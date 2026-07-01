"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import FlagIcon from "@/components/FlagIcon";
import type { Match, Phase } from "@/types/database";
import { Check, Loader2, Plus, Save, ChevronDown } from "lucide-react";

// ── Catálogo oficial de 32 equipos (nombres en español) ──────────────────────
const TEAMS = [
  "Alemania", "Argelia", "Argentina", "Australia", "Austria",
  "Bélgica", "Bosnia H.", "Brasil",
  "C. Marfil", "Cabo Verde", "Canadá", "Colombia", "Croacia",
  "Ecuador", "Egipto", "España", "Estados Unidos",
  "Francia", "Ghana", "Inglaterra",
  "Japón", "Marruecos", "México",
  "Noruega", "Países Bajos", "Paraguay", "Portugal",
  "RD Congo", "Senegal", "Sudáfrica", "Suecia", "Suiza",
];

// ── Conversiones UTC ↔ hora México ───────────────────────────────────────────
function utcToMexicoInput(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso)).replace(" ", "T").slice(0, 16);
}

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

// ── Combobox con filtro por nombre de equipo ──────────────────────────────────
interface ComboboxProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  align?: "left" | "right";
}

function TeamCombobox({ value, onChange, placeholder = "Equipo", align = "left" }: ComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar cuando el padre actualiza el valor
  useEffect(() => { setQuery(value); }, [value]);

  const filtered = TEAMS.filter((t) =>
    t.toLowerCase().includes(query.toLowerCase())
  );

  const isValid = TEAMS.includes(query);

  const handleSelect = (team: string) => {
    setQuery(team);
    onChange(team);
    setOpen(false);
  };

  const handleBlur = () => {
    setOpen(false);
    if (!isValid) {
      // Revertir al valor confirmado anterior
      setQuery(value);
    } else {
      onChange(query);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            "w-full bg-gray-800 border rounded-lg px-2.5 py-2 pr-7 text-sm text-white",
            "focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors",
            open || isValid
              ? "border-gray-700"
              : query !== ""
              ? "border-red-800/60"
              : "border-gray-700"
          )}
        />
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>

      {open && filtered.length > 0 && (
        <div
          className={cn(
            "absolute z-20 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl",
            "max-h-48 overflow-y-auto overscroll-contain",
            "min-w-[160px] w-full",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {filtered.map((team) => (
            <button
              key={team}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(team); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                team === query
                  ? "bg-indigo-700/40 text-white"
                  : "hover:bg-gray-700 text-gray-200"
              )}
            >
              <FlagIcon team={team} className="w-5 h-3.5 rounded-sm shrink-0" />
              {team}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tipos de estado por partido ───────────────────────────────────────────────
type MatchEditState = {
  home_team: string;
  away_team: string;
  kickoff: string;
  home90: string;
  away90: string;
  homeFinal: string;
  awayFinal: string;
  penWinner: "" | "home" | "away";
};

type AddMatchState = {
  phase_id: string;
  home_team: string;
  away_team: string;
  kickoff: string;
};

interface Props {
  matches: Match[];
  phases: Phase[];
  adminId: string;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function UnifiedMatchEditor({ matches, phases, adminId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Estado inicial: combina campos de MatchManager + ResultsManager
  const [editState, setEditState] = useState<Record<string, MatchEditState>>(
    Object.fromEntries(
      matches.map((m) => [
        m.id,
        {
          home_team: m.home_team,
          away_team: m.away_team,
          kickoff: utcToMexicoInput(m.kickoff_at),
          home90: m.home_score?.toString() ?? "",
          away90: m.away_score?.toString() ?? "",
          homeFinal: m.home_score_final?.toString() ?? "",
          awayFinal: m.away_score_final?.toString() ?? "",
          penWinner: (m.penalty_winner ?? "") as "" | "home" | "away",
        },
      ])
    )
  );

  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [addState, setAddState] = useState<AddMatchState>({
    phase_id: phases[0]?.id?.toString() ?? "",
    home_team: "",
    away_team: "",
    kickoff: "",
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const update = (matchId: string, patch: Partial<MatchEditState>) =>
    setEditState((prev) => ({ ...prev, [matchId]: { ...prev[matchId], ...patch } }));

  // ── Guardar partido (equipos + horario + resultado + penales) ─────────────
  const saveMatch = async (match: Match) => {
    const st = editState[match.id];
    if (!st) return;

    // Validaciones
    if (!TEAMS.includes(st.home_team) || !TEAMS.includes(st.away_team)) {
      setSaveError("Selecciona equipos válidos del catálogo");
      setTimeout(() => setSaveError(null), 3000);
      return;
    }
    if (!st.kickoff) return;

    const home90 = st.home90 !== "" && !isNaN(Number(st.home90)) ? parseInt(st.home90) : null;
    const away90 = st.away90 !== "" && !isNaN(Number(st.away90)) ? parseInt(st.away90) : null;
    const homeFinal = st.homeFinal !== "" && !isNaN(Number(st.homeFinal)) ? parseInt(st.homeFinal) : null;
    const awayFinal = st.awayFinal !== "" && !isNaN(Number(st.awayFinal)) ? parseInt(st.awayFinal) : null;
    const penWinner = st.penWinner || null;

    // Ambos marcadores de 90' deben estar presentes o ninguno
    if ((home90 === null) !== (away90 === null)) {
      setSaveError("Captura el marcador local Y visitante a 90 min");
      setTimeout(() => setSaveError(null), 3000);
      return;
    }

    setSaving(match.id);
    setSaveError(null);

    const kickoff_at = mexicoInputToUtc(st.kickoff);
    const hasScores = home90 !== null && away90 !== null;

    const payload: Record<string, unknown> = {
      home_team: st.home_team,
      away_team: st.away_team,
      kickoff_at,
      home_score_final: homeFinal,
      away_score_final: awayFinal,
      penalty_winner: penWinner,
    };

    if (hasScores) {
      payload.home_score = home90;
      payload.away_score = away90;
      payload.status = "finished";
    }

    const { error } = await supabase.from("matches").update(payload).eq("id", match.id);

    if (!error) {
      // Calcular puntos si se capturó resultado a 90'
      if (hasScores) {
        await supabase.rpc("calculate_points", {
          p_match_id: match.id,
          p_home_score: home90!,
          p_away_score: away90!,
        });
      }

      // Bitácora
      const action_type =
        hasScores && match.home_score === null
          ? "result_captured"
          : hasScores
          ? "result_updated"
          : "match_updated";

      await supabase.from("audit_log").insert({
        action_type,
        performed_by: adminId,
        match_id: match.id,
        before_value: {
          home_team: match.home_team,
          away_team: match.away_team,
          kickoff_at: match.kickoff_at,
          home_score: match.home_score,
          away_score: match.away_score,
          penalty_winner: match.penalty_winner,
        },
        after_value: {
          home_team: st.home_team,
          away_team: st.away_team,
          kickoff_at,
          ...(hasScores && { home_score: home90, away_score: away90 }),
          penalty_winner: penWinner,
        },
      });

      setSaved(match.id);
      setTimeout(() => setSaved(null), 2500);
      router.refresh();
    } else {
      setSaveError("Error al guardar. Intenta de nuevo.");
      setTimeout(() => setSaveError(null), 3000);
    }

    setSaving(null);
  };

  // ── Agregar partido nuevo ─────────────────────────────────────────────────
  const addMatch = async () => {
    setAddError(null);
    if (!TEAMS.includes(addState.home_team) || !TEAMS.includes(addState.away_team)) {
      setAddError("Selecciona equipos válidos del catálogo");
      return;
    }
    if (!addState.kickoff || !addState.phase_id) {
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
      home_team: addState.home_team,
      away_team: addState.away_team,
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

  // ── Agrupar partidos por fase ─────────────────────────────────────────────
  const matchesByPhase = phases.map((ph) => ({
    phase: ph,
    phMatches: matches
      .filter((m) => m.phase_id === ph.id)
      .sort((a, b) => a.match_number - b.match_number),
  }));

  return (
    <div>
      {/* Nota informativa */}
      <div className="mx-4 mt-4 mb-4 px-3 py-2 bg-yellow-900/20 border border-yellow-800/40 rounded-lg">
        <p className="text-xs text-yellow-400/80">
          ⚠️ Horarios en <strong>hora Ciudad de México</strong>.
          Los equipos se seleccionan del catálogo — escribe para filtrar.
          El marcador a 90&apos; es el que cuenta para la quiniela.
        </p>
      </div>

      {/* Partidos por fase */}
      <div className="space-y-0 divide-y divide-gray-800/40">
        {matchesByPhase.map(({ phase, phMatches }) => (
          <div key={phase.id}>
            {/* Encabezado de fase */}
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
                const isDraw =
                  st.home90 !== "" &&
                  st.away90 !== "" &&
                  !isNaN(Number(st.home90)) &&
                  !isNaN(Number(st.away90)) &&
                  st.home90 === st.away90;
                const hasValidTeams = TEAMS.includes(st.home_team) && TEAMS.includes(st.away_team);

                return (
                  <div key={match.id} className="px-4 py-4 space-y-3">

                    {/* Fila 1: Número + estado del partido */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 font-mono">P{match.match_number}</span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full border font-medium",
                        match.status === "finished"
                          ? "bg-gray-800 text-gray-500 border-gray-700"
                          : match.status === "live"
                          ? "bg-green-900/40 text-green-400 border-green-800/50"
                          : "bg-blue-900/20 text-blue-400 border-blue-900/40"
                      )}>
                        {match.status === "finished" ? "Terminado"
                          : match.status === "live" ? "⚡ En vivo"
                          : "Programado"}
                      </span>
                      {match.home_score !== null && (
                        <span className="text-xs text-gray-600">
                          Resultado actual: {match.home_score}–{match.away_score}
                          {match.penalty_winner && ` (pen. ${match.penalty_winner === "home" ? match.home_team : match.away_team})`}
                        </span>
                      )}
                    </div>

                    {/* Fila 2: Equipos */}
                    <div>
                      <label className="text-xs text-gray-500 block mb-1.5">Equipos</label>
                      <div className="grid grid-cols-[1fr_2rem_1fr] items-center gap-1.5">
                        <TeamCombobox
                          value={st.home_team}
                          onChange={(v) => update(match.id, { home_team: v })}
                          placeholder="Local"
                          align="left"
                        />
                        <span className="text-gray-600 text-xs text-center font-bold">vs</span>
                        <TeamCombobox
                          value={st.away_team}
                          onChange={(v) => update(match.id, { away_team: v })}
                          placeholder="Visitante"
                          align="right"
                        />
                      </div>
                      {/* Vista previa con banderas */}
                      {hasValidTeams && (
                        <div className="flex items-center justify-center gap-2 mt-1.5">
                          <FlagIcon team={st.home_team} className="w-5 h-3.5 rounded-sm" />
                          <span className="text-xs text-gray-500">{st.home_team}</span>
                          <span className="text-gray-700 text-xs">vs</span>
                          <span className="text-xs text-gray-500">{st.away_team}</span>
                          <FlagIcon team={st.away_team} className="w-5 h-3.5 rounded-sm" />
                        </div>
                      )}
                    </div>

                    {/* Fila 3: Horario */}
                    <div>
                      <label className="text-xs text-gray-500 block mb-1.5">
                        Fecha y hora (hora México)
                      </label>
                      <input
                        type="datetime-local"
                        value={st.kickoff}
                        onChange={(e) => update(match.id, { kickoff: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Fila 4: Resultado a 90 min */}
                    <div>
                      <p className="text-xs text-indigo-400 font-medium mb-1.5">
                        ⚽ Resultado 90 min <span className="text-gray-600 font-normal">(cuenta para la quiniela)</span>
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-right text-xs text-gray-400 truncate">{st.home_team || "Local"}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number" min="0" max="99"
                            value={st.home90}
                            onChange={(e) => update(match.id, { home90: e.target.value })}
                            placeholder="—"
                            className="w-11 h-9 text-center font-bold rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-gray-600">:</span>
                          <input
                            type="number" min="0" max="99"
                            value={st.away90}
                            onChange={(e) => update(match.id, { away90: e.target.value })}
                            placeholder="—"
                            className="w-11 h-9 text-center font-bold rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <span className="flex-1 text-xs text-gray-400 truncate">{st.away_team || "Visitante"}</span>
                      </div>
                    </div>

                    {/* Fila 5: Resultado final (T.E.) — solo display */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">
                        🏆 Resultado final T.E. <span className="text-gray-600">(solo display, opcional)</span>
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-right text-xs text-gray-600 truncate">{st.home_team || "Local"}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number" min="0" max="99"
                            value={st.homeFinal}
                            onChange={(e) => update(match.id, { homeFinal: e.target.value })}
                            placeholder="—"
                            className="w-11 h-8 text-center font-bold rounded-lg bg-gray-800/60 border border-gray-700/60 text-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-gray-600"
                          />
                          <span className="text-gray-700 text-xs">:</span>
                          <input
                            type="number" min="0" max="99"
                            value={st.awayFinal}
                            onChange={(e) => update(match.id, { awayFinal: e.target.value })}
                            placeholder="—"
                            className="w-11 h-8 text-center font-bold rounded-lg bg-gray-800/60 border border-gray-700/60 text-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-gray-600"
                          />
                        </div>
                        <span className="flex-1 text-xs text-gray-600 truncate">{st.away_team || "Visitante"}</span>
                      </div>
                    </div>

                    {/* Fila 6: Ganador en penales (solo si empate en 90') */}
                    {isDraw && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">
                          🎯 Ganó en penales <span className="text-gray-600">(solo display)</span>
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { val: "" as const, label: "Ninguno (T.E.)" },
                            { val: "home" as const, label: st.home_team || "Local" },
                            { val: "away" as const, label: st.away_team || "Visitante" },
                          ].map(({ val, label }) => (
                            <button
                              key={val || "none"}
                              type="button"
                              onClick={() => update(match.id, { penWinner: val })}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                st.penWinner === val
                                  ? "bg-indigo-600/30 border-indigo-600/60 text-indigo-300"
                                  : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                              )}
                            >
                              {val !== "" && <FlagIcon team={val === "home" ? st.home_team : st.away_team} className="w-4 h-3 rounded-sm" />}
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error de guardado */}
                    {saveError && saving === null && saved === null && (
                      <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-1.5">
                        {saveError}
                      </p>
                    )}

                    {/* Botón guardar */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => saveMatch(match)}
                        disabled={isSaving || !hasValidTeams || !st.kickoff}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                          isSaved
                            ? "bg-green-900/40 text-green-400 border border-green-800/40"
                            : "bg-indigo-700 hover:bg-indigo-600 text-white disabled:opacity-40"
                        )}
                      >
                        {isSaving ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isSaved ? (
                          <><Check size={14} /> Guardado</>
                        ) : (
                          <><Save size={14} /> Guardar</>
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

      {/* Agregar partido nuevo */}
      <div className="px-4 py-4 border-t border-gray-800/40">
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

            {/* Fase */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fase</label>
              <select
                value={addState.phase_id}
                onChange={(e) => setAddState((p) => ({ ...p, phase_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {phases.map((ph) => (
                  <option key={ph.id} value={ph.id}>{ph.display_name}</option>
                ))}
              </select>
            </div>

            {/* Equipos */}
            <div className="grid grid-cols-[1fr_2rem_1fr] items-end gap-1.5">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Local</label>
                <TeamCombobox
                  value={addState.home_team}
                  onChange={(v) => setAddState((p) => ({ ...p, home_team: v }))}
                  placeholder="Buscar equipo..."
                  align="left"
                />
              </div>
              <span className="text-gray-600 text-xs text-center font-bold mb-2.5">vs</span>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Visitante</label>
                <TeamCombobox
                  value={addState.away_team}
                  onChange={(v) => setAddState((p) => ({ ...p, away_team: v }))}
                  placeholder="Buscar equipo..."
                  align="right"
                />
              </div>
            </div>

            {/* Vista previa */}
            {TEAMS.includes(addState.home_team) && TEAMS.includes(addState.away_team) && (
              <div className="flex items-center justify-center gap-2">
                <FlagIcon team={addState.home_team} className="w-5 h-3.5 rounded-sm" />
                <span className="text-xs text-gray-400">{addState.home_team}</span>
                <span className="text-gray-700 text-xs">vs</span>
                <span className="text-xs text-gray-400">{addState.away_team}</span>
                <FlagIcon team={addState.away_team} className="w-5 h-3.5 rounded-sm" />
              </div>
            )}

            {/* Horario */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha y hora (hora México)</label>
              <input
                type="datetime-local"
                value={addState.kickoff}
                onChange={(e) => setAddState((p) => ({ ...p, kickoff: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {addError && (
              <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-1.5">
                {addError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={addMatch}
                disabled={adding}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Agregar partido
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddError(null); }}
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
