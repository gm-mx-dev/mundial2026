"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Match, Phase } from "@/types/database";
import { Check, Loader2, Plus, Save } from "lucide-react";

interface Props {
  matches: Match[];
  phases: Phase[];
  adminId: string;
}

// UTC ISO → datetime-local string en hora México
function utcToMexicoInput(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso)).replace(" ", "T").slice(0, 16);
}

// datetime-local (hora México) → UTC ISO
function mexicoInputToUtc(local: string): string {
  const fakeUtc = new Date(local + ":00Z");
  const mxBack = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(fakeUtc).replace(" ", "T").slice(0, 16);
  const offsetMs = fakeUtc.getTime() - new Date(mxBack + ":00Z").getTime();
  return new Date(fakeUtc.getTime() + offsetMs).toISOString();
}

type MatchEditState = {
  home_team: string;
  away_team: string;
  kickoff: string;
};

type AddMatchState = {
  phase_id: string;
  home_team: string;
  away_team: string;
  kickoff: string;
};

export default function MatchManager({ matches, phases, adminId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [editState, setEditState] = useState<Record<string, MatchEditState>>(
    Object.fromEntries(
      matches.map((m) => [
        m.id,
        {
          home_team: m.home_team,
          away_team: m.away_team,
          kickoff: utcToMexicoInput(m.kickoff_at),
        },
      ])
    )
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [addState, setAddState] = useState<AddMatchState>({
    phase_id: phases[0]?.id?.toString() ?? "",
    home_team: "",
    away_team: "",
    kickoff: "",
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const saveMatch = async (matchId: string, original: Match) => {
    const st = editState[matchId];
    if (!st.kickoff) return;
    setSaving(matchId);
    const kickoff_at = mexicoInputToUtc(st.kickoff);
    const { error } = await supabase
      .from("matches")
      .update({
        home_team: st.home_team.trim(),
        away_team: st.away_team.trim(),
        kickoff_at,
      })
      .eq("id", matchId);
    setSaving(null);
    if (!error) {
      setSaved(matchId);
      setTimeout(() => setSaved(null), 2500);
      await supabase.from("audit_log").insert({
        action_type: "match_updated",
        performed_by: adminId,
        match_id: matchId,
        before_value: {
          home_team: original.home_team,
          away_team: original.away_team,
          kickoff_at: original.kickoff_at,
        },
        after_value: {
          home_team: st.home_team.trim(),
          away_team: st.away_team.trim(),
          kickoff_at,
        },
      });
      router.refresh();
    }
  };

  const addMatch = async () => {
    setAddError(null);
    const h = addState.home_team.trim();
    const a = addState.away_team.trim();
    if (!h || !a || !addState.kickoff || !addState.phase_id) {
      setAddError("Completa todos los campos");
      return;
    }
    setAdding(true);
    const phaseId = parseInt(addState.phase_id);
    const phaseMatches = matches.filter((m) => m.phase_id === phaseId);
    const nextNumber =
      phaseMatches.length > 0
        ? Math.max(...phaseMatches.map((m) => m.match_number)) + 1
        : 1;
    const kickoff_at = mexicoInputToUtc(addState.kickoff);

    const { error } = await supabase.from("matches").insert({
      phase_id: phaseId,
      match_number: nextNumber,
      home_team: h,
      away_team: a,
      kickoff_at,
      status: "scheduled",
    });
    setAdding(false);
    if (error) {
      setAddError(error.message);
    } else {
      setAddState({ phase_id: addState.phase_id, home_team: "", away_team: "", kickoff: "" });
      setShowAddForm(false);
      router.refresh();
    }
  };

  const matchesByPhase = phases
    .map((ph) => ({
      phase: ph,
      phMatches: matches
        .filter((m) => m.phase_id === ph.id)
        .sort((a, b) => a.match_number - b.match_number),
    }));

  return (
    <div>
      <div className="mx-4 mt-4 mb-4 px-3 py-2 bg-yellow-900/20 border border-yellow-800/40 rounded-lg">
        <p className="text-xs text-yellow-400/80">
          ⚠️ Horarios en <strong>hora Ciudad de México</strong>. Los equipos deben usar
          el nombre exacto en español (ej: &quot;Países Bajos&quot;, &quot;C. Marfil&quot;).
        </p>
      </div>

      <div className="space-y-0 divide-y divide-gray-800/40">
        {matchesByPhase.map(({ phase, phMatches }) => (
          <div key={phase.id}>
            <div className="px-4 py-2 bg-gray-800/30">
              <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                {phase.display_name}
              </span>
              <span className="text-xs text-gray-600 ml-2">({phMatches.length} partidos)</span>
            </div>
            <div className="divide-y divide-gray-800/40">
              {phMatches.map((match) => {
                const st = editState[match.id];
                if (!st) return null;
                const isSaving = saving === match.id;
                const isSaved = saved === match.id;
                return (
                  <div key={match.id} className="px-4 py-3">
                    {/* Status badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-600">P{match.match_number}</span>
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          match.status === "finished"
                            ? "bg-gray-800 text-gray-500"
                            : match.status === "live"
                            ? "bg-green-900/40 text-green-400"
                            : "bg-blue-900/20 text-blue-400"
                        )}
                      >
                        {match.status === "finished"
                          ? "Terminado"
                          : match.status === "live"
                          ? "En vivo"
                          : "Programado"}
                      </span>
                    </div>

                    {/* Equipos */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-2 items-center">
                      <input
                        value={st.home_team}
                        onChange={(e) =>
                          setEditState((prev) => ({
                            ...prev,
                            [match.id]: { ...st, home_team: e.target.value },
                          }))
                        }
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Local"
                      />
                      <span className="text-gray-600 font-bold text-xs text-center">vs</span>
                      <input
                        value={st.away_team}
                        onChange={(e) =>
                          setEditState((prev) => ({
                            ...prev,
                            [match.id]: { ...st, away_team: e.target.value },
                          }))
                        }
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Visitante"
                      />
                    </div>

                    {/* Fecha + Guardar */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">
                          Fecha y hora (hora México)
                        </label>
                        <input
                          type="datetime-local"
                          value={st.kickoff}
                          onChange={(e) =>
                            setEditState((prev) => ({
                              ...prev,
                              [match.id]: { ...st, kickoff: e.target.value },
                            }))
                          }
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        onClick={() => saveMatch(match.id, match)}
                        disabled={isSaving}
                        className={cn(
                          "shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                          isSaved
                            ? "bg-green-900/40 text-green-400 border border-green-800/40"
                            : "bg-indigo-700 hover:bg-indigo-600 text-white"
                        )}
                      >
                        {isSaving ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isSaved ? (
                          <>
                            <Check size={14} /> Guardado
                          </>
                        ) : (
                          <>
                            <Save size={14} /> Guardar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Agregar partido */}
      <div className="px-4 py-4">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-indigo-700/50 text-indigo-400 hover:border-indigo-600 hover:bg-indigo-900/10 transition-colors text-sm"
          >
            <Plus size={16} /> Agregar partido
          </button>
        ) : (
          <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Nuevo partido</h3>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Fase</label>
              <select
                value={addState.phase_id}
                onChange={(e) =>
                  setAddState((p) => ({ ...p, phase_id: e.target.value }))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {phases.map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Equipo local</label>
                <input
                  value={addState.home_team}
                  onChange={(e) =>
                    setAddState((p) => ({ ...p, home_team: e.target.value }))
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="ej: México"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Equipo visitante</label>
                <input
                  value={addState.away_team}
                  onChange={(e) =>
                    setAddState((p) => ({ ...p, away_team: e.target.value }))
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="ej: Argentina"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Fecha y hora (hora México)
              </label>
              <input
                type="datetime-local"
                value={addState.kickoff}
                onChange={(e) =>
                  setAddState((p) => ({ ...p, kickoff: e.target.value }))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {addError && (
              <p className="text-xs text-red-400">{addError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={addMatch}
                disabled={adding}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
              >
                {adding ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Agregar
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setAddError(null);
                }}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
