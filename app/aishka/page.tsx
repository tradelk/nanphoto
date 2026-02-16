"use client";

import { useState } from "react";
import { useAuthRequired } from "../components/AuthGuard";
import AppNav from "../components/AppNav";

const AISHKA_STYLES = {
  bg: "#fafafa",
  card: "#fff",
  border: "#e5e5e5",
  accent: "#2563eb",
  text: "#1a1a1a",
  textSoft: "#666",
};

const MODEL_OPTIONS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
];

type ModelStatus = { id: string; label: string; listed: boolean; works: boolean };

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  return Array.from(new Set(matches));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textWithLinks(text: string): string {
  const escaped = escapeHtml(text).replace(/\n/g, "<br />");
  return escaped.replace(URL_REGEX, (url) => {
    const safe = escapeHtml(url);
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
  });
}

export default function AishkaPage() {
  const { authRequired } = useAuthRequired();
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [modelCheck, setModelCheck] = useState<ModelStatus[] | null>(null);
  const [modelCheckLoading, setModelCheckLoading] = useState(false);
  const [modelCheckError, setModelCheckError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResponse("");
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/aishka", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка запроса");
      setResponse(data.text ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResponse("");
    setError(null);
  };

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(response).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCheckModels = async () => {
    setModelCheckError(null);
    setModelCheck(null);
    setModelCheckLoading(true);
    try {
      const res = await fetch("/api/aishka/models", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка проверки");
      setModelCheck(data.available ?? []);
    } catch (err) {
      setModelCheckError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setModelCheckLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: AISHKA_STYLES.bg,
        padding: "2rem 1rem",
        fontFamily: '"Nunito", system-ui, sans-serif',
        color: AISHKA_STYLES.text,
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <AppNav authRequired={authRequired} currentPage="aishka" linkColor={AISHKA_STYLES.accent} />

      <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700, color: AISHKA_STYLES.text }}>
          Аишка
        </h1>
        <p style={{ color: AISHKA_STYLES.textSoft, marginTop: "0.25rem", fontSize: "0.95rem" }}>
          Задайте вопрос — получите ответ
        </p>
      </header>

      <section
        style={{
          maxWidth: "42rem",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <form onSubmit={handleSubmit}>
          <div
            style={{
              background: AISHKA_STYLES.card,
              borderRadius: "0.75rem",
              border: `1px solid ${AISHKA_STYLES.border}`,
              padding: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                alignItems: "flex-end",
                marginBottom: "1rem",
              }}
            >
              <label
                style={{
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: AISHKA_STYLES.text,
                }}
              >
                Модель
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={loading}
                  style={{
                    display: "block",
                    marginTop: "0.35rem",
                    padding: "0.4rem 0.6rem",
                    borderRadius: "0.5rem",
                    border: `1px solid ${AISHKA_STYLES.border}`,
                    background: AISHKA_STYLES.bg,
                    color: AISHKA_STYLES.text,
                    fontFamily: "inherit",
                    fontSize: "0.9rem",
                  }}
                >
                  {MODEL_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleCheckModels}
                disabled={modelCheckLoading}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${AISHKA_STYLES.border}`,
                  background: "transparent",
                  color: AISHKA_STYLES.accent,
                  fontFamily: "inherit",
                  fontSize: "0.9rem",
                  cursor: modelCheckLoading ? "not-allowed" : "pointer",
                }}
              >
                {modelCheckLoading ? "Проверяю…" : "Проверить модели"}
              </button>
            </div>

            <label
              htmlFor="aishka-query"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.9rem",
                color: AISHKA_STYLES.text,
                marginBottom: "0.5rem",
              }}
            >
              Запрос
            </label>
            <textarea
              id="aishka-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Введите ваш вопрос..."
              rows={6}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: `1px solid ${AISHKA_STYLES.border}`,
                background: AISHKA_STYLES.bg,
                color: AISHKA_STYLES.text,
                fontFamily: "inherit",
                fontSize: "1rem",
                resize: "vertical",
                minHeight: "140px",
              }}
            />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginTop: "0.75rem",
                alignItems: "center",
              }}
            >
              <button
                type="submit"
                disabled={loading || !query.trim()}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: loading ? AISHKA_STYLES.border : AISHKA_STYLES.accent,
                  color: "#fff",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Отправляю…" : "Отправить"}
              </button>
              <button
                type="button"
                onClick={handleClear}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${AISHKA_STYLES.border}`,
                  background: "transparent",
                  color: AISHKA_STYLES.textSoft,
                  fontFamily: "inherit",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Очистить
              </button>
            </div>
          </div>
        </form>

        {(modelCheck !== null || modelCheckError) && (
          <div
            style={{
              background: AISHKA_STYLES.card,
              borderRadius: "0.75rem",
              border: `1px solid ${AISHKA_STYLES.border}`,
              padding: "1rem",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem", color: AISHKA_STYLES.text }}>
              Доступность моделей по вашему API
            </h3>
            {modelCheckError && (
              <p style={{ color: "#991b1b", fontSize: "0.9rem", marginBottom: "0.5rem" }}>{modelCheckError}</p>
            )}
            {modelCheck && modelCheck.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.9rem", lineHeight: 1.8 }}>
                {modelCheck.map((m) => (
                  <li key={m.id}>
                    <strong>{m.label}</strong>{" "}
                    {m.works ? (
                      <span style={{ color: "#15803d" }}>✓ доступна</span>
                    ) : m.listed ? (
                      <span style={{ color: "#ca8a04" }}>в списке, тест не прошла</span>
                    ) : (
                      <span style={{ color: AISHKA_STYLES.textSoft }}>нет в API</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        {(response || loading) && (
          <div
            style={{
              background: AISHKA_STYLES.card,
              borderRadius: "0.75rem",
              border: `1px solid ${AISHKA_STYLES.border}`,
              padding: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: AISHKA_STYLES.text,
                }}
              >
                Ответ
              </span>
              {response && (
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "0.4rem",
                    border: `1px solid ${AISHKA_STYLES.border}`,
                    background: "transparent",
                    color: AISHKA_STYLES.accent,
                    fontFamily: "inherit",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  {copied ? "Скопировано" : "Скопировать"}
                </button>
              )}
            </div>
            <div
              style={{
                minHeight: "4rem",
                wordBreak: "break-word",
                fontSize: "0.95rem",
                lineHeight: 1.6,
                color: AISHKA_STYLES.text,
              }}
            >
              {loading && !response ? (
                "Ждём ответ…"
              ) : (
                <>
                  <div
                    style={{ whiteSpace: "pre-wrap" }}
                    dangerouslySetInnerHTML={{
                      __html: textWithLinks(response),
                    }}
                  />
                  {extractUrls(response).length > 0 && (
                    <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: `1px solid ${AISHKA_STYLES.border}` }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem", color: AISHKA_STYLES.text }}>
                        Источники
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.9rem", lineHeight: 1.7 }}>
                        {extractUrls(response).map((url) => (
                          <li key={url}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: AISHKA_STYLES.accent }}
                            >
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
