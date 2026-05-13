import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, query, orderBy } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;
let storage;
let db;

function getFirebase() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.storageBucket) {
    throw new Error("Firebase 환경변수가 없습니다. Vercel Environment Variables를 설정하세요.");
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    storage = getStorage(app);
    db = getFirestore(app);
  }
  return { storage, db };
}

const DB_NAME = "hwayoungBlogDraftDB";
const STORE = "drafts";
const PREFIX = "draft_";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(id, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, PREFIX + id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(PREFIX + id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(PREFIX + id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function Button({ children, onClick, disabled, kind = "dark", className = "" }) {
  const styles = {
    dark: "bg-slate-900 text-white hover:bg-slate-700",
    blue: "bg-blue-900 text-white",
    green: "bg-emerald-900 text-white",
    light: "border border-slate-200 bg-white text-slate-700",
    danger: "border border-red-200 bg-red-50 text-red-700",
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${styles[kind]} ${className}`}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

const templates = [
  { id: "restaurant", label: "맛집 리뷰" },
  { id: "travel", label: "여행 후기" },
  { id: "product", label: "제품 리뷰" },
  { id: "daily", label: "일상 기록" },
];

export default function App() {
  const [mode, setMode] = useState("mobile");
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [media, setMedia] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [status, setStatus] = useState("");
  const [cloudCode, setCloudCode] = useState("hwayoung");
  const [cloudDrafts, setCloudDrafts] = useState([]);
  const [cloudStatus, setCloudStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [template, setTemplate] = useState("restaurant");
  const [referenceContents, setReferenceContents] = useState(["", "", ""]);
  const [personalPrompt, setPersonalPrompt] = useState("아이는 없고, 남편과 데이트로 방문한 상황입니다. 아이 동반, 가족 나들이, 키즈 관련 내용은 제외해 주세요.");
  const [generated, setGenerated] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [aiError, setAiError] = useState("");
  const [copied, setCopied] = useState(false);

  const imageCount = media.filter((m) => m.type === "image").length;
  const videoCount = media.filter((m) => m.type === "video").length;

  useEffect(() => {
    refreshLocalDrafts();
  }, []);

  const refreshLocalDrafts = async () => {
    const rows = await idbAll();
    setDrafts(rows.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)));
  };

  const compressImage = (file, maxSize = 980, quality = 0.62) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const width = Math.round(img.width * scale);
          const height = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const url = canvas.toDataURL("image/jpeg", quality);
          resolve({
            id: `${Date.now()}-${Math.random()}`,
            type: "image",
            name: file.name,
            url,
            width,
            height,
            originalSize: file.size,
            size: Math.round((url.length * 3) / 4),
          });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const readVideo = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: `${Date.now()}-${Math.random()}`,
        type: "video",
        name: file.name,
        url: reader.result,
        originalSize: file.size,
      });
      reader.readAsDataURL(file);
    });
  };

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (!files.length) return;
    setLoading(true);
    try {
      const rows = await Promise.all(files.map((file) => file.type.startsWith("image/") ? compressImage(file) : readVideo(file)));
      setMedia((prev) => [...prev, ...rows]);
      setStatus(`파일 추가 완료 · 사진 ${rows.filter((r) => r.type === "image").length}장 · 동영상 ${rows.filter((r) => r.type === "video").length}개`);
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  const onDrop = (event) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  const saveLocalDraft = async () => {
    const id = `${Date.now()}`;
    const draft = {
      id,
      title: title || memo.slice(0, 20) || `임시저장 ${drafts.length + 1}`,
      memo,
      media,
      savedAt: new Date().toISOString(),
    };
    await idbPut(id, draft);
    await refreshLocalDrafts();
    setStatus(`기기에 임시저장 완료 · 사진 ${imageCount}장 · 동영상 ${videoCount}개`);
  };

  const loadLocalDraft = async (id) => {
    const draft = await idbGet(id);
    if (!draft) return;
    setTitle(draft.title || "");
    setMemo(draft.memo || "");
    setMedia(draft.media || []);
    setStatus("기기 저장본 불러오기 완료");
  };

  const deleteLocalDraft = async (id) => {
    await idbDelete(id);
    await refreshLocalDrafts();
    setStatus("기기 저장본 삭제 완료");
  };

  const uploadCloud = async () => {
    if (!memo.trim() && !media.length) {
      setCloudStatus("업로드할 내용이 없습니다.");
      return;
    }
    setLoading(true);
    setCloudStatus("클라우드 업로드 중...");
    try {
      const { storage, db } = getFirebase();
      const id = `${Date.now()}`;
      const code = (cloudCode || "hwayoung").trim();
      const uploaded = [];
      for (let i = 0; i < media.length; i += 1) {
        const item = media[i];
        const ext = item.type === "video" ? "mp4" : "jpg";
        const path = `blog-drafts/${code}/${id}/${i + 1}-${item.id}.${ext}`;
        const ref = storageRef(storage, path);
        await uploadString(ref, item.url, "data_url");
        const url = await getDownloadURL(ref);
        uploaded.push({ ...item, url, cloudPath: path });
      }
      const draft = {
        id,
        code,
        title: title || memo.slice(0, 20) || `클라우드 저장 ${id}`,
        memo,
        media: uploaded,
        savedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "blogDraftGroups", code, "drafts", id), draft);
      setCloudStatus("클라우드 업로드 완료");
      await loadCloudList();
    } catch (err) {
      setCloudStatus(err.message || "클라우드 업로드 실패");
    } finally {
      setLoading(false);
    }
  };

  const loadCloudList = async () => {
    setLoading(true);
    setCloudStatus("클라우드 목록 불러오는 중...");
    try {
      const { db } = getFirebase();
      const code = (cloudCode || "hwayoung").trim();
      const q = query(collection(db, "blogDraftGroups", code, "drafts"), orderBy("savedAt", "desc"));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => d.data());
      setCloudDrafts(rows);
      setCloudStatus(`클라우드 저장본 ${rows.length}개`);
    } catch (err) {
      setCloudStatus(err.message || "클라우드 목록 실패");
    } finally {
      setLoading(false);
    }
  };

  const loadCloudDraft = async (id) => {
    setLoading(true);
    try {
      const { db } = getFirebase();
      const code = (cloudCode || "hwayoung").trim();
      const snap = await getDoc(doc(db, "blogDraftGroups", code, "drafts", id));
      if (!snap.exists()) {
        setCloudStatus("저장본을 찾지 못했습니다.");
        return;
      }
      const draft = snap.data();
      setTitle(draft.title || "");
      setMemo(draft.memo || "");
      setMedia(draft.media || []);
      setCloudStatus("클라우드 저장본 불러오기 완료");
    } catch (err) {
      setCloudStatus(err.message || "클라우드 불러오기 실패");
    } finally {
      setLoading(false);
    }
  };

  const removeMedia = (index) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const referenceText = referenceContents
    .map((text, idx) => text.trim() ? `참고 콘텐츠 ${idx + 1}:\n${text.trim()}` : "")
    .filter(Boolean)
    .join("\n\n");

  const buildPrompt = () => {
    const templateLabel = templates.find((t) => t.id === template)?.label || "블로그 후기";
    return `너는 네이버 블로그 전문 에디터다.

글 유형: ${templateLabel}
사용자 메모: ${memo || "없음"}
사용자 상황 및 제외 조건: ${personalPrompt}
참고 콘텐츠:
${referenceText || "없음"}

사진 개수: ${media.filter((m) => m.type === "image").length}

작성 규칙:
- 소제목에는 번호를 붙이지 않는다.
- 아이 동반, 키즈, 가족 나들이 내용은 쓰지 않는다.
- 남편과 데이트 방문 관점으로 쓴다.
- 참고 콘텐츠의 위치, 가격, 메뉴, 주차, 꿀팁, 평가를 자연스럽게 녹인다.
- 그대로 베끼지 말고 새 글로 재구성한다.
- 서론 500자 내외, 각 섹션 250자 이상, 결론 400자 내외.
- sections는 이미지 개수와 같게 만든다.

JSON만 반환:
{
  "title": "제목",
  "intro": "서론",
  "sections": [{ "subtitle": "소제목", "content": "본문" }],
  "conclusion": "결론",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}`;
  };

  const generatePost = async () => {
    setAiError("");
    setLoading(true);
    try {
      if (!apiKey.trim()) throw new Error("OpenAI API Key를 입력하세요.");
      const imageMedia = media.filter((m) => m.type === "image");
      const content = [
        { type: "text", text: buildPrompt() },
        ...imageMedia.slice(0, 20).map((m) => ({ type: "image_url", image_url: { url: m.url } })),
      ];
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content }],
          temperature: 0.8,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(text.replaceAll("```json", "").replaceAll("```", "").trim());
      const withMedia = {
        ...parsed,
        sections: imageMedia.map((img, idx) => ({ ...(parsed.sections?.[idx] || { subtitle: `사진 ${idx + 1}`, content: "" }), image: img })),
      };
      setGenerated(withMedia);
    } catch (err) {
      setAiError(err.message || "생성 실패");
    } finally {
      setLoading(false);
    }
  };

  const postText = generated ? [
    generated.title,
    "",
    "서론",
    generated.intro,
    "",
    ...(generated.sections || []).flatMap((s) => [s.subtitle, s.content, ""]),
    "결론",
    generated.conclusion,
    "",
    "태그",
    (generated.tags || []).map((t) => `#${t}`).join(" "),
  ].join("\n") : "";

  const copyPost = async () => {
    await navigator.clipboard.writeText(postText);
    setCopied(true);
  };

  const formatBytes = (bytes = 0) => {
    if (!bytes) return "0KB";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const mobileOnly = mode === "mobile";

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-3">
          <div className="inline-flex rounded-full bg-white px-4 py-2 text-sm shadow-sm">✨ AI 블로그 포스팅 생성기</div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold sm:text-5xl">화영의블로그자동화</h1>
              <p className="mt-2 text-sm text-slate-600">모바일 저장 → 와이파이 업로드 → PC 불러오기 → AI 초안 생성</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button kind={mode === "mobile" ? "dark" : "light"} onClick={() => setMode("mobile")}>모바일 저장</Button>
              <Button kind={mode === "editor" ? "dark" : "light"} onClick={() => setMode("editor")}>전체 편집</Button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-6">
            <Card>
              <h2 className="mb-3 text-lg font-bold">사진·동영상 업로드</h2>
              <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()} className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center">
                <div className="mb-2 text-2xl">⬆️</div>
                <p className="text-sm text-slate-600">사진·동영상을 추가하세요.</p>
                <p className="mt-1 text-xs text-slate-400">사진은 최대 980px로 압축됩니다.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="cursor-pointer rounded-xl bg-slate-900 p-3 text-sm font-semibold text-white">
                    갤러리에서 선택
                    <input type="file" accept="image/*,video/*" multiple onChange={onFileChange} className="hidden" />
                  </label>
                  <label className="cursor-pointer rounded-xl border bg-white p-3 text-sm font-semibold">
                    카메라로 촬영
                    <input type="file" accept="image/*,video/*" capture="environment" onChange={onFileChange} className="hidden" />
                  </label>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-lg font-bold">간단 메모</h2>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="저장 제목 예: 경주 황리단길 데이트" className="mb-3 w-full rounded-xl border p-3 text-sm" />
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="간단 메모를 입력하세요." className="min-h-32 w-full rounded-xl border p-3 text-sm" />
              <Button onClick={saveLocalDraft} kind="blue" className="mt-3 w-full">기기에 임시저장</Button>
              {status && <p className="mt-3 text-xs text-blue-700">{status}</p>}
            </Card>

            <Card>
              <h2 className="mb-3 text-lg font-bold">기기 저장 목록</h2>
              {!drafts.length && <p className="text-sm text-slate-500">저장된 항목이 없습니다.</p>}
              <div className="space-y-2">
                {drafts.map((draft) => (
                  <div key={draft.id} className="rounded-xl border p-3">
                    <div className="font-semibold">{draft.title}</div>
                    <div className="text-xs text-slate-500">파일 {(draft.media || []).length}개</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button kind="light" onClick={() => loadLocalDraft(draft.id)}>불러오기</Button>
                      <Button kind="danger" onClick={() => deleteLocalDraft(draft.id)}>삭제</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-lg font-bold">와이파이 업로드 / PC 불러오기</h2>
              <input value={cloudCode} onChange={(e) => setCloudCode(e.target.value)} placeholder="공유 코드" className="mb-3 w-full rounded-xl border p-3 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <Button kind="green" disabled={loading} onClick={uploadCloud}>와이파이 업로드</Button>
                <Button kind="light" disabled={loading} onClick={loadCloudList}>웹에서 불러오기</Button>
              </div>
              {cloudStatus && <p className="mt-3 text-xs text-emerald-700">{cloudStatus}</p>}
              <div className="mt-4 space-y-2">
                {cloudDrafts.map((draft) => (
                  <div key={draft.id} className="rounded-xl border p-3">
                    <div className="font-semibold">{draft.title}</div>
                    <div className="text-xs text-slate-500">파일 {(draft.media || []).length}개</div>
                    <Button kind="light" className="mt-2 w-full" onClick={() => loadCloudDraft(draft.id)}>이 저장본 불러오기</Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">업로드 파일</h2>
                <span className="text-sm text-slate-500">사진 {imageCount}장 · 동영상 {videoCount}개</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {media.map((item, index) => (
                  <div key={item.id} className="relative overflow-hidden rounded-xl bg-slate-100">
                    {item.type === "video" ? (
                      <video src={item.url} className="h-24 w-full object-cover" muted playsInline />
                    ) : (
                      <img src={item.url} className="h-24 w-full object-cover" alt={item.name} />
                    )}
                    <button onClick={() => removeMedia(index)} className="absolute right-1 top-1 rounded-full bg-black/70 px-2 text-white">×</button>
                    <div className="truncate p-1 text-[11px]">{item.type === "video" ? "동영상" : "사진"} {index + 1}</div>
                    <div className="px-1 pb-1 text-[10px] text-slate-400">{item.width ? `${item.width}×${item.height} · ${formatBytes(item.size)}` : formatBytes(item.originalSize)}</div>
                  </div>
                ))}
                {!media.length && <div className="col-span-full rounded-xl bg-slate-100 p-8 text-center text-sm text-slate-500">업로드된 파일이 없습니다.</div>}
              </div>
            </Card>

            {!mobileOnly && (
              <>
                <Card>
                  <h2 className="mb-3 text-lg font-bold">AI 글 생성 설정</h2>
                  <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="OpenAI API Key" className="mb-3 w-full rounded-xl border p-3 text-sm" />
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {templates.map((t) => <Button key={t.id} kind={template === t.id ? "dark" : "light"} onClick={() => setTemplate(t.id)}>{t.label}</Button>)}
                  </div>
                  <textarea value={personalPrompt} onChange={(e) => setPersonalPrompt(e.target.value)} className="mb-3 min-h-24 w-full rounded-xl border p-3 text-sm" />
                  {[0, 1, 2].map((idx) => (
                    <textarea key={idx} value={referenceContents[idx]} onChange={(e) => {
                      const next = [...referenceContents];
                      next[idx] = e.target.value;
                      setReferenceContents(next);
                    }} placeholder={`참고 블로그 본문 ${idx + 1}`} className="mb-2 min-h-24 w-full rounded-xl border p-3 text-sm" />
                  ))}
                  <Button onClick={generatePost} disabled={loading} className="w-full">AI 초안 생성</Button>
                  {aiError && <p className="mt-3 text-xs text-red-700">{aiError}</p>}
                </Card>

                <Card>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-bold">생성 결과</h2>
                    <Button kind="light" disabled={!generated} onClick={copyPost}>{copied ? "복사됨" : "전체 복사"}</Button>
                  </div>
                  {!generated && <p className="text-sm text-slate-500">아직 생성 결과가 없습니다.</p>}
                  {generated && (
                    <div className="space-y-5">
                      <section className="rounded-2xl bg-slate-900 p-5 text-white">
                        <h2 className="text-2xl font-bold">{generated.title}</h2>
                      </section>
                      <section><h3 className="mb-2 text-xl font-bold">서론</h3><p className="leading-7">{generated.intro}</p></section>
                      {(generated.sections || []).map((s, idx) => (
                        <section key={idx} className="rounded-2xl border p-4">
                          {s.image && <img src={s.image.url} className="mb-4 h-72 w-full rounded-xl object-cover" alt={s.subtitle} />}
                          <h3 className="mb-2 text-xl font-bold">{s.subtitle}</h3>
                          <p className="leading-7">{s.content}</p>
                        </section>
                      ))}
                      <section><h3 className="mb-2 text-xl font-bold">결론</h3><p className="leading-7">{generated.conclusion}</p></section>
                      <section><h3 className="mb-2 text-xl font-bold">태그</h3><p>{(generated.tags || []).map((t) => `#${t}`).join(" ")}</p></section>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}