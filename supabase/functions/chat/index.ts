import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PERFORMANCE FIX: Singleton Supabase client to avoid repeated initialization overhead
let _supabaseClient: any = null;
function getSupabaseClient() {
  if (!_supabaseClient) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    _supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    console.log("[PERF] Supabase client initialized");
  }
  return _supabaseClient;
}

/**
 * EST TIMEZONE HELPERS
 * All date calculations use America/New_York timezone (Eastern Time)
 * This ensures consistent behavior regardless of server timezone
 */

/**
 * Gets the current date/time in Eastern Time
 */
function getNowInEST(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * Gets midnight (start of day) today in Eastern Time
 */
function getTodayStartEST(): Date {
  const nowEST = getNowInEST();
  return new Date(nowEST.getFullYear(), nowEST.getMonth(), nowEST.getDate());
}

/**
 * Gets end of day tomorrow in Eastern Time (23:59:59)
 */
function getTomorrowEndEST(): Date {
  const todayStart = getTodayStartEST();
  const tomorrowEnd = new Date(todayStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 2); // Start of day after tomorrow
  tomorrowEnd.setMilliseconds(-1); // End of tomorrow
  return tomorrowEnd;
}

/**
 * EMERGENCY FIX: Timeout wrapper to prevent first message from hanging
 * Wraps a promise with a timeout to ensure responses even if external APIs are slow
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds (default 3000ms = 3s)
 * @param fallbackValue - Value to return on timeout
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 3000,
  fallbackValue: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        console.warn(`[TIMEOUT] Operation timed out after ${timeoutMs}ms, using fallback`);
        resolve(fallbackValue);
      }, timeoutMs);
    })
  ]);
}

/**
 * Intelligently determines if the user's query requires advanced or basic analysis
 * Advanced mode: For users asking for statistical analysis, EV calculations, Kelly Criterion, etc.
 * Basic mode: For casual bettors asking for simple picks and straightforward advice
 */
function detectBettingMode(messages: any[]): 'basic' | 'advanced' {
  // Get the last few messages to understand context (up to last 3 messages)
  const recentMessages = messages.slice(-3);
  const combinedText = recentMessages
    .map(msg => msg.content || '')
    .join(' ')
    .toLowerCase();

  // Advanced mode indicators - technical and statistical terms
  const advancedIndicators = [
    // Expected Value related
    'expected value', 'ev', '+ev', '-ev', 'positive ev', 'negative ev',

    // Kelly Criterion and bet sizing
    'kelly', 'kelly criterion', 'optimal bet size', 'fractional kelly',

    // Statistical analysis
    'confidence interval', 'probability distribution', 'variance', 'standard deviation',
    'correlation', 'correlation matrix', 'statistical model', 'regression',

    // Sharp betting terms
    'sharp money', 'sharp action', 'clv', 'closing line value', 'line movement',
    'reverse line movement', 'steam move', 'market efficiency',

    // Advanced strategy
    'hedge', 'hedging', 'arbitrage', 'middle', 'correlation penalty',
    'parlay correlation', 'vig calculation', 'true odds', 'implied probability',

    // Technical analysis requests
    'show me the math', 'calculate the', 'what are the odds', 'win probability',
    'edge calculation', 'what is my edge', 'quantify', 'statistical edge',

    // Advanced mode explicit requests
    'advanced analysis', 'detailed stats', 'statistical breakdown',
    'give me the numbers', 'run the numbers', 'crunch the numbers',

    // Professional terminology
    'roi', 'return on investment', 'bankroll management formula',
    'risk of ruin', 'drawdown', 'profit expectation'
  ];

  // Basic mode indicators - casual language
  const basicIndicators = [
    'simple', 'easy', 'casual', 'beginner', 'just starting',
    'quick pick', 'straightforward', 'without the math',
    'in simple terms', 'layman', 'explain like',
    'easy to understand', 'basic analysis'
  ];

  // Check for advanced indicators
  let advancedScore = 0;
  for (const indicator of advancedIndicators) {
    if (combinedText.includes(indicator)) {
      advancedScore += 1;
      // Some terms are stronger indicators
      if (indicator === 'kelly' || indicator === 'expected value' || indicator === 'ev' ||
          indicator === 'sharp money' || indicator === 'hedge') {
        advancedScore += 2; // Extra weight for key terms
      }
    }
  }

  // Check for basic indicators
  let basicScore = 0;
  for (const indicator of basicIndicators) {
    if (combinedText.includes(indicator)) {
      basicScore += 2; // Weight basic requests heavily
    }
  }

  // Question complexity analysis
  const hasMultipleQuestions = (combinedText.match(/\?/g) || []).length > 2;
  const isVeryLong = combinedText.length > 500; // Long, detailed questions suggest advanced
  const hasMathSymbols = /[%$+\-*/=]/.test(combinedText);

  if (isVeryLong && hasMathSymbols) {
    advancedScore += 1;
  }

  // Specific question patterns that indicate advanced mode
  const advancedQuestionPatterns = [
    /what('s| is) the (expected value|ev|edge)/i,
    /how much should i bet/i,  // Kelly criterion question
    /calculate/i,
    /probability of/i,
    /what are my odds/i,
    /statistical/i,
    /quantitative/i
  ];

  for (const pattern of advancedQuestionPatterns) {
    if (pattern.test(combinedText)) {
      advancedScore += 1;
    }
  }

  console.log(`[MODE DETECTION] Advanced score: ${advancedScore}, Basic score: ${basicScore}`);

  // Decision logic:
  // - If basic indicators are present, strongly prefer basic mode
  // - If 2+ advanced indicators, use advanced mode
  // - Otherwise default to basic mode for casual users

  if (basicScore > 0) {
    console.log(`[MODE DETECTION] Basic mode selected (explicit basic request)`);
    return 'basic';
  }

  if (advancedScore >= 2) {
    console.log(`[MODE DETECTION] Advanced mode selected (score: ${advancedScore})`);
    return 'advanced';
  }

  console.log(`[MODE DETECTION] Basic mode selected (default for casual betting)`);
  return 'basic';
}

async function fetchLineupData(query: string): Promise<string> {
  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = getSupabaseClient();

  console.log("Fetching lineup data for query:", query);

  // Determine league from query
  let league = 'NFL';
  const queryLower = query.toLowerCase();

  if (queryLower.includes('nba') || queryLower.includes('basketball')) {
    league = 'NBA';
  } else if (queryLower.includes('ncaaf') || queryLower.includes('college football') ||
             queryLower.includes('ncaa football') || queryLower.includes('cfb')) {
    league = 'NCAAF';
  } else if (queryLower.includes('mlb') || queryLower.includes('baseball')) {
    league = 'MLB';
  } else if (queryLower.includes('nhl') || queryLower.includes('hockey')) {
    league = 'NHL';
  } else if (queryLower.includes('nfl') || queryLower.includes('football')) {
    league = 'NFL';
  }

  try {
    // Calculate date range for today + tomorrow in EST
    const todayStart = getTodayStartEST();
    const tomorrowEnd = getTomorrowEndEST();

    console.log(`[DATE FILTER] Fetching lineups from ${todayStart.toISOString()} to ${tomorrowEnd.toISOString()} (EST)`);

    // EMERGENCY FIX: Stale-While-Revalidate caching strategy
    // Check for any cached lineups
    const { data: cachedLineups, error: cacheError } = await supabase
      .from('starting_lineups')
      .select('*')
      .eq('league', league)
      .gte('game_date', todayStart.toISOString())
      .lte('game_date', tomorrowEnd.toISOString())
      .order('last_updated', { ascending: false });

    if (cacheError) {
      console.error('Database query error:', cacheError);
    }

    // Calculate cache age
    const cacheAge = cachedLineups && cachedLineups.length > 0
      ? Date.now() - new Date(cachedLineups[0].last_updated).getTime()
      : Infinity;
    const cacheAgeMinutes = cacheAge / (60 * 1000);

    console.log(`[CACHE] Lineup cache age: ${cacheAgeMinutes.toFixed(1)} minutes`);

    // If cache is fresh (< 5 minutes), use it immediately
    if (cacheAge < 5 * 60 * 1000 && cachedLineups && cachedLineups.length > 0) {
      console.log(`[CACHE HIT] Using fresh cached lineups`);
      return formatLineupsData(cachedLineups, query);
    }

    // If cache is acceptable (5-60 minutes), use it
    if (cacheAge < 60 * 60 * 1000 && cachedLineups && cachedLineups.length > 0) {
      console.log(`[CACHE STALE] Using slightly stale cached lineups (${cacheAgeMinutes.toFixed(1)} min old)`);
      return formatLineupsData(cachedLineups, query);
    }

    // Cache is old or missing, try to fetch fresh data WITH TIMEOUT
    console.log('[FETCH] Cache too old or missing, attempting fresh lineup fetch with timeout...');

    const fetchFreshLineups = async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/scrape-lineups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ league, query }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch lineups: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[FETCH] Fetched ${result.count} fresh lineups`);
      return result.lineups || [];
    };

    // Try to fetch with 3-second timeout
    const freshLineups = await withTimeout(
      fetchFreshLineups(),
      3000,
      cachedLineups || [] // Fall back to stale cache if timeout
    );

    if (freshLineups.length > 0) {
      return formatLineupsData(freshLineups, query);
    }

    // No data available
    return "No lineup information found. Lineups may not be confirmed yet or data is temporarily unavailable.";

  } catch (error) {
    console.error("[ERROR] Error fetching lineups:", error);
    // Fallback: try to use any cached data
    const todayStart = getTodayStartEST();
    const tomorrowEnd = getTomorrowEndEST();
    const { data: fallbackLineups } = await supabase
      .from('starting_lineups')
      .select('*')
      .eq('league', league)
      .gte('game_date', todayStart.toISOString())
      .lte('game_date', tomorrowEnd.toISOString())
      .order('last_updated', { ascending: false });

    if (fallbackLineups && fallbackLineups.length > 0) {
      console.log('[FALLBACK] Using cached lineups after error');
      return formatLineupsData(fallbackLineups, query);
    }

    return "Unable to fetch lineup information at the moment. Please try again shortly.";
  } finally {
    console.log(`[PERF] fetchLineupData took ${Date.now() - startTime}ms`);
  }
}

function formatLineupsData(lineups: any[], query: string): string {
  if (!lineups || lineups.length === 0) {
    return "No lineup information found. Lineups may not be confirmed yet.";
  }

  let result = `STARTING LINEUP DATA:\n\n`;

  for (const lineup of lineups) {
    result += `${lineup.team}\n`;
    result += `League: ${lineup.league}\n`;
    result += `Game Date: ${new Date(lineup.game_date).toLocaleString()}\n`;
    result += `Lineup Quality Score: ${lineup.lineup_quality_score || 'N/A'}/100\n`;

    if (lineup.starters && lineup.starters.length > 0) {
      result += `\nSTARTERS:\n`;
      lineup.starters.forEach((player: any, index: number) => {
        result += `  ${index + 1}. ${player.name} - ${player.position}`;
        if (player.jersey_number) result += ` (#${player.jersey_number})`;
        if (player.status) result += ` - ${player.status}`;
        result += '\n';
      });
    }

    if (lineup.injured && lineup.injured.length > 0) {
      result += `\nINJURIES:\n`;
      lineup.injured.forEach((injury: any) => {
        result += `  ⚠️ ${injury.name} (${injury.position}) - ${injury.injury_status}`;
        if (injury.injury_type) result += ` - ${injury.injury_type}`;
        if (injury.impact_level) result += ` [Impact: ${injury.impact_level}]`;
        result += '\n';
      });
    }

    if (lineup.key_absences && lineup.key_absences.length > 0) {
      result += `\nKEY ABSENCES: ${lineup.key_absences.join(', ')}\n`;
    }

    if (lineup.lineup_changes_from_previous && lineup.lineup_changes_from_previous.length > 0) {
      result += `\nLINEUP CHANGES: ${lineup.lineup_changes_from_previous.join(', ')}\n`;
    }

    if (lineup.formation) {
      result += `Formation: ${lineup.formation}\n`;
    }

    result += `Data Quality: ${lineup.data_quality}\n`;
    result += '\n---\n\n';
  }

  return result;
}

