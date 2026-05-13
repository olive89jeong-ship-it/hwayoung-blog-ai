
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import readline from "readline";

const args = process.argv.slice(2);
const NO_GOTO = args.includes("--no-goto") || process.env.NAVER_AUTO_NO_GOTO === "1";
const NO_PROMPT = args.includes("--no-prompt") || process.env.NAVER_AUTO_NO_PROMPT === "1";

const explicitJson = args.find((arg) => arg.endsWith(".json"));
const POST_JSON = explicitJson || path.resolve(process.cwd(), "latest-post.json");
const USER_DATA_DIR = path.resolve(process.cwd(), "naver-chrome-profile");
const TEMP_DIR = path.resolve(process.cwd(), "temp-upload-files");

function ask(question) {
  if (NO_PROMPT) return Promise.resolve("");
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPlainText(post) {
  const generated = post.generated || {};
  const sections = Array.isArray(generated.sections) ? generated.sections : [];
  const tags = Array.isArray(generated.tags) ? generated.tags : post.tags || [];
  const lines = [];

  if (generated.intro) {
    lines.push(generated.intro.trim(), "");
  }

  sections.forEach((section) => {
    if (section.subtitle) lines.push(section.subtitle.trim());
    if (section.content) lines.push(section.content.trim());
    lines.push("");
  });

  if (generated.conclusion) {
    lines.push("총평", generated.conclusion.trim(), "");
  }

  if (tags.length) {
    lines.push(tags.map((tag) => `#${String(tag).replace(/^#/, "")}`).join(" "));
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function getContexts(page) {
  return [page, ...page.frames()];
}

async function findAndClick(page, selectors, label, timeout = 1800) {
  for (const ctx of getContexts(page)) {
    for (const selector of selectors) {
      try {
        const loc = ctx.locator(selector).first();
        await loc.waitFor({ state: "visible", timeout });
        await loc.click({ timeout });
        console.log(`${label} 클릭 성공: ${selector}`);
        await sleep(300);
        return true;
      } catch {}
    }
  }
  console.log(`${label} 클릭 실패`);
  return false;
}

async function findAndFillByKeyboard(page, selectors, text, label) {
  for (const ctx of getContexts(page)) {
    for (const selector of selectors) {
      try {
        const loc = ctx.locator(selector).first();
        await loc.waitFor({ state: "visible", timeout: 2500 });
        await loc.click({ timeout: 2500 });
        await sleep(300);
        await page.keyboard.type(text, { delay: 35 });
        console.log(`${label} 입력 완료: ${selector}`);
        return true;
      } catch {}
    }
  }
  return false;
}

async function fillTitle(page, title) {
  const selectors = [
    'p.se-text-paragraph:has(span.se-placeholder:has-text("제목"))',
    'span.se-placeholder:has-text("제목")',
    '.se-placeholder:has-text("제목")',
    '[data-a11y-title="제목"]',
    '.se-title-text',
  ];

  const ok = await findAndFillByKeyboard(page, selectors, title, "제목");
  if (!ok) {
    console.log("제목 자동 입력 실패. 제목 영역을 직접 클릭하세요.");
    await ask("제목 영역 클릭 후 Enter를 누르세요...");
    await page.keyboard.type(title, { delay: 35 });
  }
}

async function uploadByClickingButton(page, selectors, files, label) {
  if (!files?.length) {
    console.log(`${label}: 업로드할 파일 없음`);
    return false;
  }

  const chooserPromise = page.waitForEvent("filechooser", { timeout: 8000 }).catch(() => null);
  const clicked = await findAndClick(page, selectors, `${label} 버튼`, 2500);

  if (!clicked && !NO_PROMPT) {
    console.log(`${label} 버튼 자동 클릭 실패. 직접 버튼을 눌러주세요.`);
    await ask("파일 선택창이 열리기 직전 상태로 만든 뒤 Enter를 누르세요...");
  }

  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles(files);
    console.log(`${label} 파일 업로드 완료: ${files.length}개`);
    await sleep(2500);
    return true;
  }

  for (const ctx of getContexts(page)) {
    const inputs = await ctx.locator('input[type="file"]').all().catch(() => []);
    for (const input of inputs) {
      try {
        await input.setInputFiles(files);
        console.log(`${label} input[type=file] 업로드 완료: ${files.length}개`);
        await sleep(2500);
        return true;
      } catch {}
    }
  }

  console.log(`${label} 자동 업로드 실패`);
  return false;
}

async function uploadCoverImage(page, coverFile) {
  if (!coverFile) return false;
  const selectors = [
    '.se-cover-button-local-image-upload[title="내 컴퓨터에서 배경사진 첨부"]',
    '[title="내 컴퓨터에서 배경사진 첨부"]',
    '.se-cover-button-local-image-upload',
    '.se-cover-attach-button-container .se-cover-button-local-image-upload',
  ];
  return uploadByClickingButton(page, selectors, [coverFile], "대표 이미지");
}

async function uploadBodyImages(page, imageFiles) {
  const selectors = [
    'button.se-image-toolbar-button[data-name="image"]',
    'button[data-name="image"]',
    'button[data-log="dot.img"]',
    'button:has(span.se-toolbar-label:has-text("사진"))',
    'button:has-text("사진")',
    '.se-image-toolbar-button',
  ];
  return uploadByClickingButton(page, selectors, imageFiles, "본문 사진");
}

async function clickBodyEditor(page) {
  const selectors = [
    '[data-a11y-title="본문"] .se-module-text',
    '[data-a11y-title="본문"] p.se-text-paragraph',
    '.se-component.se-text[data-a11y-title="본문"]',
    '.se-module.se-module-text.__se-unit',
    'p.se-text-paragraph:has(span.se-placeholder:has-text("글감과 함께 나의 일상을 기록해보세요!"))',
    'span.se-placeholder:has-text("글감과 함께 나의 일상을 기록해보세요!")',
    '[contenteditable="true"]',
  ];

  const clicked = await findAndClick(page, selectors, "본문 영역", 2500);
  if (!clicked && !NO_PROMPT) {
    console.log("본문 자동 클릭 실패. 본문 영역을 직접 클릭하세요.");
    await ask("본문 영역 클릭 후 Enter를 누르세요...");
  }
}

async function pastePlainText(page, text) {
  await clickBodyEditor(page);
  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value);
  }, text);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
  console.log("본문 순수 텍스트 붙여넣기 완료");
  await sleep(1500);
}

