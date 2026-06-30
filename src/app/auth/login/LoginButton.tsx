"use client";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function LoginButton() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    // Verificar que el email está registrado en la quiniela
    const { data: participant } = await supabase
      .from("participants")
      .select("id, is_active")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (!participant) {
      setError("Este correo no está registrado en la quiniela. Verifica con el administrador.");
      setLoading(false);
      return;
    }

    if (!participant.is_active) {
      setError("Tu cuenta está desactivada. Contacta al administrador.");
      setLoading(false);
      return;
    }

    // Email válido → mandar magic link
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });

    if (otpError) {
      setError("No se pudo enviar el link. Intenta de nuevo.");
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-3">📧</div>
        <p className="text-white font-semibold mb-1">¡Link enviado!</p>
        <p className="text-gray-400 text-sm">
          Revisa tu correo <span className="text-indigo-400">{email}</span> y toca el link para entrar.
        </p>
        <p className="text-gray-500 text-xs mt-2">Revisa también tu carpeta de spam.</p>
        <button
          onClick={() => { setSent(false); setEmail(""); }}
          className="mt-4 text-xs text-gray-500 hover:text-gray-300"
        >
          Usar otro correo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={sendMagicLink} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Tu correo electrónico</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nombre@correo.com"
          required
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      {error && (
        <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || !email}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
      >
        {loading ? "Verificando..." : "Enviar link de acceso ✉️"}
      </button>
      <p className="text-center text-xs text-gray-600 mt-1">
        Te mandamos un link a tu correo, sin contraseña
      </p>
    </form>
  );
}
