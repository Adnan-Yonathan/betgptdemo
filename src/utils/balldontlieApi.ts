/**
 * BALLDONTLIE API Client
 *
 * Official documentation: https://docs.balldontlie.io/
 *
 * Features:
 * - Clean, type-safe API methods
 * - Automatic retries with exponential backoff
 * - Rate limit handling
 * - Response caching
 * - Error logging
 * - ESPN format conversion for compatibility
 */

import type {
  BallDontLieTeam,
  BallDontLiePlayer,
  BallDontLieGame,
  BallDontLieStats,
  BallDontLieSeasonAverage,
  BallDontLieResponse,
  BallDontLieTeamsParams,
  BallDontLiePlayersParams,
  BallDontLieGamesParams,
  BallDontLieStatsParams,
  BallDontLieSeasonAveragesParams,
  BallDontLieAPIError,
  ESPNPlayerStats,
  ESPNGameData,
  BallDontLieConfig,
  DEFAULT_CONFIG,
} from '@/types/balldontlie';

import { statsCache, CacheKeys } from './statsCache';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY = import.meta.env.VITE_BALLDONTLIE_API_KEY || import.meta.env.BALLDONTLIE_API_KEY;
const BASE_URL = 'https://api.balldontlie.io/v1';
const ENABLE_CACHING = true;
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 500;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make HTTP request with retry logic
 */
