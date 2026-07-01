import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import ParticipantsManager from "./ParticipantsManager";
import ResultsManager from "./ResultsManager";
import AdminPronosticosManager from "./AdminPronosticosManager";
import AuditLog from "./AuditLog";
import RecalcularButton from "./RecalcularButton";
import PronosticosStatus from "./PronosticosStatus";
import type { Participant, Match, Phase, BolsaInfo } from "@/types/database";

export const revalidate = 0;

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: me } = await supabase
    .from("participants")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!me?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🚫</div>
          <p className="text-gray-400">No tienes permisos de administrador</p>
        </div>
      </div>
    );
  }

  const [participantsRes, matchesRes, phasesRes, bolsaRes] = await Promise.all([
    supabase.from("participants").select("*").order("name"),
    supabase.from("matches").select("*, phases(display_name)").order("kickoff_at"),
    supabase.from("phases").select("*").order("sort_order"),
    supabase.rpc("get_bolsa"),
  ]);

  const participants: Participant[] = participantsRes.data ?? [];
  const matches: Match[] = matchesRes.data ?? [];
  const phases: Phase[] = phasesRes.data ?? [];
  const bolsa: BolsaInfo = bolsaRes.data?.[0] ?? {
    activos: 18, bolsa_total: 9000,
    primer_lugar: 5400, segundo_lugar: 2250, tercer_lugar: 1350,
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation isAdmin />
      <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">⚙️ Panel de Administración</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de participantes y resultados</p>
        </div>

        {/* Bolsa en tiempo real */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bolsa actual</div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-white">
              ${bolsa.bolsa_total.toLocaleString("es-MX")} MXN
            </span>
            <span className="text-sm text-gray-400">{bolsa.activos} participantes activos</span>
          </div>
        </div>

        {/* Participantes */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">👥 Participantes</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Activa o desactiva participantes — la bolsa se recalcula automáticamente
            </p>
          </div>
          <ParticipantsManager participants={participants} adminId={me.id} />
        </div>

        {/* Estado de pronósticos */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">📊 Estado de Pronósticos</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Avance de captura para la siguiente fase — los marcados con "admin" los captura el administrador
            </p>
          </div>
          <PronosticosStatus />
        </div>

        {/* Resultados */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">📋 Capturar Resultados</h2>
            <p className="text-xs text-gray-500 mt-0.5">Solo partidos terminados o en curso</p>
          </div>
          <ResultsManager matches={matches} adminId={me.id} />
        </div>

        {/* Pronósticos por participante */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">✏️ Capturar Pronósticos por Participante</h2>
            <p className="text-xs text-gray-500 mt-0.5">Para DON TANIS, TOÑO o cualquier participante</p>
          </div>
          <AdminPronosticosManager
            participants={participants}
            matches={matches}
            phases={phases}
            adminId={me.id}
          />
        </div>

        {/* Recalcular puntos */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">🔄 Recalcular Puntos</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Vuelve a calcular los puntos de todos los pronósticos para cada partido con resultado. Útil si algo quedó desincronizado.
            </p>
          </div>
          <div className="px-4 py-4">
            <RecalcularButton adminId={me.id} />
          </div>
        </div>

        {/* Bitácora */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">📜 Bitácora de Cambios</h2>
            <p className="text-xs text-gray-500 mt-0.5">Registro de todas las acciones en la app</p>
          </div>
          <AuditLog />
        </div>
      </main>
    </div>
  );
}
