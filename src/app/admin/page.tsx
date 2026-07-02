import { createClient, tryAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import ParticipantsManager from "./ParticipantsManager";
import AdminPronosticosManager from "./AdminPronosticosManager";
import AuditLog from "./AuditLog";
import RecalcularButton from "./RecalcularButton";
import PronosticosStatus from "./PronosticosStatus";
import UnifiedMatchEditor from "./UnifiedMatchEditor";
import RespaldoManager from "./RespaldoManager";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Participant, Match, Phase, BolsaInfo } from "@/types/database";

export const revalidate = 0;

const TABS = [
  { id: "participantes", label: "👥 Participantes" },
  { id: "partidos",      label: "📅 Partidos" },
  { id: "pronosticos",   label: "✏️ Pronósticos" },
  { id: "recalcular",    label: "🔄 Recalcular" },
  { id: "bitacora",      label: "📜 Bitácora" },
  { id: "respaldo",      label: "💾 Respaldo" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const activeTab: TabId =
    TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "participantes";

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

  // Bolsa: siempre visible — consulta ligera
  const bolsaRes = await supabase.rpc("get_bolsa");
  const bolsa: BolsaInfo = bolsaRes.data?.[0] ?? {
    activos: 18,
    bolsa_total: 9000,
    primer_lugar: 5400,
    segundo_lugar: 2250,
    tercer_lugar: 1350,
  };

  // Fetch solo los datos que necesita el tab activo
  let participants: Participant[] = [];
  let matches: Match[] = [];
  let phases: Phase[] = [];

  if (activeTab === "participantes") {
    const res = await supabase.from("participants").select("*").order("name");
    participants = res.data ?? [];
  }

  if (activeTab === "partidos") {
    const [mRes, phRes] = await Promise.all([
      supabase.from("matches").select("*, phases(display_name)").order("kickoff_at"),
      supabase.from("phases").select("*").order("sort_order"),
    ]);
    matches = mRes.data ?? [];
    phases = phRes.data ?? [];
  }

  if (activeTab === "pronosticos") {
    const [pRes, mRes, phRes] = await Promise.all([
      supabase.from("participants").select("*").order("name"),
      supabase.from("matches").select("*, phases(display_name)").order("kickoff_at"),
      supabase.from("phases").select("*").order("sort_order"),
    ]);
    participants = pRes.data ?? [];
    matches = mRes.data ?? [];
    phases = phRes.data ?? [];
  }

  // recalcular y bitacora no necesitan datos adicionales

  // Respaldo: listar archivos del bucket privado (necesita service role)
  let backups: { name: string; metadata?: { size?: number } | null }[] = [];
  if (activeTab === "respaldo") {
    const adminClient = tryAdminClient();
    if (adminClient) {
      const { data: files } = await adminClient.storage
        .from("backups")
        .list("", { sortBy: { column: "name", order: "desc" } });
      backups = (files ?? [])
        .filter(f => f.name.endsWith(".json"))
        .map(f => ({ name: f.name, metadata: f.metadata }));
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation isAdmin />
      <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-3xl">

        {/* Header + Bolsa */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">⚙️ Panel de Administración</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de participantes, partidos y resultados</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bolsa actual</div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-white">
              ${bolsa.bolsa_total.toLocaleString("es-MX")} MXN
            </span>
            <span className="text-sm text-gray-400">
              {bolsa.activos} participantes activos
            </span>
          </div>
        </div>

        {/* Tabs de navegación */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`?tab=${t.id}`}
              className={cn(
                "shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                activeTab === t.id
                  ? "bg-indigo-700 text-white shadow-sm"
                  : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700"
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* ── TAB: PARTICIPANTES ── */}
        {activeTab === "participantes" && (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="font-semibold text-white">👥 Participantes</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Activa o desactiva participantes — la bolsa se recalcula automáticamente
                </p>
              </div>
              <ParticipantsManager participants={participants} adminId={me.id} />
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="font-semibold text-white">📊 Estado de Pronósticos</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Avance de captura para la siguiente fase — los marcados con &quot;admin&quot; los captura el administrador
                </p>
              </div>
              <PronosticosStatus />
            </div>
          </div>
        )}

        {/* ── TAB: PARTIDOS ── */}
        {activeTab === "partidos" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="font-semibold text-white">📅 Partidos</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Edita equipos, horarios y resultados — todo en un solo lugar
              </p>
            </div>
            <UnifiedMatchEditor matches={matches} phases={phases} adminId={me.id} />
          </div>
        )}

        {/* ── TAB: PRONÓSTICOS ── */}
        {activeTab === "pronosticos" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="font-semibold text-white">✏️ Capturar Pronósticos por Participante</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Para DON TANIS, TOÑO o cualquier participante
              </p>
            </div>
            <AdminPronosticosManager
              participants={participants}
              matches={matches}
              phases={phases}
              adminId={me.id}
            />
          </div>
        )}

        {/* ── TAB: RECALCULAR ── */}
        {activeTab === "recalcular" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="font-semibold text-white">🔄 Recalcular Puntos</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Vuelve a calcular los puntos de todos los pronósticos. Útil si algo quedó desincronizado.
              </p>
            </div>
            <div className="px-4 py-4">
              <RecalcularButton adminId={me.id} />
            </div>
          </div>
        )}

        {/* ── TAB: BITÁCORA ── */}
        {activeTab === "bitacora" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="font-semibold text-white">📜 Bitácora de Cambios</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Registro de todas las acciones en la app
              </p>
            </div>
            <AuditLog />
          </div>
        )}

        {/* ── TAB: RESPALDO ── */}
        {activeTab === "respaldo" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="font-semibold text-white">💾 Respaldo de Base de Datos</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Genera o descarga un respaldo completo de todos los datos
              </p>
            </div>
            <RespaldoManager backups={backups} />
          </div>
        )}

      </main>
    </div>
  );
}
