import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET,POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const now = new Date();
    const results = [] as { id: number; occupied: boolean; updated_at: Date }[];
    for (const id of [1, 2, 3]) {
      const space = await prisma.parkingSpace.upsert({
        where: { id },
        update: { occupied: false, updated_at: now },
        create: { id, occupied: false, updated_at: now },
        select: { id: true, occupied: true, updated_at: true },
      });
      results.push(space);
    }
    return res.status(200).json({ ok: true, spaces: results });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Internal Error" });
  }
}