/**
 * Unified Stats Service
 *
 * Intelligent data fetching with automatic source selection and fallback:
 * - Primary: BALLDONTLIE (clean API, historical data)
 * - Fallback: ESPN (proven reliability)
 * - Caching: 3-layer strategy (memory → database → API)
 *
 * This service abstracts the data source from the rest of the application,
 * allowing components to request data without knowing where it comes from.
 */

import {
  getBallDontLieGamesByDate,
  getBallDontLieStatsByDate,
  getBallDontLieGameStats,
  getBallDontLieTeams,
  searchBallDontLiePlayer,
  getBallDontLiePlayerSeasonAverage,
  convertBDLToESPNFormat,
  convertBDLGameToESPN,
  getTodaysGames,
  checkBallDontLieHealth,
} from './balldontlieApi';

import {
  fetchESPNGameStats,
  getPlayerPerformanceHistory,
  calculatePlayerHistory,
  getTodaysGames as getESPNTodaysGames,
} from './espnApi';

import { statsCache, CacheKeys, getGameCacheType } from './statsCache';
import { getTodayEST } from './dateUtils';
import type { ESPNPlayerStats, ESPNGameData } from '@/types/balldontlie';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ENABLE_BALLDONTLIE = import.meta.env.VITE_ENABLE_BALLDONTLIE !== 'false';
const ENABLE_ESPN_FALLBACK = import.meta.env.VITE_ENABLE_ESPN_FALLBACK !== 'false';

// Feature flag for gradual rollout
const BALLDONTLIE_ROLLOUT_PERCENTAGE = parseInt(
  import.meta.env.VITE_BALLDONTLIE_ROLLOUT || '100'
);

// ============================================================================
// TYPES
// ============================================================================

export type DataSource = 'balldontlie' | 'espn' | 'cache' | 'auto';

export interface StatsServiceOptions {
  preferredSource?: DataSource;
  enableCache?: boolean;
  userId?: string;
}

export interface StatsResult<T> {
  data: T;
  source: 'balldontlie' | 'espn' | 'cache';
  cached: boolean;
  responseTime: number;
}

// ============================================================================
// FEATURE FLAG LOGIC
// ============================================================================

/**
 * Determine if user should use BALLDONTLIE based on rollout percentage
 */
