import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Configurable timeout (minutes) for WAITING -> EXPIRED
const WAITING_TIMEOUT_MINUTES = parseInt(process.env.WAITING_TIMEOUT_MINUTES || "30", 10);

function getClientIp(req: NextRequest) {
  const xfwd = req.headers.get("x-forwarded-for");
  const xreal = req.headers.get("x-real-ip");
  return (xfwd?.split(",")[0]?.trim()) || xreal || "unknown";
}

async function logAction(opts: { req: NextRequest; userId?: string | null; action: string; data: Record<string, any>; codigo?: string | null; }) {
  try {
    await prisma.auditLog.create({
      data: {
        usuario_id: opts.userId ?? null,
        ip: getClientIp(opts.req),
        accion: opts.action,
        datos: opts.data as any,
        codigo: opts.codigo ?? null,
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Failed to write audit log", e);
  }
}

function validateCodeFormat(code: string) {
  // Current generator: 6 numeric digits
  const pattern = /^\d{6}$/;
  if (!pattern.test(code)) {
    return "El código debe tener 6 dígitos numéricos";
  }
  return null;
}

async function expireOldWaitingCodes() {
  const cutoff = new Date(Date.now() - WAITING_TIMEOUT_MINUTES * 60 * 1000);
  await prisma.parkingCode.updateMany({
    where: { status: "WAITING", fecha_creacion: { lte: cutoff } },
    data: { status: "EXPIRED" },
  });
}

export async function GET(req: NextRequest) {
  await expireOldWaitingCodes();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") || "fecha_creacion";
  const order = (searchParams.get("order") || "desc").toLowerCase();

  const where: any = {};
  if (status) where.status = status as any;
  if (q) where.codigo = { contains: q };

  const codes = await prisma.parkingCode.findMany({
    where,
    orderBy: { [sort!]: order === "asc" ? "asc" : "desc" } as any,
    select: { codigo: true, status: true, fecha_creacion: true, fecha_actualizacion: true },
  });
  await logAction({ req, action: "LIST_CODES", data: { status, q, sort, order } });
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = (body?.codigo ?? body?.code ?? "").toString().trim();
  if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  const fmtError = validateCodeFormat(code);
  if (fmtError) return NextResponse.json({ error: fmtError }, { status: 400 });

  try {
    const created = await prisma.parkingCode.create({
      data: { codigo: code, status: "WAITING" },
      select: { codigo: true, status: true, fecha_creacion: true, fecha_actualizacion: true },
    });
    await logAction({ req, action: "SUBMIT_CODE", data: { codigo: code }, codigo: code });
    return NextResponse.json({ ok: true, code: created });
  } catch (e: any) {
    const msg = /Unique constraint failed/i.test(e.message) ? "El código ya existe" : e.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = (body?.codigo ?? body?.code ?? "").toString().trim();
  const status = (body?.status ?? "").toString().trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  if (!status || !["CLAIMED", "WAITING", "EXPIRED"].includes(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  try {
    const updated = await prisma.parkingCode.update({
      where: { codigo: code },
      data: { status: status as any },
      select: { codigo: true, status: true, fecha_creacion: true, fecha_actualizacion: true },
    });
    await logAction({ req, action: "CHANGE_STATUS", data: { codigo: code, status }, codigo: code });
    return NextResponse.json({ ok: true, code: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}