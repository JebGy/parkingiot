import type { NextApiRequest } from "next"
import crypto from "crypto"

function base64UrlDecode(input: string) {
  const str = input.replace(/-/g, "+").replace(/_/g, "/")
  const pad = str.length % 4 === 0 ? 0 : 4 - (str.length % 4)
  const padded = str + "=".repeat(pad)
  return Buffer.from(padded, "base64")
}

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function verifyAuthorizationBearer(req: NextApiRequest) {
  const auth = req.headers["authorization"]
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  if (!token) return { ok: false, error: "No autorizado" }
  const secret = process.env.JWT_SECRET || ""
  if (!secret) return { ok: false, error: "Configuración inválida" }
  const parts = token.split(".")
  if (parts.length !== 3) return { ok: false, error: "Token inválido" }
  const [h, p, s] = parts
  let header
  let payload
  try {
    header = JSON.parse(base64UrlDecode(h).toString("utf8"))
    payload = JSON.parse(base64UrlDecode(p).toString("utf8"))
  } catch {
    return { ok: false, error: "Token inválido" }
  }
  if (header.alg !== "HS256" || header.typ !== "JWT") return { ok: false, error: "Token inválido" }
  const data = Buffer.from(`${h}.${p}`)
  const expected = crypto.createHmac("sha256", secret).update(data).digest()
  const got = base64UrlDecode(s)
  if (!timingSafeEqual(expected, got)) return { ok: false, error: "Token inválido" }
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === "number" && payload.exp < now) return { ok: false, error: "Token expirado" }
  return { ok: true, payload }
}