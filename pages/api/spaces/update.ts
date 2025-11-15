import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

function getClientIp(req: NextApiRequest) {
  const xfwd = req.headers["x-forwarded-for"];
  const xreal = req.headers["x-real-ip"];
  const first = Array.isArray(xfwd)
    ? xfwd[0]
    : typeof xfwd === "string"
      ? xfwd.split(",")[0]?.trim()
      : undefined;
  return (
    first ||
    (Array.isArray(xreal) ? xreal[0] : (xreal as string)) ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { id_espacio, estado, timestamp } = req.body || {};

    const id = Number(id_espacio);
    if (!Number.isInteger(id) || id < 1 || id > 3) {
      return res.status(400).json({ error: "id_espacio inválido (1-3)" });
    }
    if (typeof estado !== "boolean") {
      return res.status(400).json({ error: "estado debe ser boolean" });
    }
    const ts = new Date(timestamp);
    if (isNaN(ts.getTime())) {
      return res.status(400).json({ error: "timestamp inválido" });
    }

    // Upsert estado actual del espacio
    const space = await prisma.parkingSpace.upsert({
      where: { id },
      update: { occupied: estado, updated_at: ts },
      create: { id, occupied: estado, updated_at: ts },
      select: { id: true, occupied: true, updated_at: true },
    });

    // Registrar en historial
    await prisma.spaceLog.create({
      data: {
        space_id: id,
        occupied: estado,
        timestamp: ts,
        ip: getClientIp(req),
      },
    });

    // También auditar en AuditLog por trazabilidad general
    try {
      await prisma.auditLog.create({
        data: {
          usuario_id: "ESP32",
          ip: getClientIp(req),
          accion: "SPACE_UPDATE",
          datos: { id_espacio: id, estado, timestamp: ts.toISOString() } as any,
        },
      });
    } catch {}

    // Si el espacio pasó a ocupado, generar/obtener código WAITING asociado al espacio
    let code: string | undefined;
    if (estado === true) {
      // Reutiliza código activo si existe; si no, genera uno nuevo
      const cutoff = new Date(
        Date.now() -
          parseInt(process.env.WAITING_TIMEOUT_MINUTES || "30", 10) * 60 * 1000,
      );
      const existing = await prisma.parkingCode.findFirst({
        where: {
          space_id: id,
          status: "WAITING",
          fecha_creacion: { gt: cutoff },
        },
        select: { codigo: true },
      });
      if (existing) {
        code = existing.codigo;
      } else {
        // intenta generar único
        for (let i = 0; i < 5; i++) {
          const c = Math.floor(100000 + Math.random() * 900000).toString();
          try {
            await prisma.parkingCode.create({
              data: { codigo: c, status: "WAITING", space_id: id },
            });
            code = c;
            break;
          } catch (e: any) {
            if (!/Unique constraint failed/i.test(e?.message || "")) throw e;
          }
        }
      }
    }
    // Si el espacio pasó a libre, gestionar pagos y expiración condicionada de códigos
    if (estado === false) {
      const start = await prisma.spaceLog.findFirst({
        where: { space_id: id, occupied: true },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true },
      });
      if (start) {
        const ms = ts.getTime() - new Date(start.timestamp).getTime();
        if (ms > 0) {
          const minutes = Math.round(ms / 60000);
          const nearest = Math.round(minutes / 15) * 15;
          const intervals = Math.max(nearest / 15, 0);
          const base = 5;
          const calculated = intervals * base;
          const finalAmount = Math.max(calculated, 1);
          const assoc = await prisma.parkingCode.findFirst({
            where: { space_id: id, status: "CLAIMED" },
            orderBy: { fecha_actualizacion: "desc" },
            select: { codigo: true },
          });
          if (assoc?.codigo) {
            try {
              await prisma.payment.create({
                data: {
                  codigo: assoc.codigo,
                  space_id: id,
                  amount: finalAmount as any,
                  amount_calculated: calculated as any,
                  amount_final: finalAmount as any,
                  time_used_minutes: nearest,
                  currency: "PEN",
                  status: "PENDING",
                },
              });
            } catch {}
          }
        }
      }
      const expiredWaiting = await prisma.parkingCode.updateMany({
        where: { space_id: id, status: "WAITING" },
        data: { status: "EXPIRED" },
      });
      const claimed = await prisma.parkingCode.findFirst({
        where: { space_id: id, status: "CLAIMED" },
        orderBy: { fecha_actualizacion: "desc" },
        select: { codigo: true },
      });
      if (claimed?.codigo) {
        const pay = await prisma.payment.findFirst({
          where: { codigo: claimed.codigo },
          orderBy: { created_at: "desc" },
          select: { status: true },
        });
        if (pay?.status === "PAID") {
          await prisma.parkingCode.update({ where: { codigo: claimed.codigo }, data: { status: "EXPIRED" } });
        }
      }
      try {
        await prisma.auditLog.create({
          data: {
            usuario_id: "ESP32",
            ip: getClientIp(req),
            accion: "SPACE_RELEASE",
            datos: { id_espacio: id, expirados_waiting: expiredWaiting.count, timestamp: ts.toISOString() } as any,
          },
        });
      } catch {}
    }

    // Responder incluyendo el código cuando aplica
    return res.status(200).json({ ok: true, space, code });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Error interno" });
  }
}
