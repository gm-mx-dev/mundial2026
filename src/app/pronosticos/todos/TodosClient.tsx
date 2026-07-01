"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Match, Phase, Participant } from "@/types/database";
import FlagIcon from "@/components/FlagIcon";

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
  lockedPhaseIds: number[];
  participants: Pick<Participant, "id" | "name" | "is_active" | "champion_pick">[];
  predictions: Prediction[];
  totals: Record<string, number>; // participantId → total_points
}

function abbrev(name: string) {
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

// Colores de fondo por fila (alternados) — deben ser sólidos para el sticky
const ROW_BG = ["#030712", "rgb(17,24,39,0.6)"] as const;

export default function TodosClient({ matches, phases, lockedPhaseIds, participants, predictions, totals }: Props) {
  const lockedSet = new Set(lockedPhaseIds);

  // Índice: participantId → matchId → prediction
  const idx: Record<string, Record<string, Prediction>> = {};
  for (const p of predictions) {
    if (!idx[p.participant_id]) idx[p.participant_id] = {};
    idx[p.participant_id][p.match_id] = p;
  }

  // Participantes ordenados por total de puntos desc
  const sorted = [...participants].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0));

  // Matches agrupados por fase, en orden
  const phaseGroups = phases.map((ph) => ({
    phase: ph,
    isLocked: lockedSet.has(ph.id),
    matches: matches.filter((m) => m.phase_id === ph.id),
  }));

  // Todos los matches en orden (para las columnas)
  const allMatches = phaseGroups.flatMap((g) => g.matches);

  // Ancho de la columna de nombre (fija)
  const NAME_COL_W = 130;

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table
        className="border-collapse text-xs"
        style={{ minWidth: `${NAME_COL_W + 56 + allMatches.length * 72}px` }}
      >

        {/* ══════════════════════════════════════════════════
            CABECERA — sticky vertical en todas las pantallas
            top-12 en móvil (nav superior 48px),
            top-0 en desktop (nav a la izquierda)
        ══════════════════════════════════════════════════ */}
        <thead>
          <tr>

            {/* Col 1: Nombre — sticky izquierda Y arriba (esquina) */}
            <th
              className="sticky left-0 top-12 md:top-0 z-40 bg-gray-900 border-b-2 border-r border-gray-700 py-2 px-3 text-left text-gray-400 font-medium"
              style={{ minWidth: `${NAME_COL_W}px` }}
            >
              Participante
            </th>

            {/* Col 2: Campeón — sticky arriba PERO no izquierda (scrollea horizontalmente) */}
            <th
              className="sticky top-12 md:top-0 z-20 bg-gray-900 border-b-2 border-r border-gray-700 py-2 px-2 text-center text-gray-400 font-medium w-[56px]"
            >
              🏆
            </th>

            {/* Columnas de partidos */}
            {allMatches.map((m) => {
              const hasResult = m.home_score !== null;
              const phaseGroup = phaseGroups.find((g) => g.matches[0]?.id === m.id);
              return (
                <th
                  key={m.id}
                  className={cn(
                    "sticky top-12 md:top-0 z-20 border-b-2 border-r border-gray-800 py-1.5 px-1 text-center bg-gray-900 min-w-[68px]",
                    phaseGroup ? "border-l-2 border-l-indigo-800" : ""
                  )}
                >
                  {phaseGroup && (
                    <div className="mb-1 leading-none">
                      <span className="text-indigo-400 font-semibold uppercase tracking-widest text-[9px]">
                        {phaseGroup.phase.display_name}
                      </span>
                      <span className={cn(
                        "ml-1 text-[8px] font-medium px-1 py-0.5 rounded",
                        phaseGroup.isLocked
                          ? "text-red-400 bg-red-950/40"
                          : "text-green-400 bg-green-950/40"
                      )}>
                        {phaseGroup.isLocked ? "Cerrada" : "Abierta"}
                      </span>
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

        {/* ══════════════════════════════════════════════════
            FILAS DE PARTICIPANTES
        ══════════════════════════════════════════════════ */}
        <tbody>
          {sorted.map((p, rowIdx) => {
            const total = totals[p.id] ?? 0;
            const rowBg = ROW_BG[rowIdx % 2];
            return (
              <tr
                key={p.id}
                className={rowIdx % 2 === 0 ? "bg-gray-950" : "bg-gray-900/60"}
              >
                {/* Col 1: Nombre + total — sticky izquierda (fondo sólido para no verse transparente) */}
                <td
                  className="sticky left-0 z-10 border-r border-gray-800 py-2 px-3 font-semibold text-white"
                  style={{ background: rowBg }}
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

                {/* Col 2: Campeón con bandera — NO sticky, scrollea con la tabla */}
                <td className="border-r border-gray-800 py-2 px-1 text-center">
                  {p.champion_pick ? (
                    <FlagIcon team={p.champion_pick} className="w-6 h-4 rounded-sm mx-auto" />
                  ) : (
                    <span className="text-gray-800 text-xs">—</span>
                  )}
                </td>

                {/* Una celda por partido */}
                {allMatches.map((m) => {
                  const phaseIsLocked = lockedSet.has(m.phase_id);
                  const pred = phaseIsLocked ? idx[p.id]?.[m.id] : undefined;
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
                      {!phaseIsLocked ? (
                        <span className="text-gray-800 text-[10px]">🔒</span>
                      ) : hasPred ? (
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
