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
  const pattern = /^[A-Za-z0-9]{6}$/;
  if (!pattern.test(code)) return "El código debe tener exactamente 6 caracteres alfanuméricos";
  return null;
}

async function expireOldWaitingCodes() {
  const cutoff = new Date(Date.now() - WAITING_TIMEOUT_MINUTES * 60 * 1000);
  await prisma.parkingCode.updateMany({
    where: { status: "WAITING", fecha_creacion: { lte: cutoff } },
    data: { status: "EXPIRED" },
  });
}

async function expireOldClaimedUnpaidCodes() {
  const grace = parseInt(process.env.PAYMENT_GRACE_MINUTES || "60", 10);
  const cutoff = new Date(Date.now() - grace * 60 * 1000);
  const pending = await prisma.payment.findMany({
    where: { status: "PENDING", created_at: { lte: cutoff } },
    select: { codigo: true },
  });
  if (pending.length === 0) return;
  const codigos = Array.from(new Set(pending.map((p) => p.codigo))).filter(Boolean);
  if (codigos.length === 0) return;
  await prisma.parkingCode.updateMany({
    where: { codigo: { in: codigos }, status: "CLAIMED" },
    data: { status: "EXPIRED" },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    await expireOldWaitingCodes();
    await expireOldClaimedUnpaidCodes();
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "fecha_creacion";
    const order = typeof req.query.order === "string" ? req.query.order.toLowerCase() : "desc";
    const spaceParam = typeof req.query.space_id === "string" ? req.query.space_id : undefined;
    const space_id = spaceParam ? Number(spaceParam) : undefined;

    const where: any = {};
    if (status) where.status = status as any;
    if (q) where.codigo = { contains: q };
    if (space_id && Number.isInteger(space_id)) where.space_id = space_id;

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
    const spaceIdRaw = body?.space_id;
    const space_id = Number(spaceIdRaw);
    if (!code) return res.status(400).json({ error: "Código requerido" });
    if (spaceIdRaw === undefined) {
      if (!status || !["CLAIMED", "WAITING", "EXPIRED"].includes(status)) {
        return res.status(400).json({ error: "Estado inválido" });
      }
    }
    try {
      if (spaceIdRaw !== undefined) {
        if (!Number.isInteger(space_id) || space_id < 1 || space_id > 3) {
          return res.status(400).json({ error: "space_id inválido (1-3)" });
        }
        const current = await prisma.parkingCode.findUnique({
          where: { codigo: code },
          select: { status: true, space_id: true },
        });
        if (!current) return res.status(404).json({ error: "Código no encontrado" });
        if (current.status === "EXPIRED") return res.status(400).json({ error: "Código expirado" });
        if (current.status !== "WAITING") return res.status(400).json({ error: "El código debe estar en estado WAITING" });

        const targetSpace = await prisma.parkingSpace.findUnique({
          where: { id: space_id },
          select: { id: true, occupied: true, updated_at: true },
        });
        if (!targetSpace) return res.status(404).json({ error: "Espacio no encontrado" });

        const alreadyClaimed = await prisma.parkingCode.findFirst({
          where: { space_id, status: "CLAIMED" },
          select: { codigo: true },
        });
        if (alreadyClaimed) {
          return res.status(400).json({ error: "Espacio con código ya registrado" });
        }

        if (current.space_id && current.space_id !== space_id) {
          const otherSpace = await prisma.parkingSpace.findUnique({
            where: { id: current.space_id },
            select: { occupied: true },
          });
          if (otherSpace?.occupied) return res.status(400).json({ error: "El código está vinculado a otro espacio ocupado" });
        }

        const updated = await prisma.parkingCode.update({
          where: { codigo: code },
          data: { space_id, status: "CLAIMED" },
          select: { codigo: true, status: true, fecha_creacion: true, fecha_actualizacion: true, space_id: true },
        });
        await logAction({ req, action: "QR_ASSOCIATED", data: { codigo: code, space_id }, codigo: code });
        return res.status(200).json({ ok: true, code: updated });
      }

      if (status === "CLAIMED") {
        const current = await prisma.parkingCode.findUnique({
          where: { codigo: code },
          select: { status: true, fecha_creacion: true },
        });
        if (!current) return res.status(404).json({ error: "Código no encontrado. Debe ser generado por el ESP32." });
        if (current.status === "EXPIRED") return res.status(400).json({ error: "No se puede reclamar un código expirado." });
        if (current.status !== "WAITING") return res.status(400).json({ error: "El código no está en estado WAITING." });
      }

      // Seguridad: impedir cambios manuales sobre códigos CLAIMED asociados a un espacio activo o en liberación
      const currentForChange = await prisma.parkingCode.findUnique({
        where: { codigo: code },
        select: { status: true, space_id: true },
      });
      if (currentForChange?.status === "CLAIMED" && currentForChange.space_id) {
        const s = await prisma.parkingSpace.findUnique({ where: { id: currentForChange.space_id }, select: { occupied: true } });
        if (s?.occupied) {
          return res.status(400).json({ error: "No se puede modificar un código registrado mientras el espacio está ocupado" });
        }
      }

      const updated = await prisma.parkingCode.update({
        where: { codigo: code },
        data: { status: status as any },
        select: { codigo: true, status: true, fecha_creacion: true, fecha_actualizacion: true },
      });
      await logAction({ req, action: "CHANGE_STATUS", data: { codigo: code, status }, codigo: code });
      return res.status(200).json({ ok: true, code: updated });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (/Record to update not found|P2025/.test(msg)) {
        return res.status(404).json({ error: "Código no encontrado. Debe ser generado por el ESP32." });
      }
      return res.status(400).json({ error: msg });
    }
  }

  res.setHeader("Allow", "GET,POST,PATCH");
  return res.status(405).json({ error: "Método no permitido" });
}