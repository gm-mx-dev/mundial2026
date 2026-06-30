import { createClient } from "@/lib/supabase/server";
import Navigation from "@/components/Navigation";
import PronosticosClient from "./PronosticosClient";
import type { Match, Phase } from "@/types/database";

export const revalidate = 0;

export default async function PronosticosPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-2xl flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-white mb-2">Inicia sesión para ver tus pronósticos</h2>
            <p className="text-gray-400 text-sm mb-6">
              Te mandamos un link a tu correo, sin contraseña
            </p>
            <a
              href="/auth/login"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors inline-block"
            >
              Iniciar sesión ✉️
            </a>
          </div>
        </main>
      </div>
    );
  }

  const [matchesRes, phasesRes, participantRes] = await Promise.all([
    supabase.from("matches").select("*, phases(display_name)").order("kickoff_at"),
    supabase.from("phases").select("*").order("sort_order"),
    supabase.from("participants").select("*").eq("auth_user_id", user.id).single(),
  ]);

  const matches: Match[] = matchesRes.data ?? [];
  const phases: Phase[] = phasesRes.data ?? [];
  const participant = participantRes.data;

  let predictions: Record<string, { home_score: number | null; away_score: number | null }> = {};
  if (participant) {
    const { data } = await supabase
      .from("predictions")
      .select("match_id, home_score, away_score")
      .eq("participant_id", participant.id);
    predictions = Object.fromEntries(
      (data ?? []).map((p) => [p.match_id, { home_score: p.home_score, away_score: p.away_score }])
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation isAdmin={participant?.is_admin} />
      <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">⭐ Mis Pronósticos</h1>
          <p className="text-gray-500 text-sm mt-1">Se guardan automáticamente al escribir</p>
        </div>
        <PronosticosClient
          matches={matches}
          phases={phases}
          participantId={participant?.id ?? null}
          initialPredictions={predictions}
        />
      </main>
    </div>
  );
}
