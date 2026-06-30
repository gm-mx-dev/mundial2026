import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LoginButton from "./LoginButton";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Barra de navegación simple (sin login requerido) */}
      <nav className="flex items-center gap-4 px-4 py-3 border-b border-gray-800 bg-gray-950">
        <Link href="/" className="text-sm font-bold text-white">⚽ Quiniela</Link>
        <span className="text-gray-700">|</span>
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Inicio</Link>
        <Link href="/partidos" className="text-sm text-gray-400 hover:text-white transition-colors">Partidos</Link>
      </nav>

      {/* Contenido centrado */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">⚽</div>
            <h1 className="text-2xl font-bold text-white">Quiniela Mundial 2026</h1>
            <p className="text-gray-400 mt-2 text-sm">Inicia sesión para capturar tus pronósticos</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <LoginButton />
            <p className="text-center text-xs text-gray-600 mt-4">
              Solo participantes registrados pueden acceder
            </p>
          </div>

          <div className="text-center mt-6">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
