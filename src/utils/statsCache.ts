/**
 * Stats Cache Utility
 *
 * Implements a 3-layer caching strategy:
 * 1. Memory cache (fastest, limited size)
 * 2. Database cache (via existing tables)
 * 3. API fetch (slowest, most up-to-date)
 *
 * TTL (Time To Live) varies by data type:
 * - Teams: 24 hours (rarely changes)
 * - Players: 4 hours (trades/updates infrequent)
 * - Live games: 2 minutes (need fresh scores)
 * - Completed games: 24 hours (never changes)
 * - Stats: 15 minutes (balance freshness/API calls)
 * - Season averages: 24 hours (updates once daily)
 */

import { formatDateEST } from './dateUtils';
import type { CacheEntry, CacheType } from '@/types/balldontlie';

// ============================================================================
// CACHE TTL CONFIGURATION (in milliseconds)
// ============================================================================

export const CACHE_TTL: Record<CacheType, number> = {
  teams: 24 * 60 * 60 * 1000,        // 24 hours
  players: 4 * 60 * 60 * 1000,       // 4 hours
  games_live: 30 * 1000,             // 30 seconds (fresher live data)
  games_final: 24 * 60 * 60 * 1000,  // 24 hours
  stats: 1 * 60 * 1000,              // 1 minute (fresher stats)
  season_avg: 24 * 60 * 60 * 1000,   // 24 hours
};

// ============================================================================
// IN-MEMORY CACHE CLASS
// ============================================================================

export class StatsCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 5000; // Maximum cache entries (increased for more caching)
  private hits = 0;
  private misses = 0;

  /**
   * Set a value in the cache
   */
  set<T>(
    key: string,
    data: T,
    type: CacheType,
    source: 'balldontlie' | 'espn' | 'cache' = 'balldontlie'
  ): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * Get a value from the cache
   * Returns null if not found or expired
   */
  get<T>(key: string, type: CacheType): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const age = Date.now() - entry.timestamp;
    const ttl = CACHE_TTL[type];

    if (age > ttl) {
      // Expired - remove and return null
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data as T;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string, type: CacheType): boolean {
    return this.get(key, type) !== null;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      // Check against all possible TTLs
      const maxTTL = Math.max(...Object.values(CACHE_TTL));
      if (now - entry.timestamp > maxTTL) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Evict oldest entries to make room
   */
  private evictOldest(count: number = 100): void {
    const entries = Array.from(this.cache.entries());

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Delete oldest entries
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate.toFixed(2) + '%',
      total,
    };
  }

  /**
   * Get all keys in cache (for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry metadata
   */
  getMetadata(key: string): { timestamp: number; source: string; age: number } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    return {
      timestamp: entry.timestamp,
      source: entry.source,
      age: Date.now() - entry.timestamp,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const statsCache = new StatsCache();

// ============================================================================
// CACHE KEY GENERATORS
// ============================================================================

/**
 * Generate consistent cache keys for different data types
 */
export const CacheKeys = {
  teams: () => 'teams:all',

  player: (playerId: number) => `player:${playerId}`,

  playerByName: (name: string) => `player:name:${name.toLowerCase().replace(/\s+/g, '-')}`,

  game: (gameId: number) => `game:${gameId}`,

  gamesByDate: (date: string) => `games:date:${date}`,

  stats: (gameId: number, playerId?: number) =>
    playerId ? `stats:game:${gameId}:player:${playerId}` : `stats:game:${gameId}`,

  statsByDate: (date: string) => `stats:date:${date}`,

  seasonAverage: (playerId: number, season: number) => `season-avg:${playerId}:${season}`,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determine if a game is live or final for caching purposes
 */
export function getGameCacheType(status: string): 'games_live' | 'games_final' {
  const finalStatuses = ['final', 'completed', 'f', 'finished'];
  const isLive = !finalStatuses.some(s => status.toLowerCase().includes(s));
  return isLive ? 'games_live' : 'games_final';
}

/**
 * Format a Date object to YYYY-MM-DD for cache keys (using Eastern Time zone)
 */
export function formatDateForCache(date: Date): string {
  return formatDateEST(date);
}

/**
 * Warm up cache with common data
 */
export async function warmUpCache(fetcher: {
  teams: () => Promise<any>;
  popularPlayers: () => Promise<any>;
}) {
  try {
    // Fetch and cache teams
    const teams = await fetcher.teams();
    statsCache.set(CacheKeys.teams(), teams, 'teams');

    // Fetch and cache popular players
    const players = await fetcher.popularPlayers();
    statsCache.set('popular-players', players, 'players');

    console.log('[CACHE] Warm-up completed');
  } catch (error) {
    console.error('[CACHE] Warm-up failed:', error);
  }
}

/**
 * Periodic cleanup of expired entries
 */
export function startCacheCleanup(intervalMinutes: number = 30) {
  setInterval(() => {
    statsCache.clearExpired();
    console.log('[CACHE] Cleanup completed', statsCache.getStats());
  }, intervalMinutes * 60 * 1000);
}
