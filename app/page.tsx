"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthRequired } from "./components/AuthGuard";

function useResultImageBlobUrl(
  resultImage: { image: string; mimeType: string } | null
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const prevRef = useRef<string | null>(null);
  useEffect(() => {
    if (!resultImage) {
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
    const binary = atob(resultImage.image);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: resultImage.mimeType });
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
  }, [resultImage]);
  return url;
}

const THEMES = [
  { id: "banana", label: "Банановый" },
  { id: "light", label: "Светлый" },
  { id: "night", label: "Ночной" },
] as const;
type ThemeId = (typeof THEMES)[number]["id"];

function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("nanphoto-theme");
  if (stored === "banana" || stored === "night" || stored === "light") return stored;
  return "light";
}

type GalleryItem = {
  id: string;
  url: string;
  mimeType: string;
  text: string | null;
};

const OPTIMIZER_CATEGORIES = [
  {
    label: "Стиль",
    options: [
      { id: "style-photorealistic", label: "photorealistic" },
      { id: "style-anime", label: "anime style" },
      { id: "style-oil", label: "oil painting" },
      { id: "style-3d", label: "3D render" },
    ],
  },
  {
    label: "Качество",
    options: [
      { id: "qual-high", label: "high quality" },
      { id: "qual-detailed", label: "detailed" },
      { id: "qual-sharp", label: "sharp focus" },
    ],
  },
  {
    label: "Освещение",
    options: [
      { id: "light-pro", label: "professional lighting" },
      { id: "light-natural", label: "natural light" },
      { id: "light-studio", label: "studio lighting" },
      { id: "light-golden", label: "golden hour / sunset" },
    ],
  },
  {
    label: "Портреты",
    options: [
      { id: "portrait-photo", label: "photorealistic" },
      { id: "portrait-portrait", label: "portrait" },
      { id: "portrait-facial", label: "detailed facial features" },
      { id: "portrait-studio", label: "professional studio lighting" },
      { id: "portrait-eyes", label: "sharp eyes" },
      { id: "portrait-hq", label: "high quality" },
    ],
  },
  {
    label: "Для продуктов",
    options: [
      { id: "product-photo", label: "product photography" },
      { id: "product-white", label: "clean white background" },
      { id: "product-light", label: "professional lighting" },
      { id: "product-detail", label: "high detail" },
      { id: "product-commercial", label: "commercial quality" },
    ],
  },
  {
    label: "Концепты",
    options: [
      { id: "concept-style", label: "concept art style" },
      { id: "concept-composition", label: "detailed composition" },
      { id: "concept-cinematic", label: "cinematic lighting" },
      { id: "concept-hq", label: "high quality" },
      { id: "concept-clear", label: "clear composition" },
      { id: "concept-lighting", label: "good lighting" },
    ],
  },
  {
    label: "Композиция",
    options: [
      { id: "comp-wide", label: "wide angle" },
      { id: "comp-closeup", label: "close-up" },
      { id: "comp-aerial", label: "aerial view" },
      { id: "comp-symmetrical", label: "symmetrical composition" },
      { id: "comp-centered", label: "centered composition" },
    ],
  },
  {
    label: "Детализация",
    options: [
      { id: "res-4k", label: "4K" },
      { id: "res-8k", label: "8K" },
      { id: "res-ultra", label: "ultra detailed" },
      { id: "res-intricate", label: "intricate details" },
    ],
  },
  {
    label: "Атмосфера",
    options: [
      { id: "atm-dramatic", label: "dramatic" },
      { id: "atm-soft", label: "soft" },
      { id: "atm-moody", label: "moody" },
      { id: "atm-vibrant", label: "vibrant colors" },
      { id: "atm-minimal", label: "minimalist" },
      { id: "atm-dreamy", label: "dreamy" },
    ],
  },
];

