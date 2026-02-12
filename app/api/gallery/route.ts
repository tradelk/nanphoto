import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getGalleryItems, addGalleryItem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 40;

export type GalleryItem = {
  id: string;
  url: string;
  mimeType: string;
  text: string | null;
};

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json([], { status: 401 });
  }
  try {
    const rows = await getGalleryItems();
    const base = getBaseUrl(request);
    const items: GalleryItem[] = rows.map((r) => ({
      id: r.id,
      url: `${base}/api/gallery/${r.id}/image`,
      mimeType: r.mime_type,
      text: r.text,
    }));
    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "База данных не настроена (DATABASE_URL). Подключите Neon в Netlify." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const { image, mimeType, text } = body as {
      image?: string;
      mimeType?: string;
      text?: string | null;
    };
    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Нужно поле image (base64)." }, { status: 400 });
    }
    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const contentType = mimeType || "image/png";

    await addGalleryItem(id, image, contentType, text ?? null);

    const rows = await getGalleryItems();
    const base = getBaseUrl(request);
    const items: GalleryItem[] = rows.map((r) => ({
      id: r.id,
      url: `${base}/api/gallery/${r.id}/image`,
      mimeType: r.mime_type,
      text: r.text,
    }));

    return NextResponse.json(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка сохранения";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
