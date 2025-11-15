"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Space = { id: number; occupied: boolean; updated_at: string | null };

export default function SpaceDetail() {
  const params = useParams<{ id: string }>();
  const idParam = params?.id;
  const spaceId = Number(idParam ?? NaN);
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const badgeClass = useMemo(() => (space?.occupied ? "bg-red-600" : "bg-green-600"), [space]);
  const panelClass = useMemo(() => (space?.occupied ? "bg-red-600/20 border-red-600/40" : "bg-green-600/20 border-green-600/40"), [space]);

  const loadSpace = async () => {
    const res = await fetch("/api/spaces");
    const data = await res.json();
    if (!res.ok) return setError(data?.error || "Error al cargar espacio");
    const s = (data.spaces || []).find((x: any) => Number(x.id) === spaceId);
    if (!s) return setError("Espacio no encontrado");
    setSpace({ id: s.id, occupied: !!s.occupied, updated_at: s.updated_at ? new Date(s.updated_at).toISOString() : null });
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
    if (!space || space.occupied) {
      setError("Espacio ocupado");
      return;
    }
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

  return (
    <div className="min-h-screen p-6">
      <div className={`rounded-md p-4 border ${panelClass}`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold">Espacio {Number.isInteger(spaceId) ? spaceId : "-"}</span>
          <span className={`px-2 py-1 rounded text-xs ${badgeClass}`}>{space?.occupied ? "Ocupado" : "Libre"}</span>
        </div>
        <p className="mt-2 text-sm">Última actualización: {space?.updated_at ? new Date(space.updated_at).toLocaleString() : "—"}</p>

        {space?.occupied ? (
          <div className="mt-4 text-sm">Espacio ocupado</div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center space-x-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ingrese código de 6 caracteres"
                className="flex-1 px-3 py-2 rounded-md border border-white/20 bg-transparent"
                maxLength={6}
              />
              <button
                onClick={submit}
                disabled={loading}
                className="px-3 py-2 rounded-md bg-blue-600 disabled:opacity-50"
              >
                {loading ? "Enviando…" : "Asociar"}
              </button>
            </div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            {message && <div className="text-green-400 text-sm">{message}</div>}
          </div>
        )}
      </div>
    </div>
  );
}