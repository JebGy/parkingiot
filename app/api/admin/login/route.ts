import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function sign(data: string) {
  const secret = process.env.ADMIN_SECRET || "secret";
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body?.password || "");
  const adminPass = process.env.ADMIN_PASSWORD || "";
  if (!adminPass) return NextResponse.json({ error: "ADMIN_PASSWORD no configurado" }, { status: 500 });
  if (password !== adminPass) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

  const ts = Date.now().toString();
  const sig = sign(ts);
  const value = `${ts}.${sig}`;

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_session", value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  return res;
}