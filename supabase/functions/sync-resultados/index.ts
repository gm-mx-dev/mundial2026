// ============================================================
// QUINIELA MUNDIAL 2026 — Edge Function: sync-resultados
// Versión: v19 | Fecha: 2026-07-02
//
// WORKFLOW:
//   1. Editar este archivo localmente
//   2. git commit + git push
//   3. Deployar a Supabase:
//      Usar el MCP de Supabase → deploy_edge_function
//      o desde CLI: supabase functions deploy sync-resultados
//
// CRON:
//   Se ejecuta cada 5 minutos via pg_cron en Supabase.
//   Ver sección 14 de schema.sql para la configuración.
//
// CAMBIOS POR VERSIÓN:
//   v1–v11:  Setup inicial, mapeo de equipos, scores básicos
//   v12:     Fix get90MinScore para partidos AET
//   v13:     Protección 4: no reescribir scores de partidos finished
//   v14:     Soporte penalty_winner, penHome/penAway
//   v15:     Fix auth header (x-cron-secret)
//   v16:     Soporte penalty tally (penalty_home_score / penalty_away_score)
//   v17:     Solo escribe home_score_final cuando el partido tuvo T.E.
//   v18:     api_match_id como lookup primario (dbByApiId)
//   v19:     resp.json() protegido con try-catch (HTML en lugar de JSON);
//            parseMinute() seguro para strings "45+2";
//            try-catch por partido para aislar errores
// ============================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FOOTBALL_API_KEY    = Deno.env.get('FOOTBALL_DATA_API_KEY') ?? '';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// ── Mapeo de nombres de equipos API → español ─────────────────────────────────
const TEAM_MAP: Record<string, string> = {
  'United States': 'Estados Unidos',
  'United States of America': 'Estados Unidos',
  'USA': 'Estados Unidos',
  'US': 'Estados Unidos',
  "United States Men's National Soccer Team": 'Estados Unidos',
  'Bosnia and Herzegovina': 'Bosnia H.',
  'Bosnia-Herzegovina': 'Bosnia H.',
  'Bosnia-Herz.': 'Bosnia H.',
  'Bosnia & Herz.': 'Bosnia H.',
  'Bosnia Herzeg.': 'Bosnia H.',
  'Bosnia-Herzeg.': 'Bosnia H.',
  'Bosnia and Herz.': 'Bosnia H.',
  'Bosnia & Herzegovina': 'Bosnia H.',
  'Bosnia': 'Bosnia H.',
  'BIH': 'Bosnia H.',
  'Bosnia H.': 'Bosnia H.',
  'Bosnia-H.': 'Bosnia H.',
  'South Africa': 'Sudáfrica',
  'Canada': 'Canadá',
  'Germany': 'Alemania',
  'Paraguay': 'Paraguay',
  'France': 'Francia',
  'Sweden': 'Suecia',
  'Netherlands': 'Países Bajos',
  'Morocco': 'Marruecos',
  'Portugal': 'Portugal',
  'Croatia': 'Croacia',
  'Spain': 'España',
  'Austria': 'Austria',
  'Belgium': 'Bélgica',
  'Senegal': 'Senegal',
  'Brazil': 'Brasil',
  'Japan': 'Japón',
  "Côte d'Ivoire": 'C. Marfil',
  'Ivory Coast': 'C. Marfil',
  "Cote d'Ivoire": 'C. Marfil',
  'Norway': 'Noruega',
  'Mexico': 'México',
  'Ecuador': 'Ecuador',
  'England': 'Inglaterra',
  'DR Congo': 'RD Congo',
  'Congo DR': 'RD Congo',
  'D.R. Congo': 'RD Congo',
  'Democratic Republic of Congo': 'RD Congo',
  'Democratic Rep. Congo': 'RD Congo',
  'Dem. Rep. Congo': 'RD Congo',
  'CD Congo': 'RD Congo',
  'Republic of Congo': 'RD Congo',
  'Congo, Democratic Republic of': 'RD Congo',
  'RD Congo': 'RD Congo',
  'DRC': 'RD Congo',
  'Argentina': 'Argentina',
  'Cape Verde': 'Cabo Verde',
  'Cabo Verde': 'Cabo Verde',
  'Australia': 'Australia',
  'Egypt': 'Egipto',
  'Switzerland': 'Suiza',
  'Algeria': 'Argelia',
  'Colombia': 'Colombia',
  'Ghana': 'Ghana',
};