async function fetchMatchupData(query: string): Promise<string> {
  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = getSupabaseClient();

  console.log("Fetching matchup analysis for query:", query);

  // Determine league from query
  let league = 'NFL';
  const queryLower = query.toLowerCase();

  if (queryLower.includes('nba') || queryLower.includes('basketball')) {
    league = 'NBA';
  } else if (queryLower.includes('ncaaf') || queryLower.includes('college football') ||
             queryLower.includes('ncaa football') || queryLower.includes('cfb')) {
    league = 'NCAAF';
  } else if (queryLower.includes('mlb') || queryLower.includes('baseball')) {
    league = 'MLB';
  } else if (queryLower.includes('nhl') || queryLower.includes('hockey')) {
    league = 'NHL';
  } else if (queryLower.includes('nfl') || queryLower.includes('football')) {
    league = 'NFL';
  }

  try {
    // Calculate date range for today + tomorrow in EST
    const todayStart = getTodayStartEST();
    const tomorrowEnd = getTomorrowEndEST();

    console.log(`[DATE FILTER] Fetching matchups from ${todayStart.toISOString()} to ${tomorrowEnd.toISOString()} (EST)`);

    // EMERGENCY FIX: Stale-While-Revalidate caching strategy
    // Check for any cached matchup data
    const { data: cachedMatchups, error: cacheError } = await supabase
      .from('matchup_analysis')
      .select('*')
      .eq('league', league)
      .gte('game_date', todayStart.toISOString())
      .lte('game_date', tomorrowEnd.toISOString())
      .order('last_updated', { ascending: false });

    if (cacheError) {
      console.error('Database query error:', cacheError);
    }

    // Calculate cache age
    const cacheAge = cachedMatchups && cachedMatchups.length > 0
      ? Date.now() - new Date(cachedMatchups[0].last_updated).getTime()
      : Infinity;
    const cacheAgeMinutes = cacheAge / (60 * 1000);

    console.log(`[CACHE] Matchup cache age: ${cacheAgeMinutes.toFixed(1)} minutes`);

    // If cache is fresh (< 5 minutes), use it immediately
    if (cacheAge < 5 * 60 * 1000 && cachedMatchups && cachedMatchups.length > 0) {
      console.log(`[CACHE HIT] Using fresh cached matchups`);
      return formatMatchupData(cachedMatchups, query);
    }

    // If cache is acceptable (5-60 minutes), use it
    if (cacheAge < 60 * 60 * 1000 && cachedMatchups && cachedMatchups.length > 0) {
      console.log(`[CACHE STALE] Using slightly stale cached matchups (${cacheAgeMinutes.toFixed(1)} min old)`);
      return formatMatchupData(cachedMatchups, query);
    }

    // Cache is old or missing, try to fetch fresh data WITH TIMEOUT
    console.log('[FETCH] Cache too old or missing, attempting fresh matchup fetch with timeout...');

    const fetchFreshMatchups = async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/scrape-matchups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ league, query }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch matchup analysis: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[FETCH] Fetched ${result.count} fresh matchup analyses`);
      return result.matchups || [];
    };

    // Try to fetch with 3-second timeout
    const freshMatchups = await withTimeout(
      fetchFreshMatchups(),
      3000,
      cachedMatchups || [] // Fall back to stale cache if timeout
    );

    if (freshMatchups.length > 0) {
      return formatMatchupData(freshMatchups, query);
    }

    // No data available
    return "No matchup analysis found for this query or data is temporarily unavailable.";

  } catch (error) {
    console.error("[ERROR] Error fetching matchup data:", error);
    // Fallback: try to use any cached data
    const todayStart = getTodayStartEST();
    const tomorrowEnd = getTomorrowEndEST();
    const { data: fallbackMatchups } = await supabase
      .from('matchup_analysis')
      .select('*')
      .eq('league', league)
      .gte('game_date', todayStart.toISOString())
      .lte('game_date', tomorrowEnd.toISOString())
      .order('last_updated', { ascending: false });

    if (fallbackMatchups && fallbackMatchups.length > 0) {
      console.log('[FALLBACK] Using cached matchups after error');
      return formatMatchupData(fallbackMatchups, query);
    }

    return "Unable to fetch matchup analysis at the moment. Please try again shortly.";
  } finally {
    console.log(`[PERF] fetchMatchupData took ${Date.now() - startTime}ms`);
  }
}

function formatMatchupData(matchups: any[], query: string): string {
  if (!matchups || matchups.length === 0) {
    return "No matchup analysis found for this query.";
  }

  let result = `MATCHUP ANALYSIS DATA:\n\n`;

  for (const matchup of matchups) {
    result += `${matchup.home_team} vs ${matchup.away_team}\n`;
    result += `League: ${matchup.league}\n`;
    result += `Game Date: ${new Date(matchup.game_date).toLocaleString()}\n\n`;

    if (matchup.h2h_history) {
      const h2h = matchup.h2h_history;
      result += `HEAD-TO-HEAD:\n`;
      result += `  Total Games: ${h2h.total_games || 'N/A'}\n`;
      result += `  ${matchup.home_team} Wins: ${h2h.home_team_wins || 'N/A'}\n`;
      result += `  ${matchup.away_team} Wins: ${h2h.away_team_wins || 'N/A'}\n`;
      if (h2h.home_team_ats) result += `  ${matchup.home_team} ATS: ${h2h.home_team_ats}\n`;
      if (h2h.over_under) result += `  Over/Under: ${h2h.over_under}\n`;
      result += '\n';
    }

    if (matchup.home_team_recent_form) {
      const form = matchup.home_team_recent_form;
      result += `${matchup.home_team} RECENT FORM:\n`;
      if (form.last_10_record) result += `  Last 10: ${form.last_10_record}\n`;
      if (form.current_streak) result += `  Current Streak: ${form.current_streak}\n`;
      if (form.avg_points_scored) result += `  Avg Points Scored: ${form.avg_points_scored}\n`;
      if (form.avg_points_allowed) result += `  Avg Points Allowed: ${form.avg_points_allowed}\n`;
      result += '\n';
    }

    if (matchup.away_team_recent_form) {
      const form = matchup.away_team_recent_form;
      result += `${matchup.away_team} RECENT FORM:\n`;
      if (form.last_10_record) result += `  Last 10: ${form.last_10_record}\n`;
      if (form.current_streak) result += `  Current Streak: ${form.current_streak}\n`;
      if (form.avg_points_scored) result += `  Avg Points Scored: ${form.avg_points_scored}\n`;
      if (form.avg_points_allowed) result += `  Avg Points Allowed: ${form.avg_points_allowed}\n`;
      result += '\n';
    }

    if (matchup.statistical_edges) {
      result += `STATISTICAL EDGES:\n`;
      Object.entries(matchup.statistical_edges).forEach(([key, value]) => {
        result += `  ${key}: ${value}\n`;
      });
      result += '\n';
    }

    if (matchup.betting_trends) {
      result += `BETTING TRENDS:\n`;
      const trends = matchup.betting_trends;
      if (trends.sharp_money) result += `  Sharp Money: ${trends.sharp_money}\n`;
      if (trends.public_money) result += `  Public Money: ${trends.public_money}\n`;
      if (trends.line_movement) result += `  Line Movement: ${trends.line_movement}\n`;
      result += '\n';
    }

    if (matchup.situational_trends && matchup.situational_trends.length > 0) {
      result += `SITUATIONAL TRENDS:\n`;
      matchup.situational_trends.forEach((trend: string) => {
        result += `  - ${trend}\n`;
      });
      result += '\n';
    }

    if (matchup.ai_prediction) {
      const pred = matchup.ai_prediction;
      result += `AI PREDICTION:\n`;
      if (pred.predicted_winner) result += `  Predicted Winner: ${pred.predicted_winner}\n`;
      if (pred.confidence) result += `  Confidence: ${pred.confidence}%\n`;
      if (pred.key_factors && pred.key_factors.length > 0) {
        result += `  Key Factors:\n`;
        pred.key_factors.forEach((factor: string) => {
          result += `    - ${factor}\n`;
        });
      }
      result += '\n';
    }

    if (matchup.tactical_analysis) {
      result += `TACTICAL ANALYSIS:\n${matchup.tactical_analysis}\n\n`;
    }

    result += '---\n\n';
  }

  return result;
}

async function fetchLiveScores(query: string): Promise<string> {
  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
  const supabase = getSupabaseClient();

  console.log("Fetching live scores for query:", query);

  // Determine league from query
  let league = 'NFL'; // default
  const queryLower = query.toLowerCase();

  if (queryLower.includes('nba') || queryLower.includes('basketball')) {
    league = 'NBA';
  } else if (queryLower.includes('ncaaf') || queryLower.includes('college football') ||
             queryLower.includes('ncaa football') || queryLower.includes('cfb')) {
    league = 'NCAAF';
  } else if (queryLower.includes('mlb') || queryLower.includes('baseball')) {
    league = 'MLB';
  } else if (queryLower.includes('nhl') || queryLower.includes('hockey')) {
    league = 'NHL';
  } else if (queryLower.includes('nfl') || queryLower.includes('football')) {
    league = 'NFL';
  }

  try {
    // Calculate date range for today + tomorrow in EST
    const todayStart = getTodayStartEST();
    const tomorrowEnd = getTomorrowEndEST();

    console.log(`[DATE FILTER] Fetching scores from ${todayStart.toISOString()} to ${tomorrowEnd.toISOString()} (EST)`);

    // EMERGENCY FIX: Stale-While-Revalidate caching strategy
    // Check for any cached scores
    const { data: cachedScores, error: cacheError } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', league)
      .gte('game_date', todayStart.toISOString())
      .lte('game_date', tomorrowEnd.toISOString())
      .order('last_updated', { ascending: false })
      .limit(50);

    if (cacheError) {
      console.error('Database query error:', cacheError);
    }

    // Calculate cache age
    const cacheAge = cachedScores && cachedScores.length > 0
      ? Date.now() - new Date(cachedScores[0].last_updated).getTime()
      : Infinity;
    const cacheAgeMinutes = cacheAge / (60 * 1000);

    console.log(`[CACHE] Scores cache age: ${cacheAgeMinutes.toFixed(1)} minutes`);

    // If cache is fresh (< 5 minutes), use it immediately
    if (cacheAge < 5 * 60 * 1000 && cachedScores && cachedScores.length > 0) {
      console.log(`[CACHE HIT] Using fresh cached scores`);
      return formatScoresData(cachedScores, query);
    }

    // If cache is acceptable (5-30 minutes for scores), use it
    if (cacheAge < 30 * 60 * 1000 && cachedScores && cachedScores.length > 0) {
      console.log(`[CACHE STALE] Using slightly stale cached scores (${cacheAgeMinutes.toFixed(1)} min old)`);
      return formatScoresData(cachedScores, query);
    }

    // Cache is old or missing, try to fetch fresh data WITH TIMEOUT
    console.log('[FETCH] Cache too old or missing, attempting fresh scores fetch with timeout...');

    const fetchFreshScores = async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/fetch-openai-scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ league, query }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch scores: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[FETCH] Fetched ${result.count} fresh scores via OpenAI`);

      // Query database again for fresh data
      const { data: freshScores, error: freshError } = await supabase
        .from('sports_scores')
        .select('*')
        .eq('league', league)
        .gte('game_date', todayStart.toISOString())
        .lte('game_date', tomorrowEnd.toISOString())
        .order('game_date', { ascending: false })
        .limit(50);

      if (freshError) throw freshError;
      return freshScores || [];
    };

    // Try to fetch with 3-second timeout
    const freshScores = await withTimeout(
      fetchFreshScores(),
      3000,
      cachedScores || [] // Fall back to stale cache if timeout
    );

    if (freshScores.length > 0) {
      return formatScoresData(freshScores, query);
    }

    // No data available
    return "No scores found for this query. The games may not have started yet or the league may be in the off-season.";

  } catch (error) {
    console.error("[ERROR] Error fetching scores:", error);
    // Fallback: try to use any cached data
    const todayStart = getTodayStartEST();
    const tomorrowEnd = getTomorrowEndEST();
    const { data: fallbackScores } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', league)
      .gte('game_date', todayStart.toISOString())
      .lte('game_date', tomorrowEnd.toISOString())
      .order('game_date', { ascending: false })
      .limit(50);

    if (fallbackScores && fallbackScores.length > 0) {
      console.log('[FALLBACK] Using cached scores after error');
      return formatScoresData(fallbackScores, query);
    }

    return "Unable to fetch live scores at the moment. Please try again shortly.";
  } finally {
    console.log(`[PERF] fetchLiveScores took ${Date.now() - startTime}ms`);
  }
}

