import { createClient } from "@/lib/supabase/server";
import Navigation from "@/components/Navigation";
import { formatDateTime, getTeamFlagUrl, toMxDateKey, formatDayHeader } from "@/lib/utils";
import type { Match, Phase } from "@/types/database";

export const revalidate = 30;

function TeamFlag({ team, side }: { team: string; side: "home" | "away" }) {
  const url = getTeamFlagUrl(team, 24);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={team}
      width={24}
      height={16}
      className={`inline-block rounded-[2px] shadow-sm shrink-0 ${side === "home" ? "ml-2" : "mr-2"}`}
      loading="lazy"
    />
  );
}

function getTodayMxKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export default async function PartidosPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("participants").select("is_admin").eq("auth_user_id", user.id).single()
    : { data: null };

  const [matchesRes, phasesRes] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_at"),
    supabase.from("phases").select("*").order("sort_order"),
  ]);

  const matches: Match[] = matchesRes.data ?? [];
  const phases: Phase[] = phasesRes.data ?? [];
  const todayKey = getTodayMxKey();

  const matchesByPhase = phases.map((ph) => ({
    phase: ph,
    matches: matches.filter((m) => m.phase_id === ph.id),
  })).filter((g) => g.matches.length > 0);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation isAdmin={me?.is_admin} />
      <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">📋 Partidos</h1>
          <p className="text-gray-500 text-sm mt-1">Resultados de todas las fases</p>
        </div>

        <div className="space-y-8">
          {matchesByPhase.map(({ phase, matches: phaseMatches }) => {
            // Agrupar partidos de esta fase por día (zona horaria CDMX)
            const dayGroups = phaseMatches.reduce<Map<string, Match[]>>((acc, m) => {
              const key = toMxDateKey(m.kickoff_at);
              if (!acc.has(key)) acc.set(key, []);
              acc.get(key)!.push(m);
              return acc;
            }, new Map());

            return (
              <div key={phase.id}>
                {/* Encabezado de fase */}
                <h2 className="text-xs uppercase tracking-widest text-indigo-400 font-semibold mb-4">
                  {phase.display_name}
                </h2>

                <div className="space-y-4">
                  {Array.from(dayGroups.entries()).map(([dayKey, dayMatches]) => {
                    const isToday = dayKey === todayKey;
                    return (
                      <div key={dayKey}>
                        {/* Separador de día */}
                        <div className={`flex items-center gap-2 mb-2 ${isToday ? "" : ""}`}>
                          <div className={`h-px flex-1 ${isToday ? "bg-yellow-500/40" : "bg-gray-800"}`} />
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            isToday
                              ? "b