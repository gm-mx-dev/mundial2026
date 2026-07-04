import type { RankingRow } from "@/types/database";
import { cn } from "@/lib/utils";
import FlagIcon from "@/components/FlagIcon";

function posLabel(position: number): string {
  return `${position}°`;
}

export default function RankingTable({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 text-sm">
        Aún no hay puntos registrados
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
            <th className="text-center py-2 pl-3 pr-1 font-medium w-8 text-gray-600">#</th>
            <th className="sticky left-0 z-10 bg-gray-900 text-left py-2 px-2 font-medium min-w-[130px]">
              Participante
            </th>
            <th className="text-center py-2 px-2 font-medium w-10">Pos</th>
            <th className="text-center py-2 px-2 font-medium">Pts</th>
            {/* ✓✓✓ = exacto octavos+ (3pts, amarillo) — regla julio 2026 */}
            <th className="text-center py-2 px-2 font-medium text-yellow-500">✓✓✓</th>
            {/* ✓✓ = exacto 16avos (2pts, verde) */}
            <th className="text-center py-2 px-2 font-medium">✓✓</th>
            <th className="text-center py-2 px-2 font-medium">✓</th>
            <th className="text-left py-2 px-3 font-medium min-w-[120px]">Campeón</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-900">
          {rows.map((row, idx) => {
            const isTop3 = row.position <= 3;
            const rowBg = isTop3 ? "rgba(30,27,75,0.2)" : "transparent";
            return (
              <tr
                key={row.id}
                className={cn(
                  "transition-colors",
                  isTop3 ? "bg-indigo-950/20" : "hover:bg-gray-900/50"
                )}
              >
                <td className="py-3 pl-3 pr-1 text-center">
                  <span className="text-xs text-gray-700 font-medium">{idx + 1}</span>
                </td>

                {/* Nombre — sticky */}
                <td
                  className="sticky left-0 z-10 py-3 px-2 font-medium text-white"
                  style={{ background: rowBg || "#030712" }}
                >
                  {row.name}
                </td>

                {/* Posición con empates */}
                <td className="py-3 px-2 text-center">
                  <span className={cn(
                    "font-bold text-sm",
                    row.position === 1 && "text-yellow-400",
                    row.position === 2 && "text-gray-300",
                    row.position === 3 && "text-orange-400",
                    row.position > 3  && "text-gray-500"
                  )}>
                    {posLabel(row.position)}
                  </span>
                </td>

                <td className="py-3 px-2 text-center">
                  <span className={cn(
                    "font-bold text-base",
                    isTop3 ? "text-indigo-300" : "text-gray-300"
                  )}>
                    {row.total_points}
                  </span>
                </td>

                {/* Exactos octavos+ 3pts (amarillo) */}
                <td className="py-3 px-2 text-center text-yellow-400 font-medium">
                  {row.exact_scores_3pt}
                </td>
                {/* Exactos 16avos 2pts (verde) */}
                <td className="py-3 px-2 text-center text-green-400 font-medium">
                  {row.exact_scores}
                </td>
                <td className="py-3 px-2 text-center text-blue-400 font-medium">
                  {row.correct_results}
                </td>
                <td className="py-3 px-3 text-gray-400 text-xs">
                  {row.champion_pick ? (
                    <span className="flex items-center gap-1.5">
                      <FlagIcon team={row.champion_pick} className="w-5 h-3.5 rounded-sm shrink-0" />
                      <span className="whitespace-nowrap">{row.champion_pick}</span>
                    </span>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