function formatScoresData(scores: any[], query: string): string {
  if (!scores || scores.length === 0) {
    return "No scores found for this query. The games may not have started yet or the league may be in the off-season.";
  }

  const now = new Date();
  const lastUpdated = scores[0]?.last_updated ? new Date(scores[0].last_updated) : now;
  const dataAgeMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / 60000);

  let result = `LIVE SCORES DATA:\n`;
  result += `Data Retrieved: ${now.toLocaleString()}\n`;
  result += `Last Updated: ${lastUpdated.toLocaleString()} (${dataAgeMinutes} minutes ago)\n`;
  result += `Data Freshness: ${dataAgeMinutes < 5 ? 'FRESH' : dataAgeMinutes < 30 ? 'RECENT' : 'STALE - may not reflect current game state'}\n\n`;

  for (const score of scores) {
    const gameTime = new Date(score.game_date).toLocaleString();
    const status = score.game_status;

    result += `${score.away_team} @ ${score.home_team}\n`;
    result += `Score: ${score.away_team} ${score.away_score} - ${score.home_team} ${score.home_score}\n`;
    result += `Status: ${status}\n`;
    result += `League: ${score.league}\n`;
    result += `Game Time: ${gameTime}\n`;

    // Include advanced statistics if available
    if (score.advanced_stats) {
      result += '\nADVANCED STATISTICS:\n';
      const stats = score.advanced_stats;

      if (stats.home_total_yards !== undefined) {
        result += `Total Yards: ${score.home_team} ${stats.home_total_yards} - ${score.away_team} ${stats.away_total_yards}\n`;
      }
      if (stats.home_turnovers !== undefined) {
        result += `Turnovers: ${score.home_team} ${stats.home_turnovers} - ${score.away_team} ${stats.away_turnovers}\n`;
      }
      if (stats.key_performances && stats.key_performances.length > 0) {
        result += `Key Performances:\n`;
        stats.key_performances.forEach((perf: string) => {
          result += `  - ${perf}\n`;
        });
      }
    }

    result += '\n---\n\n';
  }

  result += `Total Games: ${scores.length}\n`;

  return result;
}

