import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TEXT_MODEL = "gemini-2.5-flash";

function getUrl(model: string) {
  return `${GEMINI_BASE}/${model}:generateContent`;
}

/** Проверяет, подразумевает ли запрос надписи/текст на изображении (рус. или англ.). */
function promptImpliesTextOnImage(prompt: string): boolean {
  if (!prompt || typeof prompt !== "string") return false;
  const lower = prompt.toLowerCase().trim();
  const keywords = [
    "надпись", "надписи", "с надписью", "с текстом", "текст на", "подпись", "подписи",
    "слова", "слово", "цитата", "слоган", "лозунг", "caption", "label", "labels",
    "text on", "with text", "with the text", "words on", "quote on", "saying",
    "написать", "изобразить текст", "отобразить текст", "вывести текст",
    "буквы", "надпись на", "текст в", "подпись под",
  ];
  return keywords.some((k) => lower.includes(k));
}

/**
 * Получает от текстовой модели исправленный вариант текста для надписи на картинке.
 * Возвращает null, если надписи не требуется или не удалось извлечь.
 */
async function getCorrectedTextForImage(apiKey: string, userPrompt: string): Promise<string | null> {
  const url = `${GEMINI_BASE}/${TEXT_MODEL}:generateContent`;
  const systemPrompt = `You are a spelling/grammar checker for text that will be rendered on images.
Task: From the user's image generation request, extract the exact phrase(s) or word(s) that should appear ON the image (sign, label, caption, slogan, quote). 
Correct spelling and grammar for Russian and English. Preserve the meaning and style.
Output ONLY the corrected text that must be drawn on the image, nothing else. If the request does not specify any text to display on the image, reply with exactly: NONE.`;

  try {
    const res = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUser request: ${userPrompt}` }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.2 },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.candidates?.[0]?.content?.parts) return null;
    const text = data.candidates[0].content.parts
      .map((p: { text?: string }) => p?.text ?? "")
      .join("")
      .trim();
    if (!text || text.toUpperCase() === "NONE") return null;
    return text;
  } catch {
    return null;
  }
}

/** Жёсткое ограничение: модель не добавляет свой текст и строго придерживается указанного. */
const IMAGE_TEXT_STRICT_INSTRUCTION =
  "\n\nSTRICT RULE — text on image: Do not add any captions, labels, slogans, or other text unless the request explicitly asks for specific text. If you render any text (Russian or English), it must be exactly and only the text specified in the instructions above—no variations, no additions, no extra words.";

/** Добавляет в промпт для изображения инструкцию по точному отображению проверенного текста. */
function appendCorrectedTextInstruction(imagePrompt: string, correctedText: string): string {
  return `${imagePrompt}\n\nCRITICAL — text on image: You MUST display exactly this text on the image with correct spelling and grammar. Render it accurately, do not alter or paraphrase: "${correctedText}"`;
}

/** Исправляет орфографию и грамматику одной фразы (для режима text-rendering). */
async function correctSpellingOnly(apiKey: string, text: string): Promise<string> {
  if (!text || !text.trim()) return text;
  const url = `${GEMINI_BASE}/${TEXT_MODEL}:generateContent`;
  try {
    const res = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{
            text: `Correct spelling and grammar for the following text (Russian or English). Output ONLY the corrected text, nothing else:\n\n${text.trim()}`,
          }],
        }],
        generationConfig: { maxOutputTokens: 128, temperature: 0.1 },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.candidates?.[0]?.content?.parts) return text;
    const corrected = data.candidates[0].content.parts
      .map((p: { text?: string }) => p?.text ?? "")
      .join("")
      .trim();
    return corrected || text;
  } catch {
    return text;
  }
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
      let fullPrompt =
        extras.length > 0
          ? `Уточнения: ${extras.join(", ")}.\n\nОписание изображения: ${prompt}\n\nСгенерируй изображение по этому описанию.`
          : `Сгенерируй изображение по описанию: ${prompt}`;
      if (promptImpliesTextOnImage(prompt)) {
        const corrected = await getCorrectedTextForImage(apiKey, prompt);
        if (corrected) fullPrompt = appendCorrectedTextInstruction(fullPrompt, corrected);
      }
      fullPrompt += IMAGE_TEXT_STRICT_INSTRUCTION;
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
      let promptText =
        refs.length >= 2
          ? `Combine the style of image 1 with the composition of image 2, create: ${prompt}, seamless blend, coherent result, high quality. Reference influence strength: ${strength}%.`
          : `Using this reference image, create: ${prompt}, coherent result, high quality. Reference influence: ${strength}%.`;
      if (promptImpliesTextOnImage(prompt)) {
        const corrected = await getCorrectedTextForImage(apiKey, prompt);
        if (corrected) promptText = appendCorrectedTextInstruction(promptText, corrected);
      }
      promptText += IMAGE_TEXT_STRICT_INSTRUCTION;
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
      let editPrompt = templates[preset] || details || "Edit this image as requested.";
      const detailStr = typeof details === "string" ? details : "";
      if (detailStr && promptImpliesTextOnImage(detailStr)) {
        const corrected = await getCorrectedTextForImage(apiKey, detailStr);
        if (corrected) editPrompt = appendCorrectedTextInstruction(editPrompt, corrected);
      }
      editPrompt += IMAGE_TEXT_STRICT_INSTRUCTION;
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

      promptForImage += ` Style: ${styleStr}. Compress information into visual format, clear typography, data visualization with charts and icons, organized layout, professional design, high readability. Any text or labels on the infographic must have correct spelling and grammar (Russian and English).`;
      promptForImage += IMAGE_TEXT_STRICT_INSTRUCTION;
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
      const exactTextCorrected = await correctSpellingOnly(apiKey, exactText);
      const styleMap: Record<string, string> = {
        bold: "bold",
        calligraphy: "calligraphy",
        neon: "neon",
        "3d": "3D",
        handwritten: "handwritten",
      };
      const styleStr = styleMap[textStyle] || "bold";
      let promptText = `Generate image with accurate text rendering: "${exactTextCorrected}", text style: ${styleStr}, language: ${language === "ru" ? "Russian" : "English"}, context: ${context || "clean background"}. Clear legible typography, precise letter spacing, high-fidelity text, render EXACTLY this text with correct spelling, professional design.`;
      promptText += IMAGE_TEXT_STRICT_INSTRUCTION;
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
