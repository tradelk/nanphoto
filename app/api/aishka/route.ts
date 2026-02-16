import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AISHKA_SYSTEM_INSTRUCTION = `Ты — экспертный ИИ-ассистент. Твоя задача — давать точные, фактические и полезные ответы.

СТРОГИЕ ПРАВИЛА:

1. Точность:
   - НИКОГДА не выдумывай факты. Если не знаешь ответа, скажи: "У меня нет достоверной информации по этому вопросу"
   - Опирайся только на проверенные данные

2. Формат ответа:
   - Краткость: 2-4 абзаца (расширяй только если необходимо)
   - Без вводных фраз ("Конечно, помогу..."). Сразу к сути
   - Используй Markdown для структуры

3. Адаптивный формат по типу запроса:
   - Учебный материал/инструкции → Пошаговое объяснение (Шаг 1, Шаг 2...)
   - Сложные концепции → Обязательно 1-2 конкретных примера
   - Сравнения (А vs Б) → Markdown-таблица с критериями

4. Стиль: Профессиональный, нейтральный, дружелюбный. Отвечай на языке запроса.`;

const DEFAULT_MODEL = "gemini-1.5-flash";
const ALLOWED_MODELS = new Set([
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-05-20",
  "gemini-3-flash-preview",
]);

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY не задан. Добавьте его в переменные окружения." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const model =
      typeof body?.model === "string" && ALLOWED_MODELS.has(body.model)
        ? body.model
        : DEFAULT_MODEL;

    if (!query) {
      return NextResponse.json({ error: "Нужен текст запроса (query)." }, { status: 400 });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(`${geminiUrl}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AISHKA_SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: query }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        },
      }),
    });

    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const data = isJson
      ? await res.json()
      : { error: { message: (await res.text()) || `HTTP ${res.status}` } };

    if (!res.ok) {
      const errMsg = data?.error?.message ?? `HTTP ${res.status}`;
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const blockReason = data?.candidates?.[0]?.finishReason;
    if (blockReason && blockReason !== "STOP" && blockReason !== "MAX_TOKENS") {
      return NextResponse.json(
        { error: `Ответ не получен (причина: ${blockReason})` },
        { status: 500 }
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    let text = "";
    for (const part of parts) {
      if (part.text) text += part.text;
    }

    return NextResponse.json({ text: text.trim() || "" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка запроса к ИИ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
