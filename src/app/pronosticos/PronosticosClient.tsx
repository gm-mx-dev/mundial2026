"use client";
import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, toMxDateKey, formatDayHeader, cn } from "@/lib/utils";
import FlagIcon from "@/components/FlagIcon";
import type { Match, Phase } from "@/types/database";
import { Check, Lock, Clock } from "lucide-react";

interface Props {
  matches: Match[];
  phases: Phase[];
  participantId: string | null;
  initialPredictions: Record<string, { home_score: number | null; away_score: number | null; points_earned: number | null }>;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function getTodayMxKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

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

  const now = new Date();
  const todayKey = getTodayMxKey();

  const matchesByPhase = phases.map((ph) => {
    const phaseMatches = matches.filter((m) => m.phase_id === ph.id);
    const firstKickoff = phaseMatches.reduce<Date | null>((min, m) => {
      const d = new Date(m.kickoff_at);
      return min === null || d < min ? d : min;
    }, null);
    const phaseLocked = firstKickoff !== null && firstKickoff <= now;

    const dayGroups = phaseMatches.reduce<Map<string, Match[]>>((acc, m) => {
      const key = toMxDateKey(m.kickoff_at);
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(m);
      return acc;
    }, new Map());

    return { phase: ph, dayGroups, phaseLocked };
  }).filter((g) => g.dayGroups.size > 0);