function mapTeam(name: string): string {
  return TEAM_MAP[name] ?? name;
}

// ── Parsea el minuto de forma segura — la API puede mandar "45+2" como string ─
function parseMinute(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && !isNaN(raw)) return Math.floor(raw);
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

// ── Obtener marcador a 90 min (base de la quiniela) ───────────────────────────
// Reglas:
//   - Partido en T.E. o penales en vivo → conservar el 90' que ya está en DB
//   - Partido FINISHED con T.E./penales → usar score.regularTime
//   - Partido normal → usar score.fullTime
function get90MinScore(
  apiMatch: Record<string, unknown>,
  dbHomeScore: number | null,
  dbAwayScore: number | null,
): { home90: number | null; away90: number | null } {
  const score     = apiMatch.score as Record<string, unknown> | null;
  const apiStatus = apiMatch.status as string;
  const duration: string = (score?.duration as string) ?? 'REGULAR';

  const isFinishedAET =
    apiStatus === 'FINISHED' &&
    (duration === 'EXTRA_TIME' || duration === 'PENALTY_SHOOTOUT');

  if (isFinishedAET) {
    const rt = score?.regularTime as Record<string, number | null> | undefined;
    if (rt?.home != null && rt?.away != null) {
      return { home90: rt.home, away90: rt.away };
    }
    return { home90: dbHomeScore, away90: dbAwayScore };
  }

  const isLiveExtraTime =
    (apiStatus === 'IN_PLAY' || apiStatus === 'PAUSED') &&
    (duration === 'EXTRA_TIME' || duration === 'PENALTY_SHOOTOUT');

  if (isLiveExtraTime) {
    return { home90: dbHomeScore, away90: dbAwayScore };
  }

  const ft = score?.fullTime as Record<string, number | null> | undefined;
  return { home90: ft?.home ?? null, away90: ft?.away ?? null };
}

