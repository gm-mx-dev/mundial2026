"use client";
import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { isMatchLocked, formatDateTime, cn } from "@/lib/utils";
import type { Match, Phase } from "@/types/database";
import { Check, Lock, Clock } from "lucide-react";

interface Props {
  matches: Match[];
  phases: Phase[];
  participantId: string | null;
  initialPredictions: Record<string, { home_score: number | null; away_score: number | null }>;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function PronosticosClient({ matches, phases, participantId, initialPredictions }: Props) {
  const [predictions, setPredictions] = useState(initialPredictions);
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const supabase = createClient();

  const savePrediction = useCallback(async (
    matchId: string,
    home: number | null,
    away: number | null
  ) => {
    if (!participantId) return;
    setSaveStatus((s) => ({ ...s, [matchId]: "saving" }));
    const { error } = await supabase.from("predictions").upsert(
      { participant_id: participantId, match_id: matchId, home_score: home, away_score: away },
      { onConflict: "participant_id,match_id" }
    );
    setSaveStatus((s) => ({ ...s, [matchId]: error ? "error" : "saved" }));
    setTimeout(() => setSaveStatus((s) => ({ ...s, [matchId]: "idle" })), 2000);
  }, [participantId, supabase]);

  const handleScore = (matchId: string, side: "home" | "away", value: string) => {
    const parsed = value === "" ? null : Math.max(0, parseInt(value) || 0);
    setPredictions((prev) => {
      const updated = { ...prev, [matchId]: { ...prev[matchId], [`${side}_score`]: parsed } };
      const pred = updated[matchId];
      if (pred.home_score !== null && pred.away_score !== null) {
        savePrediction(matchId, pred.home_score, pred.away_score);
      }
      return updated;
    });
  };

  const matchesByPhase = phases.map((ph) => ({
    phase: ph,
    matches: matches.filter((m) => m.phase_id === ph.id),
  })).filter((g) => g.matches.length > 0);

  return (
    <div className="space-y-6">
      {matchesByPhase.map(({ phase, matches: phaseMatches }) => (
        <div key={phase.id}>
          <h2 className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">
            {phase.display_name}
          </h2>
          <div className="space-y-3">
            {phaseMatches.map((match) => {
              const locked = isMatchLocked(match.kickoff_at) || match.status === "finished";
              const pred = predictions[match.id] ?? { home_score: null, away_score: null };
              const status = saveStatus[match.id] ?? "idle";
              const hasResult = match.home_score !== null;

              return (
                <div
                  key={match.id}
                  className={cn(
                    "bg-gray-900 border rounded-xl p-4 transition-all",
                    locked ? "border-gray-800 opacity-80" : "border-gray-700",
                    status === "saved" && "border-green-700/50"
                  )}
                >
                  {/* Partido header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500">{formatDateTime(match.kickoff_at)}</span>
                    <div className="flex items-center gap-1.5">
                      {locked && <Lock size={12} className="text-gray-600" />}
                      {status === "saving" && <Clock size={12} className="text-indigo-400 animate-spin" />}
                      {status === "saved" && <Check size={12} className="text-green-400" />}
                      {status === "error" && <span className="text-xs text-red-400">Error</span>}
                    </div>
                  </div>

                  {/* Equipos y marcadores */}
                  <div className="flex items-center gap-3">
                    {/* Local */}
                    <div className="flex-1 text-right">
                      <span className="font-semibold text-white text-sm">{match.home_team}</span>
                    </div>

                    {/* Inputs pronóstico */}
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        disabled={locked}
                        value={pred.home_score ?? ""}
                        onChange={(e) => handleScore(match.id, "home", e.target.value)}
                        className={cn(
                          "w-12 h-10 text-center text-lg font-bold rounded-lg border bg-gray-800 text-white",
                          "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                          locked ? "opacity-50 cursor-not-allowed border-gray-700" : "border-gray-600"
                        )}
                        placeholder="—"
                      />
                      <span className="text-gray-500 font-bold">:</span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        disabled={locked}
                        value={pred.away_score ?? ""}
                        onChange={(e) => handleScore(match.id, "away", e.target.value)}
                        className={cn(
                          "w-12 h-10 text-center text-lg font-bold rounded-lg border bg-gray-800 text-white",
                          "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                          locked ? "opacity-50 cursor-not-allowed border-gray-700" : "border-gray-600"
                        )}
                        placeholder="—"
                      />
                    </div>

                    {/* Visitante */}
                    <div className="flex-1">
                      <span className="font-semibold text-white text-sm">{match.away_team}</span>
                    </div>
                  </div>

                  {/* Resultado real (si ya se jugó) */}
                  {hasResult && (
                    <div className="mt-2 text-center text-xs text-gray-500">
                      Resultado: <span className="text-white font-semibold">{match.home_score} – {match.away_score}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
