-- ============================================================
-- QUINIELA MUNDIAL 2026 — Schema de Base de Datos (Supabase)
-- ============================================================
-- Ejecutar en el SQL Editor de Supabase en este orden.
-- ============================================================

-- ────────────────────────────────────────────────
-- 0. EXTENSIONES
-- ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────
-- 1. PARTICIPANTES
-- ────────────────────────────────────────────────
CREATE TABLE participants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,                    -- Nombre visible (ADRIAN, GIO, etc.)
  email       TEXT UNIQUE,                      -- Correo para login con Google
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,    -- false = no pago / desactivado
  is_admin    BOOLEAN NOT NULL DEFAULT false,   -- true = puede capturar resultados y admin
  needs_proxy BOOLEAN NOT NULL DEFAULT false,   -- true = Don Tanis, Toño (sin celular)
  champion_pick TEXT,                           -- País elegido como campeón
  fee_paid    BOOLEAN NOT NULL DEFAULT true,    -- Si ya pagó los $500
  deactivated_reason TEXT,                      -- Razón de desactivación (si aplica)
  deactivated_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_participants_active ON participants(is_active);
CREATE INDEX idx_participants_auth ON participants(auth_user_id);

-- ────────────────────────────────────────────────
-- 2. FASES
-- ────────────────────────────────────────────────
CREATE TABLE phases (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,                    -- "16avos", "Octavos", etc.
  display_name TEXT NOT NULL,                   -- "16avos de Final"
  sort_order  INT NOT NULL,
  is_open     BOOLEAN NOT NULL DEFAULT false,   -- Admin puede abrir/cerrar manualmente
  first_match_at TIMESTAMPTZ,                   -- Hora del primer partido (auto-lock)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar las 6 fases
INSERT INTO phases (name, display_name, sort_order) VALUES
  ('16avos',      '16avos de Final',  1),
  ('octavos',     'Octavos de Final', 2),
  ('cuartos',     'Cuartos de Final', 3),
  ('semifinal',   'Semifinal',        4),
  ('tercer_lugar','Tercer Lugar',     5),
  ('final',       'Final',            6);

-- ────────────────────────────────────────────────
-- 3. PARTIDOS
-- ────────────────────────────────────────────────
CREATE TABLE matches (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase_id     INT REFERENCES phases(id) ON DELETE CASCADE,
  match_number INT NOT NULL,                    -- Número de partido dentro de la fase
  home_team    TEXT NOT NULL,
  away_team    TEXT NOT NULL,
  kickoff_at   TIMESTAMPTZ NOT NULL,            -- Hora exacta de inicio
  home_score   INT,                             -- NULL = no jugado todavía
  away_score   INT,
  status       TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | finished
  api_match_id TEXT,                            -- ID en football-data.org
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_phase ON matches(phase_id);
CREATE INDEX idx_matches_kickoff ON matches(kickoff_at);
CREATE INDEX idx_matches_status ON matches(status);

-- Insertar los 16 partidos de la fase inicial (16avos)
-- Nota: las fechas exactas deben actualizarse con el calendario oficial
INSERT INTO matches (phase_id, match_number, home_team, away_team, kickoff_at, home_score, away_score, status) VALUES
  (1, 1,  'Sudáfrica',      'Canadá',          '2026-06-11 16:00:00+00', 0, 1, 'finished'),
  (1, 2,  'Alemania',       'Paraguay',         '2026-06-12 16:00:00+00', NULL, NULL, 'scheduled'),
  (1, 3,  'Francia',        'Suecia',           '2026-06-12 19:00:00+00', NULL, NULL, 'scheduled'),
  (1, 4,  'Países Bajos',   'Marruecos',        '2026-06-13 16:00:00+00', NULL, NULL, 'scheduled'),
  (1, 5,  'Portugal',       'Croacia',          '2026-06-13 19:00:00+00', NULL, NULL, 'scheduled'),
  (1, 6,  'España',         'Austria',          '2026-06-14 16:00:00+00', NULL, NULL, 'scheduled'),
  (1, 7,  'Estados Unidos', 'Bosnia H.',        '2026-06-14 19:00:00+00', NULL, NULL, 'scheduled'),
  (1, 8,  'Bélgica',        'Senegal',          '2026-06-15 16:00:00+00', NULL, NULL, 'scheduled'),
  (1, 9,  'Brasil',         'Japón',            '2026-06-15 19:00:00+00', NULL, NULL, 'scheduled'),
  (1, 10, 'C. Marfil',      'Noruega',          '2026-06-16 16:00:00+00', NULL, NULL, 'scheduled'),
  (1, 11, 'México',         'Ecuador',          '2026-06-16 19:00:00+00', NULL, NULL, 'scheduled'),
  (1, 12, 'Inglaterra',     'RD Congo',         '2026-06-17 16:00:00+00', NULL, NULL, 'scheduled'),
  (1, 13, 'Argentina',      'Cabo Verde',       '2026-06-17 19:00:00+00', NULL, NULL, 'scheduled'),
  (1, 14, 'Australia',      'Egipto',           '2026-06-18 16:00:00+00', NULL, NULL, 'scheduled'),
  (1, 15, 'Suiza',          'Argelia',          '2026-06-18 19:00:00+00', NULL, NULL, 'scheduled'),
  (1, 16, 'Colombia',       'Ghana',            '2026-06-19 16:00:00+00', NULL, NULL, 'scheduled');

-- ────────────────────────────────────────────────
-- 4. PRONÓSTICOS
-- ────────────────────────────────────────────────
CREATE TABLE predictions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id  UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_score      INT,                          -- Pronóstico local
  away_score      INT,                          -- Pronóstico visitante
  points_earned   INT,                          -- Calculado al registrar resultado: 0, 1, o 2
  entered_by_admin UUID REFERENCES participants(id),  -- NULL si lo capturó el participante mismo
  is_override     BOOLEAN DEFAULT false,        -- true = ingresado fuera de tiempo por admin
  override_reason TEXT,                         -- Razón obligatoria si is_override = true
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, match_id)
);

