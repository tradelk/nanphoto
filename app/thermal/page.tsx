"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuthRequired } from "../components/AuthGuard";

function useBlobUrl(data: { image: string; mimeType: string } | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const prevRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data) {
      if (prevRef.current) {
        URL.revokeObjectURL(prevRef.current);
        prevRef.current = null;
      }
      setUrl(null);
      return;
    }
    if (prevRef.current) {
      URL.revokeObjectURL(prevRef.current);
      prevRef.current = null;
    }
    const binary = atob(data.image);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.mimeType });
    const blobUrl = URL.createObjectURL(blob);
    prevRef.current = blobUrl;
    setUrl(blobUrl);
    return () => {
      if (prevRef.current) {
        URL.revokeObjectURL(prevRef.current);
        prevRef.current = null;
      }
      setUrl(null);
    };
  }, [data]);
  return url;
}

const THERMAL_COLORS = {
  bg: "#f5f0ff",
  upload: "#e8e0f5",
  options: "#ffe0ec",
  result: "#d4f0e8",
  border: "#d4c8e8",
  accent: "#b8a0d8",
  text: "#3d3550",
  textSoft: "#6b5f7a",
  star: "#ffb8d4",
  heart: "#f08",
};

type GalleryItem = {
  id: string;
  url: string;
  mimeType: string;
  text: string | null;
};

const CATEGORIES = [
  { id: "portrait", label: "Портрет", icon: "📷" },
  { id: "objects", label: "Объекты/товары", icon: "📦" },
  { id: "logos", label: "Логотипы/иконки", icon: "✨" },
] as const;

const STYLE_OPTIONS = [
  { id: "line-art", label: "Line Art" },
  { id: "stencil", label: "Stencil" },
  { id: "stamp", label: "Stamp" },
  { id: "halftone", label: "Halftone" },
];

const DETAIL_OPTIONS = [
  { id: "simplified", label: "Simplified" },
  { id: "medium", label: "Medium" },
  { id: "detailed", label: "Detailed" },
];

const OUTLINE_OPTIONS = [
  { id: "thin", label: "Thin" },
  { id: "medium", label: "Medium" },
  { id: "bold", label: "Bold" },
];

const PAPER_OPTIONS = [
  { id: "58mm", label: "58mm" },
  { id: "80mm", label: "80mm" },
];

