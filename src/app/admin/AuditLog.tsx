"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  action_type: string;
  performed_by: string | null;
  affected_user: string | null;
  match_id: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  // Joined
  performer_name?: string;
  affected_name?: string;
  match_teams?: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  result_captured:          { label: "Resultado capturado",    color: "text-green-400" },
  result_updated:           { label: "Resultado actualizado",  color: "text-blue-400" },
  admin_prediction:         { label: "Pronóstico (admin)",     color: "text-indigo-400" },
  admin_override_prediction:{ label: "Override pronóstico",    color: "text-orange-400" },
  participant_deactivated:  { label: "Participante desactivado", color: "text-red-400" },
  participant_activated:    { label: "Participante activado",  color: "text-green-400" },
};

const FILTER_OPTIONS = [
  { value: "all",                      label: "Todos" },
  { value: "result_captured",          label: "Resultados" },
  { value: "admin_prediction",         label: "Pronósticos admin" },
  { value: "admin_override_prediction",label: "Overrides" },
  { value: "participant_deactivated",  label: "Desactivaciones" },
  { value: "participant_activated",    label: "Activaciones" },
];

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

export default function AuditLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);

    // Cargar log + participantes + partidos en paralelo
    const [logRes, partRes, matchRes] = await Promise.all([
      supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("participants").select("id, name"),
      supabase.from("matches").select("id, home_team, away_team"),
    ]);

    const partMap: Record<string, string> = {};
    for (const p of partRes.data ?? []) partMap[p.id] = p.name;

    const matchMap: Record<string, string> = {};
    for (const m of matchRes.data ?? []) matchMap[m.id] = `${m.home_team} vs ${m.away_team}`;

    const enriched: LogEntry[] = (logRes.data ?? []).map((e) => ({
      ...e,
      performer_name: e.performed_by ? (partMap[e.performed_by] ?? "—") : "Sistema",
      affected_name:  e.affected_user ? (partMap[e.affected_user] ?? "—") : undefined,
      match_teams:    e.match_id ? (matchMap[e.match_id] ?? "—") : undefined,
    }));

    setEntries(enriched);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all"
    ? entries
    : entries.filter((e) => e.action_type === filter);

  return (
    <div>
      {/* Filtros */}
      <div className="px-4 py-3 border-b border-gray-800 flex gap-2 overflow-x-auto">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              "shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all",
              filter === opt.value
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="px-4 py-8 text-center text-gray-500 text-sm">Cargando bitácora...</div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-600 text-sm">Sin registros</div>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {filtered.map((entry) => {
            const meta = ACTION_LABELS[entry.action_type] ?? { label: entry.action_type, color: "text-gray-400" };
            return (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-xs font-semibold", meta.color)}>
                        {meta.label}
                      </span>
                      {entry.match_teams && (
                        <span className="text-xs text-gray-500">{entry.match_teams}</span>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 mt-0.5">
                      <span className="text-gray-300 font-medium">{entry.performer_name}</span>
                      {entry.affected_name && (
                        <> → <span className="text-gray-300 font-medium">{entry.affected_name}</span></>
                      )}
                    </div>

                    {entry.after_value && (
                      <div className="text-xs text-gray-600 mt-0.5 font-mono">
                        {JSON.stringify(entry.after_value)}
                      </div>
                    )}

                    {entry.reason && (
                      <div className="text-xs text-orange-400/70 mt-0.5 italic">
                        "{entry.reason}"
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 shrink-0 tabular-nums">
                    {fmtDate(entry.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
