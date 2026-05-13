import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

const POST_JSON = process.argv[2] || path.resolve(process.cwd(), "naver-post.json");
const USER_DATA_DIR = path.resolve(process.cwd(), "naver-chrome-profile");
const TEMP_DIR = path.resolve(process.cwd(), "temp-upload-files");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

function dataUrlToFile(dataUrl, filename) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) throw new Error("지원하지 않는 이미지 데이터입니다.");

  const ext = match[1].includes("png") ? "png" : "jpg";
  const filePath = path.join(TEMP_DIR, `${filename}.${ext}`);
  fs.writeFileSync(filePath, Buffer.from(match[2], "base64"));
  return filePath;
}

function cleanFileName(value = "image") {
  return String(value)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 50);
}

async function tryClickText(page, text) {
  const candidates = [
    page.getByText(text, { exact: true }),
    page.getByRole("button", { name: text }),
    page.locator(`text=${text}`),
  ];

  for (const locator of candidates) {
    try {
      await locator.first().click({ timeout: 1500 });
      return true;
    } catch {}
  }

  return false;
}

async function fillTitle(page, title) {
  const candidates = [
    page.getByPlaceholder("제목"),
    page.locator('[placeholder="제목"]'),
    page.locator('textarea[placeholder*="제목"]'),
    page.locator('input[placeholder*="제목"]'),
    page.locator('[contenteditable="true"]').first(),
  ];

  for (const locator of candidates) {
    try {
      await locator.click({ timeout: 2500 });
      await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await page.keyboard.type(title, { delay: 25 });
      console.log("제목 입력 완료");
      return true;
    } catch {}
  }

  console.log("제목 영역을 자동으로 찾지 못했습니다.");
  return false;
}

async function pasteHtmlToEditor(page, html) {
  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value);
  }, html);

  console.log("\n본문 입력 위치를 한 번 클릭하세요.");
  await ask("클릭 후 Enter를 누르면 HTML을 붙여넣습니다... ");

  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
  console.log("본문 붙여넣기 완료");
}

async function uploadImagesByButton(page, imageFiles) {
  if (!imageFiles.length) return false;

  console.log("사진 버튼 자동 탐색 중...");

  const clicked =
    await tryClickText(page, "사진") ||
    await tryClickText(page, "이미지") ||
    await tryClickText(page, "사진 추가");

  if (!clicked) {
    console.log("사진 버튼을 자동으로 찾지 못했습니다. 직접 사진 버튼을 눌러주세요.");
    await ask("파일 선택창이 열리기 직전 상태로 만든 뒤 Enter를 누르세요... ");
  }

  const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null);

  if (clicked) {
    // If click already opened chooser, wait below.
  }

  const chooser = await fileChooserPromise;

  if (chooser) {
    await chooser.setFiles(imageFiles);
    console.log(`사진 업로드 시도 완료: ${imageFiles.length}장`);
    return true;
  }

  const inputs = await page.locator('input[type="file"]').all();

  for (const input of inputs) {
    try {
      await input.setInputFiles(imageFiles);
      console.log(`input[type=file]로 사진 업로드 완료: ${imageFiles.length}장`);
      return true;
    } catch {}
  }

  console.log("자동 사진 업로드 실패. 네이버 화면에서 직접 사진을 올려주세요.");
  return false;
}

async function main() {
  if (!fs.existsSync(POST_JSON)) {
    console.error(`JSON 파일을 찾지 못했습니다: ${POST_JSON}`);
    process.exit(1);
  }

  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const post = JSON.parse(fs.readFileSync(POST_JSON, "utf-8"));
  const title = post.title || post.generated?.title || "블로그 글";
  const html = post.html || "";

  if (!html) {
    console.error("JSON 안에 html 값이 없습니다. 웹앱에서 '네이버 HTML 생성' 후 JSON을 다운로드하세요.");
    process.exit(1);
  }

  const imageFiles = [];
  const media = Array.isArray(post.media) ? post.media : [];

  media.forEach((item, index) => {
    if (item?.type === "image" && item.url?.startsWith("data:")) {
      imageFiles.push(dataUrlToFile(item.url, `${String(index + 1).padStart(2, "0")}_${cleanFileName(item.name || "image")}`));
    }
  });

  console.log("네이버 자동입력 준비 완료");
  console.log(`제목: ${title}`);
  console.log(`이미지 파일: ${imageFiles.length}장`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1400, height: 950 },
    permissions: ["clipboard-read", "clipboard-write"],
  });

  const page = context.pages()[0] || await context.newPage();

  console.log("\n네이버 블로그 글쓰기 페이지로 이동합니다.");
  await page.goto("https://blog.naver.com/GoBlogWrite.naver", { waitUntil: "domcontentloaded" }).catch(() => {});

  console.log("\n네이버 로그인이 필요하면 직접 로그인하세요.");
  console.log("글쓰기 화면이 완전히 뜬 뒤 진행합니다.");
  await ask("글쓰기 화면 준비 후 Enter를 누르세요... ");

  await fillTitle(page, title);

  console.log("\n대표/본문 이미지는 HTML 안에 data 이미지로도 들어가지만, 네이버에서 막힐 수 있습니다.");
  console.log("그래서 별도 사진 업로드도 시도합니다.");
  await uploadImagesByButton(page, imageFiles);

  await pasteHtmlToEditor(page, html);

  console.log("\n임시저장을 시도합니다.");
  const saved = await tryClickText(page, "임시저장") || await tryClickText(page, "저장");

  if (saved) {
    console.log("임시저장 클릭 완료. 네이버 화면에서 저장 여부를 확인하세요.");
  } else {
    console.log("임시저장 버튼을 자동으로 찾지 못했습니다. 직접 임시저장을 눌러주세요.");
  }

  console.log("\n완료. 브라우저는 확인을 위해 열어둡니다.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