async function clickTempSave(page) {
  const selectors = [
    'button.save_btn__bzc5B[data-click-area="tpb.save"]',
    'button[data-click-area="tpb.save"]',
    'button:has(span.text__bK4MD:has-text("저장"))',
    'button:has-text("저장")',
    'button:has-text("임시저장")',
    'text=저장',
  ];
  const clicked = await findAndClick(page, selectors, "저장 버튼", 2500);
  console.log(clicked ? "저장 버튼 클릭 완료" : "저장 버튼 자동 클릭 실패");
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
  const bodyText = buildPlainText(post);

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

  console.log("네이버 포스팅 자동입력 시작");
  console.log(`제목: ${title}`);
  console.log(`본문 이미지: ${imageFiles.length}장`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 950 },
    permissions: ["clipboard-read", "clipboard-write"],
  });

  const page = context.pages()[0] || await context.newPage();

  if (!NO_GOTO) {
    await page.goto("https://blog.naver.com/GoBlogWrite.naver", { waitUntil: "domcontentloaded" }).catch(() => {});
    await ask("글쓰기 화면 준비 후 Enter를 누르세요... ");
  } else {
    await page.bringToFront();
    console.log("현재 열린 자동화 브라우저의 글쓰기 화면에서 작업합니다.");
    await sleep(2500);
  }

  await fillTitle(page, title);
  await uploadCoverImage(page, coverFile);
  await uploadBodyImages(page, imageFiles);
  await pastePlainText(page, bodyText);
  await clickTempSave(page);

  console.log("완료. 네이버 화면에서 저장 여부를 확인하세요.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
