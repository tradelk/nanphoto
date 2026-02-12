import { NextResponse } from "next/server";
import { getAuthCookieHeaders } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  Object.entries(getAuthCookieHeaders(false)).forEach(([key, value]) => {
    res.headers.append(key, value);
  });
  return res;
}
