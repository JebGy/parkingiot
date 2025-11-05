import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const codigo = typeof req.query.codigo === "string" ? req.query.codigo : undefined;
  const logs = await prisma.auditLog.findMany({
    where: codigo ? { codigo } : undefined,
    orderBy: { created_at: "desc" },
    select: { id: true, created_at: true, usuario_id: true, ip: true, accion: true, datos: true },
  });
  return res.status(200).json({ logs });
}