import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

function unauthorized(res: NextApiResponse) {
  res.setHeader("WWW-Authenticate", 'Basic realm="ESP32"');
  return res.status(401).json({ error: "Unauthorized" });
}

function checkBasicAuth(req: NextApiRequest, res: NextApiResponse) {
  const hdr = req.headers.authorization;
  if (!hdr || !hdr.startsWith("Basic ")) return unauthorized(res);
  const decoded = Buffer.from(hdr.replace("Basic ", ""), "base64").toString("utf8");
  const [user, pass] = decoded.split(":");
  const expectedUser = process.env.ESP32_USER || "esp32";
  const expectedPass = process.env.ESP32_PASS || "secret";
  if (user !== expectedUser || pass !== expectedPass) return unauthorized(res);
  return true;
}

function getClientIp(req: NextApiRequest) {
  const xfwd = req.headers["x-forwarded-for"];
  const xreal = req.headers["x-real-ip"];
  const first = Array.isArray(xfwd) ? xfwd[0] : typeof xfwd === "string" ? xfwd.split(",")[0]?.trim() : undefined;
  return first || (Array.isArray(xreal) ? xreal[0] : (xreal as string)) || req.socket.remoteAddress || "unknown";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  if (checkBasicAuth(req, res) !== true) return; // Responded with 401

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
      data: { space_id: id, occupied: estado, timestamp: ts, ip: getClientIp(req) },
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

    // Responder
    return res.status(200).json({ ok: true, space });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Error interno" });
  }
}