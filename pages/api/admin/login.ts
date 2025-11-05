import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

function sign(data: string) {
  const secret = process.env.ADMIN_SECRET || "secret";
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }
  const password = String(req.body?.password || "");
  const adminPass = process.env.ADMIN_PASSWORD || "";
  if (!adminPass) return res.status(500).json({ error: "ADMIN_PASSWORD no configurado" });
  if (password !== adminPass) return res.status(401).json({ error: "Credenciales inválidas" });

  const ts = Date.now().toString();
  const sig = sign(ts);
  const value = `${ts}.${sig}`;

  res.setHeader("Set-Cookie", `admin_session=${value}; HttpOnly; Path=/; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return res.status(200).json({ ok: true });
}