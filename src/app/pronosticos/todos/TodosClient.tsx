"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  totals: Record<string, number>;
  /** Posición en el ranking (1=primero) — para ordenar igual que la tabla principal */
  positions: Record<string, number>;
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

// Fondos de fila alternados — sólidos (necesario para sticky left)
const ROW_BG_SOLID = ["#030712", "#0f1623"] as const;

export default function TodosClient({
  matches, phases, lockedPhaseIds, participants, predictions, totals, positions,
}: Props) {
  const lockedSet = new Set(lockedPhaseIds);
  const router = useRouter();

  // ── Realtime: refrescar cuando cambien puntos o resultados ───────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("todos-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "predictions" }, () => {
        router.refresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [router]);

  // Índice rápido: participantId → matchId → prediction
  const idx: Record<string, Record<string, Prediction>> = {};
  for (const p of predictions) {
    if (!idx[p.participant_id]) idx[p.participant_id] = {};
    idx[p.participant_id][p.match_id] = p;
  }

  // Participantes ordenados por posición del ranking (igual que la tabla principal).
  // Usa la posición de la vista `ranking` que ya aplica los desempates correctos.
  // Si no hay posición registrada (ej. aún sin puntos), va al final.
  const sorted = [...participants].sort(
    (a, b) => (positions[a.id] ?? 999) - (positions[b.id] ?? 999)
  );

  // Partidos agrupados por fase
  const phaseGroups = phases.map((ph) => ({
    phase: ph,
    isLocked: lockedSet.has(ph.id),
    matches: matches.filter((m) => m.phase_id === ph.id),
  })).filter((g) => g.matches.length > 0);

  // Toggle de fases — todas visibles por default
  const [visiblePhases, setVisiblePhases] = useState<Set<number>>(
    () => new Set(phaseGroups.map((g) => g.phase.id))
  );

  const togglePhase = (phaseId: number) => {
    setVisiblePhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const allMatches = phaseGroups
    .filter((g) => visiblePhases.has(g.phase.id))
    .flatMap((g) => g.matches);
  const NAME_W = 140;

  return (
    <div>
      {/* ═══════════════════════════════════════════
          FILTROS DE FASES — toggles acumulativos
      ═══════════════════════════════════════════ */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2 px-4">
        {phaseGroups.map((g) => {
          const isVisible = visiblePhases.has(g.phase.id);
          const finished = g.matches.filter((m) => m.status === "finished").length;
          return (
            <button
              key={g.phase.id}
              onClick={() => togglePhase(g.phase.id)}
              className={cn(
                "text-[10px] px-2 py-1 rounded-lg border font-medium whitespace-nowrap transition-all",
                isVisible
                  ? "bg-indigo-700/30 border-indigo-600/50 text-indigo-300"
                  : "bg-gray-800/30 border-gray-700/50 text-gray-600 line-through"
              )}
            >
              {g.phase.display_name}
              <span className={cn(
                "ml-1 text-[9px]",
                isVisible ? "text-indigo-500" : "text-gray-700"
              )}>
                {finished}/{g.matches.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contador — fuera del scroll */}
      <p className="text-[11px] text-gray-600 mb-1 px-4">
        {sorted.length} participante{sorted.length !== 1 ? "s" : ""}
        {visiblePhases.size < phaseGroups.length && (
          <span className="ml-1 text-gray-700">
            · {allMatches.length} partido{allMatches.length !== 1 ? "s" : ""} visibles
          </span>
        )}
      </p>

      {/*
        ═══════════════════════════════════════════
        CONTENEDOR DE LA TABLA

        EN MÓVIL (< md):
          overflow-x-auto + overflow-y-auto + max-height → contenedor con scroll INTERNO en ambos ejes.
          position:sticky top-0 en los headers referencia ESTE contenedor (no la ventana),
          por lo que el header siempre pega en la parte superior del contenedor —
          y la fila #1 (Jakub) aparece JUSTO DEBAJO sin ocultarse al scrollear.

        EN DESKTOP (md+):
          overflow-y-clip elimina el contenedor de scroll vertical → la página scrollea normalmente.
          max-h-none quita el límite de altura.
          position:sticky top-0 referencia la ventana (nav está a la izquierda, top=0 correcto).
        ═══════════════════════════════════════════
      */}
      <div
        className={cn(
          "overflow-x-auto -mx-4 px-4",
          // Móvil: scroll interno con altura máxima (svh = viewport más pequeño, con barra del navegador)
          "overflow-y-auto max-h-[calc(100svh_-_160px)]",
          // Desktop: sin contenedor de scroll Y (la página scrollea), sin límite de altura
          "md:overflow-y-clip md:max-h-none",
        )}
      >
        <table
          className="border-collapse text-xs"
          style={{ minWidth: `${NAME_W + 48 + allMatches.length * 60}px` }}
        >
          {/* ═══════════════════════════════════════════
              CABECERA COMPACTA
              top-0 → referencia el contenedor de scroll (móvil)
                     o la ventana (desktop con overflow-y-clip)
              Removido el nombre de fase del header → altura ~36px en lugar de ~80px
          ═══════════════════════════════════════════ */}
          <thead>
            <tr>
              {/* Esquina: sticky izquierda + arriba */}
              <th
                className="sticky left-0 top-0 z-40 bg-gray-900 border-b-2 border-r border-gray-700 py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap"
                style={{ minWidth: `${NAME_W}px` }}
              >
                Participante
              </th>

              {/* Campeón: sticky arriba, NO izquierda */}
              <th className="sticky top-0 z-20 bg-gray-900 border-b-2 border-r border-gray-700 py-2 px-2 text-center text-gray-400 font-medium w-[48px]">
                🏆
              </th>

              {/* Columnas de partidos — COMPACTAS (una línea) */}
              {allMatches.map((m) => {
                const hasResult = m.home_score !== null;
                const isFirstOfPhase = phaseGroups.some((g) => g.matches[0]?.id === m.id);
                return (
                  <th
                    key={m.id}
                    className={cn(
                      "sticky top-0 z-20 bg-gray-900",
                      "border-b-2 border-r border-gray-800 py-1.5 px-0.5 text-center min-w-[56px]",
                      isFirstOfPhase ? "border-l-2 border-l-indigo-700" : ""
                    )}
                  >
                    {/* HOME-AWAY en una sola línea — reduce altura del header a ~36px */}
                    <div className="text-[9px] font-bold text-gray-300 tabular-nums leading-tight whitespace-nowrap">
                      <span>{abbrev(m.home_team)}</span>
                      <span className="text-gray-500 mx-[1px]">-</span>
                      <span>{abbrev(m.away_team)}</span>
                    </div>
                    {/* Marcador 90 min si existe */}
                    {hasResult && (
                      <div className="mt-0.5 leading-none tabular-nums">
                        <span className="text-gray-600 font-normal text-[8px]">90'</span>
                        <span className="text-green-500 font-bold text-[9px]"> {m.home_score}–{m.away_score}</span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ═══════════════════════════════════════════
              FILAS DE PARTICIPANTES
          ═══════════════════════════════════════════ */}
          <tbody>
            {sorted.map((p, rowIdx) => {
              const total = totals[p.id] ?? 0;
              const bg = ROW_BG_SOLID[rowIdx % 2];

              return (
                <tr
                  key={p.id}
                  className={rowIdx % 2 === 0 ? "bg-[#030712]" : "bg-[#0f1623]"}
                >
                  {/* Nombre + # fila + puntos — sticky izquierda */}
                  <td
                    className="sticky left-0 z-10 border-r border-gray-800 py-2 px-3 font-semibold text-white"
                    style={{ background: bg }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-700 font-mono text-[10px] w-4 shrink-0 text-right">
                        {rowIdx + 1}
                      </span>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className={cn(
                        "font-bold text-xs tabular-nums shrink-0",
                        total > 0 ? "text-indigo-300" : "text-gray-600"
                      )}>
                        {total}
                      </span>
                    </div>
                  </td>

                  {/* Campeón — NO sticky, scrollea horizontalmente */}
                  <td className="border-r border-gray-800 py-2 px-1 text-center">
                    {p.champion_pick
                      ? <FlagIcon team={p.champion_pick} className="w-6 h-4 rounded-sm mx-auto" />
                      : <span className="text-gray-800 text-xs">—</span>}
                  </td>

                  {/* Celdas de partidos */}
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
                          /* Regla julio 2026: exacto oct.+=3pts(amarillo), exacto 16avos=2pts(verde) */
                          hasResult && pts === 3 && "bg-yellow-950/40",
                          hasResult && pts === 2 && "bg-green-950/40",
                          hasResult && pts === 1 && "bg-blue-950/30",
                        )}
                      >
                        {!phaseIsLocked ? (
                          <span className="text-gray-800 text-[10px]">🔒</span>
                        ) : hasPred ? (
                          <div>
                            <div className={cn(
                              "font-bold text-xs leading-tight",
                              pts === 3 ? "text-yellow-400" :
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
                                pts === 3 ? "text-yellow-500" :
                                pts === 2 ? "text-green-500" :
                                pts === 1 ? "text-blue-500" :
                                "text-gray-700"
                              )}>
                                {pts === 3 ? "+3" : pts === 2 ? "+2" : pts === 1 ? "+1" : "✗"}
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

          {/* ═══════════════════════════════════════════
              PIE
          ═══════════════════════════════════════════ */}
          <tfoot>
            <tr>
              <td
                className="sticky left-0 bg-gray-900 border-t border-gray-800 py-1.5 px-3 text-[10px] text-gray-600"
                style={{ minWidth: `${NAME_W}px` }}
                colSpan={1}
              >
                {sorted.length} de 18 participantes
              </td>
              <td colSpan={1 + allMatches.length} className="border-t border-gray-800" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
