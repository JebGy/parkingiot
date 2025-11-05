import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const all = await prisma.parkingCode.findMany({ select: { status: true, fecha_creacion: true } });
  const distribution: Record<string, number> = { CLAIMED: 0, WAITING: 0, EXPIRED: 0 };
  const byDay: Record<string, number> = {};
  for (const row of all) {
    if (distribution[row.status] !== undefined) distribution[row.status] += 1;
    const d = new Date(row.fecha_creacion);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    byDay[key] = (byDay[key] ?? 0) + 1;
  }
  return res.status(200).json({ distribution, byDay });
}