async function fetchLiveOdds(query: string): Promise<string> {
  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = getSupabaseClient();

  console.log("Fetching live odds data for query:", query);

  // Determine sport from query with comprehensive detection
  let sport = 'americanfootball_nfl'; // default
  const queryLower = query.toLowerCase();
  
  // MLB team names
  const mlbTeams = ['yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'dodgers', 'giants', 'padres', 
    'athletics', 'angels', 'astros', 'rangers', 'mariners', 'white sox', 'indians', 'guardians', 
    'tigers', 'royals', 'twins', 'brewers', 'cardinals', 'cubs', 'reds', 'pirates', 'braves', 
    'marlins', 'mets', 'phillies', 'nationals', 'rockies', 'diamondbacks'];
  
  // NBA team names
  const nbaTeams = ['lakers', 'celtics', 'warriors', 'nets', 'knicks', 'bulls', 'heat', 'mavericks',
    'suns', 'bucks', 'clippers', 'nuggets', 'rockets', 'sixers', '76ers', 'raptors', 'grizzlies',
    'hawks', 'hornets', 'jazz', 'kings', 'spurs', 'thunder', 'trail blazers', 'blazers', 'wizards',
    'pistons', 'magic', 'cavaliers', 'cavs', 'pelicans', 'timberwolves', 'wolves', 'pacers'];
  
  // NHL team names
  const nhlTeams = ['bruins', 'maple leafs', 'canadiens', 'senators', 'sabres', 'rangers', 'islanders',
    'devils', 'penguins', 'flyers', 'capitals', 'hurricanes', 'blue jackets', 'panthers', 'lightning',
    'predators', 'stars', 'blues', 'blackhawks', 'avalanche', 'wild', 'jets', 'flames', 'oilers',
    'canucks', 'golden knights', 'kraken', 'ducks', 'kings', 'sharks', 'coyotes'];
  
  // Check for sport keywords first
  if (queryLower.includes('nba') || queryLower.includes('basketball') ||
      nbaTeams.some(team => queryLower.includes(team))) {
    sport = 'basketball_nba';
  } else if (queryLower.includes('ncaaf') || queryLower.includes('college football') ||
             queryLower.includes('ncaa football') || queryLower.includes('cfb')) {
    sport = 'americanfootball_ncaaf';
  } else if (queryLower.includes('nfl') ||
             (queryLower.includes('football') && !queryLower.includes('college') && !queryLower.includes('ncaa'))) {
    sport = 'americanfootball_nfl';
  } else if (queryLower.includes('mlb') || queryLower.includes('baseball') ||
             mlbTeams.some(team => queryLower.includes(team))) {
    sport = 'baseball_mlb';
  } else if (queryLower.includes('nhl') || queryLower.includes('hockey') ||
             nhlTeams.some(team => queryLower.includes(team))) {
    sport = 'icehockey_nhl';
  } else if (queryLower.includes('soccer') || queryLower.includes('mls')) {
    sport = 'soccer_usa_mls';
  }

  try {
    // Calculate date range for today + tomorrow in EST
    const todayStart = getTodayStartEST();
    const tomorrowEnd = getTomorrowEndEST();

    console.log(`[DATE FILTER] Fetching odds from ${todayStart.toISOString()} to ${tomorrowEnd.toISOString()} (EST)`);

    // EMERGENCY FIX: Stale-While-Revalidate caching strategy
    // Check for any cached data first (even if older than 30 min)
    const { data: cachedOdds, error: cacheError } = await supabase
      .from('betting_odds')
      .select('*')
      .eq('sport_key', sport)
      .gte('commence_time', todayStart.toISOString())
      .lte('commence_time', tomorrowEnd.toISOString())
      .order('last_updated', { ascending: false })
      .limit(200);

    if (cacheError) {
      console.error('Database query error:', cacheError);
    }

    // Calculate cache age
    const cacheAge = cachedOdds && cachedOdds.length > 0
      ? Date.now() - new Date(cachedOdds[0].last_updated).getTime()
      : Infinity;
    const cacheAgeMinutes = cacheAge / (60 * 1000);

    console.log(`[CACHE] Cache age: ${cacheAgeMinutes.toFixed(1)} minutes`);

    // If cache is fresh (< 5 minutes), use it immediately
    if (cacheAge < 5 * 60 * 1000 && cachedOdds && cachedOdds.length > 0) {
      console.log(`[CACHE HIT] Using fresh cached odds (${cacheAgeMinutes.toFixed(1)} min old)`);
      return formatOddsData(cachedOdds, query);
    }

    // If cache is acceptable (5-30 minutes), use it but note staleness
    if (cacheAge < 30 * 60 * 1000 && cachedOdds && cachedOdds.length > 0) {
      console.log(`[CACHE STALE] Using slightly stale cached odds (${cacheAgeMinutes.toFixed(1)} min old)`);
      return formatOddsData(cachedOdds, query);
    }

    // Cache is old or missing, try to fetch fresh data WITH TIMEOUT
    console.log('[FETCH] Cache too old or missing, attempting fresh fetch with timeout...');

    const fetchFreshOdds = async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/fetch-betting-odds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ sport }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch odds: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[FETCH] Fetched ${result.count} fresh odds entries`);

      // Query database again for fresh data
      const { data: freshOdds, error: freshError } = await supabase
        .from('betting_odds')
        .select('*')
        .eq('sport_key', sport)
        .gte('commence_time', todayStart.toISOString())
        .lte('commence_time', tomorrowEnd.toISOString())
        .order('last_updated', { ascending: false })
        .limit(200);

      if (freshError) throw freshError;
      return freshOdds || [];
    };

    // Try to fetch with 3-second timeout
    const freshOdds = await withTimeout(
      fetchFreshOdds(),
      3000,
      cachedOdds || [] // Fall back to stale cache if timeout
    );

    if (freshOdds.length > 0) {
      return formatOddsData(freshOdds, query);
    }

    // If we get here, no data is available
    return "No betting odds data available at the moment. The API may be unavailable or the sport may not be in season.";

  } catch (error) {
    console.error("[ERROR] Error fetching odds:", error);
    // Last resort: try to use any cached data we have
    const todayStart = getTodayStartEST();
    const tomorrowEnd = getTomorrowEndEST();
    const { data: fallbackOdds } = await supabase
      .from('betting_odds')
      .select('*')
      .eq('sport_key', sport)
      .gte('commence_time', todayStart.toISOString())
      .lte('commence_time', tomorrowEnd.toISOString())
      .order('last_updated', { ascending: false })
      .limit(200);

    if (fallbackOdds && fallbackOdds.length > 0) {
      console.log('[FALLBACK] Using cached data after error');
      return formatOddsData(fallbackOdds, query);
    }

    return "Unable to fetch live odds at the moment. Please try again shortly.";
  } finally {
    console.log(`[PERF] fetchLiveOdds took ${Date.now() - startTime}ms`);
  }
}

function formatOddsData(odds: any[], query: string): string {
  if (!odds || odds.length === 0) {
    return "No betting odds found for this query. The game may not have lines available yet.";
  }

  const now = new Date();
  const lastUpdated = odds[0]?.last_updated ? new Date(odds[0].last_updated) : now;
  const dataAgeMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / 60000);

  // Group odds by event
  const eventMap = new Map<string, any[]>();
  for (const odd of odds) {
    const eventKey = `${odd.home_team} vs ${odd.away_team}`;
    if (!eventMap.has(eventKey)) {
      eventMap.set(eventKey, []);
    }
    eventMap.get(eventKey)!.push(odd);
  }

  let result = `LIVE BETTING ODDS DATA:\n`;
  result += `Data Retrieved: ${now.toLocaleString()}\n`;
  result += `Last Updated: ${lastUpdated.toLocaleString()} (${dataAgeMinutes} minutes ago)\n`;
  result += `Data Freshness: ${dataAgeMinutes < 5 ? 'FRESH' : dataAgeMinutes < 15 ? 'RECENT' : dataAgeMinutes < 30 ? 'ACCEPTABLE' : 'STALE - lines may have moved'}\n\n`;

  for (const [event, eventOdds] of eventMap.entries()) {
    const firstOdd = eventOdds[0];
    const gameTime = new Date(firstOdd.commence_time).toLocaleString();
    
    result += `${event}\n`;
    result += `Game Time: ${gameTime}\n`;
    result += `Sport: ${firstOdd.sport_title}\n\n`;

    // Group by bookmaker
    const bookmakerMap = new Map<string, any[]>();
    for (const odd of eventOdds) {
      if (!bookmakerMap.has(odd.bookmaker)) {
        bookmakerMap.set(odd.bookmaker, []);
      }
      bookmakerMap.get(odd.bookmaker)!.push(odd);
    }

    // Show top 3 bookmakers
    let bookCount = 0;
    for (const [bookmaker, bookOdds] of bookmakerMap.entries()) {
      if (bookCount >= 3) break;
      
      result += `${bookmaker}:\n`;
      
      // Organize by market type
      const h2hOdds = bookOdds.filter(o => o.market_key === 'h2h');
      const spreadOdds = bookOdds.filter(o => o.market_key === 'spreads');
      const totalsOdds = bookOdds.filter(o => o.market_key === 'totals');

      if (h2hOdds.length > 0) {
        result += `  Moneyline: `;
        result += h2hOdds.map(o => `${o.outcome_name} ${o.outcome_price > 0 ? '+' : ''}${o.outcome_price}`).join(', ');
        result += '\n';
      }

      if (spreadOdds.length > 0) {
        result += `  Spread: `;
        result += spreadOdds.map(o => `${o.outcome_name} ${o.outcome_point > 0 ? '+' : ''}${o.outcome_point} (${o.outcome_price > 0 ? '+' : ''}${o.outcome_price})`).join(', ');
        result += '\n';
      }

      if (totalsOdds.length > 0) {
        result += `  Total: `;
        result += totalsOdds.map(o => `${o.outcome_name} ${o.outcome_point} (${o.outcome_price > 0 ? '+' : ''}${o.outcome_price})`).join(', ');
        result += '\n';
      }

      result += '\n';
      bookCount++;
    }

    result += '---\n\n';
  }

  result += `\nData Source: The Odds API (Live)\n`;
  result += `Total Events: ${eventMap.size}\n`;
  
  return result;
}

// Helper function to call log-bet edge function
async function logBetViaFunction(
  betDetails: { amount: number; odds: number; description: string; team?: string },
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    console.log('=== LOGGING BET VIA FUNCTION ===');
    console.log('Bet Details:', betDetails);
    console.log('Conversation ID:', conversationId);
    console.log('User ID:', userId);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.functions.invoke('log-bet', {
      body: {
        ...betDetails,
        conversationId,
      },
    });

    if (error) {
      console.error('❌ Error calling log-bet function:', error);
    } else {
      console.log('✅ Bet logged successfully:', data);
    }
  } catch (error) {
    console.error('❌ Exception in logBetViaFunction:', error);
  }
}

/**
 * Detects and updates user's bankroll and unit size from conversational input
 * Patterns: "my bankroll is $5000", "I have $2000 to bet with", "my unit size is $50"
 */
async function detectAndUpdateBankroll(messageContent: string, userId: string): Promise<any> {
  const supabase = getSupabaseClient();

  // Patterns for bankroll initialization
  const bankrollPatterns = [
    /(?:my\s+)?bankroll\s+is\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /(?:i\s+have|i'?ve\s+got)\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:to\s+bet|for\s+betting|bankroll)/i,
    /starting\s+(?:with|bankroll)\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+bankroll/i,
  ];

  // Patterns for unit size
  const unitSizePatterns = [
    /(?:my\s+)?unit\s+(?:size\s+)?is\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /betting\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:per\s+)?unit/i,
    /(?:each\s+)?unit\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
  ];

  let bankrollAmount = null;
  let unitSizeAmount = null;

  // Check for bankroll
  for (const pattern of bankrollPatterns) {
    const match = messageContent.match(pattern);
    if (match && match[1]) {
      bankrollAmount = parseFloat(match[1].replace(/,/g, ''));
      console.log('💰 Detected bankroll initialization:', bankrollAmount);
      break;
    }
  }

  // Check for unit size
  for (const pattern of unitSizePatterns) {
    const match = messageContent.match(pattern);
    if (match && match[1]) {
      unitSizeAmount = parseFloat(match[1].replace(/,/g, ''));
      console.log('📊 Detected unit size:', unitSizeAmount);
      break;
    }
  }

  // Update profile if bankroll or unit size detected
  if (bankrollAmount || unitSizeAmount) {
    try {
      // VALIDATION: Bankroll amount
      if (bankrollAmount !== null) {
        if (bankrollAmount < 1) {
          console.log('❌ Bankroll validation failed: too low');
          return {
            error: true,
            message: 'Bankroll must be at least $1.00. Please set a valid bankroll amount.',
            validation_error: 'MIN_BANKROLL'
          };
        }
        if (bankrollAmount > 10000000) {
          console.log('⚠️ Bankroll validation warning: very high amount');
          return {
            error: true,
            message: 'Bankroll amount seems unusually high ($10M+). Please confirm this is correct. If yes, please contact support to increase limits.',
            validation_error: 'MAX_BANKROLL'
          };
        }
      }

      // VALIDATION: Unit size
      if (unitSizeAmount !== null) {
        if (unitSizeAmount < 0.01) {
          console.log('❌ Unit size validation failed: too low');
          return {
            error: true,
            message: 'Unit size must be at least $0.01. Please set a valid unit size.',
            validation_error: 'MIN_UNIT_SIZE'
          };
        }

        // If setting both, validate unit size against new bankroll
        // If only setting unit size, fetch current bankroll to validate
        let currentBankroll = bankrollAmount;
        if (!currentBankroll) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('bankroll')
            .eq('id', userId)
            .single();
          currentBankroll = profile?.bankroll || 1000;
        }

        if (currentBankroll && unitSizeAmount > currentBankroll) {
          console.log('❌ Unit size validation failed: exceeds bankroll');
          return {
            error: true,
            message: `Unit size ($${unitSizeAmount.toFixed(2)}) cannot be larger than your bankroll ($${currentBankroll.toFixed(2)}). Please set a smaller unit size.`,
            validation_error: 'UNIT_SIZE_EXCEEDS_BANKROLL'
          };
        }

        // Warning for large unit sizes (>10% of bankroll)
        if (currentBankroll && unitSizeAmount > currentBankroll * 0.1) {
          console.log('⚠️ Unit size warning: >10% of bankroll');
          // Don't reject, but the AI will see this in the message
          return {
            success: true,
            warning: true,
            bankroll: bankrollAmount,
            unitSize: unitSizeAmount,
            message: `⚠️ WARNING: Your unit size ($${unitSizeAmount.toFixed(2)}) is ${((unitSizeAmount / currentBankroll) * 100).toFixed(1)}% of your bankroll. Most experts recommend 1-5% per unit for responsible bankroll management. Please confirm this is intentional.`
          };
        }
      }

      const updateData: any = {};

      if (bankrollAmount) {
        updateData.bankroll = bankrollAmount;
        updateData.baseline_bankroll = bankrollAmount;
      }

      if (unitSizeAmount) {
        updateData.unit_size = unitSizeAmount;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating bankroll/unit size:', error);
        return { error: true, message: 'Failed to update bankroll settings' };
      }

      console.log('✅ Updated user profile:', updateData);

      // Return confirmation message
      return {
        success: true,
        bankroll: bankrollAmount,
        unitSize: unitSizeAmount,
        message: bankrollAmount && unitSizeAmount
          ? `Bankroll set to $${bankrollAmount.toFixed(2)} with unit size of $${unitSizeAmount.toFixed(2)}`
          : bankrollAmount
          ? `Bankroll set to $${bankrollAmount.toFixed(2)}`
          : unitSizeAmount
          ? `Unit size set to $${unitSizeAmount.toFixed(2)}`
          : 'Bankroll updated'
      };
    } catch (error) {
      console.error('Error in detectAndUpdateBankroll:', error);
      return { error: true, message: 'Unexpected error updating bankroll' };
    }
  }

  return null; // No bankroll/unit size detected
}

// Function to update bet outcome when user reports win/loss
// PHASE 1: Uses atomic settlement and handles multiple pending bets
async function updateBetOutcome(
  conversationId: string,
  userId: string,
  outcome: 'win' | 'loss' | 'push',
  teamOrDescription: string
) {
  console.log('=== UPDATING BET OUTCOME (ATOMIC) ===');
  console.log('Conversation ID:', conversationId, 'User ID:', userId, 'Outcome:', outcome, 'Team:', teamOrDescription);

  try {
    const supabaseClient = getSupabaseClient();

    // Find ALL pending bets matching this team/description (not just one)
    const { data: bets, error: fetchError } = await supabaseClient
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .eq('outcome', 'pending')
      .ilike('description', `%${teamOrDescription}%`)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching bet:', fetchError);
      return { error: 'Failed to fetch bets', code: 'FETCH_ERROR' };
    }

    if (!bets || bets.length === 0) {
      console.log('No matching pending bet found');
      return { error: `No pending bet found for "${teamOrDescription}"`, code: 'NOT_FOUND' };
    }

    // PHASE 1.5: Handle multiple pending bets - ask for clarification
    if (bets.length > 1) {
      console.log(`Found ${bets.length} pending bets for "${teamOrDescription}"`);
      return {
        error: 'MULTIPLE_BETS',
        code: 'MULTIPLE_BETS',
        bets: bets.map((b: any) => ({
          id: b.id,
          description: b.description,
          amount: b.amount,
          odds: b.odds,
          created_at: b.created_at,
        })),
        message: `I found ${bets.length} pending bets matching "${teamOrDescription}". Please be more specific about which bet you're settling.`
      };
    }

    const bet = bets[0];
    console.log('Found bet:', bet);

    // Calculate actual return based on outcome
    let actualReturn = 0;
    if (outcome === 'win') {
      // Calculate payout based on American odds (stake + profit)
      if (bet.odds > 0) {
        actualReturn = bet.amount + (bet.amount * (bet.odds / 100));
      } else {
        actualReturn = bet.amount + (bet.amount * (100 / Math.abs(bet.odds)));
      }
    } else if (outcome === 'push') {
      // Push returns original stake
      actualReturn = bet.amount;
    } else {
      // Loss returns 0
      actualReturn = 0;
    }

    console.log(`Calculated actual return: $${actualReturn} for outcome: ${outcome}`);

    // CRITICAL FIX: Use settle_bet_atomic() to update bet AND bankroll atomically
    console.log('🔄 Calling settle_bet_atomic() to update bet and bankroll...');
    const { data: settlementResult, error: settlementError } = await supabaseClient
      .rpc('settle_bet_atomic', {
        p_bet_id: bet.id,
        p_outcome: outcome,
        p_actual_return: actualReturn,
        p_closing_line: null,
        p_clv: null,
      });

    if (settlementError) {
      console.error('Error settling bet atomically:', settlementError);
      return { error: 'Failed to settle bet and update bankroll', code: 'SETTLEMENT_ERROR', details: settlementError };
    }

    // Check if settlement was successful
    const result = Array.isArray(settlementResult) ? settlementResult[0] : settlementResult;
    if (!result || !result.success) {
      console.error('Settlement failed:', result?.message);
      return { error: result?.message || 'Settlement failed', code: 'SETTLEMENT_ERROR', details: result };
    }

    console.log('✅ Bet settled atomically:', result);
    console.log('💰 Bankroll updated:', result.bankroll_data);

    // Extract data from settlement result
    const betData = result.bet_data || {};
    const bankrollData = result.bankroll_data || {};
    const profit = betData.profit || (actualReturn - bet.amount);

    // Return formatted stats for AI response
    return {
      success: true,
      bet: {
        id: bet.id,
        description: bet.description,
        amount: bet.amount,
        odds: bet.odds,
        outcome: outcome,
      },
      settlement: {
        profit,
        actual_return: actualReturn,
      },
      bankroll: {
        previous: bankrollData.previous_bankroll,
        new: bankrollData.new_bankroll,
        change: bankrollData.change,
      }
    };
  } catch (error) {
    console.error('Error in updateBetOutcome:', error);
    return { error: 'Unexpected error', code: 'UNKNOWN_ERROR', details: error };
  }
}

