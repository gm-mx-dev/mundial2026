import { createClient } from "@/lib/supabase/server";
import Navigation from "@/components/Navigation";
import BolsaCard from "@/components/BolsaCard";
import RankingRealtime from "@/components/RankingRealtime";
import CountdownTimer from "@/components/CountdownTimer";
import type { RankingRow, BolsaInfo, Match } from "@/types/database";
import { formatDateTime } from "@/lib/utils";

export const revalidate = 30;

export default async function HomePage() {
  const supabase = await createClient();

  const [rankingRes, bolsaRes, matchesRes] = await Promise.all([
    supabase.from("ranking").select("*").order("position"),
    supabase.rpc("get_bolsa"),
    supabase
      .from("matches")
      .select("*")
      .eq("status", "scheduled")
      .order("kickoff_at")
      .limit(1),
  ]);

  const rows: RankingRow[] = rankingRes.data ?? [];
  const bolsa: BolsaInfo = bolsaRes.data?.[0] ?? {
    activos: 18, bolsa_total: 9000,
    primer_lugar: 5400, segundo_lugar: 2250, tercer_lugar: 1350,
  };
  const nextMatch: Match | null = matchesRes.data?.[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation />

      {/* contenido: offset top en mobile por la nav, en desktop por el sidebar */}
      <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-4xl">

        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">⚽ Quiniela Mundial 2026</h1>
          <p className="text-gray-500 text-sm mt-1">Tabla de posiciones en tiempo real</p>
        </div>

        {/* Próximo partido + countdown */}
        {nextMatch && (
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

        {/* Leyenda de puntos */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-600">
          <div className="bg-gray-900 rounded-lg p-2">
            <div className="text-green-400 font-bold text-base">2</div>
            <div>Marcador exacto</div>
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
