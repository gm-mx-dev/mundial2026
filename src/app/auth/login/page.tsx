import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoginButton from "./LoginButton";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">⚽</div>
          <h1 className="text-2xl font-bold text-white">Quiniela Mundial 2026</h1>
          <p className="text-gray-400 mt-2 text-sm">Inicia sesión para ver tus pronósticos</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <LoginButton />
          <p className="text-center text-xs text-gray-600 mt-4">
            Solo participantes registrados pueden acceder
          </p>
        </div>
      </div>
    </div>
  );
}
