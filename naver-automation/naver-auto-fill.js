import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import readline from "readline";

const POST_JSON = process.argv[2] || path.resolve(process.cwd(), "latest-post.json");
const USER_DATA_DIR = path.resolve(process.cwd(), "naver-chrome-profile");
const TEMP_DIR = path.resolve(process.cwd(), "temp-upload-files");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
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

async function pause(ms = 500) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickFirstVisible(page, selectors, label) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: 2500 });
      await locator.click({ timeout: 2500 });
      console.log(`${label} 클릭 성공: ${selector}`);
      await pause(300);
      return true;
    } catch {}
  }

  console.log(`${label} 클릭 실패`);
  return false;
}

async function fillTitle(page, title) {
  console.log("제목 입력 시도 중...");

  const titleSelectors = [
    'p.se-text-paragraph:has(span.se-placeholder:has-text("제목"))',
    'span.se-placeholder:has-text("제목")',
    '.se-placeholder:has-text("제목")',
    '.se-title-text',
    '[data-a11y-title="제목"]',
    '[contenteditable="true"]',
  ];

  for (const selector of titleSelectors) {
    try {
      const target = page.locator(selector).first();
      await target.waitFor({ state: "visible", timeout: 3000 });
      await target.click({ timeout: 3000 });
      await pause(300);
      await page.keyboard.type(title, { delay: 35 });
      console.log("제목 입력 완료");
      return true;
    } catch {}
  }

  console.log("제목 자동 입력 실패. 제목 영역을 직접 클릭해 주세요.");
  await ask("제목 영역 클릭 후 Enter를 누르세요...");
  await page.keyboard.type(title, { delay: 35 });
  console.log("수동 위치에 제목 입력 완료");
  return false;
}

async function uploadCoverImage(page, coverFile) {
  if (!coverFile) return false;

  console.log("대표 이미지 업로드 시도 중...");

  const coverSelectors = [
    '.se-cover-button-local-image-upload[title="내 컴퓨터에서 배경사진 첨부"]',
    '.se-cover-button-local-image-upload',
    '[title="내 컴퓨터에서 배경사진 첨부"]',
  ];

  const chooserPromise = page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null);
  const clicked = await clickFirstVisible(page, coverSelectors, "대표 이미지 버튼");

  if (!clicked) {
    console.log("대표 이미지 버튼을 찾지 못했습니다. 네이버 화면에서 대표 이미지 버튼을 직접 눌러주세요.");
    await ask("파일 선택창이 열리기 직전 또는 열린 상태에서 Enter를 누르세요...");
  }

  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles(coverFile);
    console.log("대표 이미지 업로드 완료");
    await pause(1500);
    return true;
  }

  const inputs = await page.locator('input[type="file"]').all();
  for (const input of inputs) {
    try {
      await input.setInputFiles(coverFile);
      console.log("input[type=file]로 대표 이미지 업로드 완료");
      await pause(1500);
      return true;
    } catch {}
  }

  console.log("대표 이미지 자동 업로드 실패");
  return false;
}

async function uploadBodyImages(page, imageFiles) {
  if (!imageFiles.length) return false;

  console.log(`본문 사진 업로드 시도 중... ${imageFiles.length}장`);

  const imageButtonSelectors = [
    'button.se-image-toolbar-button[data-name="image"]',
    'button[data-name="image"]',
    'button[data-log="dot.img"]',
    'button:has(span.se-toolbar-label:has-text("사진"))',
    '.se-image-toolbar-button',
  ];

  const chooserPromise = page.waitForEvent("filechooser", { timeout: 7000 }).catch(() => null);
  const clicked = await clickFirstVisible(page, imageButtonSelectors, "본문 사진 버튼");

  if (!clicked) {
    console.log("사진 버튼을 찾지 못했습니다. 상단 메뉴의 사진 버튼을 직접 눌러주세요.");
    await ask("파일 선택창이 열리기 직전 또는 열린 상태에서 Enter를 누르세요...");
  }

  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles(imageFiles);
    console.log("본문 사진 업로드 완료");
    await pause(2500);
    return true;
  }

  const inputs = await page.locator('input[type="file"]').all();
  for (const input of inputs) {
    try {
      await input.setInputFiles(imageFiles);
      console.log("input[type=file]로 본문 사진 업로드 완료");
      await pause(2500);
      return true;
    } catch {}
  }

  console.log("본문 사진 자동 업로드 실패");
  return false;
}