CREATE INDEX idx_predictions_participant ON predictions(participant_id);
CREATE INDEX idx_predictions_match ON predictions(match_id);

-- ────────────────────────────────────────────────
-- 5. TABLA DE POSICIONES (vista calculada)
-- ────────────────────────────────────────────────
-- No se guarda como tabla — se calcula como VIEW para que siempre esté actualizada

CREATE OR REPLACE VIEW ranking AS
SELECT
  p.id,
  p.name,
  p.champion_pick,
  p.is_active,
  COALESCE(SUM(pred.points_earned), 0) AS total_points,
  COUNT(CASE WHEN pred.points_earned = 2 THEN 1 END) AS exact_scores,
  COUNT(CASE WHEN pred.points_earned = 1 THEN 1 END) AS correct_results,
  COUNT(CASE WHEN pred.points_earned = 0 AND pred.home_score IS NOT NULL THEN 1 END) AS wrong_predictions,
  RANK() OVER (
    PARTITION BY p.is_active
    ORDER BY
      COALESCE(SUM(pred.points_earned), 0) DESC,
      COUNT(CASE WHEN pred.points_earned = 2 THEN 1 END) DESC
  ) AS position
FROM participants p
LEFT JOIN predictions pred ON pred.participant_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.champion_pick, p.is_active;

-- ────────────────────────────────────────────────
-- 6. BOLSA DINÁMICA (función)
-- ────────────────────────────────────────────────
-- Calcula la bolsa en tiempo real según participantes activos

