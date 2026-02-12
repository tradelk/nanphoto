import { createHash } from "crypto";

const COOKIE_NAME = "nanphoto_sess";

function getSessionToken(): string {
  const password = process.env.NANPHOTO_PASSWORD;
  if (!password) return "";
  return createHash("sha256").update(password).digest("hex");
}

export function isAuthEnabled(): boolean {
  return Boolean(process.env.NANPHOTO_PASSWORD);
}

export function isAuthenticated(request: Request): boolean {
  if (!isAuthEnabled()) return true;
  const token = getSessionToken();
  if (!token) return true;
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return false;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1].trim() === token : false;
}

export function getAuthCookieHeaders(authenticated: boolean): Record<string, string> {
  const token = getSessionToken();
  if (authenticated && token) {
    return {
      "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
    };
  }
  return {
    "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  };
}
