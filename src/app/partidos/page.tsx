import { createClient } from "@/lib/supabase/server";
import Navigation from "@/components/Navigation";
import PartidosClient from "./PartidosClient";
import type { Match, Phase } from "@/types/database";

export const revalidate = 30;

function getTodayMxKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export default async function PartidosPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("participants").select("is_admin").eq("auth_user_id", user.id).single()
    : { data: null };

  const [matchesRes, phasesRes] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_at"),
    supabase.from("phases").select("*").order("sort_order"),
  ]);

  const matches: Match[] = matchesRes.data ?? [];
  const phases: Phase[] = phasesRes.data ?? [];
  const todayKey = getTodayMxKey();

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation isAdmin={me?.is_admin} />
      <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">📋 Partidos</h1>
          <p className="text-gray-500 text-sm mt-1">Resultados de todas las fases</p>
        </div>

        <PartidosClient matches={matches} phases={phases} todayKey={todayKey} />
      </main>
    </div>
  );
}
