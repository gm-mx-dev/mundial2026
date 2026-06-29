import { createClient } from "@/lib/supabase/server";
import Navigation from "@/components/Navigation";
import { formatDateTime } from "@/lib/utils";
import type { Match, Phase } from "@/types/database";

export const revalidate = 60;

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

  const matchesByPhase = phases.map((ph) => ({
    phase: ph,
    matches: matches.filter((m) => m.phase_id === ph.id),
  })).filter((g) => g.matches.length > 0);

  const statusLabel: Record<string, string> = {
    scheduled: "Pendiente",
    live: "En vivo",
    finished: "Finalizado",
  };
  const statusColor: Record<string, string> = {
    scheduled: "text-gray-500",
    live: "text-green-400 animate-pulse",
    finished: "text-gray-400",
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation isAdmin={me?.is_admin} />
      <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">📋 Partidos</h1>
          <p className="text-gray-500 text-sm mt-1">Resultados de todas las fases</p>
        </div>

        <div className="space-y-6">
          {matchesByPhase.map(({ phase, matches: phaseMatches }) => (
            <div key={phase.id}>
              <h2 className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">
                {phase.display_name}
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800/60 overflow-hidden">
                {phaseMatches.map((match) => (
                  <div key={match.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500">{formatDateTime(match.kickoff_at)}</span>
                      <span className={`text-xs font-medium ${statusColor[match.status]}`}>
                        {statusLabel[match.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white text-sm">{match.home_team}</span>
                      <div className="flex items-center gap-2 px-3">
                        {match.status === "finished" ? (
                          <span className="text-lg font-bold text-white">
                            {match.home_score} – {match.away_score}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-sm">vs</span>
                        )}
                      </div>
                      <span className="font-medium text-white text-sm text-right">{match.away_team}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
