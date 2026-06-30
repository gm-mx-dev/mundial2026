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

interface MatchState {
  home: string;
  away: string;
  homeFinal: string;
  awayFinal: string;
  penWinner: "" | "home" | "away";
}

export default function ResultsManager({ matches, adminId }: Props) {
  const [scores, setScores] = useState<Record<string, MatchState>>(
    Object.fromEntries(
      matches.map((m) => [m.id, {
        home: m.home_score?.toString() ?? "",
        away: m.away_score?.toString() ?? "",
        homeFinal: m.home_score_final?.toString() ?? "",
        awayFinal: m.away_score_final?.toString() ?? "",
        penWinner: (m.penalty_winner ?? "") as "" | "home" | "away",
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

    const homeFinal = sc.homeFinal !== "" ? parseInt(sc.homeFinal) : null;
    const awayFinal = sc.awayFinal !== "" ? parseInt(sc.awayFinal) : null;
    const penWinner = sc.penWinner || null;

    setSaving(match.id);

    const updatePayload: Record<string, unknown> = {
      home_score: home,
      away_score: away,
      status: "finished",
      home_score_final: homeFinal,
      away_score_final: awayFinal,
      penalty_winner: penWinner,
    };

    const { error } = await supabase
      .from("matches")
      .update(updatePayload)
      .eq("id", match.id);

    if (!error) {
      // El trigger recalcula puntos automáticamente, pero también llamamos el RPC por si acaso
      await supabase.rpc("calculate_points", {
        p_match_id: match.id,
        p_home_score: home,
        p_away_score: away,
      });

      await supabase.from("audit_log").insert({
        action_type: match.home_score !== null ? "result_updated" : "result_captured",
        performed_by: adminId,
        match_id: match.id,
        before_value: { home_score: match.home_score, away_score: match.away_score },
        after_value: { home_score: home, away_score: away, penalty_winner: penWinner },
      });

      setSaved(match.id);
      setTimeout(() => setSaved(null), 2000);
    }
    setSaving(null);
  };

  const relevantMatches = matches.filter((m) => {
    const diff = Date.now() - new Date(m.kickoff_at).getTime();
    return diff > -1000 * 60 * 60 * 2;
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
        const isDraw = sc.home !== "" && sc.away !== "" && sc.home === sc.away;

        return (
          <div key={match.id} className="px-4 py-4">
            <div className="text-xs text-gray-500 mb-3">{formatDateTime(match.kickoff_at)}</div>

            {/* Resultado 90 minutos (cuenta para la quiniela) */}
            <div className="mb-1">
              <p className="text-xs text-indigo-400 font-medium mb-1.5">Resultado 90 min (cuenta para la quiniela)</p>
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
              </div>
            </div>

            {/* Resultado final con ET (opcional, solo display) */}
            <div className="mt-3 mb-1">
              <p className="text-xs text-gray-500 mb-1.5">Resultado final con tiempo extra (solo display, opcional)</p>
              <div className="flex items-center gap-3">
                <span className="flex-1 text-right text-xs text-gray-400">{match.home_team}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number" min="0" max="99"
                    placeholder="—"
                    value={sc.homeFinal}
                    onChange={(e) => setScores((s) => ({ ...s, [match.id]: { ...s[match.id], homeFinal: e.target.value } }))}
                    className="w-11 h-8 text-center font-bold rounded-lg bg-gray-800/60 border border-gray-700/60 text-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-gray-600"
                  />
                  <span className="text-gray-700 text-xs">:</span>
                  <input
                    type="number" min="0" max="99"
                    placeholder="—"
                    value={sc.awayFinal}
                    onChange={(e) => setScores((s) => ({ ...s, [match.id]: { ...s[match.id], awayFinal: e.target.value } }))}
                    className="w-11 h-8 text-center font-bold rounded-lg bg-gray-800/60 border border-gray-700/60 text-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-gray-600"
                  />
                </div>
                <span className="flex-1 text-xs text-gray-400">{match.away_team}</span>
              </div>
            </div>

            {/* Ganador en penales (solo si empate en 90 min) */}
            {isDraw && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1.5">Ganó en penales (solo display)</p>
                <div className="flex gap-2">
                  {[
                    { val: "" as const, label: "Ninguno (decidido en ET)" },
                    { val: "home" as const, label: match.home_team },
                    { val: "away" as const, label: match.away_team },
                  ].map(({ val, label }) => (
                    <button
                      key={val}
                      onClick={() => setScores((s) => ({ ...s, [match.id]: { ...s[match.id], penWinner: val } }))}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                        sc.penWinner === val
                          ? "bg-indigo-600/30 border-indigo-600/60 text-indigo-300"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Botón guardar */}
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => saveResult(match)}
                disabled={isSaving || !sc.home || !sc.away}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                  isSaved
                    ? "bg-green-900/40 text-green-400 border border-green-800/40"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40"
                )}
              >
                {isSaving ? <Loader size={12} className="animate-spin" /> : isSaved ? <Check size={12} /> : "Guardar resultado"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