CREATE OR REPLACE FUNCTION get_bolsa()
RETURNS TABLE (
  activos INT,
  bolsa_total NUMERIC,
  primer_lugar NUMERIC,
  segundo_lugar NUMERIC,
  tercer_lugar NUMERIC
) AS $$
DECLARE
  v_activos INT;
  v_bolsa NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_activos FROM participants WHERE is_active = true;
  v_bolsa := v_activos * 500;
  RETURN QUERY SELECT
    v_activos,
    v_bolsa,
    ROUND(v_bolsa * 0.60, 2),
    ROUND(v_bolsa * 0.25, 2),
    ROUND(v_bolsa * 0.15, 2);
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────
-- 7. BITÁCORA DE CAMBIOS (AUDIT LOG)
-- ────────────────────────────────────────────────
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type     TEXT NOT NULL,                -- Ver lista abajo
  performed_by    UUID REFERENCES participants(id),  -- Quien hizo el cambio
  affected_user   UUID REFERENCES participants(id),  -- A quien afecta (puede ser el mismo)
  match_id        UUID REFERENCES matches(id),
  before_value    JSONB,                        -- Estado anterior
  after_value     JSONB,                        -- Estado nuevo
  reason          TEXT,                         -- Obligatorio en overrides y desactivaciones
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos de acción válidos:
-- 'prediction_created'     → Pronóstico capturado por primera vez
-- 'prediction_updated'     → Pronóstico modificado
-- 'prediction_by_admin'    → Admin capturó pronóstico por otro participante
-- 'result_captured'        → Admin capturó resultado oficial
-- 'result_updated'         → Admin modificó resultado
-- 'points_calculated'      → Se calcularon puntos automáticamente
-- 'participant_activated'  → Admin activó participante
-- 'participant_deactivated'→ Admin desactivó participante
-- 'override_time'          → Admin ingresó pronóstico fuera de tiempo
-- 'phase_opened'           → Admin abrió fase manualmente
-- 'phase_closed'           → Admin cerró fase manualmente

CREATE INDEX idx_audit_action ON audit_log(action_type);
CREATE INDEX idx_audit_performed_by ON audit_log(performed_by);
CREATE INDEX idx_audit_affected_user ON audit_log(affected_user);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);

-- ────────────────────────────────────────────────
-- 8. FUNCIÓN: CALCULAR PUNTOS DE UN PARTIDO
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_points(
  p_match_id UUID,
  p_home_score INT,
  p_away_score INT
) RETURNS VOID AS $$
DECLARE
  v_pred RECORD;
  v_points INT;
BEGIN
  FOR v_pred IN
    SELECT * FROM predictions WHERE match_id = p_match_id
  LOOP
    IF v_pred.home_score = p_home_score AND v_pred.away_score = p_away_score THEN
      v_points := 2; -- Marcador exacto
    ELSIF
      (v_pred.home_score > v_pred.away_score AND p_home_score > p_away_score) OR
      (v_pred.home_score < v_pred.away_score AND p_home_score < p_away_score) OR
      (v_pred.home_score = v_pred.away_score AND p_home_score = p_away_score)
    THEN
      v_points := 1; -- Resultado correcto
    ELSE
      v_points := 0; -- Incorrecto
    END IF;

    UPDATE predictions
    SET points_earned = v_points, updated_at = NOW()
    WHERE id = v_pred.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────
ALTER TABLE participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;

-- Helper: obtener el participant_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_my_participant_id()
RETURNS UUID AS $$
  SELECT id FROM participants WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: saber si el usuario actual es admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM participants WHERE auth_user_id = auth.uid() LIMIT 1),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies: participants
CREATE POLICY "Ver participantes activos" ON participants
  FOR SELECT USING (is_active = true OR is_admin());

CREATE POLICY "Admin puede modificar participantes" ON participants
  FOR ALL USING (is_admin());

-- Policies: predictions
CREATE POLICY "Ver pronósticos propios siempre" ON predictions
  FOR SELECT USING (participant_id = get_my_participant_id());

-- Ver pronósticos ajenos solo si la fase ya inició
CREATE POLICY "Ver pronósticos ajenos post-inicio" ON predictions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN phases ph ON ph.id = m.phase_id
      WHERE m.id = predictions.match_id
      AND ph.first_match_at < NOW()
    )
  );

CREATE POLICY "Capturar pronostico propio" ON predictions
  FOR INSERT WITH CHECK (participant_id = get_my_participant_id());

CREATE POLICY "Modificar pronostico propio" ON predictions
  FOR UPDATE USING (participant_id = get_my_participant_id());

