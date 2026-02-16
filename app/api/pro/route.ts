import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getUrl(model: string) {
  return `${GEMINI_BASE}/${model}:generateContent`;
}

type ProMode = "text-to-image" | "image-to-image" | "edit" | "infographic" | "text-rendering";

async function callGemini(
  apiKey: string,
  model: string,
  body: { contents: unknown; generationConfig?: Record<string, unknown>; tools?: unknown[] }
) {
  const res = await fetch(`${getUrl(model)}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : { error: { message: await res.text() } };
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  }
  const blockReason = data?.candidates?.[0]?.finishReason;
  if (blockReason && blockReason !== "STOP" && blockReason !== "MAX_TOKENS") {
    throw new Error(`Генерация остановлена: ${blockReason}`);
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
  return { imageBase64, mimeType, text: text.trim() || null };
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY не задан." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const mode = body.mode as ProMode;

    const defaultModel = "gemini-2.5-flash-image";
    const imageModel = "gemini-2.5-flash-image";

    if (mode === "text-to-image") {
      const { prompt, style, aspectRatio, model: userModel } = body;
      if (!prompt || typeof prompt !== "string") {
        return NextResponse.json({ error: "Нужен промпт." }, { status: 400 });
      }
      const ratioHint: Record<string, string> = {
        "1:1": "square, 1:1 aspect ratio",
        "16:9": "wide landscape, 16:9",
        "9:16": "portrait, 9:16",
        "4:3": "4:3 aspect ratio",
      };
      const styleHint: Record<string, string> = {
        photorealistic: "photorealistic, high quality photo",
        anime: "anime style",
        "concept-art": "concept art style",
        "oil-painting": "oil painting style",
      };
      const styleStr = styleHint[style] || "";
      const ratioStr = ratioHint[aspectRatio] || "";
      const extras = [styleStr, ratioStr].filter(Boolean);
      const fullPrompt =
        extras.length > 0
          ? `Уточнения: ${extras.join(", ")}.\n\nОписание изображения: ${prompt}\n\nСгенерируй изображение по этому описанию.`
          : `Сгенерируй изображение по описанию: ${prompt}`;
      const model = userModel === "imagen-4" ? "gemini-2.5-flash-image" : defaultModel;
      const result = await callGemini(apiKey, model, {
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      });
      if (!result.imageBase64) {
        const hint = result.text ? ` Ответ модели: ${result.text.slice(0, 200)}` : "";
        return NextResponse.json(
          { error: `Модель не вернула изображение.${hint}` },
          { status: 500 }
        );
      }
      return NextResponse.json({ image: result.imageBase64, mimeType: result.mimeType, text: result.text });
    }

    if (mode === "image-to-image") {
      const { images = [], mimeTypes = [], prompt, strength = 80 } = body;
      const refs = [images[0], images[1], images[2]].filter(Boolean);
      if (refs.length === 0 || !prompt) {
        return NextResponse.json({ error: "Нужна минимум 1 картинка и описание." }, { status: 400 });
      }
      const parts: unknown[] = [];
      refs.forEach((data: string, i: number) => {
        parts.push({ inlineData: { mimeType: mimeTypes[i] || "image/png", data } });
      });
      const promptText =
        refs.length >= 2
          ? `Combine the style of image 1 with the composition of image 2, create: ${prompt}, seamless blend, coherent result, high quality. Reference influence strength: ${strength}%.`
          : `Using this reference image, create: ${prompt}, coherent result, high quality. Reference influence: ${strength}%.`;
      parts.push({ text: promptText });
      const result = await callGemini(apiKey, imageModel, {
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      });
      if (!result.imageBase64) return NextResponse.json({ error: "Модель не вернула изображение." }, { status: 500 });
      return NextResponse.json({ image: result.imageBase64, mimeType: result.mimeType, text: result.text });
    }

    if (mode === "edit") {
      const { image, mimeType, preset, details } = body;
      if (!image || !preset) {
        return NextResponse.json({ error: "Нужно изображение и тип редактирования." }, { status: 400 });
      }
      const templates: Record<string, string> = {
        "replace-background": `Replace the background with ${details || "a new background"}, keep the main subject unchanged, seamless integration, natural lighting match`,
        "remove-object": `Remove ${details || "the selected object"} from the image, inpaint the area naturally, seamless reconstruction, no traces left`,
        "change-colors": `Change ${details || "colors as described"} to new colors, maintain original lighting and shadows, natural color transition, photorealistic result`,
        "add-object": `Add ${details || "the described object"} to the image, natural placement, consistent lighting and perspective`,
        "change-style": `Change the style of the image: ${details || "apply the new style"}, coherent result, high quality`,
      };
      const editPrompt = templates[preset] || details || "Edit this image as requested.";
      const result = await callGemini(apiKey, imageModel, {
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: mimeType || "image/png", data: image } },
              { text: editPrompt },
            ],
          },
        ],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      });
      if (!result.imageBase64) return NextResponse.json({ error: "Модель не вернула изображение." }, { status: 500 });
      return NextResponse.json({ image: result.imageBase64, mimeType: result.mimeType, text: result.text });
    }

    if (mode === "infographic") {
      const { topic, useGoogleSearch, style, metrics } = body;
      if (!topic || typeof topic !== "string") {
        return NextResponse.json({ error: "Нужна тема инфографики." }, { status: 400 });
      }
      const styleMap: Record<string, string> = {
        editorial: "editorial",
        technical: "technical diagram",
        "hand-drawn": "hand-drawn",
        minimalist: "minimalist",
      };
      const styleStr = styleMap[style] || "editorial";

      let promptForImage = `Create an infographic about ${topic}.`;
      if (metrics) promptForImage += ` Include key data and metrics: ${metrics}.`;

      if (useGoogleSearch) {
        // Модель для картинок не поддерживает Google Search — сначала получаем актуальные данные текстовой моделью
        const searchModel = "gemini-2.5-flash";
        const searchUrl = `${GEMINI_BASE}/${searchModel}:generateContent`;
        const searchPrompt = `Topic for infographic: ${topic}.${metrics ? ` Focus on: ${metrics}.` : ""} Using current/recent data, list the most important facts, numbers, and points to show on an infographic. Be concise: 5–10 bullet points with key figures. Output in English, facts only.`;
        const searchRes = await fetch(`${searchUrl}?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { maxOutputTokens: 1024 },
          }),
        });
        const searchData = await searchRes.json().catch(() => ({}));
        if (searchRes.ok && searchData?.candidates?.[0]?.content?.parts) {
          const searchText = searchData.candidates[0].content.parts
            .map((p: { text?: string }) => p?.text ?? "")
            .join("")
            .trim();
          if (searchText) {
            promptForImage += ` Use this up-to-date content for the infographic:\n${searchText}`;
          }
        }
      }

      promptForImage += ` Style: ${styleStr}. Compress information into visual format, clear typography, data visualization with charts and icons, organized layout, professional design, high readability.`;
      const imageModel = "gemini-2.5-flash-image";
      const result = await callGemini(apiKey, imageModel, {
        contents: [{ role: "user", parts: [{ text: promptForImage }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      });
      if (!result.imageBase64) return NextResponse.json({ error: "Модель не вернула изображение." }, { status: 500 });
      return NextResponse.json({ image: result.imageBase64, mimeType: result.mimeType, text: result.text });
    }

    if (mode === "text-rendering") {
      const { exactText, language, textStyle, context } = body;
      if (!exactText) {
        return NextResponse.json({ error: "Нужен текст для отображения." }, { status: 400 });
      }
      const styleMap: Record<string, string> = {
        bold: "bold",
        calligraphy: "calligraphy",
        neon: "neon",
        "3d": "3D",
        handwritten: "handwritten",
      };
      const styleStr = styleMap[textStyle] || "bold";
      const promptText = `Generate image with accurate text rendering: "${exactText}", text style: ${styleStr}, language: ${language === "ru" ? "Russian" : "English"}, context: ${context || "clean background"}. Clear legible typography, precise letter spacing, high-fidelity text, no spelling errors, professional design.`;
      const result = await callGemini(apiKey, imageModel, {
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      });
      if (!result.imageBase64) return NextResponse.json({ error: "Модель не вернула изображение." }, { status: 500 });
      return NextResponse.json({ image: result.imageBase64, mimeType: result.mimeType, text: result.text });
    }

    return NextResponse.json({ error: "Неизвестный режим." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