// ── Obtener marcador final (T.E.) y datos de penales ─────────────────────────
function getFinalScore(apiMatch: Record<string, unknown>): {
  homeFinal: number | null;
  awayFinal: number | null;
  penWinner: 'home' | 'away' | null;
  penHome: number | null;
  penAway: number | null;
  hasAET: boolean;
} {
  const score    = apiMatch.score as Record<string, unknown> | null;
  const duration: string = (score?.duration as string) ?? 'REGULAR';
  const apiStatus = apiMatch.status as string;

  const ft   = score?.fullTime as Record<string, number | null> | undefined;
  const pens = score?.penalties as Record<string, number | null> | undefined;

  const isPEN      = duration === 'PENALTY_SHOOTOUT';
  const isAET      = duration === 'EXTRA_TIME' || isPEN;
  const isFinished = apiStatus === 'FINISHED';

  let homeFinal: number | null = null;
  let awayFinal: number | null = null;
  if (isFinished && isAET) {
    homeFinal = ft?.home ?? null;
    awayFinal = ft?.away ?? null;
  }

  let penWinner: 'home' | 'away' | null = null;
  let penHome: number | null = null;
  let penAway: number | null = null;

  if (isFinished && isPEN && pens?.home != null && pens?.away != null) {
    penHome = pens.home as number;
    penAway = pens.away as number;
    if (penHome > penAway) penWinner = 'home';
    else if (penAway > penHome) penWinner = 'away';
  }

  return { homeFinal, awayFinal, penWinner, penHome, penAway, hasAET: isAET };
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('x-cron-secret');
  const cronSecret = Deno.env.get('CRON_SECRET') ?? 'quiniela2026';
  if (req.method !== 'GET' && authHeader !== cronSecret) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results: string[]   = [];
  const unmatched: string[] = [];

  try {
    // Ventana: solo ejecutar si hay partidos activos o próximos en ±3h
    const now         = new Date();
    const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const windowEnd   = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

    const { data: activeMatches } = await supabase
      .from('matches')
      .select('id')
      .or(`status.eq.live,and(status.eq.scheduled,kickoff_at.gte.${windowStart},kickoff_at.lte.${windowEnd})`)
      .limit(1);

    if (!activeMatches?.length) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'Sin partidos activos o próximos en ventana ±3h' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Llamar a la API de football-data.org
    const resp = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?season=2026',
      { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
    );

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(
        JSON.stringify({ error: `API error ${resp.status}`, detail: txt.slice(0, 500) }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // v19: proteger resp.json() — la API puede devolver HTML (rate limit con HTTP 200)
    let data: Record<string, unknown>;
    try {
      data = await resp.json();
    } catch (jsonErr) {
      const raw = await resp.text().catch(() => '(no body)');
      console.error('API no devolvió JSON válido:', jsonErr, 'Body:', raw.slice(0, 300));
      return new Response(
        JSON.stringify({ error: 'API devolvió respuesta no-JSON', detail: raw.slice(0, 300) }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiMatches = (data.matches ?? []) as Record<string, unknown>[];

    // Leer todos los partidos de la DB
    const { data: dbMatches } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_score, away_score, home_score_final, away_score_final, penalty_winner, penalty_home_score, penalty_away_score, status, api_match_id, current_minute');

    if (!dbMatches) throw new Error('No se pudo leer partidos de la BD');

    type DbMatch = NonNullable<typeof dbMatches>[0];
    const dbByApiId: Record<string, DbMatch>  = {};
    const dbByTeams: Record<string, DbMatch>  = {};

    for (const m of dbMatches) {
      if (m.api_match_id) dbByApiId[m.api_match_id] = m;
      dbByTeams[`${m.home_team}|${m.away_team}`] = m;
    }

    // Procesar cada partido de la API
    for (const apiMatch of apiMatches) {
      // v19: try-catch por partido — un error no mata el loop completo
      try {
        const ht = apiMatch.homeTeam as Record<string, string>;
        const at = apiMatch.awayTeam as Record<string, string>;

        const rawHome = ht?.shortName ?? ht?.name ?? '';
        const rawAway = at?.shortName ?? at?.name ?? '';
        const homeTeam = mapTeam(rawHome);
        const awayTeam = mapTeam(rawAway);
        const apiId    = String(apiMatch.id);

        // Lookup: primero por api_match_id, luego por nombres
        const dbMatch    = dbByApiId[apiId] ?? dbByTeams[`${homeTeam}|${awayTeam}`];
        const matchedById = !!dbByApiId[apiId];

        if (!dbMatch) {
          unmatched.push(`API: "${rawHome}"→"${homeTeam}" vs "${rawAway}"→"${awayTeam}" [id:${apiMatch.id}]`);
          continue;
        }

        const apiStatus = apiMatch.status as string;
        const { homeFinal: rawHomeFinal, awayFinal: rawAwayFinal, penWinner, penHome, penAway, hasAET } = getFinalScore(apiMatch);

        // ── PROTECCIÓN 4: partido ya FINISHED → nunca tocar home/away_score ──
        if (dbMatch.status === 'finished') {
          const homeFinal = hasAET ? (dbMatch.home_score_final ?? rawHomeFinal) : dbMatch.home_score_final;
          const awayFinal = hasAET ? (dbMatch.away_score_final ?? rawAwayFinal) : dbMatch.away_score_final;

          const newPenHome   = dbMatch.penalty_home_score  !== null ? dbMatch.penalty_home_score  : penHome;
          const newPenAway   = dbMatch.penalty_away_score  !== null ? dbMatch.penalty_away_score  : penAway;
          const newPenWinner = dbMatch.penalty_winner      !== null ? dbMatch.penalty_winner      : penWinner;

          const finalChanged     = hasAET && rawHomeFinal !== null && dbMatch.home_score_final !== rawHomeFinal;
          const penChanged       = newPenWinner !== dbMatch.penalty_winner;
          const penTallyChanged  = newPenHome   !== dbMatch.penalty_home_score;
          const apiIdChanged     = dbMatch.api_match_id !== apiId;

          if (finalChanged || penChanged || penTallyChanged || apiIdChanged) {
            const payload: Record<string, unknown> = { api_match_id: apiId };
            if (finalChanged)      { payload.home_score_final = homeFinal; payload.away_score_final = awayFinal; }
            if (penChanged)        payload.penalty_winner = newPenWinner;
            if (penTallyChanged)   { payload.penalty_home_score = newPenHome; payload.penalty_away_score = newPenAway; }
            await supabase.from('matches').update(payload).eq('id', dbMatch.id);
            const src = matchedById ? 'id' : 'nombre';
            results.push(`✓ ${dbMatch.home_team} vs ${dbMatch.away_team}: [finished] actualizando extras (match por ${src})`);
          }
          continue;
        }

        // ── Partidos NO finished: flujo normal ────────────────────────────────
        const { home90: rawHome90, away90: rawAway90 } = get90MinScore(apiMatch, dbMatch.home_score, dbMatch.away_score);

        const home90 = (dbMatch.home_score !== null && rawHome90 === null) ? dbMatch.home_score : rawHome90;
        const away90 = (dbMatch.away_score !== null && rawAway90 === null) ? dbMatch.away_score : rawAway90;

        const homeFinal = hasAET ? (rawHomeFinal ?? dbMatch.home_score_final) : dbMatch.home_score_final;
        const awayFinal = hasAET ? (rawAwayFinal ?? dbMatch.away_score_final) : dbMatch.away_score_final;

        // v19: parseMinute seguro — maneja número o string "45+2"
        const currentMinute: number | null =
          (apiStatus === 'IN_PLAY' || apiStatus === 'PAUSED')
            ? parseMinute(apiMatch.minute)
            : null;

        let newStatus: string;
        if (apiStatus === 'FINISHED')                              newStatus = 'finished';
        else if (apiStatus === 'IN_PLAY' || apiStatus === 'PAUSED') newStatus = 'live';
        else                                                        newStatus = 'scheduled';

        // Protección 3: no revertir 'live' a 'scheduled'
        if (dbMatch.status === 'live' && newStatus === 'scheduled') newStatus = 'live';

        const changed =
          dbMatch.home_score     !== home90         ||
          dbMatch.away_score     !== away90         ||
          dbMatch.status         !== newStatus      ||
          dbMatch.current_minute !== currentMinute  ||
          dbMatch.penalty_winner !== penWinner      ||
          (hasAET && homeFinal !== null && dbMatch.home_score_final !== homeFinal) ||
          dbMatch.api_match_id   !== apiId;

        if (!changed) continue;

        const wasFinished = dbMatch.status === 'finished';
        const nowFinished = newStatus === 'finished';

        const updatePayload: Record<string, unknown> = {
          home_score:     home90,
          away_score:     away90,
          status:         newStatus,
          current_minute: currentMinute,
          api_match_id:   apiId,
        };

        if (nowFinished && hasAET && homeFinal !== null) {
          updatePayload.home_score_final  = homeFinal;
          updatePayload.away_score_final  = awayFinal;
          updatePayload.penalty_winner    = penWinner;
          if (penHome !== null) updatePayload.penalty_home_score = penHome;
          if (penAway !== null) updatePayload.penalty_away_score = penAway;
        }

        const { error } = await supabase.from('matches').update(updatePayload).eq('id', dbMatch.id);

        if (error) {
          results.push(`Error DB ${dbMatch.home_team} vs ${dbMatch.away_team}: ${error.message}`);
          continue;
        }

        const minStr = currentMinute ? ` ${currentMinute}'` : '';
        const penStr = penWinner ? ` pen→${penWinner}(${penHome}–${penAway})` : '';
        const src    = matchedById ? 'id' : 'nombre';
        results.push(`✓ ${dbMatch.home_team} ${home90 ?? '?'}–${away90 ?? '?'} ${dbMatch.away_team} [${newStatus}${minStr}]${penStr} (${src})`);

        // Registrar en bitácora cuando se finaliza un partido
        if (!wasFinished && nowFinished && home90 !== null && away90 !== null) {
          await supabase.from('audit_log').insert({
            action_type: 'result_captured',
            match_id:    dbMatch.id,
            before_value: { home_score: dbMatch.home_score, away_score: dbMatch.away_score },
            after_value:  { home_score: home90, away_score: away90, penalty_winner: penWinner, penalty_home_score: penHome, penalty_away_score: penAway },
            reason: 'Sync automático vía football-data.org',
          });
          results.push(`  → Partido finalizado — puntos vía trigger`);
        }

      } catch (matchErr) {
        // v19: error por partido aislado — no mata el resto del loop
        console.error(`Error procesando partido [id:${apiMatch.id}]:`, matchErr);
        unmatched.push(`ERROR [id:${apiMatch.id}]: ${String(matchErr)}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, updated: results.length, details: results, unmatched }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error global sync-resultados:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
