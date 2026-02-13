"use client";

import Link from "next/link";

export type AppNavPage = "main" | "pro" | "thermal" | "gallery";

type AppNavProps = {
  authRequired?: boolean;
  currentPage?: AppNavPage;
  /** Для главной страницы: цвет ссылок из темы (var(--accent-strong)). Остальные страницы передают свой accent. */
  linkColor?: string;
};

const NAV_ITEMS: { path: string; label: string; page: AppNavPage }[] = [
  { path: "/", label: "nanphoto", page: "main" },
  { path: "/pro", label: "Pro", page: "pro" },
  { path: "/thermal", label: "Термопринтер", page: "thermal" },
  { path: "/gallery", label: "Галерея", page: "gallery" },
];

export default function AppNav({ authRequired, currentPage, linkColor = "#7c3aed" }: AppNavProps) {
  return (
    <nav
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem 1.25rem",
        padding: "0.5rem 0",
        marginBottom: "0.5rem",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        fontFamily: "inherit",
        fontSize: "0.95rem",
      }}
    >
      {NAV_ITEMS.map(({ path, label, page }) => {
        const isCurrent = currentPage === page;
        const color = isCurrent ? "currentColor" : linkColor;
        return isCurrent ? (
          <span
            key={path}
            style={{
              color,
              fontWeight: 600,
              opacity: 0.9,
            }}
          >
            {label}
          </span>
        ) : (
          <Link
            key={path}
            href={path}
            style={{
              color,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            {label}
          </Link>
        );
      })}
      {authRequired && (
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            window.location.href = "/";
          }}
          style={{
            marginLeft: "auto",
            padding: "0.35rem 0.65rem",
            borderRadius: "0.5rem",
            border: "1px solid rgba(0,0,0,0.15)",
            background: "transparent",
            color: "inherit",
            opacity: 0.8,
            fontFamily: "inherit",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          Выйти
        </button>
      )}
    </nav>
  );
}
