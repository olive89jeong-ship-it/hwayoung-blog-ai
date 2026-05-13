import React, { useMemo, useState } from "react";

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl bg-white shadow-sm ${className}`}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function Button({ children, onClick, disabled, variant = "solid", className = "" }) {
  const base = "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const style = variant === "outline" ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "bg-slate-900 text-white hover:bg-slate-700";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${style} ${className}`}>
      {children}
    </button>
  );
}

const templates = [
  { id: "restaurant", label: "맛집 리뷰", guide: "방문 계기, 분위기, 메뉴, 맛, 재방문 의사 중심" },
  { id: "travel", label: "여행 후기", guide: "장소 소개, 동선, 사진 포인트, 팁 중심" },
  { id: "product", label: "제품 리뷰", guide: "사용 전 기대, 장점, 단점, 추천 대상 중심" },
  { id: "daily", label: "일상 기록", guide: "자연스러운 감상, 사진 흐름, 짧은 후기 중심" },
];

function buildMockPost({ memo, template, images }) {
  const cleanMemo = memo?.trim() || "직접 찍은 사진을 바탕으로 방문 경험을 자연스럽게 정리합니다.";
  const titleBase = cleanMemo.slice(0, 28);

  const contentRules = {
    restaurant: {
      titleTail: "솔직 방문 후기",
      intro: "사진을 보며 실제 방문 흐름에 맞춰 분위기, 메뉴, 맛, 이용 팁을 차분하게 정리해보았습니다.",
      subtitles: ["첫인상과 방문 분위기", "메뉴 구성과 주문한 음식", "직접 먹어본 맛과 만족도", "이용 전 알아두면 좋은 점"],
      tags: ["맛집후기", "방문후기", "솔직후기", "메뉴추천", "일상기록"],
    },
    travel: {
      titleTail: "사진으로 남긴 여행 기록",
      intro: "직접 찍은 사진을 중심으로 장소의 분위기와 기억에 남은 포인트를 정리했습니다.",
      subtitles: ["도착했을 때 느낀 분위기", "사진으로 남기기 좋은 포인트", "동선과 머물기 좋았던 구간", "다시 간다면 챙기고 싶은 팁"],
      tags: ["여행후기", "여행기록", "사진스팟", "여행코스", "일상기록"],
    },
    product: {
      titleTail: "직접 써본 후기",
      intro: "제품을 사용하면서 느낀 첫인상, 장점, 아쉬운 점을 사진 흐름에 맞춰 정리했습니다.",
      subtitles: ["처음 사용했을 때의 인상", "마음에 들었던 부분", "사용하면서 느낀 아쉬운 점", "추천하고 싶은 대상"],
      tags: ["제품리뷰", "사용후기", "솔직후기", "구매후기", "리뷰"],
    },
    daily: {
      titleTail: "사진으로 남긴 하루",
      intro: "평범한 하루 속에서 찍은 사진들을 중심으로 자연스럽게 기록을 남겨보았습니다.",
      subtitles: ["오늘의 분위기", "사진 속에 남은 순간", "기억에 남은 장면", "하루를 마무리하며"],
      tags: ["일상기록", "사진일기", "데일리", "블로그일상", "기록"],
    },
  };

  const rule = contentRules[template] || contentRules.daily;
  const imageSections = images.length
    ? images.map((image, index) => ({
        image,
        subtitle: rule.subtitles[index % rule.subtitles.length],
        content: `${cleanMemo}라는 메모를 기준으로 보면, 이 사진은 실제 경험을 보여주는 장면으로 활용하기 좋습니다. 보이는 요소만 나열하기보다 분위기, 이용 과정, 좋았던 점과 아쉬운 점을 함께 적으면 읽는 사람이 현장감을 느끼기 쉽습니다.`,
      }))
    : [
        {
          image: null,
          subtitle: "사진을 추가하면 장면별 본문이 생성됩니다",
          content: "사진을 업로드하면 각 이미지에 맞는 소제목과 본문 문단을 구성합니다.",
        },
      ];

  return {
    title: `${titleBase} ${rule.titleTail}`,
    intro: `${rule.intro} ${cleanMemo}라는 메모를 바탕으로 너무 광고처럼 보이지 않게, 실제 경험 중심의 문장으로 구성했습니다.`,
    sections: imageSections,
    conclusion: "전체적으로 사진과 메모를 함께 보니 기록으로 남길 만한 포인트가 분명했습니다. 처음 접하는 분들도 분위기와 이용 흐름을 쉽게 이해할 수 있도록 정리했고, 실제 방문이나 선택 전에 참고하기 좋은 후기 형태로 마무리했습니다.",
    tags: rule.tags,
  };
}

