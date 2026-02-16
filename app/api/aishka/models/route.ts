import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Кандидаты для Аишки: текстовые модели. */
const CANDIDATE_MODELS = [
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash (preview)" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
];

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY не задан." },
      { status: 500 }
    );
  }

  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  let listData: { models?: { name?: string }[]; error?: { message?: string } };
  try {
    const listRes = await fetch(listUrl);
    const listJson = await listRes.json().catch(() => ({}));
    listData = listJson;
    if (!listRes.ok) {
      return NextResponse.json({
        error: listData?.error?.message ?? `HTTP ${listRes.status}`,
        available: [],
      }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Ошибка запроса к API",
      available: [],
    }, { status: 500 });
  }

  const modelNames = new Set(
    (listData.models ?? []).map((m) => (m.name ?? "").replace(/^models\//, ""))
  );

  const available: { id: string; label: string; listed: boolean; works: boolean }[] = [];
  const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  for (const candidate of CANDIDATE_MODELS) {
    const listed = modelNames.has(candidate.id);
    let works = false;
    if (listed) {
      try {
        const res = await fetch(
          `${baseUrl}/${candidate.id}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: "Hi" }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
          }
        );
        const data = await res.json().catch(() => ({}));
        works =
          res.ok &&
          (data?.candidates?.[0]?.finishReason === "STOP" ||
            data?.candidates?.[0]?.finishReason === "MAX_TOKENS");
      } catch {
        works = false;
      }
    }
    available.push({
      id: candidate.id,
      label: candidate.label,
      listed,
      works,
    });
  }

  return NextResponse.json({
    available,
    allListedNames: Array.from(modelNames).sort(),
  });
}
