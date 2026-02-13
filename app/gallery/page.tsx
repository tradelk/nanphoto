"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthRequired } from "../components/AuthGuard";

type GalleryItem = {
  id: string;
  url: string;
  mimeType: string;
  text: string | null;
};

export default function GalleryPage() {
  const { authRequired } = useAuthRequired();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  useEffect(() => {
    fetch("/api/gallery", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

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

      <header style={{ textAlign: "center", width: "100%", maxWidth: "56rem" }}>
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
          </div>
        )}
        <h1
          style={{
            fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.02em",
          }}
        >
          Галерея
        </h1>
        <p style={{ color: "var(--text-soft)", marginTop: "0.25rem" }}>
          Последние 100 сгенерированных картинок
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: "0.75rem",
            color: "var(--accent-strong)",
            fontSize: "0.95rem",
          }}
        >
          ← На главную
        </Link>
      </header>

      {loading ? (
        <p style={{ color: "var(--text-soft)" }}>Загрузка…</p>
      ) : items.length === 0 ? (
        <section
          style={{
            width: "100%",
            maxWidth: "40rem",
            background: "var(--card)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            padding: "2rem",
            textAlign: "center",
            color: "var(--text-soft)",
          }}
        >
          Пока нет картинок. Сгенерируйте изображения на{" "}
          <Link href="/" style={{ color: "var(--accent-strong)" }}>
            главной
          </Link>
          .
        </section>
      ) : (
        <section
          style={{
            width: "100%",
            maxWidth: "56rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "1rem",
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                borderRadius: "var(--radius)",
                overflow: "hidden",
                border: "1px solid var(--border)",
                background: "var(--card)",
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
                <div
                  style={{
                    padding: "0.4rem 0.5rem",
                    fontSize: "0.75rem",
                    color: "var(--text-soft)",
                    flex: "1 1 auto",
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
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
                    onClick={(e) => {
                      e.preventDefault();
                      copyPrompt(item.id, item.text!);
                    }}
                    style={{
                      alignSelf: "flex-start",
                      padding: "0.2rem 0.45rem",
                      fontSize: "0.7rem",
                      border: "1px solid var(--border)",
                      borderRadius: "4px",
                      background: "var(--bg)",
                      color: "var(--text-soft)",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {copiedId === item.id ? "Скопировано" : "Копировать промпт"}
                  </button>
                </div>
              ) : (
                <div style={{ padding: "0.4rem 0.5rem", fontSize: "0.75rem", color: "var(--text-soft)", minHeight: "2rem" }} />
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
