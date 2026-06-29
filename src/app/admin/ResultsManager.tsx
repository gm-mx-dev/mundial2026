"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDateTime } from "@/lib/utils";
import type { Match } from "@/types/database";
import { Check, Loader } from "lucide-react";

interface Props {
  matches: Match[];
  adminId: string;
}

export default function ResultsManager({ matches, adminId }: Props) {
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>(
    Object.fromEntries(
      matches.map((m) => [m.id, {
        home: m.home_score?.toString() ?? "",
        away: m.away_score?.toString() ?? "",
      }])
    )
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const supabase = createClient();

  const saveResult = async (match: Match) => {
    const sc = scores[match.id];
    const home = parseInt(sc.home);
    const away = parseInt(sc.away);
    if (isNaN(home) || isNaN(away)) return;

    setSaving(match.id);

    const { error } = await supabase
      .from("matches")
      .update({ home_score: home, away_score: away, status: "finished" })
      .eq("id", match.id);

    if (!error) {
      // Calcular puntos automáticamente
      await supabase.rpc("calculate_points", {
        p_match_id: match.id,
        p_home_score: home,
        p_away_score: away,
      });

      // Bitácora
      await supabase.from("audit_log").insert({
        action_type: match.home_score !== null ? "result_updated" : "result_captured",
        performed_by: adminId,
        match_id: match.id,
        before_value: { home_score: match.home_score, away_score: match.away_score },
        after_value: { home_score: home, away_score: away },
      });

      setSaved(match.id);
      setTimeout(() => setSaved(null), 2000);
    }
    setSaving(null);
  };

  // Solo mostrar partidos finalizados o próximos (últimos 5 días)
  const relevantMatches = matches.filter((m) => {
    const diff = Date.now() - new Date(m.kickoff_at).getTime();
    return diff > -1000 * 60 * 60 * 2; // partidos que ya empezaron (o empiezan en 2h)
  });

  if (relevantMatches.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500 text-sm">
        No hay partidos para capturar resultado aún
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800/60">
      {relevantMatches.map((match) => {
        const sc = scores[match.id];
        const isSaving = saving === match.id;
        const isSaved = saved === match.id;

        return (
          <div key={match.id} className="px-4 py-3">
            <div className="text-xs text-gray-500 mb-2">{formatDateTime(match.kickoff_at)}</div>
            <div className="flex items-center gap-3">
              <span className="flex-1 text-right text-sm font-medium text-white">{match.home_team}</span>

              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number" min="0" max="99"
                  value={sc.home}
                  onChange={(e) => setScores((s) => ({ ...s, [match.id]: { ...s[match.id], home: e.target.value } }))}
                  className="w-12 h-9 text-center font-bold rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-gray-600">:</span>
                <input
                  type="number" min="0" max="99"
                  value={sc.away}
                  onChange={(e) => setScores((s) => ({ ...s, [match.id]: { ...s[match.id], away: e.target.value } }))}
                  className="w-12 h-9 text-center font-bold rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <span className="flex-1 text-sm font-medium text-white">{match.away_team}</span>

              <button
                onClick={() => saveResult(match)}
                disabled={isSaving || !sc.home || !sc.away}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  isSaved
                    ? "bg-green-900/40 text-green-400 border border-green-800/40"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40"
                )}
              >
                {isSaving ? <Loader size={12} className="animate-spin" /> : isSaved ? <Check size={12} /> : "Guardar"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
