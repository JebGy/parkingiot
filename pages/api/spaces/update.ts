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

    // Responder incluyendo el código cuando aplica
    return res.status(200).json({ ok: true, space, code });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Error interno" });
  }
}
