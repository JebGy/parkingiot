import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método no permitido" });
  }

  // Estado actual de los 3 espacios y estadísticas simples
  const spaces = await prisma.parkingSpace.findMany({
    where: { id: { in: [1, 2, 3] } },
    orderBy: { id: "asc" },
    select: { id: true, occupied: true, updated_at: true },
  });

  const logs = await prisma.spaceLog.groupBy({
    by: ["space_id", "occupied"],
    _count: { space_id: true },
    where: { space_id: { in: [1, 2, 3] } },
  });

  const stats: Record<number, { occupied_count: number; free_count: number }> = { 1: { occupied_count: 0, free_count: 0 }, 2: { occupied_count: 0, free_count: 0 }, 3: { occupied_count: 0, free_count: 0 } };
  for (const l of logs) {
    const s = stats[l.space_id as 1 | 2 | 3] || { occupied_count: 0, free_count: 0 };
    if (l.occupied) s.occupied_count += l._count.space_id;
    else s.free_count += l._count.space_id;
    stats[l.space_id as 1 | 2 | 3] = s;
  }

  // Asegurar siempre 3 espacios en la respuesta
  const byId: Record<number, { id: number; occupied: boolean; updated_at: Date | null }> = { 1: { id: 1, occupied: false, updated_at: null }, 2: { id: 2, occupied: false, updated_at: null }, 3: { id: 3, occupied: false, updated_at: null } };
  for (const s of spaces) byId[s.id] = s as any;

  return res.status(200).json({ spaces: [byId[1], byId[2], byId[3]], stats });
}