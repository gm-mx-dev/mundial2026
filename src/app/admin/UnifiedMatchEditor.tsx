"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import FlagIcon from "@/components/FlagIcon";
import type { Match, Phase } from "@/types/database";
import { Check, Loader2, Plus, Save, ChevronDown, Trash2, AlertTriangle } from "lucide-react";

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

// ── Abreviaturas de 3 letras para el header compacto ────────────────────────
const TEAM_ABBR: Record<string, string> = {
  "Alemania": "GER", "Argelia": "ALG", "Argentina": "ARG",
  "Australia": "AUS", "Austria": "AUT", "Bélgica": "BEL",
  "Bosnia H.": "BiH", "Brasil": "BRA", "C. Marfil": "CIV",
  "Cabo Verde": "CPV", "Canadá": "CAN", "Colombia": "COL",
  "Croacia": "CRO", "Ecuador": "ECU", "Egipto": "EGY",
  "España": "ESP", "Estados Unidos": "USA", "Francia": "FRA",
  "Ghana": "GHA", "Inglaterra": "ENG", "Japón": "JPN",
  "Marruecos": "MAR", "México": "MEX", "Noruega": "NOR",
  "Países Bajos": "NED", "Paises Bajos": "NED", "Paraguay": "PAR",
  "Portugal": "POR", "RD Congo": "COD", "Senegal": "SEN",
  "Sudáfrica": "RSA", "Suecia": "SWE", "Suiza": "SUI",
};
function abbrTeam(name: string): string {
  return TEAM_ABBR[name] ?? name.slice(0, 3).toUpperCase();
}

