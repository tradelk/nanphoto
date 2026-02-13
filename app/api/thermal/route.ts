import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const BASE_PROMPT =
  "Convert this image to black and white line art suitable for thermal printer. High contrast monochrome. No gray tones, only pure black and white. Isolated subject only, centered composition, compact layout optimized for small thermal printer paper. Vector-style edges, sharp crisp boundaries. Sticker-style cut-out, no shadows, flat design, ready for printing.";

type CategoryId = "portrait" | "objects" | "logos" | "";
const CATEGORY_ADDITIONS: Record<CategoryId, string> = {
  portrait: " Focus on face and shoulders, clear facial features, portrait-optimized line art.",
  objects: " Product or object focus, clear edges, no background.",
  logos: " Icon or logo style, simple shapes, minimal lines.",
  "": "",
};

function buildPrompt(opts: {
  category: string;
  style: string;
  detailLevel: string;
  outlineThickness: string;
  backgroundRemoval: boolean;
  paperSize: string;
}): string {
  const parts: string[] = [BASE_PROMPT];

  if (opts.category && CATEGORY_ADDITIONS[opts.category as CategoryId]) {
    parts.push(CATEGORY_ADDITIONS[opts.category as CategoryId]);
  }

  const styleMap: Record<string, string> = {
    "line-art": "Use clean line art style.",
    stencil: "Use stencil style, bold cut-out look.",
    stamp: "Use stamp style, rubber stamp aesthetic.",
    halftone: "Use halftone/dotted style where appropriate.",
  };
  if (opts.style && styleMap[opts.style]) parts.push(styleMap[opts.style]);

  const detailMap: Record<string, string> = {
    simplified: "Simplified details, minimal lines.",
    medium: "Medium level of detail.",
    detailed: "Detailed, intricate lines.",
  };
  if (opts.detailLevel && detailMap[opts.detailLevel]) parts.push(detailMap[opts.detailLevel]);

  const outlineMap: Record<string, string> = {
    thin: "Thin outlines.",
    medium: "Medium thickness outlines.",
    bold: "Thick bold black outlines.",
  };
  if (opts.outlineThickness && outlineMap[opts.outlineThickness]) parts.push(outlineMap[opts.outlineThickness]);

  if (opts.backgroundRemoval) {
    parts.push("Remove all background. Clean white background only.");
  }

  const paperMap: Record<string, string> = {
    "58mm": "Optimized for 58mm thermal paper width.",
    "80mm": "Optimized for 80mm thermal paper width.",
  };
  if (opts.paperSize && paperMap[opts.paperSize]) parts.push(paperMap[opts.paperSize]);

  return parts.join(" ");
}

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    const {
      image,
      mimeType = "image/png",
      category = "",
      style = "",
      detailLevel = "",
      outlineThickness = "",
      backgroundRemoval = true,
      paperSize = "",
    } = body as {
      image?: string;
      mimeType?: string;
      category?: string;
      style?: string;
      detailLevel?: string;
      outlineThickness?: string;
      backgroundRemoval?: boolean;
      paperSize?: string;
    };

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Нужно поле image (base64)." }, { status: 400 });
    }

    const prompt = buildPrompt({
      category: category || "",
      style: style || "",
      detailLevel: detailLevel || "",
      outlineThickness: outlineThickness || "",
      backgroundRemoval: !!backgroundRemoval,
      paperSize: paperSize || "",
    });

    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: mimeType || "image/png", data: image } },
              { text: prompt },
            ],
          },
        ],
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
    let outMimeType = "image/png";
    let text = "";

    for (const part of parts) {
      if (part.inlineData) {
        imageBase64 = part.inlineData.data ?? null;
        outMimeType = part.inlineData.mimeType ?? "image/png";
      }
      if (part.text) text += part.text;
    }

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Модель не вернула изображение. Попробуйте другую картинку или настройки." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image: imageBase64,
      mimeType: outMimeType,
      text: text.trim() || null,
      promptUsed: prompt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка конвертации";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