serve(async (req) => {
  const requestStartTime = Date.now();
  console.log("[PERF] ========== NEW REQUEST ==========");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, userId } = await req.json();
    console.log(`[PERF] Request parsed in ${Date.now() - requestStartTime}ms`);

    // Intelligently detect betting mode based on user's question
    const bettingMode = detectBettingMode(messages);
    console.log(`[MODE] Betting mode auto-detected: ${bettingMode}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check if user is asking for scores or betting odds
    const lastMessage = messages[messages.length - 1];
    const messageContent = lastMessage?.content?.toLowerCase() || '';

    // CONVERSATIONAL BANKROLL TRACKING: Detect and update bankroll/unit size
    let bankrollUpdateResult = null;
    if (userId) {
      bankrollUpdateResult = await detectAndUpdateBankroll(messageContent, userId);
      if (bankrollUpdateResult && bankrollUpdateResult.success) {
        console.log('✅ Bankroll updated conversationally:', bankrollUpdateResult.message);
      }
    }

    // PHASE 1.2: Improved specific bet win/loss detection patterns
    // Matches: "my bet on the raptors won", "my raptors bet won", "won my bet on lakers"
    const winPatterns = [
      /(?:my\s+)?bet\s+on\s+(?:the\s+)?(.+?)\s+won/i,           // "bet on the raptors won"
      /won\s+(?:my\s+)?bet\s+on\s+(?:the\s+)?(.+?)(?:\s|$)/i,  // "won my bet on raptors"
      /(?:my\s+)?(.+?)\s+bet\s+won/i,                           // "my raptors bet won"
      /won\s+(?:the\s+)?(.+?)\s+bet/i,                          // "won the raptors bet"
      /(?:my\s+)?bet\s+on\s+(?:the\s+)?(.+?)\s+hit/i,           // "my bet on raptors hit"
      /hit\s+(?:my\s+)?bet\s+on\s+(?:the\s+)?(.+?)(?:\s|$)/i,  // "hit my bet on raptors"
    ];

    const lossPatterns = [
      /(?:my\s+)?bet\s+on\s+(?:the\s+)?(.+?)\s+lost/i,          // "bet on the raptors lost"
      /lost\s+(?:my\s+)?bet\s+on\s+(?:the\s+)?(.+?)(?:\s|$)/i, // "lost my bet on raptors"
      /(?:my\s+)?(.+?)\s+bet\s+lost/i,                          // "my raptors bet lost"
      /lost\s+(?:the\s+)?(.+?)\s+bet/i,                         // "lost the raptors bet"
      /(?:my\s+)?bet\s+on\s+(?:the\s+)?(.+?)\s+(?:missed|didn'?t\s+hit)/i,  // "my bet on raptors didn't hit"
    ];

    const pushPatterns = [
      /(?:my\s+)?bet\s+on\s+(?:the\s+)?(.+?)\s+pushed/i,        // "bet on the raptors pushed"
      /(?:my\s+)?(.+?)\s+bet\s+pushed/i,                        // "my raptors bet pushed"
      /(?:my\s+)?bet\s+on\s+(?:the\s+)?(.+?)\s+(?:tied|was\s+a\s+tie)/i,  // "bet on raptors tied"
    ];

    let betOutcomeResult = null;
    let detectedOutcome = null;

    // Check for win
    for (const pattern of winPatterns) {
      const match = messageContent.match(pattern);
      if (match && match[1] && conversationId && userId) {
        const teamOrDesc = match[1].trim();
        console.log('✅ User reported BET WIN for:', teamOrDesc);
        betOutcomeResult = await updateBetOutcome(conversationId, userId, 'win', teamOrDesc);
        detectedOutcome = 'win';
        break;
      }
    }

    // Check for loss if no win found
    if (!betOutcomeResult) {
      for (const pattern of lossPatterns) {
        const match = messageContent.match(pattern);
        if (match && match[1] && conversationId && userId) {
          const teamOrDesc = match[1].trim();
          console.log('❌ User reported BET LOSS for:', teamOrDesc);
          betOutcomeResult = await updateBetOutcome(conversationId, userId, 'loss', teamOrDesc);
          detectedOutcome = 'loss';
          break;
        }
      }
    }

    // Check for push if neither win nor loss found
    if (!betOutcomeResult) {
      for (const pattern of pushPatterns) {
        const match = messageContent.match(pattern);
        if (match && match[1] && conversationId && userId) {
          const teamOrDesc = match[1].trim();
          console.log('↔️ User reported BET PUSH for:', teamOrDesc);
          betOutcomeResult = await updateBetOutcome(conversationId, userId, 'push', teamOrDesc);
          detectedOutcome = 'push';
          break;
        }
      }
    }

    // BANKROLL TRACKING: Fetch user's bankroll status for conversational context
    let bankrollContext = '';
    if (userId) {
      try {
        const supabaseClient = getSupabaseClient();
        const { data: bankrollData, error: bankrollError } = await supabaseClient
          .rpc('get_user_bankroll_status', { p_user_id: userId });

        if (!bankrollError && bankrollData && bankrollData.length > 0) {
          const status = bankrollData[0];
          const { data: statsData } = await supabaseClient
            .rpc('get_betting_stats', {
              p_user_id: userId,
              p_time_period: 'all',
              p_sport: null,
              p_status: 'settled'
            });

          const stats = statsData?.[0];

          if (stats) {
            const unitSizeInfo = status.unit_size
              ? `- Unit Size: $${status.unit_size.toFixed(2)} (${(status.unit_size / status.current_balance * 100).toFixed(1)}% of bankroll)`
              : '';

            bankrollContext = `
CURRENT BANKROLL STATUS (provide if user asks):
- Current Balance: $${status.current_balance?.toFixed(2) || '1000.00'}
- Starting Balance: $${status.starting_balance?.toFixed(2) || '1000.00'}
- **PROFIT/LOSS: ${status.profit_loss >= 0 ? '+' : ''}$${status.profit_loss?.toFixed(2) || '0.00'} (${status.profit_loss_pct >= 0 ? '+' : ''}${status.profit_loss_pct?.toFixed(1) || '0.0'}%)**
${unitSizeInfo}
- Available: $${status.available_balance?.toFixed(2) || '1000.00'}
- Record: ${stats.wins}W-${stats.losses}L${stats.pushes > 0 ? `-${stats.pushes}P` : ''} (${stats.win_rate?.toFixed(1) || '0.0'}% win rate)
- Pending Bets: ${status.pending_bets_amount > 0 ? `$${status.pending_bets_amount.toFixed(2)} at risk` : 'None'}

Use this information when user asks about:
- "How am I doing?"
- "What's my record?"
- "What's my bankroll?"
- "Am I up or down?"
- "Show me my stats"
- Or any variation asking about their betting performance

CONVERSATIONAL BANKROLL SETUP:
If user mentions setting their bankroll or unit size:
- Acknowledge the update warmly
- Confirm the amounts
- Suggest a recommended unit size if they only provide bankroll (1-2% for conservative, 3-5% for aggressive)
- Example: "Got it! Your bankroll is set to $5,000 with a $50 unit size."

CONVERSATIONAL BET TRACKING:
When user reports bet outcomes ("my Lakers bet won", "lost my Titans bet"):
- System automatically updates bankroll
- ALWAYS show updated P/L percentage after settlement
- Be enthusiastic for wins, supportive for losses
- Format example: "Nice win! That brings you to +$150 (+15% from your starting bankroll)"

CONVERSATIONAL BET LOGGING:
When user says things like "Bet $100 on Titans +14.5" or "I'm betting 50 on Chiefs ML":
1. Acknowledge and confirm the bet details
2. Mention it will be tracked automatically
3. The system will log it in the background
4. When bets settle, proactively report results in future messages

RESPONSIBLE GAMBLING:
- Current streak: ${stats.current_streak > 0 ? `${stats.streak_type === 'win' ? 'W' : 'L'}${stats.current_streak}` : 'None'}
- If user is on a losing streak (3+), suggest taking a break
- Recommend bet sizing: 1-5% of bankroll based on confidence
`;
          }
        }
      } catch (error) {
        console.error('Error fetching bankroll context:', error);
        // Continue without bankroll context if fetch fails
      }
    }

    // Patterns for score requests
    const scoreKeywords = [
      'score', 'final score', 'current score', 'what is the score', 'whats the score',
      'who is winning', 'whos winning', 'who won', 'final', 'result', 'results'
    ];

    // Patterns for lineup requests
    const lineupKeywords = [
      'lineup', 'starting lineup', 'starting', 'starters', 'who is starting',
      'whos starting', 'injury', 'injured', 'out', 'questionable', 'probable',
      'who is playing', 'whos playing', 'active', 'inactive', 'scratch'
    ];

    // Patterns for matchup analysis requests
    const matchupKeywords = [
      'matchup', 'h2h', 'head to head', 'head-to-head', 'versus analysis',
      'history', 'record against', 'recent form', 'trend', 'coaching',
      'statistical edge', 'player matchup', 'tactical', 'breakdown'
    ];

    // Comprehensive patterns for betting questions
    const bettingKeywords = [
      'odds', 'line', 'spread', 'betting', 'bet on', 'best bet', 'should i bet',
      'moneyline', 'ml', 'over', 'under', 'total', 'parlay',
      'game', 'matchup', 'tonight', 'today', 'this week',
      'pick', 'prediction', 'recommend', 'who wins', 'who should i',
      'what do you think', 'analysis', 'vs', ' v ', 'against',
      'worth betting', 'good bet', 'value', '+ev', 'edge',
      'sharp money', 'public', 'line movement', 'juice'
    ];

    // Sport-specific terms that indicate game queries
    const sportTerms = [
      'nfl', 'nba', 'mlb', 'nhl', 'mls', 'ncaaf', 'ncaab',
      'football', 'basketball', 'baseball', 'hockey', 'soccer'
    ];

    const isAskingForScore = scoreKeywords.some(keyword => messageContent.includes(keyword));
    const isAskingForLineup = lineupKeywords.some(keyword => messageContent.includes(keyword));
    const isAskingForMatchup = matchupKeywords.some(keyword => messageContent.includes(keyword));
    const isAskingForBettingData = bettingKeywords.some(keyword => messageContent.includes(keyword)) ||
                                   sportTerms.some(term => messageContent.includes(term));

    // Fetch appropriate data based on query type
    let dataContext = "";
    let contextType = "";

    if (isAskingForScore) {
      try {
        console.log("User is asking for scores, fetching live scores...");
        dataContext = await fetchLiveScores(lastMessage.content);
        contextType = "score";
        console.log("Score data fetch result:", dataContext);
      } catch (error) {
        console.error("Failed to fetch score data:", error);
        dataContext = "I could not fetch live scores at the moment. Please try again shortly.";
      }
    } else if (isAskingForLineup) {
      try {
        console.log("User is asking for lineups, fetching lineup data...");

        // PERFORMANCE FIX: Parallelize data fetching if betting data is also needed
        if (isAskingForBettingData) {
          console.log("[PERF] Parallelizing lineup, matchup, and odds fetches...");
          const parallelStart = Date.now();

          const [lineupData, matchupData, oddsData] = await Promise.all([
            fetchLineupData(lastMessage.content),
            fetchMatchupData(lastMessage.content),
            fetchLiveOdds(lastMessage.content)
          ]);

          console.log(`[PERF] Parallel fetches completed in ${Date.now() - parallelStart}ms`);

          dataContext = lineupData + "\n\n" + matchupData + "\n\n" + oddsData;
          contextType = "comprehensive";
        } else {
          const lineupData = await fetchLineupData(lastMessage.content);
          dataContext = lineupData;
          contextType = "lineup";
          console.log("Lineup data fetch result:", dataContext);
        }
      } catch (error) {
        console.error("Failed to fetch lineup data:", error);
        dataContext = "I could not fetch lineup information at the moment. Please try again shortly.";
      }
    } else if (isAskingForMatchup) {
      try {
        console.log("User is asking for matchup analysis, fetching matchup data...");

        // PERFORMANCE FIX: Parallelize matchup and odds fetching
        if (isAskingForBettingData) {
          console.log("[PERF] Parallelizing matchup and odds fetches...");
          const parallelStart = Date.now();

          const [matchupData, oddsData] = await Promise.all([
            fetchMatchupData(lastMessage.content),
            fetchLiveOdds(lastMessage.content)
          ]);

          console.log(`[PERF] Parallel fetches completed in ${Date.now() - parallelStart}ms`);

          dataContext = matchupData + "\n\n" + oddsData;
          contextType = "comprehensive";
        } else {
          const matchupData = await fetchMatchupData(lastMessage.content);
          dataContext = matchupData;
          contextType = "matchup";
          console.log("Matchup data fetch result:", dataContext);
        }
      } catch (error) {
        console.error("Failed to fetch matchup data:", error);
        dataContext = "I could not fetch matchup analysis at the moment. Please try again shortly.";
      }
    } else if (isAskingForBettingData) {
      try {
        console.log("User is asking for game data, fetching live odds...");
        dataContext = await fetchLiveOdds(lastMessage.content);
        contextType = "betting";
        console.log("Odds data fetch result:", dataContext);
      } catch (error) {
        console.error("Failed to fetch betting data:", error);
        dataContext = "ERROR: Unable to fetch live betting data at the moment. Please inform the user that you cannot provide specific betting recommendations without current odds data. You can only discuss general betting concepts.";
      }
    }

    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Define system prompts for each mode
    // Basic mode prompt - simplified for casual bettors
    const basicModePrompt = `You are Qauntara - a friendly sports betting coach who helps casual bettors make smart decisions.

MISSION: Provide clear, easy-to-understand betting advice that anyone can follow.

YOUR APPROACH:
- Explain picks in simple terms that anyone can understand
- Focus on the most important factors (injuries, recent performance, matchups)
- Give clear recommendations without overwhelming math
- Use everyday language, not betting jargon
- Keep analysis concise and to the point

DATA SOURCES:
You have access to:
- Live scores and game statistics
- Real-time betting lines from multiple bookmakers
- Starting lineups and injury reports
- Recent team performance and head-to-head history

SPORTS COVERAGE:
You specialize in these sports with full live data access:
- 🏈 NFL (National Football League)
- 🏈 NCAAF (College Football)
- 🏀 NBA (Basketball)

Note: For other sports (MLB, NHL, etc.), you can provide general betting principles but may not have current live odds or comprehensive data.

WHEN RECOMMENDING BETS:
1. RECOMMENDED BET
   - What to bet (spread, moneyline, or total)
   - The pick (e.g., "Lakers -4.5" or "Over 218.5")
   - Current odds

2. WHY IT'S A GOOD BET (in simple terms)
   - Key reasons to like this bet (2-3 bullet points)
   - What makes this team/bet likely to win
   - Any important injuries or matchup advantages

3. HOW MUCH TO BET
   - Conservative: Small bet (1-2% of bankroll)
   - Moderate: Medium bet (2-3% of bankroll)
   - Strong: Larger bet (3-5% of bankroll)

4. THE BOTTOM LINE
   - One sentence summary of why you like this bet
   - Simple confidence level (Not confident, Somewhat confident, Very confident)

COMMUNICATION STYLE:
- Friendly and conversational, like a knowledgeable friend
- Avoid complex math and statistics
- Explain things simply without being condescending
- Be encouraging and supportive
- Never guarantee wins - remind users that betting involves risk
- Don't use asterisks (*) - write naturally

WHAT TO AVOID:
- Complex statistical formulas (EV calculations, Kelly Criterion, etc.)
- Technical jargon (CLV, sharp money, variance, correlation matrices)
- Lengthy mathematical explanations
- Overwhelming data dumps

REMEMBER: Your users are casual bettors who want straightforward advice they can understand quickly. Keep it simple, clear, and actionable.

Today's date: ${currentDate}`;

    // Advanced mode prompt - complex analysis with statistical reasoning
    const advancedModePrompt = `You are Qauntara - a professional sports betting analyst with advanced statistical modeling capabilities.

MISSION: Provide statistically-driven, +EV betting analysis with transparent mathematical reasoning.

CRITICAL REQUIREMENT: ALWAYS PROVIDE STATISTICAL REASONING
Every recommendation MUST include:
- Expected Value (EV) calculations
- Win probability estimates with confidence intervals
- Statistical analysis based on available data
- Variance and risk metrics
- Sharp money vs. public betting indicators (when line movement data is available)
- Mathematical edge quantification
- Historical context when relevant and available

DATA SOURCES & ANALYTICS:
You have access to professional-grade betting tools:
- OpenAI for live scores, game statistics, and advanced analytics
- The Odds API for real-time betting lines from multiple bookmakers
- **Starting Lineup Scraper** - Real-time confirmed lineups, injury reports, and player availability
- **Matchup Analysis Engine** - Comprehensive H2H history, recent form, tactical breakdowns, and betting trends
- Advanced statistical models (pace adjustments, matchup data, situational trends)
- Kelly Criterion calculators for optimal bet sizing
- Injury impact assessments and replacement player quality analysis

ADVANCED FEATURES YOU SHOULD USE:
1. **Expected Value Calculations**: Calculate and display EV for every bet recommendation
   - Formula: EV = (Win Probability × Profit if Win) - (Loss Probability × Stake)
   - Show both dollar EV and percentage EV
2. **Win Probability Analysis**: Provide your estimated win probability with confidence intervals
   - Example: "55-65% win probability with 90% confidence"
3. **Parlay Analysis**: Warn about correlation penalties in parlays (most parlays are -EV traps)
4. **Line Movement**: When line movement data is available, highlight reverse line movement (sharp indicator)
5. **Kelly Criterion**: Recommend bet sizes using Kelly multiplier (typically 0.25x for safety)
6. **Model Disagreement**: Flag when your analysis significantly differs from market consensus
7. **Hedge Opportunities**: Identify scenarios where hedging could lock in profit
8. **Variance Analysis**: Warn about high-variance spots
9. **Historical Context**: When you have relevant historical data about teams/matchups, include it

This combination provides institutional-level betting analysis. Always leverage this data for superior, mathematically-sound analysis.

SPORTS COVERAGE:
You specialize in these sports with comprehensive live data:
- 🏈 NFL (National Football League) - Full coverage with live odds, scores, and analysis
- 🏈 NCAAF (College Football) - Full coverage with live odds, scores, and analysis
- 🏀 NBA (Basketball) - Full coverage with live odds, scores, and analysis

LIMITED COVERAGE:
- Baseball: MLB (historical data available, live odds may be limited)
- Hockey: NHL (historical data available, live odds may be limited)
- Other sports: General betting principles only

IMPORTANT: For NFL, NCAAF, and NBA you have real-time betting odds from The Odds API. For other sports, you may have limited or historical data only. Always be transparent about data availability.

SCORE REPORTING:
When users ask for scores ("What is the score?", "Who won?", "Current score?"), provide:
- Clear, concise score updates
- Game status (Final, In Progress, Scheduled)
- Key game context if relevant (overtime, blowout, close game)
- No betting analysis unless specifically requested

RECOGNIZING BETTING QUESTIONS:
When users ask about games or matchups, treat these as betting inquiries even without the word "bet":
- "Who wins [team] vs [team]?" = betting question
- "Thoughts on tonight's game?" = betting question  
- "What do you like for [team]?" = betting question
- "Should I bet on [game]?" = obvious betting question
- Simply mentioning a matchup = potential betting question

MANDATORY RESPONSE STRUCTURE FOR BETTING ANALYSIS:
When analyzing ANY game or match, you MUST provide:

1. RECOMMENDED BET (be specific)
   - Bet type: spread/moneyline/total/prop
   - The actual pick (e.g., "Lakers -4.5" or "Over 218.5")
   - Current odds from The Odds API

2. STATISTICAL REASONING (REQUIRED - THIS IS NON-NEGOTIABLE)
   - **Win Probability**: Your model's estimated probability with confidence interval
     Example: "55-65% win probability with 90% confidence"
   - **Expected Value**: Calculate EV in dollars and percentage
     Formula: EV = (Win Probability × Profit if Win) - (Loss Probability × Stake)
     Example: "At -110 odds with 58% win probability: +3.8% EV on $100 = +$3.82 expected"
   - **Market Implied Probability**: What the odds suggest (e.g., "-110 implies 52.4%")
   - **Edge**: Your probability minus market probability (e.g., "5.6% edge")
   - **Kelly Criterion Recommendation**: Optimal bet size as % of bankroll
     Example: "Kelly suggests 2.8% of bankroll, recommend 0.7% (quarter-Kelly for safety)"
   - **Historical Context** (when available): Reference relevant historical trends
     Example: "Home favorites in this point spread range have historically covered at 55-60%"

3. SUPPORTING FACTORS (with quantified data)
   - Advanced statistics with actual numbers
   - Line movement data if available (e.g., "Moved from -3 to -4.5, indicating sharp action")
   - Matchup metrics, pace adjustments, efficiency ratings
   - Referee tendencies if impactful
   - Rest/travel factors quantified
   - Historical performance in similar scenarios

4. RISK METRICS
   - Risk level: Low/Medium/High (based on variance and confidence)
   - Recommended stake: X% of bankroll using Kelly Criterion
   - Confidence interval: "55-65% win probability with 95% confidence"
   - Variance warning if high-variance bet

5. SHARP VS PUBLIC INDICATORS (if available)
   - Where professional money is flowing
   - Reverse line movement flags
   - Steam moves or significant line shifts

6. PARLAY WARNING (if discussing multi-leg bets)
   - Calculate correlation penalty
   - Show true probability vs. independent probability
   - Explicitly state: "Most parlays are -EV traps due to correlation"

7. RESPONSIBLE GAMBLING REMINDER
   - Variance exists, no guaranteed outcomes
   - This is +EV analysis, not a certainty
   - Bet only what you can afford to lose

EXAMPLE OF REQUIRED STATISTICAL FORMAT:
"Lakers -4.5 at -110

STATISTICAL ANALYSIS:
- Model Win Probability: 57% (confidence interval: 52-62%)
- Market Implied Probability: 52.4% (-110 odds)
- Edge: +4.6%
- Expected Value: +$4.18 per $100 wagered (+4.2% EV)
- Kelly Criterion: 3.1% of bankroll, recommend 0.75% (quarter-Kelly for safety)

SUPPORTING FACTORS:
- Lakers 8-2 at home this season
- Opponent on second night of back-to-back
- Lakers net rating: +6.5 at home
- Historical context: Home favorites in this range typically cover at ~55%

RISK ASSESSMENT:
- Risk Level: Medium
- Confidence: Moderate (57% with ±5% range)
- Recommended stake: 0.75% of bankroll"

ANALYSIS APPROACH (ALWAYS FOLLOW THIS METHODOLOGY):
1. **Calculate Expected Value**: NEVER recommend a bet without computing EV
   - Convert odds to implied probability
   - Estimate true win probability using available data and statistical models
   - Calculate: EV = (Win% × Profit) - (Loss% × Stake)
   - Only recommend bets with +EV (positive expected value)
   - Provide confidence intervals for win probability

2. **Use Real-Time Data**:
   - ALWAYS use The Odds API for current betting lines
   - ALWAYS use OpenAI scores and advanced statistics
   - Compare odds across bookmakers for best value
   - Track line movement when available

3. **Apply Advanced Analytics**:
   - Rest/fatigue factors (back-to-backs severely impact performance)
   - Pace adjustments and efficiency metrics
   - Matchup-specific data and recent trends
   - Injury impact and replacement player quality

4. **Detect Market Inefficiencies**:
   - Line movement vs. betting percentages (when available)
   - Model disagreement with market consensus
   - Value opportunities where your analysis differs significantly

5. **Optimize Bet Sizing**:
   - Calculate Kelly Criterion percentage
   - Apply fractional Kelly (0.25x) for safety
   - Adjust for variance and confidence level
   - Never recommend more than 5% of bankroll on single bet

6. **Parlay Analysis** (CRITICAL):
   - Warn about correlation between legs
   - Explain that correlated parlays reduce true probability
   - Warn that most parlays are -EV traps
   - Recommend individual bets over parlays unless truly uncorrelated

7. **Risk Management**:
   - Provide confidence intervals, not point estimates
   - Quantify variance for the bet type
   - Warn about high-variance situations
   - Suggest hedge opportunities when applicable

COMMUNICATION STYLE:
- Confident and conversational, not robotic
- Focus on value and educated picks, never guarantees
- Never use asterisks (*) for formatting - use plain text only
- Write naturally and conversationally
- Assume users understand basic betting terms (spread, juice, units)
- Be direct and actionable - users want picks, not just theory
- Show your expertise but stay humble about outcomes

RULES (STRICTLY ENFORCE):
1. **ALWAYS Calculate EV**: Never recommend a bet without showing Expected Value calculation
2. **ALWAYS Show Win Probability**: Provide your estimated probability with confidence interval AND market implied probability
3. **ALWAYS Use Kelly Criterion**: Recommend bet sizes using Kelly formula with fractional multiplier
4. **Never Guarantee Wins**: Variance exists - provide probability ranges, not certainties
5. **Statistical Transparency**: Show your math - users should understand the edge
6. **Stay Impartial**: No bias toward popular teams or public consensus
7. **Prioritize +EV**: Long-term value > short-term results or public opinion
8. **Parlay Truth**: Explicitly warn that most parlays are -EV due to correlation
9. **Only Real Data**: Never fabricate odds, spreads, or statistics
10. **Transparency**: If you lack current data, say so - don't guess or make up numbers
11. **Bankroll Management**: Always recommend proper position sizing based on Kelly
12. **Confidence Intervals**: Provide ranges (e.g., "55-65%"), not false precision
13. **Variance Warnings**: Flag high-variance bets explicitly
14. **Historical Context**: When you have relevant historical trends, include them but don't fabricate
15. **Responsible Gambling**: Remind that even +EV bets can lose - this is probabilistic analysis, not guarantees

Today's date: ${currentDate}`;

    const managerPrompt = `You are a sports betting bankroll manager AI assistant with real-time sports data access.

CORE RESPONSIBILITIES:
1. **Bet Tracking**: Help users log and track their sports bets
2. **Bankroll Management**: Provide advice on bet sizing and risk management
3. **Live Data Analysis**: Access real-time odds and scores when users ask about games

PERSONALITY:
- Professional and analytical
- Help users make informed decisions
- Focus on responsible bankroll management
- Be concise and data-driven

BET LOGGING INSTRUCTIONS:
When a user wants to log a bet, collect these details:
1. What they're betting on (team, game, bet type)
2. Amount ($)
3. Odds (American format like -110, +150)

Then confirm in natural language: "I've logged your bet on [description] for $[amount] at [odds]. Good luck!"

The system will automatically track the game result and update your bankroll when the game finishes.

MANAGEMENT GUIDELINES:
- Recommend 1-5% of bankroll per bet based on risk tolerance:
  * Conservative: 1-2% per bet
  * Moderate: 2-3% per bet
  * Aggressive: 3-5% per bet
- Warn against betting >10% of bankroll on single plays
- Encourage disciplined unit sizing and emotional discipline

COMMUNICATION:
- Keep answers conversational but precise
- Never use asterisks (*) for formatting - use plain text only
- Write naturally and conversationally
- Be encouraging but honest about performance
- Only provide specific recommendations when you have current data

Today's date: ${currentDate}`;

    // Select the appropriate prompt based on betting mode
    const coachPrompt = bettingMode === 'advanced' ? advancedModePrompt : basicModePrompt;
    const basePrompt = coachPrompt;

    // PHASE 1.3: Add comprehensive bet outcome context with stats
    // Build context for bankroll update if detected
    let bankrollUpdateContext = '';
    if (bankrollUpdateResult) {
      if (bankrollUpdateResult.error) {
        // Validation error occurred
        bankrollUpdateContext = `
BANKROLL VALIDATION ERROR:
${bankrollUpdateResult.message}

RESPONSE INSTRUCTIONS:
- Politely inform the user that their bankroll/unit size value was not accepted
- Explain the specific validation issue in a friendly way
- Provide the correct range or requirement
- Ask them to try again with a valid value
- Example: "I noticed you tried to set a bankroll of $0.50, but the minimum is $1.00. Could you provide a bankroll amount of at least $1?"
`;
      } else if (bankrollUpdateResult.success && bankrollUpdateResult.warning) {
        // Warning for risky unit size
        bankrollUpdateContext = `
BANKROLL UPDATED WITH WARNING:
${bankrollUpdateResult.message}

RESPONSE INSTRUCTIONS:
- Acknowledge the bankroll/unit size was set
- Gently warn them about the high unit size relative to bankroll
- Explain that most experts recommend 1-5% per unit
- Ask if they want to reconsider or if this is intentional
- Be supportive, not judgmental
- Example: "I've set your unit size to $500, but I want to check - that's 10% of your $5,000 bankroll. Most professionals recommend 1-5% to minimize risk. Would you like to adjust that, or is this intentional for your strategy?"
`;
      } else if (bankrollUpdateResult.success) {
        // Normal success case
        bankrollUpdateContext = `
USER JUST UPDATED THEIR BANKROLL SETTINGS:
${bankrollUpdateResult.message}

RESPONSE INSTRUCTIONS:
- Warmly acknowledge the bankroll setup
- Confirm the exact amounts they provided
- If they only set bankroll (no unit size), suggest setting a unit size (recommend 1-5% of bankroll based on risk tolerance)
- If they only set unit size, confirm it
- If they set both, confirm both amounts
- Keep response brief and friendly (2-3 sentences)
- Example: "Perfect! I've got your bankroll set at $5,000. Since you mentioned a $50 unit size, that's a conservative 1% approach - great for managing risk!"
`;
      }
    }

    let betOutcomeContext = '';
    if (betOutcomeResult) {
      // Handle error cases (NOT_FOUND, MULTIPLE_BETS, etc.)
      if (betOutcomeResult.error || !betOutcomeResult.success) {
        if (betOutcomeResult.code === 'MULTIPLE_BETS') {
          // Ask user to clarify which bet
          betOutcomeContext = `
MULTIPLE PENDING BETS FOUND:
The user has ${betOutcomeResult.bets.length} pending bets matching their description:

${betOutcomeResult.bets.map((b: any, i: number) => `
${i + 1}. ${b.description}
   - Amount: $${b.amount}
   - Odds: ${b.odds > 0 ? '+' : ''}${b.odds}
   - Placed: ${new Date(b.created_at).toLocaleDateString()}
`).join('')}

RESPONSE INSTRUCTIONS:
Ask the user to be more specific about which bet they want to settle. List the bets above and ask them to clarify by providing more details (e.g., the exact amount, odds, or when they placed it).`;
        } else if (betOutcomeResult.code === 'NOT_FOUND') {
          betOutcomeContext = `
NO PENDING BET FOUND:
${betOutcomeResult.error}

RESPONSE INSTRUCTIONS:
Politely inform the user that you couldn't find a pending bet matching their description. Ask them to:
1. Check if they already settled this bet
2. Provide more details about the bet (exact team name, amount, or when they placed it)
3. Or ask them to log the bet first if they haven't done so yet`;
        } else {
          // Generic error
          betOutcomeContext = `
BET SETTLEMENT ERROR:
${betOutcomeResult.error}

RESPONSE INSTRUCTIONS:
Apologize and inform the user that there was an issue settling their bet. Ask them to try again or contact support if the problem persists.`;
        }
      } else {
        // Success case - formatted response
        const { bet, settlement, bankroll } = betOutcomeResult;
        const outcomeEmoji = detectedOutcome === 'win' ? '🎉' : detectedOutcome === 'loss' ? '😔' : '↔️';
        const profitSign = settlement.profit >= 0 ? '+' : '';

        // Fetch updated bankroll status after settlement to get P/L percentage
        const supabaseClient = getSupabaseClient();
        const { data: updatedBankrollData } = await supabaseClient
          .rpc('get_user_bankroll_status', { p_user_id: userId });

        const updatedStatus = updatedBankrollData?.[0];
        const plSign = updatedStatus?.profit_loss >= 0 ? '+' : '';
        const plPct = updatedStatus?.profit_loss_pct || 0;

        // Use bankroll data from settlement result (more efficient and guaranteed fresh)
        const newBalance = bankroll?.new || updatedStatus?.current_balance;
        const bankrollChange = bankroll?.change || settlement.profit;

        betOutcomeContext = `
${outcomeEmoji} BET SETTLED SUCCESSFULLY:

Bet Details:
- Description: ${bet.description}
- Amount Wagered: $${bet.amount.toFixed(2)}
- Odds: ${bet.odds > 0 ? '+' : ''}${bet.odds}
- Outcome: ${bet.outcome.toUpperCase()}

Financial Impact:
- Profit/Loss from this bet: ${profitSign}$${settlement.profit.toFixed(2)}
- Return: $${settlement.actual_return.toFixed(2)}
- **BANKROLL CHANGE: ${profitSign}$${Math.abs(bankrollChange).toFixed(2)} (${bankroll?.previous?.toFixed(2) || 'N/A'} → $${newBalance?.toFixed(2) || 'N/A'})**
- **UPDATED TOTAL P/L: ${plSign}$${updatedStatus?.profit_loss?.toFixed(2) || '0.00'} (${plSign}${plPct.toFixed(1)}% from starting bankroll)**
- New Balance: $${newBalance?.toFixed(2) || '0.00'}

RESPONSE INSTRUCTIONS:
Respond to the user with enthusiasm and empathy appropriate to the outcome:

${detectedOutcome === 'win' ? `
✅ FOR A WIN:
1. Congratulate them warmly on the win
2. Highlight the profit from this bet: "${profitSign}$${settlement.profit.toFixed(2)}"
3. **ALWAYS mention their updated total P/L percentage: "That brings you to ${plSign}${plPct.toFixed(1)}% overall!"**
4. Keep it concise and celebratory (2-3 sentences)
` : detectedOutcome === 'loss' ? `
❌ FOR A LOSS:
1. Be empathetic and encouraging
2. Acknowledge the loss: "$${Math.abs(settlement.profit).toFixed(2)}"
3. **ALWAYS mention their updated total P/L percentage: "You're now at ${plSign}${plPct.toFixed(1)}% overall"**
4. Focus on the long game and staying disciplined
5. Be supportive, not discouraging (2-3 sentences)
` : `
↔️ FOR A PUSH:
1. Explain that the bet pushed (tie/voided)
2. Confirm their stake was returned: "$${bet.amount.toFixed(2)}"
3. Mention their P/L remains at ${plSign}${plPct.toFixed(1)}%
4. Keep it brief and neutral (1-2 sentences)
`}

Keep your response CONCISE but ALWAYS include the updated P/L percentage.`;
      }
    }

    const systemPrompt = dataContext
      ? `${basePrompt}

${bankrollContext}

${isAskingForScore ? 'LIVE SCORE DATA RETRIEVED:' : 'LIVE BETTING DATA RETRIEVED:'}
${dataContext}

INSTRUCTIONS:
${isAskingForScore
  ? '- Provide clear, concise score updates based on the data above\n- Include game status and any relevant context\n- Only provide betting analysis if specifically requested along with the score'
  : '- Use this live data to provide specific, concrete analysis\n- Reference actual odds, spreads, and totals from the data provided\n- Identify specific edges based on matchup analysis, injury impacts, and situational factors\n- Compare odds across different bookmakers when available\n- Provide reasoning based on the actual data, not generic principles\n- Recommend bet sizing based on your confidence level\n- Be direct and actionable with your recommendations'}`
      : bankrollUpdateContext
        ? `${basePrompt}

${bankrollContext}

${bankrollUpdateContext}`
      : betOutcomeContext
        ? `${basePrompt}

${bankrollContext}

${betOutcomeContext}`
        : `${basePrompt}

${bankrollContext}

If the user asks about a specific game, matchup, or betting opportunity, you will automatically receive live data. Use that data to provide concrete, quantified analysis.`;

    const dataFetchTime = Date.now() - requestStartTime;
    console.log(`[PERF] Data fetching completed in ${dataFetchTime}ms`);
    console.log(`[PERF] Sending request to AI...`);

    const aiStartTime = Date.now();
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: systemPrompt
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    console.log(`[PERF] AI request initiated in ${Date.now() - aiStartTime}ms`);
    console.log(`[PERF] Total time before streaming: ${Date.now() - requestStartTime}ms`);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the streamed response to extract and log bets
    if (conversationId && userId) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader!.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              fullResponse += chunk;
              controller.enqueue(value);
            }
            
            // After streaming completes, check for bet confirmation pattern
            console.log('=== CHECKING FOR BET CONFIRMATION ===');
            console.log('Full Response:', fullResponse);
            
            const betPatterns = [
              /(?:logged|tracking|recorded|placed).*?bet.*?(?:on|for)\s+(.+?)\s+(?:for|amount:?|\$)\s*\$?([\d.]+).*?(?:at|odds:?|@)\s*([-+]?\d+)/i,
              /bet.*?on\s+(.+?)\s+for\s+\$?([\d.]+)\s+at\s+([-+]?\d+)/i,
              /betting\s+\$?([\d.]+)\s+on\s+(.+?)\s+at\s+([-+]?\d+)/i,
            ];
            
            let match = null;
            let patternIndex = -1;
            for (let i = 0; i < betPatterns.length; i++) {
              match = fullResponse.match(betPatterns[i]);
              if (match) {
                patternIndex = i;
                console.log(`✅ Matched pattern ${i}:`, match);
                break;
              }
            }
            
            if (match) {
              let description, amount, odds;
              
              if (patternIndex === 2) {
                [, amount, description, odds] = match;
              } else {
                [, description, amount, odds] = match;
              }
              
              console.log('Extracted bet details:', { description, amount, odds });

              // Comprehensive team name matching across all major sports
              const allTeams = [
                // NBA Teams
                'Lakers', 'Celtics', 'Warriors', 'Heat', 'Nets', 'Knicks', 'Bulls', 'Cavaliers', 'Mavericks',
                'Rockets', 'Spurs', 'Clippers', '76ers', 'Sixers', 'Bucks', 'Raptors', 'Suns', 'Nuggets',
                'Jazz', 'Trail Blazers', 'Blazers', 'Kings', 'Grizzlies', 'Pelicans', 'Thunder', 'Timberwolves',
                'Wolves', 'Hawks', 'Hornets', 'Pistons', 'Pacers', 'Magic', 'Wizards', 'Cavs',
                // NFL Teams
                'Patriots', 'Bills', 'Dolphins', 'Jets', 'Ravens', 'Bengals', 'Browns', 'Steelers',
                'Texans', 'Colts', 'Jaguars', 'Titans', 'Broncos', 'Chiefs', 'Raiders', 'Chargers',
                'Cowboys', 'Giants', 'Eagles', 'Commanders', 'Bears', 'Lions', 'Packers', 'Vikings',
                'Falcons', 'Panthers', 'Saints', 'Buccaneers', 'Cardinals', 'Rams', '49ers', 'Seahawks',
                // MLB Teams
                'Yankees', 'Red Sox', 'Blue Jays', 'Orioles', 'Rays', 'Dodgers', 'Giants', 'Padres',
                'Athletics', 'Angels', 'Astros', 'Rangers', 'Mariners', 'White Sox', 'Indians', 'Guardians',
                'Tigers', 'Royals', 'Twins', 'Brewers', 'Cardinals', 'Cubs', 'Reds', 'Pirates', 'Braves',
                'Marlins', 'Mets', 'Phillies', 'Nationals', 'Rockies', 'Diamondbacks',
                // NHL Teams
                'Bruins', 'Maple Leafs', 'Canadiens', 'Senators', 'Sabres', 'Rangers', 'Islanders',
                'Devils', 'Penguins', 'Flyers', 'Capitals', 'Hurricanes', 'Blue Jackets', 'Panthers',
                'Lightning', 'Predators', 'Stars', 'Blues', 'Blackhawks', 'Avalanche', 'Wild', 'Jets',
                'Flames', 'Oilers', 'Canucks', 'Golden Knights', 'Kraken', 'Ducks', 'Kings', 'Sharks', 'Coyotes'
              ];

              const teamPattern = new RegExp(`\\b(${allTeams.join('|')})\\b`, 'i');
              const teamMatch = description.match(teamPattern);
              const team = teamMatch ? teamMatch[0] : undefined;
              
              await logBetViaFunction(
                {
                  amount: Number(amount),
                  odds: Number(odds),
                  description: description.trim(),
                  team,
                },
                conversationId,
                userId
              );
            } else {
              console.log('❌ No bet pattern matched in response');
            }
            
            controller.close();
          } catch (error) {
            console.error('Stream error:', error);
            controller.error(error);
          }
        }
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
