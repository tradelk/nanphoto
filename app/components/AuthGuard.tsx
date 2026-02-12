"use client";

import { useState, useEffect, createContext, useContext } from "react";

const AUTH_STORAGE_KEY = "nanphoto_authed";

type AuthContextValue = { authRequired: boolean };
const AuthContext = createContext<AuthContextValue>({ authRequired: false });

export function useAuthRequired() {
  return useContext(AuthContext);
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "auth" | "ok">("loading");
  const [authRequired, setAuthRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/status", { credentials: "include" });
        const data = await res.json();
        if (cancelled) return;
        setAuthRequired(Boolean(data?.authRequired));
        if (data?.ok) {
          if (typeof window !== "undefined") sessionStorage.setItem(AUTH_STORAGE_KEY, "1");
          setStatus("ok");
        } else {
          if (typeof window !== "undefined") sessionStorage.removeItem(AUTH_STORAGE_KEY);
          setStatus("auth");
        }
      } catch {
        if (cancelled) return;
        setStatus("auth");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data?.ok) {
        sessionStorage.setItem(AUTH_STORAGE_KEY, "1");
        setStatus("ok");
      } else {
        setError(data?.error || "Неверный пароль");
      }
    } catch {
      setError("Ошибка запроса");
    }
  };

  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--text-soft)",
          fontFamily: "var(--font-sans)",
        }}
      >
        Загрузка…
      </div>
    );
  }

  if (status === "auth") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          padding: "1rem",
        }}
      >
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <div
          style={{
            width: "100%",
            maxWidth: "20rem",
            background: "var(--card)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
            border: "1px solid var(--border)",
            padding: "1.5rem",
          }}
        >
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: "0.5rem",
            }}
          >
            nanphoto
          </h1>
          <p style={{ color: "var(--text-soft)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Введите пароль для входа
          </p>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              autoFocus
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                fontFamily: "inherit",
                fontSize: "1rem",
              }}
            />
            {error && (
              <p style={{ color: "#b91c1c", fontSize: "0.85rem", margin: 0 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={!password.trim()}
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "var(--radius)",
                border: "none",
                background: "var(--accent-strong)",
                color: "#fff",
                fontFamily: "inherit",
                fontWeight: 600,
                cursor: password.trim() ? "pointer" : "not-allowed",
              }}
            >
              Войти
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ authRequired }}>
      {children}
    </AuthContext.Provider>
  );
}
