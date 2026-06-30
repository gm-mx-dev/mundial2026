export type Participant = {
  id: string;
  name: string;
  email: string | null;
  auth_user_id: string | null;
  is_active: boolean;
  is_admin: boolean;
  needs_proxy: boolean;
  champion_pick: string | null;
  fee_paid: boolean;
  username: string | null;
  deactivated_reason: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Phase = {
  id: number;
  name: string;
  display_name: string;
  sort_order: number;
  is_open: boolean;
  first_match_at: string | null;
};

export type Match = {
  id: string;
  phase_id: number;
  match_number: number;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  /** Goles local en 90 min — es lo que cuenta para la quiniela y dispara el trigger */
  home_score: number | null;
  /** Goles visitante en 90 min — es lo que cuenta para la quiniela y dispara el trigger */
  away_score: number | null;
  /** Resultado final incluyendo tiempo extra (solo display) */
  home_score_final: number | null;
  /** Resultado final incluyendo tiempo extra (solo display) */
  away_score_final: number | null;
  /** Quién avanzó en penales: 'home' | 'away' | null (solo display) */
  penalty_winner: "home" | "away" | null;
  status: "scheduled" | "live" | "finished";
  api_match_id: string | null;
  current_minute: number | null;
};

export type Prediction = {
  id: string;
  participant_id: string;
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  points_earned: number | null;
  entered_by_admin: string | null;
  is_override: boolean;
  override_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  action_type: string;
  performed_by: string | null;
  affected_user: string | null;
  match_id: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
};

export type RankingRow = {
  id: string;
  name: string;
  champion_pick: string | null;
  is_active: boolean;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  wrong_predictions: number;
  position: number;
};

export type BolsaInfo = {
  activos: number;
  bolsa_total: number;
  primer_lugar: number;
  segundo_lugar: number;
  tercer_lugar: number;
};
