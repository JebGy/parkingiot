"use client";
import { useState } from "react";

export default function Home() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (value: string) => {
    if (value.length < 6) return "El código debe tener 6 dígitos";
    if (value.length > 6) return "El código no debe exceder 6 dígitos";
    if (!/^\d{6}$/.test(value)) return "Formato inválido: solo números (6 dígitos)";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const vErr = validate(code.trim());
    if (vErr) {
      setError(vErr);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: code.trim(), status: "CLAIMED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al reclamar código");
      setSuccess("Código cambiado a estado CLAIMED");
      setCode("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6">Parking IoT</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg p-5 space-y-4">
        <div>
          <label htmlFor="codigo" className="block text-sm font-medium mb-1">
            Ingresa tu código de estacionamiento
          </label>
          <input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            pattern="\d{6}"
            placeholder="Ej: 123456"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            className="w-full px-3 py-2 rounded-md border border-white/10 bg-transparent outline-none focus:border-blue-500"
          />
          <p className="text-xs mt-1 text-gray-400">Formato: 6 dígitos numéricos</p>
          {error && <p className="text-sm mt-2 text-red-500">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Enviando…" : "Enviar código"}
        </button>
        {success && (
          <div className="mt-3 p-3 rounded-md bg-green-600/20 border border-green-600/40">
            <p className="text-green-300">{success}</p>
          </div>
        )}
      </form>
      <div className="mt-4 text-sm text-gray-400">
        ¿No tienes código? <a className="text-blue-400 underline" href="/api/gencode">Generar uno</a>
      </div>
    </div>
  );
}
