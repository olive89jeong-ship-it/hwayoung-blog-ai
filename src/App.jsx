import React, { useEffect, useState } from "react";

function Button({ children, onClick, disabled, kind = "dark", className = "" }) {
  const styles = {
    dark: "bg-slate-900 text-white hover:bg-slate-700",
    blue: "bg-blue-900 text-white",
    light: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-200 bg-red-50 text-red-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[kind]} ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

const DB_NAME = "hwayoungBlogLocalDraftDB";
const STORE = "drafts";
const PREFIX = "draft_";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(id, value) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, PREFIX + id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(PREFIX + id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function dbAll() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(PREFIX + id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

const templates = [
  { id: "restaurant", label: "맛집 리뷰" },
  { id: "travel", label: "여행 후기" },
  { id: "product", label: "제품 리뷰" },
  { id: "daily", label: "일상 기록" },
];

export default function App() {
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [media, setMedia] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState("restaurant");
  const [apiKey, setApiKey] = useState("");
  const [personalPrompt, setPersonalPrompt] = useState(
    "아이는 없고, 남편과 데이트로 방문한 상황입니다. 아이 동반, 가족 나들이, 키즈 관련 내용은 제외해 주세요."
  );
  const [referenceContents, setReferenceContents] = useState(["", "", ""]);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    refreshDrafts();
  }, []);

  const refreshDrafts = async () => {
    const rows = await dbAll();
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

      reader.onload = () =>
        resolve({
          id: `${Date.now()}-${Math.random()}`,
          type: "video",
          name: file.name,
          url: reader.result,
          size: file.size,
        });

      reader.readAsDataURL(file);
    });
  };

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );

    if (!files.length) return;

    setLoading(true);

    try {
      const rows = await Promise.all(
        files.map((file) => (file.type.startsWith("image/") ? compressImage(file) : readVideo(file)))
      );

      setMedia((prev) => [...prev, ...rows]);
      setStatus(`파일 추가 완료 · ${rows.length}개`);
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    const id = `${Date.now()}`;

    const draft = {
      id,
      title: title || memo.slice(0, 20) || `임시저장 ${drafts.length + 1}`,
      memo,
      media,
      savedAt: new Date().toISOString(),
    };

    await dbPut(id, draft);
    await refreshDrafts();

    const savedCount = media.length;
    setTitle("");
    setMemo("");
    setMedia([]);
    setGenerated(null);
    setCopied(false);

    setStatus(`기기에 임시저장 완료 · 파일 ${savedCount}개 · 새 글 작성 모드로 전환`);
  };

  const loadDraft = async (id) => {
    const draft = await dbGet(id);

    if (!draft) return;

    setTitle(draft.title || "");
    setMemo(draft.memo || "");
    setMedia(draft.media || []);
    setGenerated(null);
    setStatus("기기 저장본 불러오기 완료");
  };

  const deleteDraft = async (id) => {
    await dbDelete(id);
    await refreshDrafts();
    setStatus("기기 저장본 삭제 완료");
  };

  const removeMedia = (index) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const cleanReferenceContent = (value = "") => {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500);
  };

  const referenceText = referenceContents
    .map((text, idx) => {
      const value = cleanReferenceContent(text);
      if (!value) return "";
      return `참고 콘텐츠 ${idx + 1}:\n${value}`;
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 7500);

  const buildPrompt = () => {
    const templateLabel = templates.find((t) => t.id === template)?.label || "블로그 후기";
    const imageCount = media.filter((m) => m.type === "image").length;

    return `너는 네이버 블로그 전문 에디터다.

글 유형: ${templateLabel}
사용자 메모: ${memo || "없음"}
사용자 상황 및 제외 조건: ${personalPrompt}
참고 콘텐츠:
${referenceText || "없음"}
사진 개수: ${imageCount}장

작성 규칙:
- 소제목에는 번호를 붙이지 않는다.
- 아이 동반, 키즈, 가족 나들이 내용은 쓰지 않는다.
- 남편과 데이트 방문 관점으로 쓴다.
- 참고 콘텐츠에서 위치, 가격, 메뉴, 주차, 꿀팁, 평가만 요약해서 자연스럽게 녹인다.
- iframe, 광고, 스크립트, 불필요한 HTML 내용은 무시한다.
- 그대로 베끼지 말고 새 글로 재구성한다.
- sections는 이미지 개수와 같게 만든다.
- 서론은 300자 이상, 각 사진 섹션은 150자 이상, 결론은 250자 이상으로 작성한다.

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
    setError("");
    setLoading(true);

    try {
      if (!apiKey.trim()) {
        throw new Error("OpenAI API Key를 입력하세요.");
      }

      const imageMedia = media.filter((m) => m.type === "image");

      const content = [
        { type: "text", text: buildPrompt() },
        ...imageMedia.slice(0, 20).map((m) => ({
          type: "image_url",
          image_url: { url: m.url },
        })),
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

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(raw.replaceAll("```json", "").replaceAll("```", "").trim());

      setGenerated({
        ...parsed,
        sections: imageMedia.map((img, idx) => ({
          ...(parsed.sections?.[idx] || { subtitle: `사진 ${idx + 1}`, content: "" }),
          image: img,
        })),
      });
    } catch (err) {
      setError(err.message || "생성 실패");
    } finally {
      setLoading(false);
    }
  };

  const postText = generated
    ? [
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
      ].join("\n")
    : "";

  const copyPost = async () => {
    await navigator.clipboard.writeText(postText);
    setCopied(true);
  };

  const formatBytes = (bytes = 0) => {
    if (!bytes) return "0KB";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-3">
          <div className="inline-flex rounded-full bg-white px-4 py-2 text-sm shadow-sm">
            ✨ AI 블로그 포스팅 생성기
          </div>
          <div>
            <h1 className="text-3xl font-bold sm:text-5xl">화영의블로그자동화</h1>
            <p className="mt-2 text-sm text-slate-600">
              Firebase 없이, 같은 기기 안에서 사진·동영상과 메모를 임시저장하고 AI 초안을 생성합니다.
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-6">
            <Card>
              <h2 className="mb-3 text-lg font-bold">사진·동영상 업로드</h2>
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                onDragOver={(e) => e.preventDefault()}
                className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center"
              >
                <div className="mb-2 text-2xl">⬆️</div>
                <p className="text-sm text-slate-600">사진·동영상을 추가하세요.</p>
                <p className="mt-1 text-xs text-slate-400">사진은 최대 980px로 압축됩니다.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="cursor-pointer rounded-xl bg-slate-900 p-3 text-sm font-semibold text-white">
                    갤러리에서 선택
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                  <label className="cursor-pointer rounded-xl border bg-white p-3 text-sm font-semibold">
                    카메라로 촬영
                    <input
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-lg font-bold">간단 메모 / 기기 저장</h2>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="저장 제목 예: 경주 황리단길 데이트"
                className="mb-3 w-full rounded-xl border p-3 text-sm"
              />
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="간단 메모를 입력하세요."
                className="min-h-32 w-full rounded-xl border p-3 text-sm"
              />
              <Button onClick={saveDraft} kind="blue" className="mt-3 w-full">
                기기에 임시저장
              </Button>
              {status && <p className="mt-3 text-xs text-blue-700">{status}</p>}
            </Card>

            <Card>
              <h2 className="mb-3 text-lg font-bold">기기 저장 목록</h2>
              {!drafts.length && <p className="text-sm text-slate-500">저장된 항목이 없습니다.</p>}
              <div className="space-y-2">
                {drafts.map((draft) => {
                  const mediaItems = draft.media || [];
                  const thumbs = mediaItems.slice(0, 6);

                  return (
                    <div key={draft.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{draft.title}</div>
                          <div className="mt-1 text-[11px] text-slate-500">파일 {mediaItems.length}개</div>
                        </div>

                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => loadDraft(draft.id)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                          >
                            불러오기
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDraft(draft.id)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700"
                          >
                            삭제
                          </button>
                        </div>
                      </div>

                      {!!thumbs.length && (
                        <div className="mt-2 flex gap-1 overflow-hidden">
                          {thumbs.map((item, index) => (
                            <div key={`${draft.id}-${index}`} className="h-[30px] w-[30px] overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200">
                              {item.type === "video" ? (
                                <video src={item.url} className="h-[30px] w-[30px] object-cover" muted playsInline />
                              ) : (
                                <img src={item.url} className="h-[30px] w-[30px] object-cover" alt={`저장 썸네일 ${index + 1}`} />
                              )}
                            </div>
                          ))}
                          {mediaItems.length > 6 && (
                            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                              +{mediaItems.length - 6}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-lg font-bold">AI 글 생성 설정</h2>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
                placeholder="OpenAI API Key"
                className="mb-3 w-full rounded-xl border p-3 text-sm"
              />
              <div className="mb-3 grid grid-cols-2 gap-2">
                {templates.map((t) => (
                  <Button
                    key={t.id}
                    kind={template === t.id ? "dark" : "light"}
                    onClick={() => setTemplate(t.id)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
              <p className="mb-2 text-xs leading-5 text-slate-500">
                참고 블로그 HTML을 붙여넣어도 됩니다. 단, 긴 iframe/광고 코드는 자동 제거하고 본문 일부만 AI에 전달합니다.
              </p>
              <textarea
                value={personalPrompt}
                onChange={(e) => setPersonalPrompt(e.target.value)}
                className="mb-3 min-h-24 w-full rounded-xl border p-3 text-sm"
              />
              {[0, 1, 2].map((idx) => (
                <textarea
                  key={idx}
                  value={referenceContents[idx]}
                  onChange={(e) => {
                    const next = [...referenceContents];
                    next[idx] = e.target.value;
                    setReferenceContents(next);
                  }}
                  placeholder={`참고 블로그 본문 ${idx + 1} · HTML 붙여넣기 가능, iframe/태그는 자동 제거`}
                  className="mb-2 min-h-24 w-full rounded-xl border p-3 text-sm"
                />
              ))}
              <Button onClick={generatePost} disabled={loading} className="w-full">
                AI 초안 생성
              </Button>
              {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">업로드 파일</h2>
                <span className="text-sm text-slate-500">파일 {media.length}개</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {media.map((item, index) => (
                  <div key={item.id} className="relative overflow-hidden rounded-xl bg-slate-100">
                    {item.type === "video" ? (
                      <video src={item.url} className="h-24 w-full object-cover" muted playsInline />
                    ) : (
                      <img src={item.url} className="h-24 w-full object-cover" alt={item.name} />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 px-2 text-white"
                    >
                      ×
                    </button>
                    <div className="truncate p-1 text-[11px]">
                      {item.type === "video" ? "동영상" : "사진"} {index + 1}
                    </div>
                    <div className="px-1 pb-1 text-[10px] text-slate-400">
                      {item.width ? `${item.width}×${item.height} · ${formatBytes(item.size)}` : formatBytes(item.size)}
                    </div>
                  </div>
                ))}
                {!media.length && (
                  <div className="col-span-full rounded-xl bg-slate-100 p-8 text-center text-sm text-slate-500">
                    업로드된 파일이 없습니다.
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">생성 결과</h2>
                <Button kind="light" disabled={!generated} onClick={copyPost}>
                  {copied ? "복사됨" : "전체 복사"}
                </Button>
              </div>
              {!generated && <p className="text-sm text-slate-500">아직 생성 결과가 없습니다.</p>}
              {generated && (
                <div className="space-y-5">
                  <section className="rounded-2xl bg-slate-900 p-5 text-white">
                    <h2 className="text-2xl font-bold">{generated.title}</h2>
                  </section>
                  <section>
                    <h3 className="mb-2 text-xl font-bold">서론</h3>
                    <p className="leading-7">{generated.intro}</p>
                  </section>
                  {(generated.sections || []).map((s, idx) => (
                    <section key={idx} className="rounded-2xl border p-4">
                      {s.image && (
                        <img src={s.image.url} className="mb-4 h-72 w-full rounded-xl object-cover" alt={s.subtitle} />
                      )}
                      <h3 className="mb-2 text-xl font-bold">{s.subtitle}</h3>
                      <p className="leading-7">{s.content}</p>
                    </section>
                  ))}
                  <section>
                    <h3 className="mb-2 text-xl font-bold">결론</h3>
                    <p className="leading-7">{generated.conclusion}</p>
                  </section>
                  <section>
                    <h3 className="mb-2 text-xl font-bold">태그</h3>
                    <p>{(generated.tags || []).map((t) => `#${t}`).join(" ")}</p>
                  </section>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