export default function ThermalPage() {
  const { authRequired } = useAuthRequired();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [style, setStyle] = useState<string>("line-art");
  const [detailLevel, setDetailLevel] = useState<string>("medium");
  const [outlineThickness, setOutlineThickness] = useState<string>("bold");
  const [backgroundRemoval, setBackgroundRemoval] = useState(true);
  const [paperSize, setPaperSize] = useState<string>("58mm");
  const [result, setResult] = useState<{ image: string; mimeType: string; promptUsed: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultBlobUrl = useBlobUrl(result);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  useEffect(() => {
    fetch("/api/gallery", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setGallery(Array.isArray(data) ? data : []))
      .catch(() => setGallery([]));
  }, []);

  const copyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type.startsWith("image/")) {
      setFile(f);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) {
      setFile(f);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const convert = async () => {
    if (!file) {
      setError("Сначала загрузите изображение");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const dataUrl = r.result as string;
          const b64 = dataUrl.split(",")[1];
          if (b64) resolve(b64);
          else reject(new Error("Не удалось прочитать файл"));
        };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });

      const res = await fetch("/api/thermal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mimeType: file.type || "image/png",
          category: category || undefined,
          style,
          detailLevel,
          outlineThickness,
          backgroundRemoval,
          paperSize,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка запроса");
      if (!data.image) throw new Error("Нет изображения в ответе");

      setResult({
        image: data.image,
        mimeType: data.mimeType || "image/png",
        promptUsed: data.promptUsed || "",
      });

      const saveRes = await fetch("/api/gallery", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: data.image,
          mimeType: data.mimeType || "image/png",
          text: data.promptUsed || null,
        }),
      });
      if (saveRes.ok) {
        const updated = await saveRes.json();
        setGallery(Array.isArray(updated) ? updated : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка конвертации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: THERMAL_COLORS.bg,
        padding: "2rem 1rem",
        fontFamily: '"Nunito", system-ui, sans-serif',
        color: THERMAL_COLORS.text,
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        {authRequired && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                window.location.href = "/";
              }}
              style={{
                padding: "0.35rem 0.65rem",
                borderRadius: "1rem",
                border: `1px solid ${THERMAL_COLORS.border}`,
                background: "transparent",
                color: THERMAL_COLORS.textSoft,
                fontFamily: "inherit",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Выйти
            </button>
          </div>
        )}
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700, color: THERMAL_COLORS.text }}>
          Термопринтер: конвертер в линейное искусство
        </h1>
        <p style={{ color: THERMAL_COLORS.textSoft, marginTop: "0.25rem", fontSize: "0.95rem" }}>
          Загрузите картинку → выберите опции → получите ч/б для печати
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: "0.75rem",
            color: THERMAL_COLORS.accent,
            fontSize: "0.95rem",
          }}
        >
          ← На главную
        </Link>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          maxWidth: "56rem",
          margin: "0 auto 2rem",
          alignItems: "stretch",
        }}
      >
        {/* Upload */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: THERMAL_COLORS.upload,
            borderRadius: "1.25rem",
            border: `2px dashed ${THERMAL_COLORS.border}`,
            minHeight: "220px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Загружено"
              style={{
                maxWidth: "100%",
                maxHeight: "180px",
                objectFit: "contain",
                borderRadius: "0.75rem",
                pointerEvents: "none",
              }}
            />
          ) : (
            <>
              <span style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>☁️</span>
              <span style={{ fontSize: "0.9rem", color: THERMAL_COLORS.textSoft, textAlign: "center" }}>
                Нажмите или перетащите изображение
              </span>
            </>
          )}
        </div>

        {/* Options */}
        <div
          style={{
            background: THERMAL_COLORS.options,
            borderRadius: "1.25rem",
            border: `1px solid ${THERMAL_COLORS.border}`,
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: THERMAL_COLORS.text }}>
            Дополнение (один вариант)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(category === c.id ? "" : c.id)}
                style={{
                  padding: "0.4rem 0.6rem",
                  borderRadius: "0.75rem",
                  border: `1px solid ${category === c.id ? THERMAL_COLORS.accent : THERMAL_COLORS.border}`,
                  background: category === c.id ? THERMAL_COLORS.upload : "transparent",
                  color: THERMAL_COLORS.text,
                  fontFamily: "inherit",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          <label style={{ fontSize: "0.85rem", color: THERMAL_COLORS.textSoft }}>
            Style
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem",
                borderRadius: "0.5rem",
                border: `1px solid ${THERMAL_COLORS.border}`,
                background: "#fff",
                fontFamily: "inherit",
              }}
            >
              {STYLE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: "0.85rem", color: THERMAL_COLORS.textSoft }}>
            Detail Level
            <select
              value={detailLevel}
              onChange={(e) => setDetailLevel(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem",
                borderRadius: "0.5rem",
                border: `1px solid ${THERMAL_COLORS.border}`,
                background: "#fff",
                fontFamily: "inherit",
              }}
            >
              {DETAIL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: "0.85rem", color: THERMAL_COLORS.textSoft }}>
            Outline Thickness
            <select
              value={outlineThickness}
              onChange={(e) => setOutlineThickness(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem",
                borderRadius: "0.5rem",
                border: `1px solid ${THERMAL_COLORS.border}`,
                background: "#fff",
                fontFamily: "inherit",
              }}
            >
              {OUTLINE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={backgroundRemoval}
              onChange={(e) => setBackgroundRemoval(e.target.checked)}
            />
            Background Removal
          </label>
          <label style={{ fontSize: "0.85rem", color: THERMAL_COLORS.textSoft }}>
            Paper Size
            <select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem",
                borderRadius: "0.5rem",
                border: `1px solid ${THERMAL_COLORS.border}`,
                background: "#fff",
                fontFamily: "inherit",
              }}
            >
              {PAPER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={convert}
            disabled={loading || !file}
            style={{
              marginTop: "auto",
              padding: "0.6rem 1rem",
              borderRadius: "0.75rem",
              border: "none",
              background: loading ? THERMAL_COLORS.border : THERMAL_COLORS.accent,
              color: "#fff",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Конвертирую…" : "Конвертировать"}
          </button>
        </div>

        {/* Result */}
        <div
          style={{
            background: THERMAL_COLORS.result,
            borderRadius: "1.25rem",
            border: `1px solid ${THERMAL_COLORS.border}`,
            minHeight: "220px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            position: "relative",
          }}
        >
          {resultBlobUrl ? (
            <a
              href={resultBlobUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", maxWidth: "100%", maxHeight: "200px" }}
            >
              <img
                src={resultBlobUrl}
                alt="Результат"
                style={{
                  maxWidth: "100%",
                  maxHeight: "200px",
                  objectFit: "contain",
                  borderRadius: "0.75rem",
                }}
              />
            </a>
          ) : (
            <div style={{ textAlign: "center", color: THERMAL_COLORS.textSoft, fontSize: "0.9rem" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>⭐</span>
              Итоговая картинка появится здесь
            </div>
          )}
        </div>
      </section>

      {error && (
        <p style={{ textAlign: "center", color: "#c00", marginBottom: "1rem", maxWidth: "40rem", marginLeft: "auto", marginRight: "auto" }}>
          {error}
        </p>
      )}

      {/* Gallery */}
      <section style={{ maxWidth: "56rem", margin: "0 auto" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem", color: THERMAL_COLORS.text }}>
          Последние генерации
        </h2>
        {gallery.length === 0 ? (
          <p style={{ color: THERMAL_COLORS.textSoft, fontSize: "0.9rem" }}>
            Пока пусто. Конвертируйте первую картинку выше.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "1rem",
            }}
          >
            {gallery.map((item) => (
              <div
                key={item.id}
                style={{
                  borderRadius: "1rem",
                  overflow: "hidden",
                  border: `1px solid ${THERMAL_COLORS.border}`,
                  background: THERMAL_COLORS.options,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block", flex: "0 0 auto" }}
                >
                  <img
                    src={item.url}
                    alt=""
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </a>
                {item.text ? (
                  <div style={{ padding: "0.4rem 0.5rem", fontSize: "0.75rem", color: THERMAL_COLORS.textSoft }}>
                    <p
                      style={{
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical" as const,
                        lineHeight: 1.3,
                      }}
                    >
                      {item.text}
                    </p>
                    <button
                      type="button"
                      onClick={() => copyPrompt(item.id, item.text!)}
                      style={{
                        marginTop: "0.25rem",
                        padding: "0.2rem 0.45rem",
                        fontSize: "0.7rem",
                        border: `1px solid ${THERMAL_COLORS.border}`,
                        borderRadius: "4px",
                        background: THERMAL_COLORS.upload,
                        color: THERMAL_COLORS.text,
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      {copiedId === item.id ? "Скопировано" : "Копировать промпт"}
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "0.4rem 0.5rem", minHeight: "2rem" }} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
