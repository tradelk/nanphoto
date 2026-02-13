"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuthRequired } from "../components/AuthGuard";
import AppNav from "../components/AppNav";

const PRO_STYLES = {
  bg: "#f8f9fc",
  panel: "#eef0f5",
  border: "#dde0e8",
  tabActive: "linear-gradient(90deg, #7c3aed 0%, #2563eb 100%)",
  tabInactive: "#fff",
  text: "#1e293b",
  textSoft: "#64748b",
  accent: "#7c3aed",
};

type TabId = "text-to-image" | "image-to-image" | "edit" | "infographic" | "text-rendering";

const TABS: { id: TabId; label: string }[] = [
  { id: "text-to-image", label: "Text-to-Image" },
  { id: "image-to-image", label: "Image-to-Image" },
  { id: "edit", label: "Edit Image" },
  { id: "infographic", label: "Infographic" },
  { id: "text-rendering", label: "Text Rendering" },
];

function toBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result as string;
      const b64 = dataUrl.split(",")[1];
      if (b64) resolve({ data: b64, mimeType: file.type || "image/png" });
      else reject(new Error("Read failed"));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function ProPage() {
  const { authRequired } = useAuthRequired();
  const [tab, setTab] = useState<TabId>("text-to-image");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ image: string; mimeType: string } | null>(null);
  const [resultBlobUrl, setResultBlobUrl] = useState<string | null>(null);

  // Text-to-Image
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("photorealistic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [text2imgModel, setText2imgModel] = useState("gemini-2.5-flash-image");

  // Image-to-Image
  const [refImages, setRefImages] = useState<(File | null)[]>([null, null, null]);
  const [refPreviewUrls, setRefPreviewUrls] = useState<(string | null)[]>([null, null, null]);
  const [img2imgPrompt, setImg2imgPrompt] = useState("");
  const [strength, setStrength] = useState(80);
  const refInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Edit
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const [editPreset, setEditPreset] = useState<string>("replace-background");
  const [editDetails, setEditDetails] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Infographic
  const [topic, setTopic] = useState("");
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const [infographicStyle, setInfographicStyle] = useState("editorial");
  const [metrics, setMetrics] = useState("");

  // Text Rendering
  const [exactText, setExactText] = useState("");
  const [textLang, setTextLang] = useState("en");
  const [textStyle, setTextStyle] = useState("bold");
  const [textContext, setTextContext] = useState("");

  useEffect(() => {
    if (!result) {
      setResultBlobUrl(null);
      return;
    }
    const binary = atob(result.image);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    setResultBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  useEffect(() => {
    const urls = refImages.map((f) => (f ? URL.createObjectURL(f) : null));
    setRefPreviewUrls((prev) => {
      prev.forEach((u) => u && URL.revokeObjectURL(u));
      return urls;
    });
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [refImages]);

  useEffect(() => {
    if (!editImage) {
      setEditPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(editImage);
    setEditPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editImage]);

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      const res = await fetch("/api/pro", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await buildBody()),
      });
      const raw = await res.text();
      let data: { image?: string; mimeType?: string; error?: string };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        if (res.status === 413 || !raw) {
          throw new Error("Запрос слишком большой (много или крупные картинки). Загрузите меньше изображений или уменьшите их размер.");
        }
        throw new Error("Сервер вернул некорректный ответ. Попробуйте позже.");
      }
      if (!res.ok) throw new Error(data.error || "Ошибка");
      if (!data.image) throw new Error("Нет изображения в ответе");
      setResult({ image: data.image, mimeType: data.mimeType || "image/png" });

      const galleryPrompt = getGalleryPromptLabel();
      try {
        const saveRes = await fetch("/api/gallery", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: data.image,
            mimeType: data.mimeType || "image/png",
            text: galleryPrompt || null,
          }),
        });
        if (!saveRes.ok && saveRes.status === 503) {
          const json = await saveRes.json().catch(() => ({}));
          console.warn("Галерея: база не настроена.", json?.error);
        }
      } catch {
        /* сохранение в галерею опционально */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  function getGalleryPromptLabel(): string {
    const parts: string[] = [];
    if (tab === "text-to-image") parts.push(`[Text-to-Image] ${prompt.trim()}`);
    if (tab === "image-to-image") parts.push(`[Image-to-Image] ${img2imgPrompt.trim()}`);
    if (tab === "edit") parts.push(`[Edit: ${editPreset}] ${editDetails.trim() || "—"}`);
    if (tab === "infographic") parts.push(`[Infographic] ${topic.trim()}${metrics.trim() ? ` — ${metrics.trim()}` : ""}`);
    if (tab === "text-rendering") parts.push(`[Text] "${exactText.trim()}" ${textContext.trim() || ""}`);
    return parts.join(" ").trim() || "Pro";
  }

  async function buildBody(): Promise<Record<string, unknown>> {
    if (tab === "text-to-image") {
      return {
        mode: "text-to-image",
        prompt: prompt.trim(),
        style,
        aspectRatio,
        model: text2imgModel,
      };
    }
    if (tab === "image-to-image") {
      const images: string[] = [];
      const mimeTypes: string[] = [];
      for (let i = 0; i < 3; i++) {
        if (refImages[i]) {
          const { data, mimeType } = await toBase64(refImages[i]!);
          images.push(data);
          mimeTypes.push(mimeType);
        }
      }
      return {
        mode: "image-to-image",
        images,
        mimeTypes,
        prompt: img2imgPrompt.trim(),
        strength,
      };
    }
    if (tab === "edit") {
      if (!editImage) throw new Error("Загрузите изображение");
      const { data, mimeType } = await toBase64(editImage);
      return {
        mode: "edit",
        image: data,
        mimeType,
        preset: editPreset,
        details: editDetails.trim(),
      };
    }
    if (tab === "infographic") {
      return {
        mode: "infographic",
        topic: topic.trim(),
        useGoogleSearch,
        style: infographicStyle,
        metrics: metrics.trim(),
      };
    }
    if (tab === "text-rendering") {
      return {
        mode: "text-rendering",
        exactText: exactText.trim(),
        language: textLang,
        textStyle,
        context: textContext.trim(),
      };
    }
    return {};
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: PRO_STYLES.bg,
        padding: "1.5rem 1rem",
        fontFamily: '"Nunito", system-ui, sans-serif',
        color: PRO_STYLES.text,
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />

      <AppNav authRequired={authRequired} currentPage="pro" linkColor={PRO_STYLES.accent} />

      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700, color: PRO_STYLES.text }}>
          Pro
        </h1>
        <p style={{ color: PRO_STYLES.textSoft, marginTop: "0.25rem", fontSize: "0.9rem" }}>
          Генерация и редактирование изображений
        </p>
      </header>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.75rem",
              border: "none",
              background: tab === t.id ? PRO_STYLES.tabActive : PRO_STYLES.tabInactive,
              color: tab === t.id ? "#fff" : PRO_STYLES.textSoft,
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              boxShadow: tab === t.id ? "0 2px 8px rgba(124,58,237,0.3)" : "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="pro-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 280px) minmax(0, 1fr) minmax(0, 200px)",
          gap: "1rem",
          maxWidth: "64rem",
          margin: "0 auto",
          alignItems: "start",
        }}
      >
        {/* Left: Input */}
        <div
          style={{
            background: PRO_STYLES.panel,
            borderRadius: "1rem",
            border: `1px solid ${PRO_STYLES.border}`,
            padding: "1rem",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.75rem", fontSize: "0.9rem" }}>Input</div>

          {tab === "text-to-image" && (
            <>
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Модель
              </label>
              <select
                value={text2imgModel}
                onChange={(e) => setText2imgModel(e.target.value)}
                style={{
                  width: "100%",
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  background: "#fff",
                  fontFamily: "inherit",
                }}
              >
                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                <option value="imagen-4">Imagen 4 (Gemini)</option>
              </select>
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Промпт
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Описание изображения"
                rows={3}
                style={{
                  width: "100%",
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Стиль
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                style={{
                  width: "100%",
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  background: "#fff",
                  fontFamily: "inherit",
                }}
              >
                <option value="photorealistic">Photorealistic</option>
                <option value="anime">Anime</option>
                <option value="concept-art">Concept Art</option>
                <option value="oil-painting">Oil Painting</option>
              </select>
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Aspect Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  background: "#fff",
                  fontFamily: "inherit",
                }}
              >
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
              </select>
            </>
          )}

          {tab === "image-to-image" && (
            <>
              <div style={{ fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.5rem" }}>
                Референсы (1–3)
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ marginBottom: "0.5rem" }}>
                  <input
                    ref={(el) => { refInputRefs.current[i] = el; }}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setRefImages((prev) => {
                          const next = [...prev];
                          next[i] = f;
                          return next;
                        });
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => refInputRefs.current[i]?.click()}
                    style={{
                      width: "100%",
                      padding: "0.4rem",
                      borderRadius: "0.5rem",
                      border: `1px dashed ${PRO_STYLES.border}`,
                      background: refImages[i] ? "transparent" : "#fff",
                      fontSize: "0.8rem",
                      color: PRO_STYLES.textSoft,
                      cursor: "pointer",
                    }}
                  >
                    {refImages[i] ? refImages[i].name : `Reference ${i + 1}`}
                  </button>
                </div>
              ))}
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                Что создать на основе референсов
              </label>
              <textarea
                value={img2imgPrompt}
                onChange={(e) => setImg2imgPrompt(e.target.value)}
                placeholder="Описание результата"
                rows={2}
                style={{
                  width: "100%",
                  marginBottom: "0.5rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft }}>
                Сила влияния референса: {strength}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </>
          )}

          {tab === "edit" && (
            <>
              <input
                ref={editInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => setEditImage(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => editInputRef.current?.click()}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  marginBottom: "0.75rem",
                  borderRadius: "0.5rem",
                  border: `1px dashed ${PRO_STYLES.border}`,
                  background: "#fff",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {editImage ? editImage.name : "Загрузить изображение"}
              </button>
              <div style={{ fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.5rem" }}>Preset</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {[
                  { id: "replace-background", label: "Replace Background" },
                  { id: "remove-object", label: "Remove Object" },
                  { id: "change-colors", label: "Change Colors" },
                  { id: "add-object", label: "Add Object" },
                  { id: "change-style", label: "Change Style" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setEditPreset(p.id)}
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: "0.5rem",
                      border: `1px solid ${editPreset === p.id ? PRO_STYLES.accent : PRO_STYLES.border}`,
                      background: editPreset === p.id ? "rgba(124,58,237,0.1)" : "transparent",
                      color: PRO_STYLES.text,
                      fontFamily: "inherit",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginTop: "0.75rem", marginBottom: "0.25rem" }}>
                Детали редактирования
              </label>
              <textarea
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                placeholder="Напр.: лес, синий цвет, собака в углу"
                rows={2}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </>
          )}

          {tab === "infographic" && (
            <>
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Тема инфографики
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Напр.: изменение климата"
                style={{
                  width: "100%",
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  fontFamily: "inherit",
                }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", cursor: "pointer", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={useGoogleSearch}
                  onChange={(e) => setUseGoogleSearch(e.target.checked)}
                />
                Использовать Google Search для актуальных данных
              </label>
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Стиль
              </label>
              <select
                value={infographicStyle}
                onChange={(e) => setInfographicStyle(e.target.value)}
                style={{
                  width: "100%",
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  background: "#fff",
                  fontFamily: "inherit",
                }}
              >
                <option value="editorial">Editorial</option>
                <option value="technical">Technical Diagram</option>
                <option value="hand-drawn">Hand-drawn</option>
                <option value="minimalist">Minimalist</option>
              </select>
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Ключевые данные для визуализации
              </label>
              <textarea
                value={metrics}
                onChange={(e) => setMetrics(e.target.value)}
                placeholder="Метрики, цифры, факты"
                rows={2}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </>
          )}

          {tab === "text-rendering" && (
            <>
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Текст для отображения
              </label>
              <input
                type="text"
                value={exactText}
                onChange={(e) => setExactText(e.target.value)}
                placeholder='Напр.: "Hello World"'
                style={{
                  width: "100%",
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  fontFamily: "inherit",
                }}
              />
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Язык
              </label>
              <select
                value={textLang}
                onChange={(e) => setTextLang(e.target.value)}
                style={{
                  width: "100%",
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  background: "#fff",
                  fontFamily: "inherit",
                }}
              >
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Стиль текста
              </label>
              <select
                value={textStyle}
                onChange={(e) => setTextStyle(e.target.value)}
                style={{
                  width: "100%",
                  marginBottom: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  background: "#fff",
                  fontFamily: "inherit",
                }}
              >
                <option value="bold">Bold</option>
                <option value="calligraphy">Calligraphy</option>
                <option value="neon">Neon</option>
                <option value="3d">3D</option>
                <option value="handwritten">Handwritten</option>
              </select>
              <label style={{ display: "block", fontSize: "0.85rem", color: PRO_STYLES.textSoft, marginBottom: "0.25rem" }}>
                Контекст изображения
              </label>
              <textarea
                value={textContext}
                onChange={(e) => setTextContext(e.target.value)}
                placeholder="Фон, сцена"
                rows={2}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${PRO_STYLES.border}`,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </>
          )}
        </div>

        {/* Center: Image zone / Preview */}
        <div
          style={{
            background: "#fff",
            borderRadius: "1rem",
            border: `2px dashed ${PRO_STYLES.border}`,
            minHeight: "320px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {resultBlobUrl ? (
            <a href={resultBlobUrl} target="_blank" rel="noopener noreferrer" style={{ maxWidth: "100%", maxHeight: "100%" }}>
              <img
                src={resultBlobUrl}
                alt="Result"
                style={{ maxWidth: "100%", maxHeight: "380px", objectFit: "contain", display: "block" }}
              />
            </a>
          ) : (tab === "image-to-image" && (refPreviewUrls[0] || refPreviewUrls[1] || refPreviewUrls[2])) ? (
            <div style={{ display: "flex", gap: "0.5rem", padding: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
              {refPreviewUrls.map((url, i) =>
                url ? (
                  <img key={i} src={url} alt={`Ref ${i + 1}`} style={{ maxHeight: "160px", width: "auto", borderRadius: "0.5rem" }} />
                ) : null
              )}
            </div>
          ) : tab === "edit" && editPreviewUrl ? (
            <img src={editPreviewUrl} alt="Edit" style={{ maxWidth: "100%", maxHeight: "380px", objectFit: "contain" }} />
          ) : (
            <span style={{ color: PRO_STYLES.textSoft, fontSize: "0.9rem" }}>
              {loading ? "Генерация…" : "Результат появится здесь"}
            </span>
          )}
        </div>

        {/* Right: Generation */}
        <div
          style={{
            background: PRO_STYLES.panel,
            borderRadius: "1rem",
            border: `1px solid ${PRO_STYLES.border}`,
            padding: "1rem",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.75rem", fontSize: "0.9rem" }}>Generation</div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || (tab === "text-to-image" && !prompt.trim()) || (tab === "image-to-image" && (!refImages[0] || !img2imgPrompt.trim())) || (tab === "edit" && !editImage) || (tab === "infographic" && !topic.trim()) || (tab === "text-rendering" && !exactText.trim())}
            style={{
              width: "100%",
              padding: "0.65rem 1rem",
              borderRadius: "0.75rem",
              border: "none",
              background: loading ? PRO_STYLES.border : PRO_STYLES.tabActive,
              color: "#fff",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {tab === "edit" ? "Edit" : tab === "infographic" ? "Generate Infographic" : tab === "text-rendering" ? "Generate with Text" : "Generate"}
          </button>
        </div>
      </div>

      {error && (
        <p style={{ textAlign: "center", color: "#c00", marginTop: "1rem", maxWidth: "40rem", marginLeft: "auto", marginRight: "auto" }}>
          {error}
        </p>
      )}

      {/* Bottom gallery placeholder */}
      <section style={{ maxWidth: "64rem", margin: "2rem auto 0" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem", color: PRO_STYLES.text }}>
          История
        </h2>
        <p style={{ color: PRO_STYLES.textSoft, fontSize: "0.9rem" }}>
          Сохранённые результаты можно посмотреть в <Link href="/gallery" style={{ color: PRO_STYLES.accent }}>галерее</Link>.
        </p>
      </section>
    </main>
  );
}
