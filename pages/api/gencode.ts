import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const WAITING_TIMEOUT_MINUTES = parseInt(process.env.WAITING_TIMEOUT_MINUTES || "30", 10);

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Permite opcionalmente asociar el código a un espacio (1-3)
  const spaceParam = typeof req.query.space_id === "string" ? req.query.space_id : undefined;
  const bodySpace = req.method !== "GET" && req.body ? req.body.space_id : undefined;
  const space_id = Number(spaceParam ?? bodySpace);
  const hasSpace = Number.isInteger(space_id) && space_id >= 1 && space_id <= 3;

  // Reutiliza código WAITING activo si existe y no expiró
  if (hasSpace) {
    const cutoff = new Date(Date.now() - WAITING_TIMEOUT_MINUTES * 60 * 1000);
    const existing = await prisma.parkingCode.findFirst({
      where: { space_id, status: "WAITING", fecha_creacion: { gt: cutoff } },
      select: { codigo: true },
    });
    if (existing) {
      return res.status(200).json({ gencode: existing.codigo, status: "WAITING", space_id });
    }
  }

  // Genera un nuevo código único y guarda como WAITING
  for (let i = 0; i < 5; i++) {
    const code = genCode();
    try {
      await prisma.parkingCode.create({
        data: { codigo: code, status: "WAITING", space_id: hasSpace ? space_id : undefined },
      });
      return res.status(200).json({ gencode: code, status: "WAITING", space_id: hasSpace ? space_id : undefined });
    } catch (e: any) {
      const isUniqueFail = /Unique constraint failed/i.test(e?.message || "");
      if (!isUniqueFail) {
        return res.status(500).json({ error: "No se pudo generar el código" });
      }
    }
  }
  return res.status(500).json({ error: "No se pudo generar un código único" });
}