export default function App() {
  const [memo, setMemo] = useState("");
  const [template, setTemplate] = useState("restaurant");
  const [images, setImages] = useState([]);
  const [generated, setGenerated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [aiMode, setAiMode] = useState("balanced");
  const [includeSeo, setIncludeSeo] = useState(true);
  const [includeEmotion, setIncludeEmotion] = useState(true);
  const [naverReady, setNaverReady] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [useRealAi, setUseRealAi] = useState(false);
  const [referenceContents, setReferenceContents] = useState(["", "", ""]);
  const [personalPrompt, setPersonalPrompt] = useState("아이는 없고, 남편과 데이트로 방문한 상황입니다. 아이 동반, 가족 나들이, 키즈 관련 내용은 제외해 주세요.");
  const [isProcessingImages, setIsProcessingImages] = useState(false);

  const previewImages = useMemo(() => images, [images]);
  const combinedReferenceContent = referenceContents
    .map((item, index) => {
      const text = item.trim();
      if (!text) return "";
      return [`참고 콘텐츠 ${index + 1}:`, text].join(String.fromCharCode(10));
    })
    .filter(Boolean)
    .join(String.fromCharCode(10) + String.fromCharCode(10));

  const compressImage = (file, maxSize = 1280, quality = 0.78) => {
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
          resolve({ name: file.name, url, originalSize: file.size, width, height });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const readImageFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;

    setIsProcessingImages(true);
    try {
      const items = await Promise.all(files.map((file) => compressImage(file)));
      setImages((current) => [...current, ...items]);
      setGenerated(null);
      setNaverReady(false);
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleFiles = (event) => {
    readImageFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    readImageFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const removeImage = (targetIndex) => {
    setImages((current) => current.filter((_, index) => index !== targetIndex));
    setGenerated(null);
    setNaverReady(false);
  };

  const buildAdvancedPrompt = () => {
    const templateLabel = templates.find((item) => item.id === template)?.label || "블로그 후기";

    return `너는 네이버 블로그 전문 에디터다.

목표:
- 사용자가 직접 찍은 사진과 메모를 바탕으로 네이버 블로그 초안을 작성한다.
- 광고글처럼 보이지 않게 실제 사람이 쓴 후기처럼 작성한다.
- 소제목에는 숫자, 1., 2., 3. 같은 번호를 절대 붙이지 않는다.
- 사진 순서에 맞춰 본문 섹션을 구성한다.
- 문장은 너무 딱딱하지 않게 자연스럽게 작성한다.

글 유형: ${templateLabel}
작성 스타일: ${aiMode}
검색 노출 키워드 강화: ${includeSeo ? "예" : "아니오"}
감성 문장 추가: ${includeEmotion ? "예" : "아니오"}
사용자 상황 및 제외 조건: ${personalPrompt || "없음"}
사용자 메모: ${memo || "메모 없음"}
사진 개수: ${previewImages.length}장
참고 콘텐츠:
${combinedReferenceContent || "참고 콘텐츠 없음"}

작성 품질 기준:
- 참고 콘텐츠 최대 3개의 공통 정보와 차이점을 비교해 위치, 주소, 영업시간, 가격, 메뉴, 주차, 동선, 꿀팁, 장단점, 평가를 자연스럽게 녹인다.
- 사용자 상황 및 제외 조건을 반드시 지킨다. 아이가 없고 남편과 데이트 방문이라면 아이 동반, 육아, 가족 나들이, 키즈 관련 내용은 쓰지 않는다.
- 참고 콘텐츠를 그대로 베끼지 말고, 사용자의 사진과 메모에 맞춰 새 글로 재구성한다.
- 본문은 빈약하지 않게 작성한다. 서론 500자 내외, 각 사진 섹션 250자 이상, 결론 400자 내외로 작성한다.
- sections 배열 개수는 반드시 사진 개수와 같게 만든다.
- 사진이 19장이면 sections도 19개를 만든다.
- 각 section은 해당 순서의 사진을 설명하는 소제목과 본문이어야 한다.

반드시 아래 JSON 형식으로만 답변한다.
{
  "title": "제목",
  "intro": "서론 문단",
  "sections": [
    { "subtitle": "소제목", "content": "본문 문단" }
  ],
  "conclusion": "결론 문단",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}`;
  };

  const extractJsonText = (text) => text.split("```json").join("").split("```").join("").trim();

  const generateWithOpenAI = async () => {
    if (!apiKey.trim()) {
      throw new Error("OpenAI API Key를 입력해야 실제 AI 생성이 가능합니다.");
    }

    const content = [
      { type: "text", text: buildAdvancedPrompt() },
      ...previewImages.slice(0, 20).map((image) => ({
        type: "image_url",
        image_url: { url: image.url },
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
      const errorText = await response.text();
      throw new Error(errorText || "AI 생성 요청에 실패했습니다.");
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(extractJsonText(text));

    return {
      ...parsed,
      sections: previewImages.map((image, index) => {
        const section = parsed.sections?.[index] || {
          subtitle: `사진 ${index + 1}에 담긴 장면`,
          content: "이 사진은 업로드한 순서에 맞춰 본문에 포함됩니다. AI가 충분한 섹션을 만들지 못한 경우에도 사진이 누락되지 않도록 기본 문단을 추가합니다.",
        };
        return { ...section, image };
      }),
      tags: parsed.tags || [],
    };
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setAiError("");

    try {
      const post = useRealAi ? await generateWithOpenAI() : buildMockPost({ memo, template, images: previewImages });
      setGenerated(post);
      setCopied(false);
      setNaverReady(true);
    } catch (error) {
      setAiError(error.message || "초안 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const plainText = generated
    ? [generated.title, "", "서론", generated.intro, "", ...generated.sections.flatMap((section) => [section.subtitle, section.content, ""]), "결론", generated.conclusion, "", "태그", generated.tags.map((tag) => `#${tag}`).join(" ")].join(String.fromCharCode(10))
    : "";

  const copyPost = async () => {
    if (!plainText) return;
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-sm"><span className="text-base">✨</span>AI 블로그 포스팅 생성기 MVP</div>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">화영의블로그자동화</h1>
              <p className="mt-3 text-base text-slate-600">사진과 메모를 바탕으로 네이버 블로그용 초안을 생성합니다. 검수 후 임시저장하는 흐름을 기준으로 설계합니다.</p>
            </div>
            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-4 text-sm text-slate-600"><div className="flex items-start gap-3"><span className="mt-0.5 text-lg">💾</span><p>2단계는 실제 AI 사진 분석 연결입니다. 네이버 자동입력은 다음 단계에서 붙입니다.</p></div></CardContent></Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-2 text-lg font-semibold"><span className="text-lg">📷</span>입력 정보</div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">사진 업로드</span>
                <div onDrop={handleDrop} onDragOver={handleDragOver} className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-5 text-center transition hover:border-slate-400 hover:bg-slate-50">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl">⬆️</div>
                  <p className="text-sm text-slate-600">사진을 드래그앤드롭하거나 모바일에서 바로 추가하세요.</p>
                  <p className="mt-1 text-xs text-slate-400">업로드 시 자동으로 1280px 기준 압축해서 속도와 비용을 줄입니다.</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <label className="cursor-pointer rounded-xl border bg-slate-900 p-3 text-sm font-semibold text-white">갤러리에서 선택<input type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" /></label>
                    <label className="cursor-pointer rounded-xl border bg-white p-3 text-sm font-semibold text-slate-700">카메라로 촬영<input type="file" accept="image/*" capture="environment" onChange={handleFiles} className="hidden" /></label>
                  </div>
                  {isProcessingImages && <p className="mt-3 text-xs text-slate-500">사진을 압축해서 추가하는 중입니다...</p>}
                </div>
              </label>

              <div><span className="mb-2 block text-sm font-medium">글 유형</span><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{templates.map((item) => (<button key={item.id} type="button" onClick={() => setTemplate(item.id)} className={`rounded-xl border p-3 text-left text-sm transition ${template === item.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}><div className="font-semibold">{item.label}</div><div className={`mt-1 text-xs ${template === item.id ? "text-slate-200" : "text-slate-500"}`}>{item.guide}</div></button>))}</div></div>

              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div><div className="text-sm font-semibold">AI 작성 스타일</div><div className="text-xs text-slate-500">실제 블로그 느낌에 가까운 스타일 설정</div></div>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setAiMode("balanced")} className={`rounded-xl border p-2 text-sm ${aiMode === "balanced" ? "bg-slate-900 text-white" : "bg-white"}`}>균형형</button>
                  <button type="button" onClick={() => setAiMode("seo")} className={`rounded-xl border p-2 text-sm ${aiMode === "seo" ? "bg-slate-900 text-white" : "bg-white"}`}>노출형</button>
                  <button type="button" onClick={() => setAiMode("emotional")} className={`rounded-xl border p-2 text-sm ${aiMode === "emotional" ? "bg-slate-900 text-white" : "bg-white"}`}>감성형</button>
                </div>
                <div className="space-y-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={includeSeo} onChange={() => setIncludeSeo(!includeSeo)} />검색 노출 키워드 강화</label><label className="flex items-center gap-2"><input type="checkbox" checked={includeEmotion} onChange={() => setIncludeEmotion(!includeEmotion)} />사람 후기 같은 감성 문장 추가</label></div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={useRealAi} onChange={() => setUseRealAi(!useRealAi)} />실제 AI API로 사진 분석하기</label><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="OpenAI API Key 입력" disabled={!useRealAi} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-slate-900 disabled:opacity-50" /><p className="text-xs leading-5 text-slate-500">테스트용 프론트 연결입니다. 실제 배포 시에는 API Key가 노출되지 않도록 서버 또는 Firebase Functions로 분리해야 합니다. 사진은 최대 20장까지 AI에 전달합니다.</p></div>

              <div className="space-y-3"><div><span className="mb-2 block text-sm font-medium">참고 블로그 콘텐츠</span><p className="mb-3 text-xs leading-5 text-slate-500">최대 3개까지 입력할 수 있습니다. 링크보다 본문 HTML 또는 본문 텍스트가 좋습니다.</p></div>{[0, 1, 2].map((index) => (<label key={index} className="block"><span className="mb-2 block text-xs font-medium text-slate-500">참고 콘텐츠 {index + 1}</span><textarea value={referenceContents[index]} onChange={(event) => { const next = [...referenceContents]; next[index] = event.target.value; setReferenceContents(next); }} placeholder={`관련 블로그 본문 텍스트 또는 HTML div ${index + 1}`} className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm outline-none focus:border-slate-900" /></label>))}</div>

              <label className="block"><span className="mb-2 block text-sm font-medium">내 상황 / 제외할 내용 프롬프트</span><textarea value={personalPrompt} onChange={(event) => setPersonalPrompt(event.target.value)} placeholder="예: 아이는 없고 남편과 데이트로 방문했습니다. 아이 동반, 키즈, 가족 나들이 내용은 제외해 주세요." className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm outline-none focus:border-slate-900" /></label>

              <label className="block"><span className="mb-2 block text-sm font-medium">간단 메모</span><textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="예: 경주 한우물회 먹고 왔고, 시원하고 양이 많았음. 주차는 조금 불편했음." className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm outline-none focus:border-slate-900" /></label>

              <Button onClick={handleGenerate} disabled={isGenerating || isProcessingImages} className="w-full rounded-2xl py-6 text-base"><span className="mr-2">✨</span>{isGenerating ? "생성 중..." : "블로그 초안 생성"}</Button>
              {aiError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{aiError}</div>}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-lg font-semibold"><span className="text-lg">🖼️</span>업로드 사진</div><span className="text-sm text-slate-500">{previewImages.length}장</span></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">{previewImages.length ? previewImages.map((image, index) => (<div key={`${image.name}-${index}`} className="relative overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200"><img src={image.url} alt={`업로드 사진 ${index + 1}`} className="h-20 w-full object-cover sm:h-24" /><button type="button" onClick={() => removeImage(index)} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white" aria-label="사진 삭제">×</button><div className="truncate p-1.5 text-[11px] text-slate-500">사진 {index + 1}</div>{image.width && <div className="px-1.5 pb-1 text-[10px] text-slate-400">{image.width}×{image.height}</div>}</div>)) : (<div className="col-span-full rounded-2xl bg-slate-100 p-8 text-center text-sm text-slate-500">아직 업로드한 사진이 없습니다.</div>)}</div></CardContent></Card>

            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="space-y-5 p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-lg font-semibold"><span className="text-lg">📄</span>생성 결과</div><Button variant="outline" onClick={copyPost} disabled={!generated} className="rounded-xl"><span className="mr-2">📋</span>{copied ? "복사됨" : "전체 복사"}</Button></div>{naverReady && (<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">네이버 스마트에디터 자동입력 준비 단계입니다. 다음 단계에서는 제목 입력 → 사진 업로드 → 본문 입력 → 임시저장 자동화를 연결합니다.</div>)}{generated ? (<div className="space-y-5"><section className="rounded-2xl bg-slate-900 p-5 text-white"><div className="mb-2 flex items-center gap-2 text-sm text-slate-300"><span>🧩</span>타이틀 영역</div><h2 className="text-2xl font-bold">{generated.title}</h2>{previewImages[0] && <img src={previewImages[0].url} alt="제목 사진" className="mt-4 h-56 w-full rounded-2xl object-cover" />}</section><section className="rounded-2xl bg-white p-5 ring-1 ring-slate-100"><h3 className="mb-2 text-xl font-bold">서론</h3><p className="leading-7 text-slate-700">{generated.intro}</p></section>{generated.sections.map((section, index) => (<section key={index} className="rounded-2xl bg-white p-4 ring-1 ring-slate-100 sm:p-5">{section.image && <img src={section.image.url} alt={section.subtitle} className="mb-4 h-56 w-full rounded-2xl object-cover sm:h-72" />}<h3 className="mb-2 text-xl font-bold">{section.subtitle}</h3><p className="leading-7 text-slate-700">{section.content}</p></section>))}<section className="rounded-2xl bg-white p-5 ring-1 ring-slate-100"><h3 className="mb-2 text-xl font-bold">결론</h3><p className="leading-7 text-slate-700">{generated.conclusion}</p></section><section className="rounded-2xl bg-white p-5 ring-1 ring-slate-100"><div className="mb-3 flex items-center gap-2 text-lg font-semibold"><span className="text-lg">#</span>태그</div><div className="flex flex-wrap gap-2">{generated.tags.map((tag) => (<span key={tag} className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">#{tag}</span>))}</div></section></div>) : (<div className="rounded-2xl bg-slate-100 p-10 text-center text-sm text-slate-500">사진과 메모를 입력한 뒤 초안을 생성하세요.</div>)}</CardContent></Card>
          </div>
        </div>
      </div>
    </div>
  );
}
