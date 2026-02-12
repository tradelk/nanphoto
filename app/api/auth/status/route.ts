import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, isAuthEnabled } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ok = isAuthenticated(request);
  const authRequired = isAuthEnabled();
  return NextResponse.json({ ok, authRequired });
}
