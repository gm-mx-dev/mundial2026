import { createClient } from "@/lib/supabase/server";
import Navigation from "@/components/Navigation";
import LoginButton from "@/app/auth/login/LoginButton";
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
        <main className="pt-12 md:pt-0 md:ml-56 px-4 py-6 flex items-center justify-center min-h-[80vh]">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">⚽</div>
              <h1 className="text-2xl font-bold text-white">Quiniela Mundial 2026</h1>
              <p className="text-gray-400 mt-2 text-sm">Ingresa tu correo y te mandamos un link para entrar, sin contraseña</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <LoginButton redirectTo="/pronosticos" />
            </div>
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
