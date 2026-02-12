import { NextRequest, NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "nanphoto-gallery/";
const INDEX_PATH = "nanphoto-gallery/index.json";
const MAX_ITEMS = 40;

export type GalleryItem = {
  id: string;
  url: string;
  mimeType: string;
  text: string | null;
};

async function getIndexUrl(): Promise<string | null> {
  const { blobs } = await list({ prefix: PREFIX });
  const indexBlob = blobs.find((b) => b.pathname === INDEX_PATH || b.pathname?.endsWith("index.json"));
  return indexBlob?.url ?? null;
}

async function getGalleryItems(): Promise<GalleryItem[]> {
  const url = await getIndexUrl();
  if (!url) return [];
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json([], { status: 401 });
  }
  try {
    const items = await getGalleryItems();
    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Хранилище галереи не настроено (BLOB_READ_WRITE_TOKEN)." },
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
    const buffer = Buffer.from(image, "base64");

    const blob = await put(`${PREFIX}${id}.png`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    const newItem: GalleryItem = {
      id,
      url: blob.url,
      mimeType: contentType,
      text: text ?? null,
    };

    const items = await getGalleryItems();
    const updated = [newItem, ...items].slice(0, MAX_ITEMS);

    await put(INDEX_PATH, JSON.stringify({ items: updated }), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка сохранения";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
