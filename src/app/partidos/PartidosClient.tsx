"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import FlagIcon from "@/components/FlagIcon";
import { formatDateTime, toMxDateKey, formatDayHeader } from "@/lib/utils";
import type { Match, Phase } from "@/types/database";

interface Props {
  matches: Match[];
  phases: Phase[];
  todayKey: string;
}

export default function PartidosClient({ matches, phases, todayKey }: Props) {
  // Filtrar solo fases que tienen partidos
  const phasesWithMatches = phases.filter((ph) =>
    matches.some((m) => m.phase_id === ph.id)
  );

  const [activePhaseId, setActivePhaseId] = useState<number>(
    phasesWithMatches[0]?.id ?? 0
  );

  const activeMatches = matches
    .filter((m) => m.phase_id === activePhaseId)
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

  // Agrupar por día (CDMX)
  const dayGroups = activeMatches.reduce<Map<string, Match[]>>((acc, m) => {
    const key = toMxDateKey(m.kickoff_at);
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(m);
    return acc;
  }, new Map());

  return (
    <div>
      {/* ── Tabs de fases ─────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        {phasesWithMatches.map((ph) => {
          const total = matches.filter((m) => m.phase_id === ph.id).length;
          const finished = matches.filter(
            (m) => m.phase_id === ph.id && m.status === "finished"
          ).length;
          const hasLive = matches.some(
            (m) => m.phase_id === ph.id && m.status === "live"
          );

          return (
            <button
              key={ph.id}
              onClick={() => setActivePhaseId(ph.id)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap",
                activePhaseId === ph.id
                  ? "bg-indigo-700/40 border-indigo-600/60 text-indigo-300"
                  : "bg-gray-800/40 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
              )}
            >
              {hasLive && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              )}
              {ph.display_name}
              <span className={cn(
                "text-[10px]",
                activePhaseId === ph.id ? "text-indigo-500" : "text-gray-700"
              )}>
                {finished}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Partidos de la fase activa ─────────────────────────────────────── */}
      <div className="space-y-4">
        {Array.from(dayGroups.entries()).map(([dayKey, dayMatches]) => {
          const isToday = dayKey === todayKey;

          return (
            <div key={dayKey}>
              {/* Separador de día */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-px flex-1 ${isToday ? "bg-yellow-500/40" : "bg-gray-800"}`} />
                <span className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 border",
                  isToday
                    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                    : "text-gray-500 border-gray-800"
                )}>
                  {isToday ? "⚽ HOY — " : ""}{formatDayHeader(dayKey)}
                </span>
                <div className={`h-px flex-1 ${isToday ? "bg-yellow-500/40" : "bg-gray-800"}`} />
              </div>

              {/* Partidos del día */}
              <div className={cn(
                "bg-gray-900 border rounded-xl divide-y overflow-hidden",
                isToday
                  ? "border-yellow-500/30 divide-yellow-900/20"
                  : "border-gray-800 divide-gray-800/60"
              )}>
                {dayMatches.map((match) => {
                  const isLive = match.status === "live";
                  const isFinished = match.status === "finished";
                  const matchDay = toMxDateKey(match.kickoff_at);
                  const isMatchToday = matchDay === todayKey;

                  const hasET = isFinished &&
                    match.home_score_final !== null &&
                    (match.home_score_final !== match.home_score ||
                      match.away_score_final !== match.away_score);
                  const hasPen = !!match.penalty_winner;
                  const penTally =
                    match.penalty_home_score !== null &&
                    match.penalty_away_score !== null;

                  return (
                    <div
                      key={match.id}
                      className={cn(
                        "px-4 py-3",
                        isLive
                          ? "bg-green-950/25"
                          : isMatchToday && !isFinished
                          ? "bg-yellow-950/10"
                          : ""
                      )}
                    >
                      {/* Header: hora y estado */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">
                          {formatDateTime(match.kickoff_at)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isMatchToday && !isLive && !isFinished && (
                            <span className="text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">
                              HOY
                            </span>
                          )}
                          <span className={cn(
                            "text-xs font-medium flex items-center gap-1",
                            isLive ? "text-green-400" : isFinished ? "text-gray-500" : "text-gray-600"
                          )}>
                            {isLive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                            )}
                            {isLive
                              ? `En vivo${match.current_minute ? ` · ${match.current_minute}'` : ""}`
                              : isFinished ? "Finalizado" : "Pendiente"}
                          </span>
                        </div>
                      </div>

                      {/* Equipos y marcador */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Local */}
                        <div className="flex-1 flex items-center justify-end">
                          <span className="font-medium text-white text-sm text-right leading-tight">
                            {match.home_team}
                          </span>
                          <FlagIcon team={match.home_team} className="w-6 h-4 rounded-sm shrink-0 ml-2" />
                        </div>

                        {/* Marcador central */}
                        <div className="flex flex-col items-center shrink-0 px-2 min-w-[80px] justify-center gap-0.5">
                          {isFinished || isLive ? (
                            <>
                              {/* 90' */}
                              <span className={cn(
                                "text-lg font-bold tabular-nums leading-tight",
                                isLive ? "text-green-300" : "text-white"
                              )}>
                                {match.home_score} – {match.away_score}
                              </span>
                              <span className="text-[10px] text-gray-600">
                                {isLive
                                  ? (match.current_minute ? `${match.current_minute}'` : "En vivo")
                                  : "90'"}
                              </span>
                              {/* T.E. */}
                              {hasET && (
                                <span className="text-[11px] text-gray-400 font-semibold tabular-nums leading-none mt-0.5">
                                  T.E. {match.home_score_final}–{match.away_score_final}
                                </span>
                              )}
                              {/* Penales */}
                              {hasPen && (
                                <span className="text-[10px] text-violet-400 text-center leading-tight mt-0.5">
                                  🎯{penTally
                                    ? ` ${match.penalty_home_score}–${match.penalty_away_score} pen.`
                                    : ` pen. ${match.penalty_winner === "home" ? match.home_team : match.away_team}`
                                  }
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-600 text-sm font-medium">vs</span>
                          )}
                        </div>

                        {/* Visitante */}
                        <div className="flex-1 flex items-center">
                          <FlagIcon team={match.away_team} className="w-6 h-4 rounded-sm shrink-0 mr-2" />
                          <span className="font-medium text-white text-sm leading-tight">
                            {match.away_team}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