CREATE POLICY "Admin puede insertar/modificar cualquier pronóstico" ON predictions
  FOR ALL USING (is_admin());

-- Policies: matches y phases (lectura para todos)
CREATE POLICY "Ver partidos" ON matches FOR SELECT USING (true);
CREATE POLICY "Admin modifica partidos" ON matches FOR ALL USING (is_admin());
CREATE POLICY "Ver fases" ON phases FOR SELECT USING (true);
CREATE POLICY "Admin modifica fases" ON phases FOR ALL USING (is_admin());

-- Policies: audit_log (solo admins)
CREATE POLICY "Admin ve bitácora" ON audit_log FOR SELECT USING (is_admin());
CREATE POLICY "Sistema inserta bitácora" ON audit_log FOR INSERT WITH CHECK (true);

-- ────────────────────────────────────────────────
-- 10. TRIGGER: updated_at automático
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────
-- 11. DATOS INICIALES: LOS 18 PARTICIPANTES
-- ────────────────────────────────────────────────
INSERT INTO participants (name, is_admin, needs_proxy, champion_pick, fee_paid) VALUES
  ('ADRIAN',    false, false, 'ARGENTINA',     true),
  ('ANGEL',     false, false, 'ARGENTINA',     true),
  ('ANUAR',     false, false, 'FRANCIA',       true),
  ('CHRIS',     false, false, 'FRANCIA',       true),
  ('DON TANIS', false, true,  'BRASIL',        true),
  ('GIO',       false, false, 'PAÍSES BAJOS',  true),
  ('INGRID',    false, false, 'FRANCIA',       true),
  ('IRIS',      false, false, 'ARGENTINA',     true),
  ('JAKUB',     false, false, 'PAÍSES BAJOS',  true),
  ('LUIS',      false, false, 'FRANCIA',       true),
  ('MARCE',     false, false, 'BRASIL',        true),
  ('MARY',      false, false, 'FRANCIA',       true),
  ('MIGUEL',    false, false, 'PAÍSES BAJOS',  true),
  ('TANIA',     false, false, 'ARGENTINA',     true),
  ('UBALDO',    true,  false, 'ESPAÑA',        true),  -- Admin principal
  ('WICHO',     false, false, 'ALEMANIA',      true),
  ('TOÑO',      false, true,  'FRANCIA',       true),
  ('YAZMIN',    false, false, 'FRANCIA',       true);

-- Nota: los emails se agregan cuando el admin registra a cada participante
-- o cuando el participante hace login con Google por primera vez (se vincula por email)

-- ────────────────────────────────────────────────
-- 12. ADICIONES POST-INICIAL
-- (aplicadas durante el desarrollo, después del schema original)
-- ────────────────────────────────────────────────

-- Columnas para soporte de Tiempo Extra y Penales en matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS current_minute     INT;           -- Minuto actual (partidos en vivo)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_score_final   INT;           -- Marcador acumulado después de T.E.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_score_final   INT;           -- (solo display — no afecta quiniela)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS penalty_winner     TEXT           -- 'home' | 'away' | NULL
  CHECK (penalty_winner IN ('home', 'away'));
ALTER TABLE matches ADD COLUMN IF NOT EXISTS penalty_home_score INT;           -- Goles en tanda de penales
ALTER TABLE matches ADD COLUMN IF NOT EXISTS penalty_away_score INT;

-- ────────────────────────────────────────────────
-- 13. FUNCIÓN Y TRIGGER: RECALCULAR PUNTOS AUTOMÁTICAMENTE
-- ────────────────────────────────────────────────
-- Se dispara en cualquier UPDATE a home_score/away_score en matches.
-- Calcula puntos para TODOS los pronósticos del partido (live o finished).
-- Incluye bono de +5 si es la Final y el participante acertó al campeón.
-- NOTA: home_score/away_score = marcador a 90 min (base de la quiniela).
--       penalty_winner solo aplica para desempatar campeón en la Final.

CREATE OR REPLACE FUNCTION recalculate_match_points()
RETURNS TRIGGER AS $$
DECLARE
  v_is_final      BOOLEAN := FALSE;
  v_champion      TEXT;
  v_champion_norm TEXT;