export default function Home() {
  const [theme, setTheme] = useState<ThemeId>("light");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resultImage, setResultImage] = useState<{ image: string; mimeType: string; text: string | null } | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authRequired } = useAuthRequired();
  const resultImageBlobUrl = useResultImageBlobUrl(resultImage);
  const selectedCount = OPTIMIZER_CATEGORIES.reduce(
    (n, cat) => n + cat.options.filter((o) => selected.has(o.id)).length,
    0
  );

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("nanphoto-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch("/api/gallery", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setGallery(Array.isArray(data) ? data : []))
      .catch(() => setGallery([]));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResultImage(null);
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          optimizations: OPTIMIZER_CATEGORIES.flatMap((cat) =>
            cat.options.filter((o) => selected.has(o.id)).map((o) => o.label)
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка запроса");
      if (data.image) {
        setResultImage({
          image: data.image,
          mimeType: data.mimeType || "image/png",
          text: data.text || null,
        });
        setQuery("");
        try {
          const saveRes = await fetch("/api/gallery", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: data.image,
              mimeType: data.mimeType || "image/png",
              text: query.trim() || null,
            }),
          });
          if (saveRes.ok) {
            const updated = await saveRes.json();
            setGallery(Array.isArray(updated) ? updated : []);
          } else if (saveRes.status === 503) {
            const json = await saveRes.json().catch(() => ({}));
            console.warn("Галерея: база не настроена.", json?.error || "Добавьте DATABASE_URL в Netlify.");
          }
        } catch {
          /* галерея опциональна */
        }
      } else throw new Error("Нет изображения в ответе");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "2rem 1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <header style={{ textAlign: "center", width: "100%", maxWidth: "40rem" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.35rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          {authRequired && (
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                window.location.reload();
              }}
              style={{
                padding: "0.35rem 0.65rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-soft)",
                fontFamily: "inherit",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Выйти
            </button>
          )}
          {THEMES.map((t) => {
            const isSelected = theme === t.id;
            const isBanana = theme === "banana";
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                aria-pressed={isSelected}
                style={{
                  padding: "0.35rem 0.65rem",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: isBanana
                    ? isSelected
                      ? "#ffeb3b"
                      : "transparent"
                    : isSelected
                      ? "var(--accent)"
                      : "var(--card)",
                  color: isBanana
                    ? isSelected
                      ? "#1a1a1a"
                      : "#ffc107"
                    : isSelected
                      ? "var(--bg)"
                      : "var(--text)",
                  fontFamily: "inherit",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <h1
          style={{
            fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.02em",
          }}
        >
          nanphoto
        </h1>
        <p style={{ color: "var(--text-soft)", marginTop: "0.25rem" }}>
          Описание + уточнения → картинка от Nano Banana
        </p>
      </header>

      <section
        style={{
          width: "100%",
          maxWidth: "40rem",
          background: "var(--card)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)",
          border: "1px solid var(--border)",
          padding: "1.5rem",
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={{ fontWeight: 600, color: "var(--text)" }}>Описание изображения</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Например: милый кот в космосе, акварель"
            rows={3}
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: theme === "banana" || theme === "night" ? "#fff" : "var(--text)",
              fontFamily: "inherit",
              fontSize: "1rem",
              resize: "vertical",
            }}
          />

          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "var(--radius)",
              border: "none",
              background: loading ? "var(--border)" : "var(--accent-strong)",
              color: theme === "banana" ? "#1a1a1a" : "#fff",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Рисую…" : "Нарисовать!"}
          </button>

          <div>
            <button
              type="button"
              onClick={() => setOptimizerOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "0.5rem 0",
                border: "none",
                background: "none",
                color: "var(--text)",
                fontFamily: "inherit",
                fontWeight: 600,
                fontSize: "0.95rem",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span>
                Уточнения для промпта
                {selectedCount > 0 && (
                  <span style={{ fontWeight: 400, color: "var(--text-soft)", marginLeft: "0.35rem" }}>
                    (выбрано {selectedCount})
                  </span>
                )}
              </span>
              <span style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>
                {optimizerOpen ? "▲ свернуть" : "▼ развернуть"}
              </span>
            </button>
            {optimizerOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                {OPTIMIZER_CATEGORIES.map((category) => (
                  <div key={category.label}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        color: "var(--text-soft)",
                        marginBottom: "0.35rem",
                      }}
                    >
                      {category.label}:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {category.options.map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggle(id)}
                          disabled={loading}
                          style={{
                            padding: "0.35rem 0.65rem",
                            borderRadius: "999px",
                            border: "1px solid var(--border)",
                            background: selected.has(id) ? "var(--accent)" : "var(--card)",
                            color: selected.has(id) ? "#fff" : "var(--text)",
                            fontFamily: "inherit",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </section>

      {error && (
        <div
          style={{
            maxWidth: "32rem",
            width: "100%",
            padding: "1rem",
            borderRadius: "var(--radius)",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {resultImage && (
        <section
          style={{
            width: "100%",
            maxWidth: "32rem",
            background: "var(--card)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
            border: "1px solid var(--border)",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--text)" }}>Результат</h2>
          {resultImage.text && (
            <p style={{ marginBottom: "0.75rem", color: "var(--text-soft)", fontSize: "0.9rem" }}>
              {resultImage.text}
            </p>
          )}
          <a
            href={resultImageBlobUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            title="Открыть в полном размере"
            style={{ display: "block", cursor: "pointer" }}
            onClick={(e) => {
              if (resultImageBlobUrl) {
                e.preventDefault();
                window.open(resultImageBlobUrl, "_blank", "noopener,noreferrer");
              } else if (resultImage) e.preventDefault();
            }}
          >
            <img
              src={`data:${resultImage.mimeType};base64,${resultImage.image}`}
              alt="Сгенерированное изображение"
              style={{
                width: "100%",
                borderRadius: "var(--radius)",
                display: "block",
              }}
            />
          </a>
        </section>
      )}

      <section
        style={{
          width: "100%",
          maxWidth: "40rem",
          background: "var(--card)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)",
          border: "1px solid var(--border)",
          padding: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2 style={{ fontWeight: 600, color: "var(--text)", margin: 0 }}>
            Последние картинки
          </h2>
          <a
            href="/gallery"
            style={{ fontSize: "0.9rem", color: "var(--accent-strong)" }}
          >
            Вся галерея →
          </a>
        </div>
        {gallery.length === 0 ? (
          <p style={{ color: "var(--text-soft)", fontSize: "0.9rem", margin: 0 }}>
            Пока пусто. Картинки сохраняются на сервере (до 40 шт.).
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {gallery.slice(0, 12).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                  background: "var(--bg)",
                  aspectRatio: "1",
                }}
                title="Открыть в полном размере"
              >
                <img
                  src={item.url}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
