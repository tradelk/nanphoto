import { NextRequest, NextResponse } from "next/server";
import { getGalleryImage } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return new NextResponse(null, { status: 401 });
  }
  const { id } = await params;
  if (!id) return new NextResponse(null, { status: 404 });
  try {
    const row = await getGalleryImage(id);
    if (!row) return new NextResponse(null, { status: 404 });
    const buffer = Buffer.from(row.image_base64, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": row.mime_type,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
