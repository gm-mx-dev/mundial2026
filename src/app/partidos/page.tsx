import { createClient } from "@/lib/supabase/server";
import Navigation from "@/components/Navigation";
import { formatDateTime, getTeamFlag } from "@/lib/utils";
import type { Match, Phase } from "@/types/database";

export const revalidate = 30;

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
                {phaseMatches.map((match) => {
                  const isLive = match.status === "live";
                  const isFinished = match.status === "finished";

                  return (
                    <div key={match.id} className={`px-4 py-3 ${isLive ? "bg-green-950/20" : ""}`}>
                      {/* Header: fecha y estado */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">{formatDateTime(match.kickoff_at)}</span>
                        <span className={`text-xs font-medium flex items-center gap-1 ${
                          isLive ? "text-green-400" : isFinished ? "text-gray-400" : "text-gray-600"
                        }`}>
                          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />}
                          {isLive
                            ? `En vivo${match.current_minute ? ` · ${match.current_minute}'` : ""}`
                            : isFinished ? "Finalizado" : "Pendiente"}
                        </span>
                      </div>

                      {/* Equipos y marcador */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Local */}
                        <div className="flex-1 flex items-center gap-2 justify-end">
                          <span className="font-medium text-white text-sm text-right">{match.home_team}</span>
                          <span className="text-lg">{getTeamFlag(match.home_team)}</span>
                        </div>

                        {/* Marcador */}
                        <div className="flex items-center gap-1 shrink-0 px-2">
                          {isFinished || isLive ? (
                            <span className={`text-lg font-bold ${isLive ? "text-green-300" : "text-white"}`}>
                              {match.home_score} – {match.away_score}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-sm font-medium">vs</span>
                          )}
                        </div>

                        {/* Visitante */}
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-lg">{getTeamFlag(match.away_team)}</span>
                          <span className="font-medium text-white text-sm">{match.away_team}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
