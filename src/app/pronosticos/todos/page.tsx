import { createClient } from "@/lib/supabase/server";
import Navigation from "@/components/Navigation";
import TodosClient from "./TodosClient";
import type { Match, Phase, Participant } from "@/types/database";

export const revalidate = 30;

export default async function TodosPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [matchesRes, phasesRes, participantsRes, meRes] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_at"),
    supabase.from("phases").select("*").order("sort_order"),
    supabase.from("participants").select("id, name, is_active").eq("is_active", true).order("name"),
    user
      ? supabase.from("participants").select("is_admin").eq("auth_user_id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  const matches: Match[] = matchesRes.data ?? [];
  const phases: Phase[] = phasesRes.data ?? [];
  const participants: Pick<Participant, "id" | "name" | "is_active">[] = participantsRes.data ?? [];

  // Solo fases donde ya empezó el primer partido
  const now = new Date();
  const lockedPhaseIds = new Set(
    phases
      .filter((ph) => {
        const phMatches = matches.filter((m) => m.phase_id === ph.id);
        const first = phMatches.reduce<Date | null>((min, m) => {
          const d = new Date(m.kickoff_at);
          return min === null || d < min ? d : min;
        }, null);
        return first !== null && first <= now;
      })
      .map((ph) => ph.id)
  );

  // Obtener pronósticos solo de fases cerradas
  const lockedMatchIds = matches
    .filter((m) => lockedPhaseIds.has(m.phase_id))
    .map((m) => m.id);

  let allPredictions: { participant_id: string; match_id: string; home_score: number | null; away_score: number | null; points_earned: number | null }[] = [];

  if (lockedMatchIds.length > 0) {
    const { data } = await supabase
      .from("predictions")
      .select("participant_id, match_id, home_score, away_score, points_earned")
      .in("match_id", lockedMatchIds);
    allPredictions = data ?? [];
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation isAdmin={meRes.data?.is_admin} />
      <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">👥 Pronósticos de Todos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Solo se muestran fases que ya iniciaron
          </p>
        </div>
        <TodosClient
          matches={matches}
          phases={phases.filter((ph) => lockedPhaseIds.has(ph.id))}
          participants={participants}
          predictions={allPredictions}
        />
      </main>
    </div>
  );
}
