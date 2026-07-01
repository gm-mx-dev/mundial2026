import { createClient } from "@/lib/supabase/server";

type ParticipantStatus = {
  id: string;
  name: string;
  needs_proxy: boolean;
  done: number;
  total: number;
};

export default async function PronosticosStatus() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Find the next open phase (first match hasn't started yet)
  const { data: phases } = await supabase
    .from("phases")
    .select("id, display_name")
    .order("sort_order");

  const { data: allMatches } = await supabase
    .from("matches")
    .select("id, phase_id, kickoff_at")
    .order("kickoff_at");

  if (!phases || !allMatches) return null;

  // Find the first phase whose opening kickoff is in the future
  let openPhase: { id: number; display_name: string } | null = null;
  let openMatchIds: string[] = [];

  for (const ph of phases) {
    const phMatches = allMatches.filter((m) => m.phase_id === ph.id);
    if (phMatches.length === 0) continue;
    const firstKickoff = phMatches.reduce(
      (min, m) => (m.kickoff_at < min ? m.kickoff_at : min),
      phMatches[0].kickoff_at
    );
    if (firstKickoff > now) {
      openPhase = ph;
      openMatchIds = phMatches.map((m) => m.id);
      break;
    }
  }

  if (!openPhase || openMatchIds.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-gray-500">
        No hay fases abiertas para pronósticos en este momento.
      </div>
    );
  }

  const total = openMatchIds.length;

  // Get all active participants
  const { data: participants } = await supabase
    .from("participants")
    .select("id, name, needs_proxy")
    .eq("is_active", true)
    .order("name");

  // Get prediction counts per participant for this phase
  const { data: preds } = await supabase
    .from("predictions")
    .select("participant_id")
    .in("match_id", openMatchIds)
    .not("home_score", "is", null)
    .not("away_score", "is", null);

  const countMap: Record<string, number> = {};
  for (const p of preds ?? []) {
    countMap[p.participant_id] = (countMap[p.participant_id] ?? 0) + 1;
  }

  const statuses: ParticipantStatus[] = (participants ?? []).map((pt) => ({
    id: pt.id,
    name: pt.name,
    needs_proxy: pt.needs_proxy,
    done: countMap[pt.id] ?? 0,
    total,
  }));

  const complete = statuses.filter((s) => s.done >= s.total);
  const incomplete = statuses.filter((s) => s.done < s.total).sort((a, b) => a.done - b.done);

  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-300">Fase abierta: </span>
          <span className="text-sm font-semibold text-indigo-400">{openPhase.display_name}</span>
          <span className="text-xs text-gray-500 ml-2">({total} partidos)</span>
        </div>
        <span className="text-xs text-gray-500">
          {complete.length}/{statuses.length} completos
        </span>
      </div>

      <div className="divide-y divide-gray-800/60">
        {[...incomplete, ...complete].map((s) => {
          const pct = total > 0 ? Math.round((s.done / total) * 100) : 0;
          const isComplete = s.done >= s.total;
          return (
            <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-medium ${isComplete ? "text-gray-400" : "text-white"}`}>
                    {s.name}
                  </span>
                  {s.needs_proxy && (
                    <span className="text-xs text-yellow-500/70 border border-yellow-700/40 px-1 rounded">
                      admin
                    </span>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isComplete ? "bg-green-600" : pct > 50 ? "bg-yellow-500" : "bg-red-600/70"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-xs tabular-nums w-12 text-right ${
                  isComplete ? "text-green-500" : "text-gray-400"
                }`}>
                  {s.done}/{s.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
