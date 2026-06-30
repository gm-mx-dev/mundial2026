"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, cn } from "@/lib/utils";
import FlagIcon from "@/components/FlagIcon";
import type { Match, Phase, Participant } from "@/types/database";
import { Check, Clock, Lock, AlertCircle } from "lucide-react";

interface Props {
  participants: Participant[];
  matches: Match[];
  phases: Phase[];
  adminId: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function AdminPronosticosManager({ participants, matches, phases, adminId }: Props) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [predictions, setPredictions] = useState<Record<string, { home_score: number | null; away_score: number | null }>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const loadPredictions = useCallback(async (participantId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("predictions")
      .select("match_id, home_score, away_score")
      .eq("participant_id", participantId);
    const pred: Record<string, { home_score: number | null; away_score: number | null }> = {};
    for (const p of data ?? []) {
      pred[p.match_id] = { home_score: p.home_score, away_score: p.away_score };
    }
    setPredictions(pred);
    setSaveStatus({});
    setOverrideReasons({});
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (selectedId) loadPredictions(selectedId);
    else { setPredictions({}); setSaveStatus({}); }
  }, [selectedId, loadPredictions]);

  const now = new Date();

  const matchesByPhase = phases.map((ph) => {
    const phaseMatches = matches.filter((m) => m.phase_id === ph.id);
    const firstKickoff = phaseMatches.reduce<Date | null>((min, m) => {
      const d = new Date(m.kickoff_at);
      return min === null || d < min ? d : min;
    }, null);
    const phaseLocked = firstKickoff !== null && firstKickoff <= now;
    return { phase: ph, phaseMatches, phaseLocked };
  }).filter((g) => g.phaseMatches.length > 0);

  const savePrediction = async (match: Match, phaseLocked: boolean) => {
    if (!selectedId) return;
    const pred = predictions[match.id] ?? { home_score: null, away_score: null };
    if (pred.home_score === null || pred.away_score === null) return;

    const isOverride = phaseLocked;
    const reason = overrideReasons[match.id]?.trim() ?? "";
    if (isOverride && !reason) return;

    setSaveStatus((s) => ({ ...s, [match.id]: "saving" }));

    const { error } = await supabase.from("predictions").upsert(
      {
        participant_id: selectedId,
        match_id: match.id,
        home_score: pred.home_score,
        away_score: pred.away_score,
        entered_by_admin: adminId,
        is_override: isOverride,
        override_reason: isOverride ? reason : null,
      },
      { onConflict: "participant_id,match_id" }
    );

    if (!error) {
      await supabase.from("audit_log").insert({
        action_type: isOverride ? "admin_override_prediction" : "admin_prediction",
        performed_by: adminId,
        affected_user: selectedId,
        match_id: match.id,
        after_value: { home_score: pred.home_score, away_score: pred.away_score },
        reason: isOverride ? reason : "Ingresado por admin",
      });

      // Si el partido ya tiene resultado, recalcular puntos inmediatamente
      if (match.home_score !== null && match.away_score !== null) {
        await supabase.rpc("calculate_points", {
          p_match_id: match.id,
          p_home_score: match.home_score,
          p_away_score: match.away_score,
        });
      }

      setSaveStatus((s) => ({ ...s, [match.id]: "saved" }));
      setTimeout(() => setSaveStatus((s) => ({ ...s, [match.id]: "idle" })), 2500);
    } else {
      setSaveStatus((s) => ({ ...s, [match.id]: "error" }));
    }
  };

