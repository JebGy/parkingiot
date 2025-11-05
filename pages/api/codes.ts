import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const WAITING_TIMEOUT_MINUTES = parseInt(process.env.WAITING_TIMEOUT_MINUTES || "30", 10);

function getClientIp(req: NextApiRequest) {
  const xfwd = req.headers["x-forwarded-for"]; // string | string[] | undefined
  const xreal = req.headers["x-real-ip"];
  const first = Array.isArray(xfwd) ? xfwd[0] : typeof xfwd === "string" ? xfwd.split(",")[0]?.trim() : undefined;
  return first || (Array.isArray(xreal) ? xreal[0] : (xreal as string)) || req.socket.remoteAddress || "unknown";
}

async function logAction(opts: { req: NextApiRequest; userId?: string | null; action: string; data: Record<string, any>; codigo?: string | null; }) {
  try {
    await prisma.auditLog.create({
      data: {
        usuario_id: opts.userId ?? null,
        ip: getClientIp(opts.req),
        accion: opts.action,
        datos: opts.data as any,
        codigo: opts.codigo ?? null,
      },
    });
  } catch (e) {
    console.warn("Failed to write audit log", e);
  }
}

function validateCodeFormat(code: string) {
  const pattern = /^\d{6}$/;
  if (!pattern.test(code)) return "El código debe tener 6 dígitos numéricos";
  return null;
}

async function expireOldWaitingCodes() {
  const cutoff = new Date(Date.now() - WAITING_TIMEOUT_MINUTES * 60 * 1000);
  await prisma.parkingCode.updateMany({
    where: { status: "WAITING", fecha_creacion: { lte: cutoff } },
    data: { status: "EXPIRED" },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    await expireOldWaitingCodes();
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "fecha_creacion";
    const order = typeof req.query.order === "string" ? req.query.order.toLowerCase() : "desc";

    const where: any = {};
    if (status) where.status = status as any;
    if (q) where.codigo = { contains: q };

    const codes = await prisma.parkingCode.findMany({
      where,
      orderBy: { [sort!]: order === "asc" ? "asc" : "desc" } as any,
      select: { codigo: true, status: true, fecha_creacion: true, fecha_actualizacion: true },
    });
    await logAction({ req, action: "LIST_CODES", data: { status, q, sort, order } });
    return res.status(200).json({ codes });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const code = (body?.codigo ?? body?.code ?? "").toString().trim();
    if (!code) return res.status(400).json({ error: "Código requerido" });
    const fmtError = validateCodeFormat(code);
    if (fmtError) return res.status(400).json({ error: fmtError });

    try {
      const created = await prisma.parkingCode.create({
        data: { codigo: code, status: "WAITING" },
        select: { codigo: true, status: true, fecha_creacion: true, fecha_actualizacion: true },
      });
      await logAction({ req, action: "SUBMIT_CODE", data: { codigo: code }, codigo: code });
      return res.status(200).json({ ok: true, code: created });
    } catch (e: any) {
      const msg = /Unique constraint failed/i.test(e.message) ? "El código ya existe" : e.message;
      return res.status(400).json({ error: msg });
    }
  }

  if (req.method === "PATCH") {
    const body = req.body || {};
    const code = (body?.codigo ?? body?.code ?? "").toString().trim();
    const status = (body?.status ?? "").toString().trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "Código requerido" });
    if (!status || !["CLAIMED", "WAITING", "EXPIRED"].includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }
    try {
      const updated = await prisma.parkingCode.update({
        where: { codigo: code },
        data: { status: status as any },
        select: { codigo: true, status: true, fecha_creacion: true, fecha_actualizacion: true },
      });
      await logAction({ req, action: "CHANGE_STATUS", data: { codigo: code, status }, codigo: code });
      return res.status(200).json({ ok: true, code: updated });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  res.setHeader("Allow", "GET,POST,PATCH");
  return res.status(405).json({ error: "Método no permitido" });
}