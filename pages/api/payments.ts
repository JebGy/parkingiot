import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

function getClientIp(req: NextApiRequest) {
  const xfwd = req.headers["x-forwarded-for"];
  const xreal = req.headers["x-real-ip"];
  const first = Array.isArray(xfwd) ? xfwd[0] : typeof xfwd === "string" ? xfwd.split(",")[0]?.trim() : undefined;
  return first || (Array.isArray(xreal) ? xreal[0] : (xreal as string)) || req.socket.remoteAddress || "unknown";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const spaceParam = typeof req.query.space_id === "string" ? req.query.space_id : undefined;
    const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;
    const codigo = typeof req.query.codigo === "string" ? req.query.codigo : undefined;
    const where: any = {};
    if (spaceParam) {
      const sid = Number(spaceParam);
      if (Number.isInteger(sid)) where.space_id = sid;
    }
    if (status && ["PENDING", "PAID"].includes(status)) where.status = status;
    if (codigo) where.codigo = codigo;
    const payments = await prisma.payment.findMany({
      where,
      orderBy: { created_at: "desc" },
      select: { id: true, codigo: true, space_id: true, amount: true, currency: true, status: true, created_at: true, paid_at: true },
    });
    return res.status(200).json({ payments });
  }

  if (req.method === "PATCH") {
    const body = req.body || {};
    const codigo = (body?.codigo ?? body?.code ?? "").toString().trim();
    if (!codigo) return res.status(400).json({ error: "Código requerido" });
    const pending = await prisma.payment.findFirst({
      where: { codigo, status: "PENDING" },
      orderBy: { created_at: "desc" },
      select: { id: true },
    });
    if (!pending) return res.status(404).json({ error: "Pago pendiente no encontrado" });
    const updated = await prisma.payment.update({
      where: { id: pending.id },
      data: { status: "PAID", paid_at: new Date() },
      select: { id: true, codigo: true, amount: true, currency: true, status: true, paid_at: true },
    });
    try {
      await prisma.auditLog.create({
        data: { usuario_id: "UI", ip: getClientIp(req), accion: "PAYMENT_PAID", datos: { codigo }, codigo },
      });
    } catch {}
    return res.status(200).json({ ok: true, payment: updated });
  }

  res.setHeader("Allow", "GET,PATCH");
  return res.status(405).json({ error: "Método no permitido" });
}