async function clickBodyEditor(page) {
  console.log("본문 입력 영역 클릭 시도 중...");

  const bodySelectors = [
    '[data-a11y-title="본문"] .se-module-text',
    '[data-a11y-title="본문"] p.se-text-paragraph',
    '.se-component.se-text[data-a11y-title="본문"]',
    '.se-module.se-module-text.__se-unit',
    'p.se-text-paragraph:has(span.se-placeholder:has-text("글감과 함께 나의 일상을 기록해보세요!"))',
    'span.se-placeholder:has-text("글감과 함께 나의 일상을 기록해보세요!")',
  ];

  for (const selector of bodySelectors) {
    try {
      const target = page.locator(selector).first();
      await target.waitFor({ state: "visible", timeout: 3000 });
      await target.click({ timeout: 3000 });
      await pause(300);
      console.log(`본문 클릭 성공: ${selector}`);
      return true;
    } catch {}
  }

  console.log("본문 영역 자동 클릭 실패. 본문 영역을 직접 클릭하세요.");
  await ask("본문 영역 클릭 후 Enter를 누르세요...");
  return false;
}

async function pasteHtmlToEditor(page, html) {
  await clickBodyEditor(page);

  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value);
  }, html);

  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
  console.log("본문 HTML 붙여넣기 완료");
  await pause(1500);
}

async function clickTempSave(page) {
  console.log("임시저장 버튼 클릭 시도 중...");

  const selectors = [
    'button.save_btn__bzc5B[data-click-area="tpb.save"]',
    'button:has-text("임시저장")',
    'a:has-text("임시저장")',
    'button:has-text("저장")',
    '[class*="save"]:has-text("임시저장")',
    'text=임시저장',
  ];

  const clicked = await clickFirstVisible(page, selectors, "임시저장");
  if (!clicked) {
    console.log("임시저장 버튼을 찾지 못했습니다. 직접 임시저장을 눌러주세요.");
  }

  return clicked;
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

  const media = Array.isArray(post.media) ? post.media : [];

  const imageFiles = [];
  media.forEach((item, index) => {
    if (item?.type === "image" && item.url?.startsWith("data:")) {
      imageFiles.push(dataUrlToFile(item.url, `${String(index + 1).padStart(2, "0")}_${cleanFileName(item.name || "image")}`));
    }
  });

  let coverFile = null;
  if (post.titleImage?.url?.startsWith("data:")) {
    coverFile = dataUrlToFile(post.titleImage.url, "00_cover_image");
  } else if (imageFiles.length) {
    coverFile = imageFiles[0];
  }

  console.log("네이버 자동입력 준비 완료");
  console.log(`제목: ${title}`);
  console.log(`대표 이미지: ${coverFile ? "있음" : "없음"}`);
  console.log(`본문 이미지: ${imageFiles.length}장`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 950 },
    permissions: ["clipboard-read", "clipboard-write"],
  });

  const page = context.pages()[0] || await context.newPage();

  console.log("\n네이버 블로그 글쓰기 페이지로 이동합니다.");
  await page.goto("https://blog.naver.com/GoBlogWrite.naver", { waitUntil: "domcontentloaded" }).catch(() => {});

  console.log("\n네이버 로그인이 필요하면 직접 로그인하세요.");
  console.log("글쓰기 화면이 완전히 뜬 뒤 진행합니다.");
  await ask("글쓰기 화면 준비 후 Enter를 누르세요... ");

  await fillTitle(page, title);
  await uploadCoverImage(page, coverFile);
  await uploadBodyImages(page, imageFiles);
  await pasteHtmlToEditor(page, html);
  await clickTempSave(page);

  console.log("\n완료. 네이버 화면에서 내용과 임시저장 여부를 확인하세요.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