// ── Formatea "YYYY-MM-DDTHH:MM" (hora México) como "02/07 1:00pm" ─────────────
function formatKickoffShort(localDt: string): string {
  if (!localDt) return "";
  const [datePart, timePart] = localDt.split("T");
  if (!datePart || !timePart) return "";
  const [, month, day] = datePart.split("-");
  const [hours, minutes] = timePart.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${day}/${month} ${h12}:${minutes}${ampm}`;
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

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = TEAMS.filter((t) => t.toLowerCase().includes(query.toLowerCase()));
  const isValid = TEAMS.includes(query);

  const handleSelect = (team: string) => {
    setQuery(team);
    onChange(team);
    setOpen(false);
  };

  const handleBlur = () => {
    setOpen(false);
    if (!isValid) setQuery(value);
    else onChange(query);
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
            open || isValid ? "border-gray-700" : query !== "" ? "border-red-800/60" : "border-gray-700"
          )}
        />
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
      {open && filtered.length > 0 && (
        <div className={cn(
          "absolute z-20 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl",
          "max-h-48 overflow-y-auto overscroll-contain",
          "min-w-[160px] w-full",
          align === "right" ? "right-0" : "left-0"
        )}>
          {filtered.map((team) => (
            <button
              key={team}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(team); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                team === query ? "bg-indigo-700/40 text-white" : "hover:bg-gray-700 text-gray-200"
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

// ── Fila de marcador reutilizable ─────────────────────────────────────────────
interface ScoreRowProps {
  homeLabel: string;
  awayLabel: string;
  homeVal: string;
  awayVal: string;
  onHomeChange: (v: string) => void;
  onAwayChange: (v: string) => void;
  inputClass?: string;
  size?: "lg" | "sm";
}

function ScoreRow({
  homeLabel, awayLabel, homeVal, awayVal,
  onHomeChange, onAwayChange,
  inputClass = "",
  size = "lg",
}: ScoreRowProps) {
  const h = size === "lg" ? "h-10 w-12 text-base" : "h-8 w-11 text-sm";
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-right text-xs text-gray-400 truncate leading-tight">{homeLabel}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number" min="0" max="99"
          value={homeVal}
          onChange={(e) => onHomeChange(e.target.value)}
          placeholder="—"
          className={cn(
            "text-center font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500",
            h, inputClass
          )}
        />
        <span className="text-gray-600 text-sm font-bold">:</span>
        <input
          type="number" min="0" max="99"
          value={awayVal}
          onChange={(e) => onAwayChange(e.target.value)}
          placeholder="—"
          className={cn(
            "text-center font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500",
            h, inputClass
          )}
        />
      </div>
      <span className="flex-1 text-xs text-gray-400 truncate leading-tight">{awayLabel}</span>
    </div>
  );
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type MatchEditState = {
  home_team: string;
  away_team: string;
  kickoff: string;
  home90: string;
  away90: string;
  homeFinal: string;
  awayFinal: string;
  penHome: string;
  penAway: string;
  status: "scheduled" | "live" | "finished";
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

  const [activePhaseId, setActivePhaseId] = useState<number>(phases[0]?.id ?? 0);

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
          penHome: m.penalty_home_score?.toString() ?? "",
          penAway: m.penalty_away_score?.toString() ?? "",
          status: (m.status ?? "scheduled") as "scheduled" | "live" | "finished",
        },
      ])
    )
  );

  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
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

  // ── Sincronizar nuevos partidos al editState cuando cambia el prop ────────
  // (router.refresh() pasa props nuevas pero useState no se reinicia)
  useEffect(() => {
    setEditState((prev) => {
      const additions: Record<string, MatchEditState> = {};
      for (const m of matches) {
        if (!prev[m.id]) {
          additions[m.id] = {
            home_team: m.home_team,
            away_team: m.away_team,
            kickoff: utcToMexicoInput(m.kickoff_at),
            home90: m.home_score?.toString() ?? "",
            away90: m.away_score?.toString() ?? "",
            homeFinal: m.home_score_final?.toString() ?? "",
            awayFinal: m.away_score_final?.toString() ?? "",
            penHome: m.penalty_home_score?.toString() ?? "",
            penAway: m.penalty_away_score?.toString() ?? "",
            status: (m.status ?? "scheduled") as "scheduled" | "live" | "finished",
          };
        }
      }
      if (Object.keys(additions).length === 0) return prev; // sin cambios
      return { ...prev, ...additions };
    });
  }, [matches]);

  // ── Guardar partido ───────────────────────────────────────────────────────
  const saveMatch = async (match: Match) => {
    const st = editState[match.id];
    if (!st) return;

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

    // Marcador de penales y ganador derivado automáticamente
    const penHome = st.penHome !== "" && !isNaN(Number(st.penHome)) ? parseInt(st.penHome) : null;
    const penAway = st.penAway !== "" && !isNaN(Number(st.penAway)) ? parseInt(st.penAway) : null;
    const penWinner: "home" | "away" | null =
      penHome !== null && penAway !== null
        ? penHome > penAway ? "home" : "away"
        : null;

    if ((home90 === null) !== (away90 === null)) {
      setSaveError("Captura el marcador local Y visitante a 90 min");
      setTimeout(() => setSaveError(null), 3000);
      return;
    }

    setSaving(match.id);
    setSaveError(null);

    const kickoff_at = mexicoInputToUtc(st.kickoff);
    const hasScores = home90 !== null && away90 !== null;
    const newStatus = hasScores ? st.status : "scheduled";

    const payload: Record<string, unknown> = {
      home_team: st.home_team,
      away_team: st.away_team,
      kickoff_at,
      home_score_final: homeFinal,
      away_score_final: awayFinal,
      penalty_winner: penWinner,
      penalty_home_score: penHome,
      penalty_away_score: penAway,
    };

    if (hasScores) {
      payload.home_score = home90;
      payload.away_score = away90;
      payload.status = newStatus;
    }

    const { error } = await supabase.from("matches").update(payload).eq("id", match.id);

    if (!error) {
      if (hasScores && newStatus === "finished") {
        await supabase.rpc("calculate_points", {
          p_match_id: match.id,
          p_home_score: home90!,
          p_away_score: away90!,
        });
      }

      const action_type =
        hasScores && match.home_score === null && newStatus === "finished"
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
          penalty_home_score: match.penalty_home_score,
          penalty_away_score: match.penalty_away_score,
        },
        after_value: {
          home_team: st.home_team,
          away_team: st.away_team,
          kickoff_at,
          ...(hasScores && { home_score: home90, away_score: away90 }),
          penalty_winner: penWinner,
          penalty_home_score: penHome,
          penalty_away_score: penAway,
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

  // ── Eliminar partido ──────────────────────────────────────────────────────
  const deleteMatch = async (match: Match) => {
    setDeleting(match.id);
    await supabase.from("predictions").delete().eq("match_id", match.id);
    const { error } = await supabase.from("matches").delete().eq("id", match.id);
    if (!error) {
      await supabase.from("audit_log").insert({
        action_type: "match_deleted",
        performed_by: adminId,
        match_id: match.id,
        before_value: {
          home_team: match.home_team,
          away_team: match.away_team,
          kickoff_at: match.kickoff_at,
          match_number: match.match_number,
        },
        after_value: null,
      });
      setDeleteConfirm(null);
      router.refresh();
    }
    setDeleting(null);
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
      // Cambiar a la fase del partido recién agregado
      setActivePhaseId(phaseId);
      setAddState({ phase_id: addState.phase_id, home_team: "", away_team: "", kickoff: "" });
      setShowAddForm(false);
      router.refresh();
    }
  };

  // ── Partidos de la fase activa ────────────────────────────────────────────
  const activeMatches = matches
    .filter((m) => m.phase_id === activePhaseId)
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

  return (
    <div>
      {/* ── Tabs de fases ─────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 px-4 pt-4 pb-3 overflow-x-auto border-b border-gray-800/40 scrollbar-hide">
        {phases.map((ph) => {
          const count = matches.filter((m) => m.phase_id === ph.id).length;
          const finished = matches.filter(
            (m) => m.phase_id === ph.id && m.status === "finished"
          ).length;
          return (
            <button
              key={ph.id}
              onClick={() => setActivePhaseId(ph.id)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap",
                activePhaseId === ph.id
                  ? "bg-indigo-700/40 border-indigo-600/60 text-indigo-300"
                  : "bg-gray-800/40 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
              )}
            >
              {ph.display_name}
              <span className="ml-1 text-[10px] opacity-50">
                {finished}/{count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Aviso ──────────────────────────────────────────────────────────── */}
      <div className="mx-4 mt-3 mb-4 px-3 py-2 bg-yellow-900/20 border border-yellow-800/40 rounded-lg">
        <p className="text-xs text-yellow-400/80">
          ⚠️ Horarios en <strong>hora Ciudad de México</strong>. Solo el marcador de 90&apos; cuenta para la quiniela. T.E. y Penales son solo para mostrar a los participantes.
        </p>
      </div>

      {/* ── Lista de partidos ──────────────────────────────────────────────── */}
      <div className="space-y-3 px-4 pb-4">
        {activeMatches.length === 0 && (
          <p className="text-center text-gray-600 text-sm py-10">
            No hay partidos en esta fase todavía.
          </p>
        )}

        {activeMatches.map((match) => {
          const st = editState[match.id];
          if (!st) return null;

          const isSaving = saving === match.id;
          const isSaved = saved === match.id;
          const home90Num = st.home90 !== "" && !isNaN(Number(st.home90)) ? Number(st.home90) : null;
          const away90Num = st.away90 !== "" && !isNaN(Number(st.away90)) ? Number(st.away90) : null;
          const hasScores = home90Num !== null && away90Num !== null;
          const isDraw = hasScores && home90Num === away90Num;
          const hasValidTeams = TEAMS.includes(st.home_team) && TEAMS.includes(st.away_team);

          // T.E.: mostrar si 90' es empate, o si ya hay datos de T.E. significativos guardados
          const homeFinalNum = st.homeFinal !== "" && !isNaN(Number(st.homeFinal)) ? Number(st.homeFinal) : null;
          const awayFinalNum = st.awayFinal !== "" && !isNaN(Number(st.awayFinal)) ? Number(st.awayFinal) : null;
          const hasPenData = st.penHome !== "" || st.penAway !== "" || match.penalty_winner !== null;
          // T.E. existente es "significativo" si el marcador difiere del 90'
          // (goles en prórroga) O si hay penales (ET real aunque terminara igual que 90')
          const hasExistingTE =
            (st.homeFinal !== "" || st.awayFinal !== "") &&
            (homeFinalNum !== home90Num || awayFinalNum !== away90Num || hasPenData);
          const showTE = isDraw || hasExistingTE;

          // Penales: mostrar si T.E. también queda empate, o si ya hay datos de penales
          const isDrawAfterET = homeFinalNum !== null && awayFinalNum !== null && homeFinalNum === awayFinalNum;
          const showPenales = isDrawAfterET || st.penHome !== "" || st.penAway !== "" || match.penalty_winner !== null;

          // Derivar ganador de penales para mostrar en UI
          const penHomeNum = st.penHome !== "" ? Number(st.penHome) : null;
          const penAwayNum = st.penAway !== "" ? Number(st.penAway) : null;
          const derivedPenWinner =
            penHomeNum !== null && penAwayNum !== null
              ? penHomeNum > penAwayNum
                ? st.home_team || "Local"
                : st.away_team || "Visitante"
              : null;

          return (
            <div
              key={match.id}
              className={cn(
                "bg-gray-900 border rounded-xl overflow-hidden",
                match.status === "live"
                  ? "border-green-800/50"
                  : match.status === "finished"
                  ? "border-gray-800"
                  : "border-gray-800"
              )}
            >
              {/* Cabecera del partido */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-800/60 bg-gray-800/30">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[11px] font-mono text-gray-600 shrink-0">P{match.match_number}</span>
                  {hasValidTeams && (
                    <div className="flex items-center gap-1 text-xs min-w-0 flex-1">
                      <FlagIcon team={st.home_team} className="w-4 h-3 rounded-sm shrink-0" />
                      <span className="font-mono text-gray-300 shrink-0">{abbrTeam(st.home_team)}</span>
                      <span className="text-gray-700 shrink-0 mx-0.5">-</span>
                      <FlagIcon team={st.away_team} className="w-4 h-3 rounded-sm shrink-0" />
                      <span className="font-mono text-gray-300 shrink-0">{abbrTeam(st.away_team)}</span>
                      {st.kickoff && (
                        <span className="text-gray-600 shrink-0 ml-1">· {formatKickoffShort(st.kickoff)}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className={cn(
                  "shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ml-2",
                  match.status === "finished"
                    ? "bg-gray-800 text-gray-500 border-gray-700"
                    : match.status === "live"
                    ? "bg-green-900/40 text-green-400 border-green-800/50"
                    : "bg-blue-900/20 text-blue-400 border-blue-900/40"
                )}>
                  {match.status === "finished" ? "✓ Listo"
                    : match.status === "live" ? "⚡ Vivo"
                    : "Prog."}
                </span>
              </div>

              <div className="p-4 space-y-4">

                {/* Equipos */}
                <div>
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide block mb-1.5">Equipos</label>
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
                </div>

                {/* Horario */}
                <div>
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide block mb-1.5">Horario (hora México)</label>
                  <input
                    type="datetime-local"
                    value={st.kickoff}
                    onChange={(e) => update(match.id, { kickoff: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* ── Tiempo Regular (90') ──────────────────────────────── */}
                <div className="bg-indigo-950/25 border border-indigo-900/40 rounded-xl p-3.5">
                  <p className="text-xs text-indigo-400 font-semibold mb-2.5">
                    ⚽ Tiempo Regular — 90 min
                    <span className="text-indigo-700 font-normal ml-1.5">cuenta para la quiniela</span>
                  </p>
                  <ScoreRow
                    homeLabel={st.home_team || "Local"}
                    awayLabel={st.away_team || "Visitante"}
                    homeVal={st.home90}
                    awayVal={st.away90}
                    onHomeChange={(v) => {
                      const patch: Partial<MatchEditState> = { home90: v };
                      if (v !== "" && st.status === "scheduled") patch.status = "finished";
                      update(match.id, patch);
                    }}
                    onAwayChange={(v) => {
                      const patch: Partial<MatchEditState> = { away90: v };
                      if (v !== "" && st.status === "scheduled") patch.status = "finished";
                      update(match.id, patch);
                    }}
                    inputClass="bg-indigo-900/30 border-indigo-800/50 text-white"
                  />

                  {/* Estado — solo cuando hay marcador */}
                  {hasScores && (
                    <div className="mt-3.5 pt-3 border-t border-indigo-900/30">
                      <p className="text-[11px] text-gray-500 mb-1.5">Estado del partido</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => update(match.id, { status: "live" })}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            st.status === "live"
                              ? "bg-green-900/40 border-green-700/60 text-green-400"
                              : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600"
                          )}
                        >
                          ⚡ En vivo
                        </button>
                        <button
                          type="button"
                          onClick={() => update(match.id, { status: "finished" })}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            st.status === "finished"
                              ? "bg-gray-700/60 border-gray-500 text-white"
                              : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600"
                          )}
                        >
                          ✓ Finalizado
                        </button>
                      </div>
                      {st.status === "live" && (
                        <p className="text-[10px] text-green-600/70 mt-1.5">
                          Marcador visible en tiempo real. Los puntos se actualizan al guardar.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Tiempo Extra ──────────────────────────────────────── */}
                {showTE && (
                  <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-3.5">
                    <p className="text-xs text-gray-500 font-medium mb-2.5">
                      🕐 Tiempo Extra
                      <span className="text-gray-600 font-normal ml-1.5">solo display — opcional</span>
                    </p>
                    <ScoreRow
                      homeLabel={st.home_team || "Local"}
                      awayLabel={st.away_team || "Visitante"}
                      homeVal={st.homeFinal}
                      awayVal={st.awayFinal}
                      onHomeChange={(v) => update(match.id, { homeFinal: v })}
                      onAwayChange={(v) => update(match.id, { awayFinal: v })}
                      inputClass="bg-gray-800 border-gray-700 text-gray-300"
                      size="sm"
                    />
                    <p className="text-[10px] text-gray-600 mt-2 leading-snug">
                      Marcador acumulado incluyendo prórroga. Ej: si 90&apos; fue 1–1 y marcó 1 gol en T.E., anota 2–1.
                    </p>
                  </div>
                )}

                {/* ── Penales ───────────────────────────────────────────── */}
                {showPenales && (
                  <div className="bg-gray-800/30 border border-violet-900/30 rounded-xl p-3.5">
                    <p className="text-xs text-violet-400 font-medium mb-2.5">
                      🎯 Tanda de Penales
                      <span className="text-gray-600 font-normal ml-1.5">solo display — opcional</span>
                    </p>
                    <ScoreRow
                      homeLabel={st.home_team || "Local"}
                      awayLabel={st.away_team || "Visitante"}
                      homeVal={st.penHome}
                      awayVal={st.penAway}
                      onHomeChange={(v) => update(match.id, { penHome: v })}
                      onAwayChange={(v) => update(match.id, { penAway: v })}
                      inputClass="bg-gray-800 border-violet-900/40 text-gray-300"
                      size="sm"
                    />
                    {derivedPenWinner && (
                      <p className="text-[10px] text-violet-500/80 mt-2">
                        Ganador automático: <span className="font-semibold text-violet-400">{derivedPenWinner}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Error de guardado */}
                {saveError && saving === null && saved === null && (
                  <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-1.5">
                    {saveError}
                  </p>
                )}

                {/* Acciones */}
                {deleteConfirm === match.id ? (
                  <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-300">¿Eliminar este partido?</p>
                        <p className="text-xs text-red-400/80 mt-0.5">
                          P{match.match_number}: {match.home_team} vs {match.away_team}
                        </p>
                        <p className="text-xs text-red-500/70 mt-1">
                          Se eliminarán también todos los pronósticos. Esta acción no se puede deshacer.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 text-xs hover:border-gray-600 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => deleteMatch(match)}
                        disabled={deleting === match.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {deleting === match.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        Sí, eliminar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setDeleteConfirm(match.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-500 text-xs hover:border-red-800/60 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>
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
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Agregar partido nuevo ──────────────────────────────────────────── */}
      <div className="px-4 pb-6 border-t border-gray-800/40 pt-4">
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
