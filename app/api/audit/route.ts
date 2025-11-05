import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const codigo = searchParams.get("codigo") || undefined;
  const logs = await prisma.auditLog.findMany({
    where: codigo ? { codigo } : undefined,
    orderBy: { created_at: "desc" },
    select: { id: true, created_at: true, usuario_id: true, ip: true, accion: true, datos: true },
  });
  return NextResponse.json({ logs });
}