  return (
    <div className="space-y-8">
      {matchesByPhase.map(({ phase, dayGroups, phaseLocked }) => (
        <div key={phase.id}>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">
              {phase.display_name}
            </h2>
            {phaseLocked && (
              <span className="text-xs text-red-500/70 flex items-center gap-1">
                <Lock size={10} /> cerrada
              </span>
            )}
          </div>

          <div className="space-y-4">
            {Array.from(dayGroups.entries()).map(([dayKey, dayMatches]) => {
              const isToday = dayKey === todayKey;
              return (
                <div key={dayKey}>
                  {/* Separador de día */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-px flex-1 ${isToday ? "bg-yellow-500/40" : "bg-gray-800"}`} />
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      isToday
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                        : "text-gray-500 border border-gray-800"
                    }`}>
                      {isToday ? "⚽ HOY — " : ""}{formatDayHeader(dayKey)}
                    </span>
                    <div className={`h-px flex-1 ${isToday ? "bg-yellow-500/40" : "bg-gray-800"}`} />
                  </div>

                  <div className={`bg-gray-900 border rounded-xl divide-y overflow-hidden ${
                    isToday
                      ? "border-yellow-500/30 divide-yellow-900/20"
                      : "border-gray-800 divide-gray-800/60"
                  }`}>
                    {dayMatches.map((match) => {
                      const locked = phaseLocked;
                      const pred = predictions[match.id] ?? { home_score: null, away_score: null, points_earned: null };
                      const status = saveStatus[match.id] ?? "idle";
                      const hasResult = match.home_score !== null && match.away_score !== null;
                      const isLive = match.status === "live";
                      const isFinished = match.status === "finished";
                      const isMatchToday = toMxDateKey(match.kickoff_at) === todayKey;
                      const pts = pred.points_earned;
                      const hasFinalResult = isFinished && match.home_score_final !== null && (
                        match.penalty_winner !== null ||
                        match.home_score_final !== match.home_score ||
                        match.away_score_final !== match.away_score
                      );

                      return (
                        <div
                          key={match.id}
                          className={cn(
                            "px-4 py-3 transition-colors",
                            isLive ? "bg-green-950/25" : isMatchToday && !isFinished ? "bg-yellow-950/10" : "",
                            status === "saved" && "outline outline-1 outline-green-700/30"
                          )}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-xs text-gray-500">{formatDateTime(match.kickoff_at)}</span>
                            <div className="flex items-center gap-1.5">
                              {isMatchToday && !isLive && !isFinished && (
                                <span className="text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">
                                  HOY
                                </span>
                              )}
                              {isLive && (
                                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                  En vivo{match.current_minute ? ` · ${match.current_minute}'` : ""}
                                </span>
                              )}
                              {locked && !isLive && <Lock size={11} className="text-gray-700" />}
                              {status === "saving" && <Clock size={11} className="text-indigo-400 animate-spin" />}
                              {status === "saved" && <Check size={11} className="text-green-400" />}
                              {status === "error" && <span className="text-xs text-red-400">Error</span>}
                            </div>
                          </div>

                          {/* Equipos + pronóstico */}
                          <div className="flex items-center gap-2">
                            {/* Local */}
                            <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                              <span className="font-medium text-white text-sm text-right leading-tight truncate">
                                {match.home_team}
                              </span>
                              <FlagIcon team={match.home_team} className="w-6 h-4 rounded-sm shrink-0" />
                            </div>

                            {/* Input o score bloqueado */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!locked ? (
                                <>
                                  <input
                                    type="number" min="0" max="99"
                                    value={pred.home_score ?? ""}
                                    onChange={(e) => handleScore(match.id, "home", e.target.value)}
                                    className="w-12 h-10 text-center text-lg font-bold rounded-lg border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="—"
                                  />
                                  <span className="text-gray-500 font-bold text-lg">:</span>
                                  <input
                                    type="number" min="0" max="99"
                                    value={pred.away_score ?? ""}
                                    onChange={(e) => handleScore(match.id, "away", e.target.value)}
                                    className="w-12 h-10 text-center text-lg font-bold rounded-lg border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="—"
                                  />
                                </>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className={cn(
                                    "w-12 h-10 flex items-center justify-center text-lg font-bold rounded-lg border",
                                    pred.home_score !== null ? "border-gray-700 text-gray-300" : "border-gray-800 text-gray-600"
                                  )}>
                                    {pred.home_score ?? "—"}
                                  </span>
                                  <span className="text-gray-600 font-bold text-lg">:</span>
                                  <span className={cn(
                                    "w-12 h-10 flex items-center justify-center text-lg font-bold rounded-lg border",
                                    pred.away_score !== null ? "border-gray-700 text-gray-300" : "border-gray-800 text-gray-600"
                                  )}>
                                    {pred.away_score ?? "—"}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Visitante */}
                            <div className="flex-1 flex items-center gap-1.5 min-w-0">
                              <FlagIcon team={match.away_team} className="w-6 h-4 rounded-sm shrink-0" />
                              <span className="font-medium text-white text-sm leading-tight truncate">
                                {match.away_team}
                              </span>
                            </div>
                          </div>

                          {/* Resultado oficial */}
                          {(hasResult || isLive) && (
                            <div className="mt-2.5 flex items-center justify-center gap-2 flex-wrap">
                              {/* Puntos ganados */}
                              {isFinished && pts !== null && pts !== undefined && (
                                <span className={cn(
                                  "text-xs font-bold px-2 py-0.5 rounded-full border",
                                  pts === 2 ? "bg-green-900/40 text-green-400 border-green-800/40" :
                                  pts === 1 ? "bg-blue-900/40 text-blue-400 border-blue-800/40" :
                                  "bg-gray-800/60 text-gray-500 border-gray-700/40"
                                )}>
                                  {pts === 2 ? "✓✓ +2 pts" : pts === 1 ? "✓ +1 pt" : "✗ 0 pts"}
                                </span>
                              )}

                              {/* Marcador 90 min */}
                              <div className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border",
                                isLive
                                  ? "bg-green-900/30 border-green-800/40"
                                  : "bg-gray-800/60 border-gray-700/40"
                              )}>
                                <span className="text-xs text-gray-500 font-medium">
                                  {isLive
                                    ? (match.current_minute ? `${match.current_minute}'` : "⚡")
                                    : "90'"}
                                </span>
                                <span className={cn(
                                  "text-sm font-bold tabular-nums",
                                  isLive ? "text-green-300" :
                                  pts === 2 ? "text-green-400" :
                                  pts === 1 ? "text-blue-400" :
                                  "text-white"
                                )}>
                                  {match.home_score} – {match.away_score}
                                </span>
                              </div>

                              {/* Resultado final (ET/penales) — solo si aplica */}
                              {hasFinalResult && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-700/40 bg-gray-800/40">
                                  <span className="text-xs text-gray-600 font-medium">Final</span>
                                  <span className="text-sm font-bold tabular-nums text-gray-400">
                                    {match.home_score_final} – {match.away_score_final}
                                  </span>
                                  {match.penalty_winner && (
                                    <span className="text-xs text-gray-600">Penales</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