async function makeRequest<T>(
  endpoint: string,
  params: Record<string, any> = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);

  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(`${key}[]`, String(v)));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  let lastError: Error | null = null;

  // Retry loop
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const startTime = Date.now();

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': API_KEY,
          'Accept': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `BALLDONTLIE API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      // Log successful request
      console.log(`[BALLDONTLIE] ${endpoint} - ${responseTime}ms`);

      return data;
    } catch (error) {
      lastError = error as Error;

      console.error(
        `[BALLDONTLIE] Attempt ${attempt}/${MAX_RETRIES} failed:`,
        error
      );

      // Don't retry on last attempt
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[BALLDONTLIE] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries failed
  throw lastError || new Error('Request failed after all retries');
}

// ============================================================================
// TEAMS API
// ============================================================================

/**
 * Get all NBA teams
 */
export async function getBallDontLieTeams(
  params: BallDontLieTeamsParams = {}
): Promise<BallDontLieTeam[]> {
  const cacheKey = CacheKeys.teams();

  // Check cache first
  if (ENABLE_CACHING) {
    const cached = statsCache.get<BallDontLieTeam[]>(cacheKey, 'teams');
    if (cached) {
      console.log('[BALLDONTLIE] Teams cache hit');
      return cached;
    }
  }

  const response = await makeRequest<BallDontLieResponse<BallDontLieTeam>>(
    '/teams',
    params
  );

  const teams = response.data;

  // Cache the result
  if (ENABLE_CACHING) {
    statsCache.set(cacheKey, teams, 'teams');
  }

  return teams;
}

// ============================================================================
// PLAYERS API
// ============================================================================

/**
 * Get players with optional search/filter
 */
export async function getBallDontLiePlayers(
  params: BallDontLiePlayersParams = {}
): Promise<BallDontLiePlayer[]> {
  const response = await makeRequest<BallDontLieResponse<BallDontLiePlayer>>(
    '/players',
    params
  );

  return response.data;
}

/**
 * Search for a player by name
 */
export async function searchBallDontLiePlayer(
  name: string
): Promise<BallDontLiePlayer | null> {
  const cacheKey = CacheKeys.playerByName(name);

  // Check cache first
  if (ENABLE_CACHING) {
    const cached = statsCache.get<BallDontLiePlayer>(cacheKey, 'players');
    if (cached) {
      console.log(`[BALLDONTLIE] Player cache hit: ${name}`);
      return cached;
    }
  }

  const players = await getBallDontLiePlayers({
    search: name,
    per_page: 10,
  });

  if (players.length === 0) {
    return null;
  }

  // Return best match (first result)
  const player = players[0];

  // Cache the result
  if (ENABLE_CACHING) {
    statsCache.set(cacheKey, player, 'players');
  }

  return player;
}

/**
 * Get player by ID
 */
export async function getBallDontLiePlayer(
  playerId: number
): Promise<BallDontLiePlayer | null> {
  const cacheKey = CacheKeys.player(playerId);

  // Check cache first
  if (ENABLE_CACHING) {
    const cached = statsCache.get<BallDontLiePlayer>(cacheKey, 'players');
    if (cached) {
      return cached;
    }
  }

  const players = await getBallDontLiePlayers({
    player_ids: [playerId],
  });

  if (players.length === 0) {
    return null;
  }

  const player = players[0];

  // Cache the result
  if (ENABLE_CACHING) {
    statsCache.set(cacheKey, player, 'players');
  }

  return player;
}

// ============================================================================
// GAMES API
// ============================================================================

/**
 * Get games with optional filters
 */
export async function getBallDontLieGames(
  params: BallDontLieGamesParams = {}
): Promise<BallDontLieGame[]> {
  const response = await makeRequest<BallDontLieResponse<BallDontLieGame>>(
    '/games',
    params
  );

  return response.data;
}

/**
 * Get games for a specific date
 */
export async function getBallDontLieGamesByDate(
  date: string
): Promise<BallDontLieGame[]> {
  const cacheKey = CacheKeys.gamesByDate(date);

  // Check cache (use games_final type assuming most queries are for past games)
  if (ENABLE_CACHING) {
    const cached = statsCache.get<BallDontLieGame[]>(cacheKey, 'games_final');
    if (cached) {
      console.log(`[BALLDONTLIE] Games cache hit: ${date}`);
      return cached;
    }
  }

  const games = await getBallDontLieGames({
    dates: [date],
    per_page: 250,
  });

  // Cache the result
  if (ENABLE_CACHING) {
    statsCache.set(cacheKey, games, 'games_final');
  }

  return games;
}

/**
 * Get today's games
 */
export async function getTodaysGames(): Promise<BallDontLieGame[]> {
  const today = new Date().toISOString().split('T')[0];
  return getBallDontLieGamesByDate(today);
}

// ============================================================================
// STATS API
// ============================================================================

/**
 * Get player stats with optional filters
 */
export async function getBallDontLieStats(
  params: BallDontLieStatsParams = {}
): Promise<BallDontLieStats[]> {
  const response = await makeRequest<BallDontLieResponse<BallDontLieStats>>(
    '/stats',
    params
  );

  return response.data;
}

/**
 * Get stats for a specific date
 */
export async function getBallDontLieStatsByDate(
  date: string
): Promise<BallDontLieStats[]> {
  const cacheKey = CacheKeys.statsByDate(date);

  // Check cache first
  if (ENABLE_CACHING) {
    const cached = statsCache.get<BallDontLieStats[]>(cacheKey, 'stats');
    if (cached) {
      console.log(`[BALLDONTLIE] Stats cache hit: ${date}`);
      return cached;
    }
  }

  const stats = await getBallDontLieStats({
    dates: [date],
    per_page: 250,
  });

  // Cache the result
  if (ENABLE_CACHING) {
    statsCache.set(cacheKey, stats, 'stats');
  }

  return stats;
}

/**
 * Get stats for a specific game
 */
export async function getBallDontLieGameStats(
  gameId: number
): Promise<BallDontLieStats[]> {
  const cacheKey = CacheKeys.stats(gameId);

  // Check cache first
  if (ENABLE_CACHING) {
    const cached = statsCache.get<BallDontLieStats[]>(cacheKey, 'stats');
    if (cached) {
      console.log(`[BALLDONTLIE] Game stats cache hit: ${gameId}`);
      return cached;
    }
  }

  const stats = await getBallDontLieStats({
    game_ids: [gameId],
    per_page: 250,
  });

  // Cache the result
  if (ENABLE_CACHING) {
    statsCache.set(cacheKey, stats, 'stats');
  }

  return stats;
}

// ============================================================================
// SEASON AVERAGES API
// ============================================================================

/**
 * Get season averages for player(s)
 */
export async function getBallDontLieSeasonAverages(
  params: BallDontLieSeasonAveragesParams
): Promise<BallDontLieSeasonAverage[]> {
  const response = await makeRequest<{ data: BallDontLieSeasonAverage[] }>(
    '/season_averages',
    params
  );

  return response.data;
}

/**
 * Get season average for a specific player
 */
export async function getBallDontLiePlayerSeasonAverage(
  playerId: number,
  season: number
): Promise<BallDontLieSeasonAverage | null> {
  const cacheKey = CacheKeys.seasonAverage(playerId, season);

  // Check cache first
  if (ENABLE_CACHING) {
    const cached = statsCache.get<BallDontLieSeasonAverage>(cacheKey, 'season_avg');
    if (cached) {
      console.log(`[BALLDONTLIE] Season avg cache hit: ${playerId} (${season})`);
      return cached;
    }
  }

  const averages = await getBallDontLieSeasonAverages({
    season,
    player_ids: [playerId],
  });

  if (averages.length === 0) {
    return null;
  }

  const average = averages[0];

  // Cache the result
  if (ENABLE_CACHING) {
    statsCache.set(cacheKey, average, 'season_avg');
  }

  return average;
}

// ============================================================================
// ESPN FORMAT CONVERSION
// ============================================================================

/**
 * Convert BALLDONTLIE stats to ESPN format for compatibility
 */
export function convertBDLToESPNFormat(
  stat: BallDontLieStats
): ESPNPlayerStats {
  return {
    name: `${stat.player.first_name} ${stat.player.last_name}`,
    team: stat.team.full_name,
    position: stat.player.position,
    stats: {
      points: stat.pts,
      rebounds: stat.reb,
      assists: stat.ast,
      steals: stat.stl,
      blocks: stat.blk,
      turnovers: stat.turnover,
      fieldGoalsMade: stat.fgm,
      fieldGoalsAttempted: stat.fga,
      threePointsMade: stat.fg3m,
      threePointsAttempted: stat.fg3a,
      freeThrowsMade: stat.ftm,
      freeThrowsAttempted: stat.fta,
      minutes: stat.min,
      plusMinus: '+0', // BALLDONTLIE doesn't provide this in basic tier
    },
    starter: false, // Can infer from minutes played if needed
  };
}

/**
 * Convert BALLDONTLIE game + stats to ESPN game data format
 */
export function convertBDLGameToESPN(
  game: BallDontLieGame,
  stats: BallDontLieStats[]
): ESPNGameData {
  // Filter stats to only include players from the home or away team
  const filteredStats = stats.filter(
    (stat) =>
      stat.team.id === game.home_team.id ||
      stat.team.id === game.visitor_team.id
  );

  return {
    event_id: String(game.id),
    game_date: game.date,
    home_team: game.home_team.full_name,
    away_team: game.visitor_team.full_name,
    home_score: game.home_team_score,
    away_score: game.visitor_team_score,
    status: game.status,
    players: filteredStats.map(convertBDLToESPNFormat),
  };
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Get all games for a date range
 */
export async function getBallDontLieGamesRange(
  startDate: string,
  endDate: string
): Promise<BallDontLieGame[]> {
  const games = await getBallDontLieGames({
    start_date: startDate,
    end_date: endDate,
    per_page: 250,
  });

  return games;
}

/**
 * Get stats for multiple players
 */
export async function getBallDontLieMultiplePlayerStats(
  playerIds: number[],
  date: string
): Promise<BallDontLieStats[]> {
  const stats = await getBallDontLieStats({
    player_ids: playerIds,
    dates: [date],
    per_page: 250,
  });

  return stats;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check if BALLDONTLIE API is accessible
 */
export async function checkBallDontLieHealth(): Promise<{
  status: 'up' | 'down';
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    await getBallDontLieTeams({ per_page: 1 });
    const responseTime = Date.now() - startTime;

    return {
      status: 'up',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      status: 'down',
      responseTime,
      error: (error as Error).message,
    };
  }
}
