"use client";
import { useState } from "react";
import { formatDateTime, cn } from "@/lib/utils";
import FlagIcon from "@/components/FlagIcon";
import type { Match, Phase, Participant } from "@/types/database";

interface Prediction {
  participant_id: string;
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  points_earned: number | null;
}

interface Props {
  matches: Match[];
  phases: Phase[];
  participants: Pick<Participant, "id" | "name" | "is_active">[];
  predictions: Prediction[];
}

export default function TodosClient({ matches, phases, participants, predictions }: Props) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<number>(phases[0]?.id ?? 0);

  // Índice de predicciones: participantId → matchId → prediction
  const predIndex: Record<string, Record<string, Prediction>> = {};
  for (const p of predictions) {
    if (!predIndex[p.participant_id]) predIndex[p.participant_id] = {};
    predIndex[p.participant_id][p.match_id] = p;
  }

  if (phases.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-4xl mb-3">🔒</div>
        <p>Los pronósticos de todos se revelan cuando inicia el primer partido de cada fase.</p>
      </div>
    );
  }

  const selectedPhase = phases.find((ph) => ph.id === selectedPhaseId) ?? phases[0];
  const phaseMatches = matches.filter((m) => m.phase_id === selectedPhase.id);

  return (
    <div>
      {/* Tabs de fases */}
      {phases.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {phases.map((ph) => (
            <button
              key={ph.id}
              onClick={() => setSelectedPhaseId(ph.id)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                ph.id === selectedPhaseId
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
              )}
            >
              {ph.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Partidos de la fase seleccionada */}
      <div className="space-y-4">
        {phaseMatches.map((match) => {
          const hasResult = match.home_score !== null && match.away_score !== null;

          return (
            <div key={match.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Encabezado del partido */}
              <div className="px-4 py-3 border-b border-gray-800/60">
                <div className="text-xs text-gray-500 mb-1">{formatDateTime(match.kickoff_at)}</div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 justify-end">
                    <span className="font-semibold text-white text-sm text-right">{match.home_team}</span>
                    <FlagIcon team={match.home_team} className="w-6 h-4 rounded-sm shrink-0" />
                  </div>

                  <div className="shrink-0 text-center px-3">
                    {hasResult ? (
                      <div>
                        <span className="text-white font-bold text-base tabular-nums">
                          {match.home_score} – {match.away_score}
                        </span>
                        <div className="text-[10px] text-gray-600">90'</div>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-sm">vs</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-1">
                    <FlagIcon team={match.away_team} className="w-6 h-4 rounded-sm shrink-0" />
                    <span className="font-semibold text-white text-sm">{match.away_team}</span>
                  </div>
                </div>
              </div>

              {/* Pronósticos de todos los participantes */}
              <div className="divide-y divide-gray-800/40">
                {participants.map((p) => {
                  const pred = predIndex[p.id]?.[match.id];
                  const pts = pred?.points_earned;
                  const hasPred = pred && pred.home_score !== null && pred.away_score !== null;

                  return (
                    <div key={p.id} className="px-4 py-2 flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-300 font-medium w-28 shrink-0">{p.name}</span>

                      <div className="flex items-center gap-2">
                        {hasPred ? (
                          <>
                            <span className={cn(
                              "font-bold tabular-nums text-sm",
                              pts === 2 ? "text-green-400" :
                              pts === 1 ? "text-blue-400" :
                              pts === 0 ? "text-gray-500" :
                              "text-gray-300"
                            )}>
                              {pred.home_score} – {pred.away_score}
                            </span>
                            {hasResult && pts !== null && (
                              <span className={cn(
                                "text-xs font-bold px-1.5 py-0.5 rounded-full border",
                                pts === 2 ? "bg-green-900/40 text-green-400 border-green-800/40" :
                                pts === 1 ? "bg-blue-900/40 text-blue-400 border-blue-800/40" :
                                "bg-gray-800/60 text-gray-600 border-gray-700/40"
                              )}>
                                {pts === 2 ? "+2" : pts === 1 ? "+1" : "0"}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-700 italic">sin pronóstico</span>
                        )}
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