function shouldUseBallDontLie(userId?: string): boolean {
  if (!ENABLE_BALLDONTLIE) return false;

  // If rollout is 100%, always use BALLDONTLIE
  if (BALLDONTLIE_ROLLOUT_PERCENTAGE >= 100) return true;

  // If rollout is 0%, never use BALLDONTLIE
  if (BALLDONTLIE_ROLLOUT_PERCENTAGE <= 0) return false;

  // Hash-based rollout for consistent user experience
  if (userId) {
    const hash = simpleHash(userId);
    return (hash % 100) < BALLDONTLIE_ROLLOUT_PERCENTAGE;
  }

  // Random rollout for anonymous users
  return Math.random() * 100 < BALLDONTLIE_ROLLOUT_PERCENTAGE;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

function logSourceError(
  source: 'balldontlie' | 'espn',
  operation: string,
  error: Error
) {
  console.error(`[${source.toUpperCase()}] ${operation} failed:`, error.message);

  // TODO: Log to database via api_source_log table
  // This will be implemented in the database migration step
}

function logSourceSuccess(
  source: 'balldontlie' | 'espn',
  operation: string,
  responseTime: number
) {
  console.log(`[${source.toUpperCase()}] ${operation} - ${responseTime}ms`);

  // TODO: Log to database via api_source_log table
}

// ============================================================================
// PLAYER STATS
// ============================================================================

/**
 * Get player stats for a specific date or game
 */
export async function getPlayerStats(params: {
  gameId?: string;
  date?: string;
  playerName?: string;
  preferredSource?: DataSource;
  userId?: string;
}): Promise<StatsResult<ESPNPlayerStats[]>> {
  const startTime = Date.now();
  const { gameId, date, playerName, preferredSource = 'auto', userId } = params;

  // Determine which source to use
  const useBallDontLie =
    preferredSource === 'balldontlie' ||
    (preferredSource === 'auto' && shouldUseBallDontLie(userId));

  // Try BALLDONTLIE first if enabled
  if (useBallDontLie) {
    try {
      let stats;

      if (gameId) {
        stats = await getBallDontLieGameStats(parseInt(gameId));
      } else if (date) {
        stats = await getBallDontLieStatsByDate(date);
      } else {
        throw new Error('Either gameId or date must be provided');
      }

      const converted = stats.map(convertBDLToESPNFormat);
      const responseTime = Date.now() - startTime;

      logSourceSuccess('balldontlie', 'getPlayerStats', responseTime);

      return {
        data: converted,
        source: 'balldontlie',
        cached: false,
        responseTime,
      };
    } catch (error) {
      logSourceError('balldontlie', 'getPlayerStats', error as Error);

      // Fall through to ESPN
      if (!ENABLE_ESPN_FALLBACK) {
        throw error;
      }
    }
  }

  // Fallback to ESPN or use ESPN as primary
  if (ENABLE_ESPN_FALLBACK || preferredSource === 'espn') {
    try {
      if (!gameId) {
        throw new Error('ESPN fallback requires gameId');
      }

      const espnData = await fetchESPNGameStats(gameId, false);
      const responseTime = Date.now() - startTime;

      if (!espnData) {
        throw new Error('ESPN returned no data');
      }

      logSourceSuccess('espn', 'getPlayerStats', responseTime);

      return {
        data: espnData.players,
        source: 'espn',
        cached: false,
        responseTime,
      };
    } catch (error) {
      logSourceError('espn', 'getPlayerStats', error as Error);
      throw error;
    }
  }

  throw new Error('All data sources failed');
}

// ============================================================================
// GAMES
// ============================================================================

/**
 * Get games for a specific date
 */
export async function getGames(params: {
  date?: string;
  sport?: string;
  preferredSource?: DataSource;
  userId?: string;
}): Promise<StatsResult<any[]>> {
  const startTime = Date.now();
  const { date, sport = 'basketball_nba', preferredSource = 'auto', userId } = params;

  const targetDate = date || getTodayEST();
  const useBallDontLie =
    preferredSource === 'balldontlie' ||
    (preferredSource === 'auto' && shouldUseBallDontLie(userId));

  // Try BALLDONTLIE first
  if (useBallDontLie) {
    try {
      const games = await getBallDontLieGamesByDate(targetDate);
      const responseTime = Date.now() - startTime;

      logSourceSuccess('balldontlie', 'getGames', responseTime);

      return {
        data: games,
        source: 'balldontlie',
        cached: false,
        responseTime,
      };
    } catch (error) {
      logSourceError('balldontlie', 'getGames', error as Error);

      if (!ENABLE_ESPN_FALLBACK) {
        throw error;
      }
    }
  }

  // Fallback to ESPN
  if (ENABLE_ESPN_FALLBACK || preferredSource === 'espn') {
    try {
      const games = await getESPNTodaysGames();
      const responseTime = Date.now() - startTime;

      logSourceSuccess('espn', 'getGames', responseTime);

      return {
        data: games,
        source: 'espn',
        cached: false,
        responseTime,
      };
    } catch (error) {
      logSourceError('espn', 'getGames', error as Error);
      throw error;
    }
  }

  throw new Error('All data sources failed');
}

// ============================================================================
// TEAMS
// ============================================================================

/**
 * Get all teams
 */
export async function getTeams(params: {
  preferredSource?: DataSource;
  userId?: string;
} = {}): Promise<StatsResult<any[]>> {
  const startTime = Date.now();
  const { preferredSource = 'auto', userId } = params;

  const useBallDontLie =
    preferredSource === 'balldontlie' ||
    (preferredSource === 'auto' && shouldUseBallDontLie(userId));

  // Try BALLDONTLIE
  if (useBallDontLie) {
    try {
      const teams = await getBallDontLieTeams();
      const responseTime = Date.now() - startTime;

      logSourceSuccess('balldontlie', 'getTeams', responseTime);

      return {
        data: teams,
        source: 'balldontlie',
        cached: false,
        responseTime,
      };
    } catch (error) {
      logSourceError('balldontlie', 'getTeams', error as Error);

      if (!ENABLE_ESPN_FALLBACK) {
        throw error;
      }
    }
  }

  // ESPN doesn't have a dedicated teams endpoint
  // Return cached data or throw error
  throw new Error('Teams data unavailable from current source');
}

// ============================================================================
// PLAYER SEARCH
// ============================================================================

/**
 * Search for a player by name
 */
export async function searchPlayer(params: {
  name: string;
  preferredSource?: DataSource;
  userId?: string;
}): Promise<StatsResult<any>> {
  const startTime = Date.now();
  const { name, preferredSource = 'auto', userId } = params;

  const useBallDontLie =
    preferredSource === 'balldontlie' ||
    (preferredSource === 'auto' && shouldUseBallDontLie(userId));

  // Try BALLDONTLIE
  if (useBallDontLie) {
    try {
      const player = await searchBallDontLiePlayer(name);
      const responseTime = Date.now() - startTime;

      if (!player) {
        throw new Error('Player not found');
      }

      logSourceSuccess('balldontlie', 'searchPlayer', responseTime);

      return {
        data: player,
        source: 'balldontlie',
        cached: false,
        responseTime,
      };
    } catch (error) {
      logSourceError('balldontlie', 'searchPlayer', error as Error);

      if (!ENABLE_ESPN_FALLBACK) {
        throw error;
      }
    }
  }

  throw new Error('Player search unavailable from current source');
}

// ============================================================================
// SEASON AVERAGES
// ============================================================================

/**
 * Get season averages for a player
 */
export async function getSeasonAverages(params: {
  playerId: number;
  season: number;
  preferredSource?: DataSource;
  userId?: string;
}): Promise<StatsResult<any>> {
  const startTime = Date.now();
  const { playerId, season, preferredSource = 'auto', userId } = params;

  const useBallDontLie =
    preferredSource === 'balldontlie' ||
    (preferredSource === 'auto' && shouldUseBallDontLie(userId));

  // Try BALLDONTLIE
  if (useBallDontLie) {
    try {
      const average = await getBallDontLiePlayerSeasonAverage(playerId, season);
      const responseTime = Date.now() - startTime;

      if (!average) {
        throw new Error('Season averages not found');
      }

      logSourceSuccess('balldontlie', 'getSeasonAverages', responseTime);

      return {
        data: average,
        source: 'balldontlie',
        cached: false,
        responseTime,
      };
    } catch (error) {
      logSourceError('balldontlie', 'getSeasonAverages', error as Error);

      if (!ENABLE_ESPN_FALLBACK) {
        throw error;
      }
    }
  }

  // ESPN doesn't have built-in season averages
  // Would need to calculate from historical data
  throw new Error('Season averages unavailable from current source');
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check health of all data sources
 */
export async function checkDataSourcesHealth(): Promise<{
  balldontlie: { status: 'up' | 'down'; responseTime: number; error?: string };
  espn: { status: 'up' | 'down'; responseTime: number; error?: string };
}> {
  const [balldontlieHealth, espnHealth] = await Promise.allSettled([
    checkBallDontLieHealth(),
    checkESPNHealth(),
  ]);

  return {
    balldontlie:
      balldontlieHealth.status === 'fulfilled'
        ? balldontlieHealth.value
        : { status: 'down', responseTime: 0, error: 'Check failed' },
    espn:
      espnHealth.status === 'fulfilled'
        ? espnHealth.value
        : { status: 'down', responseTime: 0, error: 'Check failed' },
  };
}

async function checkESPNHealth(): Promise<{
  status: 'up' | 'down';
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Try to fetch today's games
    await getESPNTodaysGames();
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

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  statsCache.clear();
  console.log('[CACHE] All caches cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return statsCache.getStats();
}
