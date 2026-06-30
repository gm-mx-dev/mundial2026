"use client";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function CambiarPassword() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (nueva.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nueva !== confirmar) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setLoading(true);

    // Verificar contraseña actual re-autenticando
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setError("No se pudo verificar tu sesión."); setLoading(false); return; }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: actual,
    });

    if (signInErr) {
      setError("La contraseña actual es incorrecta.");
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: nueva });

    if (updateErr) {
      setError("No se pudo actualizar la contraseña. Intenta de nuevo.");
    } else {
      setSuccess(true);
      setActual(""); setNueva(""); setConfirmar("");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-white font-semibold">¡Contraseña actualizada!</p>
        <button onClick={() => setSuccess(false)} className="mt-4 text-xs text-gray-500 hover:text-gray-300">
          Cambiar de nuevo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Contraseña actual</label>
        <input type="password" value={actual} onChange={e => setActual(e.target.value)} required
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Nueva contraseña</label>
        <input type="password" value={nueva} onChange={e => setNueva(e.target.value)} required minLength={6}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Confirmar nueva contraseña</label>
        <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} required
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      {error && (
        <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
      )}
      <button type="submit" disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
        {loading ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}