  return (
    <div className="divide-y divide-gray-800/60">
      {/* Selector de participante */}
      <div className="px-4 py-4">
        <label className="text-xs text-gray-500 block mb-1.5">Selecciona participante</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">— Elige un participante —</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.needs_proxy ? " 📵" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Estado de carga */}
      {selectedId && loading && (
        <div className="px-4 py-6 text-center text-sm text-gray-500">Cargando pronósticos...</div>
      )}

      {/* Pronósticos por fase */}
      {selectedId && !loading && (
        <div className="px-4 py-4 space-y-6">
          {matchesByPhase.map(({ phase, phaseMatches, phaseLocked }) => (
            <div key={phase.id}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">
                  {phase.display_name}
                </h3>
                {phaseLocked && (
                  <span className="text-xs text-orange-400 flex items-center gap-1">
                    <Lock size={10} /> cerrada — override requiere razón
                  </span>
                )}
              </div>

              <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl divide-y divide-gray-700/30 overflow-hidden">
                {phaseMatches.map((match) => {
                  const pred = predictions[match.id] ?? { home_score: null, away_score: null };
                  const status = saveStatus[match.id] ?? "idle";
                  const reason = overrideReasons[match.id] ?? "";
                  const canSave =
                    pred.home_score !== null &&
                    pred.away_score !== null &&
                    (!phaseLocked || reason.trim() !== "");

                  return (
                    <div key={match.id} className="px-3 py-3">
                      <div className="text-xs text-gray-600 mb-2">{formatDateTime(match.kickoff_at)}</div>

                      {/* Equipos + inputs + botón */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                          <span className="text-sm font-medium text-white text-right truncate">{match.home_team}</span>
                          <FlagIcon team={match.home_team} className="w-5 h-3.5 rounded-sm shrink-0" />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number" min="0" max="99"
                            value={pred.home_score ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                              setPredictions((p) => ({ ...p, [match.id]: { ...p[match.id], home_score: v } }));
                            }}
                            className="w-11 h-9 text-center font-bold rounded-lg border border-gray-600 bg-gray-800 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="—"
                          />
                          <span className="text-gray-600 text-sm">:</span>
                          <input
                            type="number" min="0" max="99"
                            value={pred.away_score ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                              setPredictions((p) => ({ ...p, [match.id]: { ...p[match.id], away_score: v } }));
                            }}
                            className="w-11 h-9 text-center font-bold rounded-lg border border-gray-600 bg-gray-800 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="—"
                          />
                        </div>

                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                          <FlagIcon team={match.away_team} className="w-5 h-3.5 rounded-sm shrink-0" />
                          <span className="text-sm font-medium text-white truncate">{match.away_team}</span>
                        </div>

                        <button
                          onClick={() => savePrediction(match, phaseLocked)}
                          disabled={!canSave || status === "saving"}
                          className={cn(
                            "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                            status === "saved"
                              ? "bg-green-900/40 text-green-400 border border-green-800/40"
                              : status === "error"
                              ? "bg-red-900/40 text-red-400 border border-red-800/40"
                              : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-30"
                          )}
                        >
                          {status === "saving" ? (
                            <Clock size={11} className="animate-spin" />
                          ) : status === "saved" ? (
                            <Check size={11} />
                          ) : (
                            "Guardar"
                          )}
                        </button>
                      </div>

                      {/* Campo de razón (solo si la fase está cerrada) */}
                      {phaseLocked && (
                        <div className="mt-2">
                          <div className="flex items-center gap-1 mb-1">
                            <AlertCircle size={10} className="text-orange-400" />
                            <span className="text-xs text-orange-400">Razón de override (obligatoria)</span>
                          </div>
                          <input
                            type="text"
                            value={reason}
                            onChange={(e) => setOverrideReasons((r) => ({ ...r, [match.id]: e.target.value }))}
                            placeholder='ej. "DON TANIS lo indicó en persona"'
                            className="w-full text-xs bg-gray-800/60 border border-orange-900/40 rounded-lg px-2 py-1.5 text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </div>
                      )}

                      {/* Resultado oficial si ya hay */}
                      {match.home_score !== null && (
                        <div className="mt-1.5 text-[11px] text-gray-600 text-center">
                          Resultado 90': {match.home_score} – {match.away_score}
                          {match.penalty_winner && ` · ${match.penalty_winner === "home" ? match.home_team : match.away_team} pen.`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
