"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Space = { id: number; occupied: boolean; updated_at: string | null };
type Claimed = { codigo: string; fecha_actualizacion: string } | null;
type Waiting = { codigo: string; fecha_creacion: string } | null;
type Payment = { id: number; codigo: string; amount: string | number; currency: string; status: string; created_at: string } | null;
type PaymentDetail = { id: number; codigo: string; amount: number; amount_calculated: number; amount_final: number; time_used_minutes: number; currency: string; status: string; created_at: string } | null;

export default function SpaceDetail() {
  const params = useParams<{ id: string }>();
  const idParam = params?.id;
  const spaceId = Number(idParam ?? NaN);
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [claimed, setClaimed] = useState<Claimed>(null);
  const [waiting, setWaiting] = useState<Waiting>(null);
  const [pendingPayment, setPendingPayment] = useState<PaymentDetail>(null);
  const [method, setMethod] = useState<string>("");
  const stateLabel = useMemo(() => {
    if (space?.occupied) return "Ocupado";
    if (claimed) return "En proceso de liberación";
    return "Libre";
  }, [space, claimed]);
  const badgeClass = useMemo(() => (stateLabel === "Ocupado" ? "bg-red-600" : stateLabel === "En proceso de liberación" ? "bg-yellow-600" : "bg-green-600"), [stateLabel]);
  const panelClass = useMemo(() => (stateLabel === "Ocupado" ? "bg-red-600/20 border-red-600/40" : stateLabel === "En proceso de liberación" ? "bg-yellow-600/20 border-yellow-600/40" : "bg-green-600/20 border-green-600/40"), [stateLabel]);

  const loadSpace = async () => {
    const res = await fetch("/api/spaces");
    const data = await res.json();
    if (!res.ok) return setError(data?.error || "Error al cargar espacio");
    const s = (data.spaces || []).find((x: any) => Number(x.id) === spaceId);
    if (!s) return setError("Espacio no encontrado");
    setSpace({ id: s.id, occupied: !!s.occupied, updated_at: s.updated_at ? new Date(s.updated_at).toISOString() : null });
    const rc = await fetch(`/api/codes?status=CLAIMED&space_id=${spaceId}&order=desc`);
    const dc = await rc.json();
    if (rc.ok && Array.isArray(dc.codes) && dc.codes.length > 0) {
      const c = dc.codes[0];
      setClaimed({ codigo: c.codigo, fecha_actualizacion: c.fecha_actualizacion });
    } else {
      setClaimed(null);
    }
    const rw = await fetch(`/api/codes?status=WAITING&space_id=${spaceId}&order=desc`);
    const dw = await rw.json();
    if (rw.ok && Array.isArray(dw.codes) && dw.codes.length > 0) {
      const w = dw.codes[0];
      setWaiting({ codigo: w.codigo, fecha_creacion: w.fecha_creacion });
    } else {
      setWaiting(null);
    }
    const rp = await fetch(`/api/payments?space_id=${spaceId}&status=PENDING`);
    const dp = await rp.json();
    if (rp.ok && Array.isArray(dp.payments) && dp.payments.length > 0) {
      const p = dp.payments[0];
      setPendingPayment({ id: p.id, codigo: p.codigo, amount: Number(p.amount), amount_calculated: Number(p.amount_calculated ?? p.amount), amount_final: Number(p.amount_final ?? p.amount), time_used_minutes: Number(p.time_used_minutes ?? 0), currency: p.currency, status: p.status, created_at: p.created_at });
    } else {
      setPendingPayment(null);
    }
  };

  useEffect(() => {
    if (!Number.isInteger(spaceId) || spaceId < 1 || spaceId > 3) {
      setError("Espacio no encontrado");
      return;
    }
    loadSpace();
    const poll = setInterval(loadSpace, 30000);
    return () => clearInterval(poll);
  }, [spaceId]);

  const validateLocalCode = (c: string) => /^[A-Za-z0-9]{6}$/.test(c);

  const submit = async () => {
    setError("");
    setMessage("");
    const c = code.trim();
    if (!validateLocalCode(c)) {
      setError("El código debe tener exactamente 6 caracteres alfanuméricos");
      return;
    }
    if (!space) { setError("Espacio no encontrado"); return; }
    if (claimed) { setError("Espacio con código ya registrado"); return; }
    if (!space.occupied) { setError("Espacio libre"); return; }
    // Permitir asociación aunque no exista ticket WAITING vinculado al espacio,
    // siempre que el código ingresado esté en estado WAITING globalmente
    setLoading(true);
    try {
      const res = await fetch("/api/codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: c, space_id: spaceId }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data?.error || "Error al asociar código");
        return;
      }
      setMessage("Código asociado al espacio");
      setCode("");
      await loadSpace();
    } catch (e: any) {
      setLoading(false);
      setError("Error de red");
    }
  };

  const pay = async () => {
    if (!pendingPayment) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: pendingPayment.codigo, method }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) { setError(data?.error || "Error al pagar"); return; }
      setMessage("Pago registrado");
      await loadSpace();
    } catch {
      setLoading(false);
      setError("Error de red");
    }
  };

  return (
    <div className="min-h-screen px-3 sm:px-4 md:px-6 py-4 sm:py-6">
      <div className="max-w-5xl mx-auto">
        <div className={`rounded-lg md:rounded-xl p-4 md:p-6 border ${panelClass}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <span className="font-semibold text-lg md:text-xl lg:text-2xl">Espacio {Number.isInteger(spaceId) ? spaceId : "-"}</span>
            <span className={`px-2 py-1 md:px-3 md:py-1.5 rounded text-xs md:text-sm ${badgeClass}`}>{stateLabel}</span>
          </div>
          <p className="mt-2 text-xs md:text-sm lg:text-base">Última actualización: {space?.updated_at ? new Date(space.updated_at).toLocaleString() : "—"}</p>

          <div className="mt-4 lg:mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div>
              {claimed ? (
                <div className="space-y-2 md:space-y-3">
                  <div className="text-sm md:text-base">Código registrado: <span className="font-mono">{claimed.codigo}</span></div>
                  <div className="text-xs md:text-sm text-gray-300">Registrado: {new Date(claimed.fecha_actualizacion).toLocaleString()}</div>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-2 space-y-2 md:space-y-0">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Ingrese código de 6 caracteres"
                      className="w-full md:flex-1 px-3 py-2 md:py-2.5 lg:py-3 rounded-md border border-white/20 bg-transparent text-sm md:text-base min-h-[44px]"
                      maxLength={6}
                      disabled={loading || !space?.occupied}
                    />
                    <button
                      onClick={submit}
                      disabled={loading || !space?.occupied}
                      className="w-full md:w-auto px-4 md:px-5 py-2 md:py-2.5 lg:py-3 rounded-md bg-blue-600 disabled:opacity-50 text-sm md:text-base min-h-[44px]"
                    >
                      {loading ? "Enviando…" : "Asociar"}
                    </button>
                  </div>
                  {waiting && (
                    <div className="text-xs sm:text-sm text-gray-300">Ticket reciente para este espacio: <span className="font-mono">{waiting.codigo}</span></div>
                  )}
                  {error && <div className="text-red-400 text-sm md:text-base">{error}</div>}
                  {message && <div className="text-green-400 text-sm md:text-base">{message}</div>}
                </div>
              )}
            </div>

            {pendingPayment && (
              <div className="space-y-3 md:space-y-4">
                <div className="text-sm md:text-base">Tiempo utilizado: <span className="font-mono">{pendingPayment.time_used_minutes} min</span></div>
                <div className="text-sm md:text-base">Monto calculado: <span className="font-mono">{pendingPayment.currency} {pendingPayment.amount_calculated.toFixed(2)}</span></div>
                <div className="text-sm md:text-base">Monto final: <span className="font-mono">{pendingPayment.currency} {pendingPayment.amount_final.toFixed(2)}</span></div>
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full md:w-auto px-3 py-2 md:py-2.5 lg:py-3 rounded-md border border-white/20 bg-transparent text-sm md:text-base min-h-[44px]">
                    <option value="">Selecciona método</option>
                    <option value="CASH">Efectivo</option>
                    <option value="CARD">Tarjeta</option>
                  </select>
                  <button
                    onClick={pay}
                    disabled={loading || !method}
                    className="w-full md:w-auto px-4 md:px-5 py-2 md:py-2.5 lg:py-3 rounded-md bg-green-600 disabled:opacity-50 text-sm md:text-base min-h-[44px]"
                  >
                    {loading ? "Procesando…" : "Pagar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}