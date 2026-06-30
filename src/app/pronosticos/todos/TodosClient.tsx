"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
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
  totals: Record<string, number>; // participantId → total_points
}

function abbrev(name: string) {
  // Acorta nombres de equipos para las cabeceras
  const map: Record<string, string> = {
    "Sudáfrica": "RSA", "Canadá": "CAN", "Alemania": "GER", "Paraguay": "PAR",
    "Francia": "FRA", "Suecia": "SUE", "Países Bajos": "NED", "Marruecos": "MAR",
    "Portugal": "POR", "Croacia": "CRO", "España": "ESP", "Austria": "AUT",
    "Estados Unidos": "USA", "Bosnia H.": "BIH", "Bélgica": "BEL", "Senegal": "SEN",
    "Brasil": "BRA", "Japón": "JPN", "C. Marfil": "CIV", "Noruega": "NOR",
    "México": "MEX", "Ecuador": "ECU", "Inglaterra": "ENG", "RD Congo": "COD",
    "Argentina": "ARG", "Cabo Verde": "CPV", "Australia": "AUS", "Egipto": "EGY",
    "Suiza": "SUI", "Argelia": "ALG", "Colombia": "COL", "Ghana": "GHA",
  };
  return map[name] ?? name.slice(0, 3).toUpperCase();
}

export default function TodosClient({ matches, phases, participants, predictions, totals }: Props) {
  // Índice: participantId → matchId → prediction
  const idx: Record<string, Record<string, Prediction>> = {};
  for (const p of predictions) {
    if (!idx[p.participant_id]) idx[p.participant_id] = {};
    idx[p.participant_id][p.match_id] = p;
  }

  // Participantes ordenados por total de puntos desc
  const sorted = [...participants].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0));

  if (phases.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-4xl mb-3">🔒</div>
        <p>Los pronósticos se revelan cuando inicia el primer partido de cada fase.</p>
      </div>
    );
  }

  // Matches agrupados por fase, en orden
  const phaseGroups = phases.map((ph) => ({
    phase: ph,
    matches: matches.filter((m) => m.phase_id === ph.id),
  }));

  // Todos los matches en orden (para las columnas)
  const allMatches = phaseGroups.flatMap((g) => g.matches);

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="border-collapse text-xs" style={{ minWidth: `${120 + allMatches.length * 72}px` }}>

        {/* ── Cabecera única (sticky vertical) ── */}
        <thead>
          <tr>
            {/* Esquina: sticky horizontal + vertical */}
            <th className="sticky left-0 top-12 md:top-0 z-30 bg-gray-900 border-b-2 border-r border-gray-700 py-2 px-3 text-left text-gray-400 font-medium min-w-[120px]">
              Participante
            </th>

            {allMatches.map((m, i) => {
              const hasResult = m.home_score !== null;
              // Primera columna de cada fase → mostrar nombre de fase encima
              const phaseGroup = phaseGroups.find((g) => g.matches[0]?.id === m.id);
              return (
                <th
                  key={m.id}
                  className={cn(
                    "sticky top-12 md:top-0 z-10 border-b-2 border-r border-gray-800 py-1.5 px-1 text-center bg-gray-900 min-w-[68px]",
                    phaseGroup ? "border-l-2 border-l-indigo-800" : ""
                  )}
                >
                  {phaseGroup && (
                    <div className="text-indigo-400 font-semibold uppercase tracking-widest text-[9px] mb-1 leading-none">
                      {phaseGroup.phase.display_name}
                    </div>
                  )}
                  <div className="text-gray-300 font-semibold leading-tight">
                    {abbrev(m.home_team)}
                  </div>
                  <div className="text-gray-600 text-[10px] leading-none my-0.5">vs</div>
                  <div className="text-gray-300 font-semibold leading-tight">
                    {abbrev(m.away_team)}
                  </div>
                  {hasResult && (
                    <div className="text-green-500 font-bold mt-1 leading-none tabular-nums">
                      {m.home_score}–{m.away_score}
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* ── Filas de participantes ── */}
        <tbody>
          {sorted.map((p, rowIdx) => {
            const total = totals[p.id] ?? 0;
            return (
              <tr
                key={p.id}
                className={rowIdx % 2 === 0 ? "bg-gray-950" : "bg-gray-900/60"}
              >
                {/* Nombre + total */}
                <td className="sticky left-0 z-10 border-r border-gray-800 py-2 px-3 font-semibold text-white"
                  style={{ background: rowIdx % 2 === 0 ? "#030712" : "rgba(17,24,39,0.6)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{p.name}</span>
                    <span className={cn(
                      "font-bold text-xs tabular-nums",
                      total > 0 ? "text-indigo-300" : "text-gray-600"
                    )}>
                      {total}
                    </span>
                  </div>
                </td>

                {/* Una celda por partido */}
                {allMatches.map((m) => {
                  const pred = idx[p.id]?.[m.id];
                  const hasPred = pred && pred.home_score !== null && pred.away_score !== null;
                  const pts = pred?.points_earned;
                  const hasResult = m.home_score !== null;

                  return (
                    <td
                      key={m.id}
                      className={cn(
                        "border-r border-gray-800/60 py-2 px-1 text-center tabular-nums",
                        hasResult && pts === 2 && "bg-green-950/40",
                        hasResult && pts === 1 && "bg-blue-950/30",
                        hasResult && pts === 0 && "bg-gray-900/20",
                      )}
                    >
                      {hasPred ? (
                        <div>
                          <div className={cn(
                            "font-bold text-xs leading-tight",
                            pts === 2 ? "text-green-400" :
                            pts === 1 ? "text-blue-400" :
                            pts === 0 && hasResult ? "text-gray-600" :
                            "text-gray-300"
                          )}>
                            {pred.home_score}–{pred.away_score}
                          </div>
                          {hasResult && pts !== null && (
                            <div className={cn(
                              "text-[10px] font-semibold leading-none mt-0.5",
                              pts === 2 ? "text-green-500" :
                              pts === 1 ? "text-blue-500" :
                              "text-gray-700"
                            )}>
                              {pts === 2 ? "+2" : pts === 1 ? "+1" : "✗"}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-800">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>

      </table>
    </div>
  );
}
