/**
 * TypeScript type definitions for BALLDONTLIE API
 * API Documentation: https://docs.balldontlie.io/
 */

// ============================================================================
// TEAMS
// ============================================================================

export interface BallDontLieTeam {
  id: number;
  conference: string;
  division: string;
  city: string;
  name: string;
  full_name: string;
  abbreviation: string;
}

// ============================================================================
// PLAYERS
// ============================================================================

export interface BallDontLiePlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  college: string;
  country: string;
  draft_year: number | null;
  draft_round: number | null;
  draft_number: number | null;
  team: BallDontLieTeam;
}

// ============================================================================
// GAMES
// ============================================================================

export interface BallDontLieGame {
  id: number;
  date: string;
  season: number;
  status: string;
  period: number;
  time: string;
  postseason: boolean;
  home_team_score: number;
  visitor_team_score: number;
  home_team: BallDontLieTeam;
  visitor_team: BallDontLieTeam;
}

// ============================================================================
// STATS
// ============================================================================

export interface BallDontLieStats {
  id: number;
  min: string;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  pf: number;
  pts: number;
  player: BallDontLiePlayer;
  team: BallDontLieTeam;
  game: BallDontLieGame;
}

// ============================================================================
// SEASON AVERAGES
// ============================================================================

export interface BallDontLieSeasonAverage {
  season: number;
  player_id: number;
  games_played: number;
  min: string;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  pf: number;
  pts: number;
}

// ============================================================================
// API RESPONSE WRAPPERS
// ============================================================================

export interface BallDontLieMeta {
  next_cursor?: number;
  per_page: number;
}

export interface BallDontLieResponse<T> {
  data: T[];
  meta: BallDontLieMeta;
}

// ============================================================================
// REQUEST PARAMETERS
// ============================================================================

export interface BallDontLieTeamsParams {
  cursor?: number;
  per_page?: number;
}

export interface BallDontLiePlayersParams {
  cursor?: number;
  per_page?: number;
  search?: string;
  first_name?: string;
  last_name?: string;
  team_ids?: number[];
  player_ids?: number[];
}

export interface BallDontLieGamesParams {
  cursor?: number;
  per_page?: number;
  dates?: string[];
  seasons?: number[];
  team_ids?: number[];
  postseason?: boolean;
  start_date?: string;
  end_date?: string;
}

export interface BallDontLieStatsParams {
  cursor?: number;
  per_page?: number;
  dates?: string[];
  seasons?: number[];
  player_ids?: number[];
  game_ids?: number[];
  postseason?: boolean;
  start_date?: string;
  end_date?: string;
}

export interface BallDontLieSeasonAveragesParams {
  season: number;
  player_ids: number[];
}

// ============================================================================
// CONVERSION HELPERS (ESPN Format Compatibility)
// ============================================================================

export interface ESPNPlayerStats {
  name: string;
  team: string;
  position: string;
  stats: {
    points?: number;
    rebounds?: number;
    assists?: number;
    steals?: number;
    blocks?: number;
    turnovers?: number;
    fieldGoalsMade?: number;
    fieldGoalsAttempted?: number;
    threePointsMade?: number;
    threePointsAttempted?: number;
    freeThrowsMade?: number;
    freeThrowsAttempted?: number;
    minutes?: string;
    plusMinus?: string;
  };
  starter: boolean;
}

export interface ESPNGameData {
  event_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  players: ESPNPlayerStats[];
}

// ============================================================================
// API ERROR TYPES
// ============================================================================

export interface BallDontLieError {
  message: string;
  status: number;
  statusText: string;
}

export class BallDontLieAPIError extends Error {
  status: number;
  statusText: string;

  constructor(message: string, status: number, statusText: string) {
    super(message);
    this.name = 'BallDontLieAPIError';
    this.status = status;
    this.statusText = statusText;
  }
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  source: 'balldontlie' | 'espn' | 'cache';
}

export type CacheType = 'teams' | 'players' | 'games_live' | 'games_final' | 'stats' | 'season_avg';

// ============================================================================
// API CLIENT CONFIG
// ============================================================================

export interface BallDontLieConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export const DEFAULT_CONFIG: Partial<BallDontLieConfig> = {
  baseUrl: 'https://api.balldontlie.io/v1',
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
};
