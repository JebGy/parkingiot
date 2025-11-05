import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Genera un código y lo guarda como WAITING (ESP32)
  for (let i = 0; i < 5; i++) {
    const code = genCode();
    try {
      await prisma.parkingCode.create({
        data: { codigo: code, status: "WAITING" },
      });
      return res.status(200).json({ gencode: code, status: "WAITING" });
    } catch (e: any) {
      // Si hay colisión, intenta nuevamente hasta 5 veces
      const isUniqueFail = /Unique constraint failed/i.test(e?.message || "");
      if (!isUniqueFail) {
        return res.status(500).json({ error: "No se pudo generar el código" });
      }
    }
  }
  return res.status(500).json({ error: "No se pudo generar un código único" });
}
