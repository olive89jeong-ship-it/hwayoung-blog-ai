
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { chromium } from "playwright";

const app = express();
const PORT = 3333;
const DATA_PATH = path.resolve(process.cwd(), "latest-post.json");
const USER_DATA_DIR = path.resolve(process.cwd(), "naver-chrome-profile");

let browserContext = null;

app.use(cors());
app.use(express.json({ limit: "200mb" }));

async function getBrowserContext() {
  if (!browserContext) {
    browserContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      viewport: { width: 1440, height: 950 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
  }
  return browserContext;
}

app.get("/status", (req, res) => {
  res.json({
    ok: true,
    message: "로컬 서버 실행중",
    hasPost: fs.existsSync(DATA_PATH),
  });
});

app.post("/receive-post", (req, res) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(req.body, null, 2), "utf-8");
  console.log("새 포스트 수신 완료");
  res.json({ ok: true });
});

app.get("/latest-post", (req, res) => {
  if (!fs.existsSync(DATA_PATH)) {
    return res.status(404).json({ error: "no_post" });
  }
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  res.json(data);
});

app.post("/open-browser", async (req, res) => {
  try {
    const context = await getBrowserContext();
    let page = context.pages()[0] || await context.newPage();

    if (req.query.write === "1") {
      await page.goto("https://blog.naver.com/GoBlogWrite.naver", { waitUntil: "domcontentloaded" }).catch(() => {});
    }

    await page.bringToFront();
    res.json({ ok: true, message: "자동화 브라우저를 열었습니다. 이 브라우저에서 네이버 로그인 후 글쓰기 화면을 준비하세요." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/run-automation", async (req, res) => {
  if (!fs.existsSync(DATA_PATH)) {
    return res.status(404).json({ ok: false, error: "latest-post.json이 없습니다. 먼저 웹앱에서 자동입력으로 보내기를 누르세요." });
  }

  const child = spawn(process.execPath, ["naver-auto-fill.js", "--no-goto", "--no-prompt"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NAVER_AUTO_NO_GOTO: "1",
      NAVER_AUTO_NO_PROMPT: "1",
    },
    shell: false,
  });

  child.stdout.on("data", (data) => {
    console.log(`[auto] ${data.toString().trim()}`);
  });

  child.stderr.on("data", (data) => {
    console.error(`[auto-error] ${data.toString().trim()}`);
  });

  child.on("close", (code) => {
    console.log(`자동입력 종료: ${code}`);
  });

  res.json({ ok: true, message: "자동입력을 시작했습니다. 자동화 브라우저 화면을 확인하세요." });
});

app.listen(PORT, () => {
  console.log(`로컬 서버 실행중: http://localhost:${PORT}`);
  console.log("웹앱에서 '자동화 브라우저 열기' 또는 'HTML 생성 + 자동입력으로 보내기'를 누르세요.");
});
