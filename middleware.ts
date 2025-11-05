import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function hmacSHA256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const bytes = new Uint8Array(signature);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verify(value: string | undefined) {
  if (!value) return false;
  const [ts, sig] = value.split(".");
  if (!ts || !sig) return false;
  const secret = process.env.ADMIN_SECRET || "secret";
  const expected = await hmacSHA256(secret, ts);
  return expected === sig;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const cookie = req.cookies.get("admin_session")?.value;
    if (!(await verify(cookie))) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};