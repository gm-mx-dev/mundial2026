"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function RecalcularButton({ adminId }: { adminId: string }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [log, setLog] = useState<string[]>([]);
  const supabase = createClient();

  const recalcular = async () => {
    if (status === "running") return;
    setStatus("running");
    setLog([]);

    // 1. Obtener todos los partidos con resultado
    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .select("id, home_team, away_team, home_score, away_score")
      .not("home_score", "is", null)
      .order("kickoff_at");

    if (matchErr || !matches) {
      setLog(["Error al obtener partidos: " + (matchErr?.message ?? "desconocido")]);
      setStatus("error");
      return;
    }

    if (matches.length === 0) {
      setLog(["No hay partidos con resultado aún."]);
      setStatus("done");
      return;
    }

    const lines: string[] = [];

    // 2. Recalcular puntos para cada partido
    for (const m of matches) {
      const { error } = await supabase.rpc("calculate_points", {
        p_match_id: m.id,
        p_home_score: m.home_score,
        p_away_score: m.away_score,
      });

      if (error) {
        lines.push(`❌ ${m.home_team} vs ${m.away_team}: ${error.message}`);
      } else {
        lines.push(`✅ ${m.home_team} ${m.home_score}–${m.away_score} ${m.away_team}`);
      }

      setLog([...lines]);
    }

    // 3. Registrar en bitácora
    await supabase.from("audit_log").insert({
      action_type: "recalculate_all",
      performed_by: adminId,
      reason: `Recalculados ${matches.length} partidos`,
    });

    setStatus("done");
  };

  return (
    <div>
      <button
        onClick={recalcular}
        disabled={status === "running"}
        className={cn(
          "w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all",
          status === "running"
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : status === "done"
            ? "bg-green-800 hover:bg-green-700 text-white"
            : status === "error"
            ? "bg-red-800 hover:bg-red-700 text-white"
            : "bg-orange-700 hover:bg-orange-600 text-white"
        )}
      >
        {status === "running" ? "⏳ Recalculando..." :
         status === "done"    ? "✅ Recalculado — volver a ejecutar" :
         status === "error"   ? "❌ Error — reintentar" :
         "🔄 Recalcular todos los puntos"}
      </button>

      {log.length > 0 && (
        <div className="mt-3 bg-gray-950 rounded-lg p-3 max-h-48 overflow-y-auto">
          {log.map((line, i) => (
            <div key={i} className="text-xs font-mono text-gray-300 leading-relaxed">
              {line}
            </div>
          ))}
          {status === "done" && (
            <div className="mt-2 text-xs text-green-400 font-semibold">
              Completado — {log.filter(l => l.startsWith("✅")).length} partidos recalculados.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
