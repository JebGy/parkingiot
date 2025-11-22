import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/prisma"
import { verifyAuthorizationBearer } from "@/lib/jwt"
import { consumeRateLimit } from "@/lib/rateLimit"
import { decideServoAction } from "@/lib/servo"
import { publishServoAction } from "@/lib/rabbit"

function getClientIp(req: NextApiRequest) {
  const xfwd = req.headers["x-forwarded-for"]
  const xreal = req.headers["x-real-ip"]
  const first = Array.isArray(xfwd) ? xfwd[0] : typeof xfwd === "string" ? xfwd.split(",")[0]?.trim() : undefined
  return first || (Array.isArray(xreal) ? xreal[0] : (xreal as string)) || req.socket.remoteAddress || "unknown"
}

function validCode(code: string) {
  return /^[A-Za-z0-9]{6}$/.test(code)
}

let successCount = 0
let errorCount = 0

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH")
    return res.status(405).json({ error: "Método no permitido" })
  }

  const key = `${getClientIp(req)}:codigos_estado`
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10)
  const max = parseInt(process.env.RATE_LIMIT_MAX || "60", 10)
  const rl = consumeRateLimit(key, windowMs, max)
  if (!rl.allowed) {
    res.setHeader("Retry-After", Math.ceil(rl.resetMs / 1000).toString())
    return res.status(429).json({ error: "Demasiadas solicitudes" })
  }

  const auth = verifyAuthorizationBearer(req)
  if (!auth.ok) return res.status(401).json({ error: auth.error })

  const codigoParam = typeof req.query.codigo_id === "string" ? req.query.codigo_id : ""
  const body = req.body || {}
  const estado = (body?.estado ?? "").toString().trim().toLowerCase()
  if (!codigoParam) return res.status(400).json({ error: "codigo_id requerido" })
  if (!validCode(codigoParam)) return res.status(400).json({ error: "Formato de codigo_id inválido" })
  if (estado !== "pagado") return res.status(400).json({ error: "estado debe ser 'pagado'" })

  try {
    const code = await prisma.parkingCode.findUnique({ where: { codigo: codigoParam } })
    if (!code) return res.status(404).json({ error: "Código no encontrado" })

    const lastPayment = await prisma.payment.findFirst({ where: { codigo: codigoParam }, orderBy: { created_at: "desc" } })
    if (!lastPayment) return res.status(404).json({ error: "Pago no encontrado" })
    if (lastPayment.status === "PAID") return res.status(409).json({ error: "Estado ya pagado" })

    const now = new Date()
    const [updated] = await prisma.$transaction([
      prisma.payment.updateMany({ where: { id: lastPayment.id, status: "PENDING" }, data: { status: "PAID", paid_at: now } })
    ])
    if (updated.count === 0) return res.status(409).json({ error: "Conflicto de concurrencia" })

    const refreshed = await prisma.payment.findUnique({ where: { id: lastPayment.id } })
    const action = refreshed ? decideServoAction(refreshed, code) : 0
    const sent = await publishServoAction(codigoParam, action)

    await prisma.auditLog.create({ data: { usuario_id: auth.payload?.sub ? String(auth.payload.sub) : null, ip: getClientIp(req), accion: "CODE_PAID", datos: { codigo_id: codigoParam, servo_action: action, notif_sent: sent }, codigo: codigoParam } })
    successCount += 1
    return res.status(200).json({ status: "success", servo_action: action, timestamp: new Date().toISOString(), codigo_id: codigoParam })
  } catch {
    errorCount += 1
    return res.status(500).json({ error: "Error interno" })
  }
}