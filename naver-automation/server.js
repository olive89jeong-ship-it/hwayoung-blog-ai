
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
const PORT = 3333;

app.use(cors());
app.use(express.json({ limit: "200mb" }));

const DATA_PATH = path.resolve(process.cwd(), "latest-post.json");

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

app.listen(PORT, () => {
  console.log(`로컬 서버 실행중: http://localhost:${PORT}`);
});
