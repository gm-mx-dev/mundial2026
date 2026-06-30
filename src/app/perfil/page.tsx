import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import CambiarPassword from "./CambiarPassword";

export const revalidate = 0;

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/pronosticos");

  const { data: participant } = await supabase
    .from("participants")
    .select("name, username, is_admin")
    .eq("auth_user_id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation isAdmin={participant?.is_admin} />
      <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">👤 Mi Perfil</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nombre</p>
          <p className="text-white font-semibold text-lg">{participant?.name ?? "—"}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide mt-3 mb-1">Usuario</p>
          <p className="text-gray-300 font-mono">{participant?.username ?? "—"}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-4">🔑 Cambiar contraseña</h2>
          <CambiarPassword />
        </div>
      </main>
    </div>
  );
}
