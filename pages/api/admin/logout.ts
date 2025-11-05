import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }
  res.setHeader("Set-Cookie", `admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return res.status(200).json({ ok: true });
}