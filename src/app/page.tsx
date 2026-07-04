import { createClient } from "@/lib/supabase/server";
import Navigation from "@/components/Navigation";
import BolsaCard from "@/components/BolsaCard";
import RankingRealtime from "@/components/RankingRealtime";
import CountdownTimer from "@/components/CountdownTimer";
import FlagIcon from "@/components/FlagIcon";
import type { RankingRow, BolsaInfo, Match } from "@/types/database";
import { formatDateTime } from "@/lib/utils";

export const revalidate = 30;

/** Etiqueta de tiempo para un partido en vivo: minuto, T.E. o penales */
function getLiveTimeLabel(m: Match): string {
  // Penales completados o en curso
  if (m.penalty_winner !== null && m.penalty_home_score !== null) {
    return `90' (${m.home_score ?? 0}-${m.away_score ?? 0}) · T.E. · 🔴 Pen. ${m.penalty_home_score}-${m.penalty_away_score}`;
  }
  // Tiempo extra (minuto > 90 o score_final registrado)
  const inET = (m.current_minute !== null && m.current_minute > 90) || m.home_score_final !== null;
  if (inET) {
    const min = m.current_minute !== null ? ` ${m.current_minute}'` : "";
    return `90' (${m.home_score ?? 0}-${m.away_score ?? 0}) · T.E.${min}`;
  }
  // Tiempo normal
  if (m.current_minute !== null) return `${m.current_minute}'`;
  return "En curso";
}

export default async function HomePage() {
  const supabase = await createClient();

  const [rankingRes, bolsaRes, liveRes, nextRes] = await Promise.all([
    supabase.from("ranking").select("*").order("position"),
    supabase.rpc("get_bolsa"),
    supabase.from("matches").select("*").eq("status", "live").order("kickoff_at"),
    supabase
      .from("matches")
      .select("*")
      .gt("kickoff_at", new Date().toISOString())
      .order("kickoff_at")
      .limit(1),
  ]);

  const rows: RankingRow[] = rankingRes.data ?? [];
  const bolsa: BolsaInfo = bolsaRes.data?.[0] ?? {
    activos: 18, bolsa_total: 9000,
    primer_lugar: 5400, segundo_lugar: 2250, tercer_lugar: 1350,
  };
  const liveMatches: Match[] = liveRes.data ?? [];
  const nextMatch: Match | null = nextRes.data?.[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation />

      <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-4xl">

        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">⚽ Quiniela Mundial 2026</h1>
          <p className="text-gray-500 text-sm mt-1">Tabla de posiciones en tiempo real</p>
        </div>

        {/* ── Partidos EN VIVO ── */}
        {liveMatches.length > 0 && (
          <div className="mb-4 space-y-2">
            {liveMatches.map((m) => (
              <div
                key={m.id}
                className="bg-green-950/20 border border-green-800/40 rounded-xl px-4 pt-2.5 pb-4"
              >
                {/* Indicador + hora */}
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <span className="text-[11px] text-green-400 font-semibold uppercase tracking-wide">En vivo</span>
                  <span className="text-[11px] text-gray-600 ml-1">· {formatDateTime(m.kickoff_at)}</span>
                </div>

                {/* Marcador centrado — equipo + score juntos */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap justify-center">
                    {/* Local */}
                    <div className="flex items-center gap-1.5">
                      <FlagIcon team={m.home_team} className="w-5 h-3.5 rounded-sm shrink-0" />
                      <span className="font-semibold text-white text-sm max-w-[100px] truncate">
                        {m.home_team}
                      </span>
                    </div>
                    {/* Scores */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-2xl font-bold text-white tabular-nums w-10 h-10 flex items-center justify-center bg-gray-800 rounded-lg">
                        {m.home_score ?? "–"}
                      </span>
                      <span className="text-gray-500 font-bold">:</span>
                      <span className="text-2xl font-bold text-white tabular-nums w-10 h-10 flex items-center justify-center bg-gray-800 rounded-lg">
                        {m.away_score ?? "–"}
                      </span>
                    </div>
                    {/* Visitante */}
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white text-sm max-w-[100px] truncate">
                        {m.away_team}
                      </span>
                      <FlagIcon team={m.away_team} className="w-5 h-3.5 rounded-sm shrink-0" />
                    </div>
                  </div>
                  {/* Tiempo: minuto, T.E. o penales */}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {getLiveTimeLabel(m)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Próximo partido (solo si no hay partidos en vivo) ── */}
        {liveMatches.length === 0 && nextMatch && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Próximo partido</div>
              <div className="font-semibold text-white truncate">
                {nextMatch.home_team} vs {nextMatch.away_team}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{formatDateTime(nextMatch.kickoff_at)}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-gray-600 mb-1">Inicia en</div>
              <CountdownTimer kickoffAt={nextMatch.kickoff_at} />
            </div>
          </div>
        )}

        {/* Bolsa */}
        <div className="mb-6">
          <BolsaCard bolsa={bolsa} />
        </div>

        {/* Ranking */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">Tabla de posiciones</h2>
            <span className="text-xs text-gray-500">{rows.length} participantes</span>
          </div>
          <RankingRealtime initialRows={rows} />
        </div>

        {/* Leyenda de puntos — regla julio 2026: exacto 16avos=2pts, exacto octavos+=3pts */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs text-gray-600 sm:grid-cols-4">
          <div className="bg-gray-900 rounded-lg p-2">
            <div className="text-yellow-400 font-bold text-base">3</div>
            <div>Exacto oct.+</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-2">
            <div className="text-green-400 font-bold text-base">2</div>
            <div>Exacto 16avos</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-2">
            <div className="text-blue-400 font-bold text-base">1</div>
            <div>Resultado correcto</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-2">
            <div className="text-yellow-400 font-bold text-base">+5</div>
            <div>Bono campeón</div>
          </div>
        </div>
      </main>
    </div>
  );
}
