import { supabase } from '@/lib/supabaseClient';

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

export interface PlayerHistory {
  seasonAvg: number;
  last5Avg: number;
  last10Avg: number;
  vsOpponentAvg: number;
  homeAwaySplit: number;
  trend: 'improving' | 'declining' | 'neutral';
  consistency: number;
  sampleSize: number;
}

/**
 * Fetches player statistics from ESPN for a specific game
 * @param eventId - ESPN event ID (game ID)
 * @param storeData - Whether to store the data in the database
 * @returns Promise with game data including player statistics
 */
export async function fetchESPNGameStats(
  eventId: string,
  storeData: boolean = true
): Promise<ESPNGameData | null> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-espn-stats', {
      body: {
        event_id: eventId,
        store_data: storeData,
      },
    });

    if (error) {
      console.error('Error fetching ESPN stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception fetching ESPN stats:', error);
    return null;
  }
}

/**
 * Syncs player stats for today's NBA games from ESPN
 * @param completedOnly - Only sync completed games
 * @param specificEventIds - Optionally specify specific event IDs to sync
 * @returns Promise with sync results
 */
export async function syncESPNPlayerStats(
  completedOnly: boolean = false,
  specificEventIds?: string[]
): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke('sync-espn-player-stats', {
      body: {
        sync_completed_only: completedOnly,
        specific_event_ids: specificEventIds || null,
      },
    });

    if (error) {
      console.error('Error syncing ESPN stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception syncing ESPN stats:', error);
    return null;
  }
}

/**
 * Fetches player performance history from the database
 * @param playerName - Name of the player
 * @param limit - Number of games to fetch
 * @returns Promise with player performance history
 */
export async function getPlayerPerformanceHistory(
  playerName: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('player_performance_history')
      .select('*')
      .eq('player_name', playerName)
      .order('game_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching player history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching player history:', error);
    return [];
  }
}

/**
 * Calculates player statistics and trends from historical data
 * @param playerName - Name of the player
 * @param propType - Type of prop (points, rebounds, assists, etc.)
 * @param opponent - Opponent team name (optional)
 * @returns Promise with calculated player history statistics
 */
export async function calculatePlayerHistory(
  playerName: string,
  propType: string,
  opponent?: string
): Promise<PlayerHistory> {
  const history = await getPlayerPerformanceHistory(playerName, 30);

  if (history.length === 0) {
    return {
      seasonAvg: 0,
      last5Avg: 0,
      last10Avg: 0,
      vsOpponentAvg: 0,
      homeAwaySplit: 1.0,
      trend: 'neutral',
      sampleSize: 0,
      consistency: 0,
    };
  }

  // Get stat key mapping
  const statKey = getStatKey(propType);

  // Extract values
  const values = history
    .map((game: any) => game.stats?.[statKey] || 0)
    .filter((v: number) => v > 0);

  if (values.length === 0) {
    return {
      seasonAvg: 0,
      last5Avg: 0,
      last10Avg: 0,
      vsOpponentAvg: 0,
      homeAwaySplit: 1.0,
      trend: 'neutral',
      sampleSize: 0,
      consistency: 0,
    };
  }

  // Calculate averages
  const seasonAvg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
  const last5Avg =
    values.slice(0, 5).reduce((a: number, b: number) => a + b, 0) / Math.min(5, values.length);
  const last10Avg =
    values.slice(0, 10).reduce((a: number, b: number) => a + b, 0) / Math.min(10, values.length);

  // Calculate vs opponent average
  let vsOpponentAvg = seasonAvg;
  if (opponent) {
    const vsOpponentGames = history.filter((game: any) => game.opponent === opponent);
    if (vsOpponentGames.length > 0) {
      const opponentValues = vsOpponentGames
        .map((game: any) => game.stats?.[statKey] || 0)
        .filter((v: number) => v > 0);
      vsOpponentAvg =
        opponentValues.reduce((a: number, b: number) => a + b, 0) / opponentValues.length;
    }
  }

  // Calculate home/away split
  let homeAwaySplit = 1.0;
  const homeGames = history.filter((game: any) => game.home_away === 'home');
  const awayGames = history.filter((game: any) => game.home_away === 'away');

  if (homeGames.length > 0 && awayGames.length > 0) {
    const homeValues = homeGames
      .map((game: any) => game.stats?.[statKey] || 0)
      .filter((v: number) => v > 0);
    const awayValues = awayGames
      .map((game: any) => game.stats?.[statKey] || 0)
      .filter((v: number) => v > 0);

    if (homeValues.length > 0 && awayValues.length > 0) {
      const homeAvg = homeValues.reduce((a: number, b: number) => a + b, 0) / homeValues.length;
      const awayAvg = awayValues.reduce((a: number, b: number) => a + b, 0) / awayValues.length;
      homeAwaySplit = awayAvg > 0 ? homeAvg / awayAvg : 1.0;
    }
  }

  // Calculate trend
  const trend: 'improving' | 'declining' | 'neutral' =
    last5Avg > seasonAvg * 1.1 ? 'improving' : last5Avg < seasonAvg * 0.9 ? 'declining' : 'neutral';

  // Calculate consistency
  const variance =
    values.reduce((sum: number, val: number) => sum + Math.pow(val - seasonAvg, 2), 0) /
    values.length;
  const consistency = seasonAvg > 0 ? 1 - Math.min(Math.sqrt(variance) / seasonAvg, 1) : 0;

  return {
    seasonAvg,
    last5Avg,
    last10Avg,
    vsOpponentAvg,
    homeAwaySplit,
    trend,
    sampleSize: values.length,
    consistency: Math.round(consistency * 100) / 100,
  };
}

/**
 * Maps prop type to stat key in database
 */
function getStatKey(propType: string): string {
  const mapping: { [key: string]: string } = {
    points: 'points',
    rebounds: 'rebounds',
    assists: 'assists',
    steals: 'steals',
    blocks: 'blocks',
    turnovers: 'turnovers',
    passing_yards: 'passingYards',
    rushing_yards: 'rushingYards',
    receiving_yards: 'receivingYards',
    touchdowns: 'touchdowns',
    hits: 'hits',
    strikeouts: 'strikeouts',
  };

  return mapping[propType] || propType;
}

/**
 * Fetches player prop predictions from the database
 * @param eventId - Event ID (optional)
 * @param playerName - Player name (optional)
 * @returns Promise with player prop predictions
 */
export async function getPlayerPropPredictions(
  eventId?: string,
  playerName?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from('player_prop_predictions')
      .select('*')
      .order('edge_percentage', { ascending: false });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    if (playerName) {
      query = query.eq('player_name', playerName);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching prop predictions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching prop predictions:', error);
    return [];
  }
}

/**
 * Gets today's NBA scoreboard from ESPN
 * Note: This would typically call the ESPN scoreboard API
 * For now, it queries stored games from the database
 */
export async function getTodaysGames(): Promise<any[]> {
  try {
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const { data, error } = await supabase
      .from('sports_scores')
      .select('*')
      .gte('game_date', todayStart)
      .lte('game_date', todayEnd)
      .eq('sport', 'basketball')
      .eq('league', 'NBA')
      .order('game_date', { ascending: true });

    if (error) {
      console.error('Error fetching today\'s games:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching today\'s games:', error);
    return [];
  }
}