BEGIN
  -- Solo actuar si cambiaron los scores
  IF (OLD.home_score IS DISTINCT FROM NEW.home_score) OR
     (OLD.away_score IS DISTINCT FROM NEW.away_score) THEN

    IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN

      -- Verificar si es la Final
      SELECT (ph.name = 'final' AND NEW.match_number = 1)
      INTO v_is_final
      FROM phases ph WHERE ph.id = NEW.phase_id;

      -- Determinar campeón si es la Final
      IF v_is_final THEN
        IF NEW.home_score > NEW.away_score THEN
          v_champion := NEW.home_team;
        ELSIF NEW.away_score > NEW.home_score THEN
          v_champion := NEW.away_team;
        ELSIF NEW.penalty_winner = 'home' THEN
          v_champion := NEW.home_team;
        ELSIF NEW.penalty_winner = 'away' THEN
          v_champion := NEW.away_team;
        END IF;

        IF v_champion IS NOT NULL THEN
          v_champion_norm := UPPER(TRANSLATE(v_champion,
            'áéíóúüñÁÉÍÓÚÜÑ',
            'aeiouunAEIOUUN'));
        END IF;
      END IF;

      -- Actualizar puntos con bonus campeón si aplica
      UPDATE predictions p
      SET points_earned = (
        CASE
          WHEN p.home_score = NEW.home_score AND p.away_score = NEW.away_score THEN 2
          WHEN SIGN(p.home_score - p.away_score) = SIGN(NEW.home_score - NEW.away_score) THEN 1
          ELSE 0
        END
        + CASE
          WHEN v_is_final AND v_champion_norm IS NOT NULL THEN
            CASE WHEN UPPER(TRANSLATE(COALESCE(pt.champion_pick, ''),
              'áéíóúüñÁÉÍÓÚÜÑ',
              'aeiouunAEIOUUN')) = v_champion_norm THEN 5
            ELSE 0 END
          ELSE 0
        END
      )
      FROM participants pt
      WHERE p.match_id = NEW.id
        AND pt.id = p.participant_id;

    ELSE
      -- Scores borrados: resetear puntos
      UPDATE predictions SET points_earned = NULL WHERE match_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- IMPORTANTE: usar CREATE OR REPLACE + DROP IF EXISTS para re-ejecuciones seguras
DROP TRIGGER IF EXISTS trg_recalculate_points ON matches;
CREATE TRIGGER trg_recalculate_points
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION recalculate_match_points();

-- ────────────────────────────────────────────────
-- 14. CRON JOB (configurado en Supabase Dashboard)
-- ────────────────────────────────────────────────
-- NO ejecutar este bloque como SQL — es solo documentación.
-- El cron se configura en: Supabase Dashboard → Database → Cron Jobs
--
--   Nombre:  sync-resultados-cada-5min
--   Cédula:  */5 * * * *
--   Comando:
--     SELECT net.http_post(
--       url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/sync-resultados',
--       headers := '{"Content-Type":"application/json","x-cron-secret":"quiniela2026"}'::jsonb,
--       body    := '{}'::jsonb
--     );
--
-- Reemplazar <PROJECT_REF> con el ID del proyecto Supabase.
-- La Edge Function vive en: supabase/functions/sync-resultados/index.ts

-- ────────────────────────────────────────────────
-- FIN DEL SCHEMA
-- ────────────────────────────────────────────────
-- Para ejecutar en Supabase (desde cero en un proyecto nuevo):
-- 1. Ve a tu proyecto en supabase.com
-- 2. Click en "SQL Editor" en el menú izquierdo
-- 3. Pega este archivo completo
-- 4. Click en "Run"
--
-- Para aplicar SOLO las adiciones post-iniciales (secciones 12-13)
-- en un proyecto que ya tiene el schema base:
-- Ejecuta únicamente desde la sección 12 en adelante.
-- Los ALTER TABLE tienen IF NOT EXISTS — son seguros de re-ejecutar.
-- ────────────────────────────────────────────────
