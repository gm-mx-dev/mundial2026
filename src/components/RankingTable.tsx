import type { RankingRow } from "@/types/database";
import { cn, getTeamFlagUrl } from "@/lib/utils";

const medalEmoji = ["🥇", "🥈", "🥉"];

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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
            <th className="text-left py-2 pl-3 pr-2 font-medium">#</th>
            <th className="text-left py-2 px-2 font-medium">Participante</th>
            <th className="text-center py-2 px-2 font-medium">Pts</th>
            <th className="text-center py-2 px-2 font-medium hidden sm:table-cell">Exactos</th>
            <th className="text-center py-2 px-2 font-medium hidden sm:table-cell">Correctos</th>
            <th className="text-left py-2 px-2 font-medium hidden md:table-cell">Campeón</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-900">
          {rows.map((row, idx) => {
            const isTop3 = idx < 3;
            return (
              <tr
                key={row.id}
                className={cn(
                  "transition-colors",
                  isTop3 ? "bg-indigo-950/20" : "hover:bg-gray-900/50"
                )}
              >
                <td className="py-3 pl-3 pr-2">
                  <span className={cn(
                    "font-bold text-sm",
                    idx === 0 && "text-yellow-400",
                    idx === 1 && "text-gray-400",
                    idx === 2 && "text-orange-400",
                    idx > 2  && "text-gray-600"
                  )}>
                    {idx < 3 ? medalEmoji[idx] : row.position}
                  </span>
                </td>
                <td className="py-3 px-2 font-medium text-white">{row.name}</td>
                <td className="py-3 px-2 text-center">
                  <span className={cn(
                    "font-bold text-base",
                    isTop3 ? "text-indigo-300" : "text-gray-300"
                  )}>
                    {row.total_points}
                  </span>
                </td>
                <td className="py-3 px-2 text-center text-green-400 font-medium hidden sm:table-cell">
                  {row.exact_scores}
                </td>
                <td className="py-3 px-2 text-center text-blue-400 font-medium hidden sm:table-cell">
                  {row.correct_results}
                </td>
                <td className="py-3 px-2 text-gray-400 text-xs hidden md:table-cell">
                  {row.champion_pick ? (
                    <span className="flex items-center gap-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {getTeamFlagUrl(row.champion_pick) && (
                        <img src={getTeamFlagUrl(row.champion_pick)} alt={row.champion_pick} width={20} height={13} className="rounded-[2px]" />
                      )}
                      {row.champion_pick}
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
