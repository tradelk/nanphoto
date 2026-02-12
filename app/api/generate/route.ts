import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nano Banana — генерация изображений по тексту (Gemini 2.5 Flash Image)
const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY не задан. Добавьте его в настройках Vercel (Environment Variables).",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { query, optimizations } = body as {
      query: string;
      optimizations: string[];
    };

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Нужен текст запроса (query)." },
        { status: 400 }
      );
    }

    const prompt =
      optimizations?.length > 0
        ? `Уточнения к изображению: ${optimizations.join(", ")}.\n\nОписание изображения: ${query}\n\nСгенерируй изображение по этому описанию.`
        : `Сгенерируй изображение по описанию: ${query}`;

    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
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
        { error: `Изображение не сгенерировано (причина: ${blockReason})` },
        { status: 500 }
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    let imageBase64: string | null = null;
    let mimeType = "image/png";
    let text = "";

    for (const part of parts) {
      if (part.inlineData) {
        imageBase64 = part.inlineData.data ?? null;
        mimeType = part.inlineData.mimeType ?? "image/png";
      }
      if (part.text) text += part.text;
    }

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Модель не вернула изображение. Попробуйте другой запрос." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image: imageBase64,
      mimeType,
      text: text.trim() || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка генерации";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
