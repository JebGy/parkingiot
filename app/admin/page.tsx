"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

type CodeRow = {
  codigo: string;
  status: "CLAIMED" | "WAITING" | "EXPIRED";
  fecha_creacion: string;
  fecha_actualizacion: string;
};

export default function AdminPage() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("fecha_creacion");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [stats, setStats] = useState<{ distribution: Record<string, number>; byDay: Record<string, number>; } | null>(null);
  const [historyCode, setHistoryCode] = useState<string>("");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchCodes();
    fetchStats();
  }, []);

  const fetchCodes = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (query) params.set("q", query);
    params.set("sort", sort);
    params.set("order", order);
    const res = await fetch(`/api/codes?${params.toString()}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return alert(data?.error || "Error al cargar códigos");
    setCodes(data.codes || []);
  };

  const fetchStats = async () => {
    const res = await fetch("/api/stats");
    const data = await res.json();
    if (!res.ok) return console.error(data?.error || "Error stats");
    setStats(data);
  };

  useEffect(() => {
    fetchCodes();
  }, [statusFilter, query, sort, order]);

  const changeStatus = async (codigo: string, status: CodeRow["status"]) => {
    const res = await fetch("/api/codes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, status }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Error al cambiar estado");
    fetchCodes();
    fetchStats();
  };

  const exportCSV = () => {
    const header = ["CODIGO", "STATUS", "FECHA_CREACION", "FECHA_ACTUALIZACION"]; 
    const rows = codes.map((c) => [c.codigo, c.status, c.fecha_creacion, c.fecha_actualizacion]);
    const csv = [header.join(","), ...rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '"')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parking_codes_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const distributionData = useMemo(() => {
    const d = stats?.distribution || { CLAIMED: 0, WAITING: 0, EXPIRED: 0 };
    return {
      labels: ["CLAIMED", "WAITING", "EXPIRED"],
      datasets: [{ data: [d.CLAIMED, d.WAITING, d.EXPIRED], backgroundColor: ["#22c55e", "#3b82f6", "#ef4444"] }],
    };
  }, [stats]);

  const byDayData = useMemo(() => {
    const entries = Object.entries(stats?.byDay || {}).sort((a, b) => a[0].localeCompare(b[0]));
    return {
      labels: entries.map(([k]) => k),
      datasets: [{ label: "Códigos por día", data: entries.map(([_, v]) => v), backgroundColor: "#60a5fa" }],
    };
  }, [stats]);

  const loadHistory = async () => {
    if (!historyCode) return setHistory([]);
    const res = await fetch(`/api/audit?codigo=${encodeURIComponent(historyCode)}`);
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Error historial");
    setHistory(data.logs || []);
  };

  // Session is enforced via middleware; just render the dashboard

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <button className="px-3 py-2 rounded-md border border-white/20" onClick={async () => { await fetch('/api/admin/logout', { method: 'POST' }); location.href = '/admin/login'; }}>Salir</button>
      </div>

      {/* Filtros y búsqueda */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-md border border-white/20 bg-transparent">
          <option value="">Todos</option>
          <option value="WAITING">WAITING</option>
          <option value="CLAIMED">CLAIMED</option>
          <option value="EXPIRED">EXPIRED</option>
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por código" className="px-3 py-2 rounded-md border border-white/20 bg-transparent" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2 rounded-md border border-white/20 bg-transparent">
          <option value="fecha_creacion">Fecha creación</option>
          <option value="fecha_actualizacion">Fecha actualización</option>
          <option value="codigo">Código</option>
        </select>
        <select value={order} onChange={(e) => setOrder(e.target.value as any)} className="px-3 py-2 rounded-md border border-white/20 bg-transparent">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </div>

      {/* Tablero de códigos */}
      <div className="bg-white/5 border border-white/10 rounded-lg">
        <div className="p-3 flex justify-between items-center">
          <h2 className="font-semibold">Códigos</h2>
          <div className="space-x-2">
            <button onClick={fetchCodes} className="px-3 py-2 rounded-md bg-blue-600">Refrescar</button>
            <button onClick={exportCSV} className="px-3 py-2 rounded-md bg-green-600">Exportar CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/10">
              <tr>
                <th className="text-left p-2">Código</th>
                <th className="text-left p-2">Estado</th>
                <th className="text-left p-2">Creación</th>
                <th className="text-left p-2">Actualización</th>
                <th className="text-left p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="p-2" colSpan={5}>Cargando…</td></tr>
              ) : codes.length === 0 ? (
                <tr><td className="p-2" colSpan={5}>Sin datos</td></tr>
              ) : (
                codes.map((c) => (
                  <tr key={c.codigo} className="border-t border-white/10">
                    <td className="p-2 font-mono">{c.codigo}</td>
                    <td className="p-2">{c.status}</td>
                    <td className="p-2">{new Date(c.fecha_creacion).toLocaleString()}</td>
                    <td className="p-2">{new Date(c.fecha_actualizacion).toLocaleString()}</td>
                    <td className="p-2 space-x-2">
                      <button className="px-2 py-1 rounded bg-blue-600" onClick={() => changeStatus(c.codigo, "CLAIMED")}>Marcar CLAIMED</button>
                      <button className="px-2 py-1 rounded bg-yellow-600" onClick={() => changeStatus(c.codigo, "WAITING")}>Marcar WAITING</button>
                      <button className="px-2 py-1 rounded bg-red-600" onClick={() => changeStatus(c.codigo, "EXPIRED")}>Marcar EXPIRED</button>
                      <button className="px-2 py-1 rounded bg-gray-600" onClick={() => { setHistoryCode(c.codigo); loadHistory(); }}>Ver historial</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Distribución de estados</h3>
          <Doughnut data={distributionData} />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Frecuencia por día</h3>
          <Bar data={byDayData} />
        </div>
      </div>

      {/* Historial de cambios */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <input value={historyCode} onChange={(e) => setHistoryCode(e.target.value)} placeholder="Código para historial" className="px-3 py-2 rounded-md border border-white/20 bg-transparent" />
          <button onClick={loadHistory} className="px-3 py-2 rounded-md bg-gray-700">Cargar historial</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/10">
              <tr>
                <th className="text-left p-2">Fecha</th>
                <th className="text-left p-2">Usuario</th>
                <th className="text-left p-2">IP</th>
                <th className="text-left p-2">Acción</th>
                <th className="text-left p-2">Datos</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td className="p-2" colSpan={5}>Sin registros</td></tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="border-t border-white/10">
                    <td className="p-2">{new Date(h.created_at).toLocaleString()}</td>
                    <td className="p-2">{h.usuario_id || "-"}</td>
                    <td className="p-2">{h.ip}</td>
                    <td className="p-2">{h.accion}</td>
                    <td className="p-2 font-mono text-xs">{JSON.stringify(h.datos)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}