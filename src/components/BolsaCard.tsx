import { formatMXN } from "@/lib/utils";
import type { BolsaInfo } from "@/types/database";

export default function BolsaCard({ bolsa }: { bolsa: BolsaInfo }) {
  return (
    <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/30 border border-indigo-800/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-indigo-300">💰 Bolsa Total</span>
        <span className="text-xs text-gray-500">{bolsa.activos} participantes</span>
      </div>
      <div className="text-3xl font-bold text-white mb-4">
        {formatMXN(bolsa.bolsa_total)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-center">
          <div className="text-xs text-yellow-400 font-medium">🥇 1er Lugar</div>
          <div className="text-sm font-bold text-white mt-1">{formatMXN(bolsa.primer_lugar)}</div>
        </div>
        <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400 font-medium">🥈 2do Lugar</div>
          <div className="text-sm font-bold text-white mt-1">{formatMXN(bolsa.segundo_lugar)}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 text-center">
          <div className="text-xs text-orange-400 font-medium">🥉 3er Lugar</div>
          <div className="text-sm font-bold text-white mt-1">{formatMXN(bolsa.tercer_lugar)}</div>
        </div>
      </div>
    </div>
  );
}
