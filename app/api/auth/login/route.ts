import { NextRequest, NextResponse } from "next/server";
import { isAuthEnabled, getAuthCookieHeaders } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true });
  }
  const body = await request.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  const expected = process.env.NANPHOTO_PASSWORD ?? "";
  if (password !== expected) {
    return NextResponse.json({ ok: false, error: "Неверный пароль" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  Object.entries(getAuthCookieHeaders(true)).forEach(([key, value]) => {
    res.headers.append(key, value);
  });
  return res;
}
