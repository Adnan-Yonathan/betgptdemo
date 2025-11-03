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
  // - If basic indicators are present (user explicitly requests simple analysis), use basic mode
  // - Otherwise default to advanced mode for professional-grade analysis
  // - Advanced mode provides EV, edges, statistical reasoning by default

  if (basicScore > 0) {
    console.log(`[MODE DETECTION] Basic mode selected (explicit basic request)`);
    return 'basic';
  }

  // Default to advanced mode for sophisticated betting analysis
  console.log(`[MODE DETECTION] Advanced mode selected (default for professional analysis, score: ${advancedScore})`);
  return 'advanced';
}

/**
 * Extract team names from query
 */
function extractTeamNames(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const teams: string[] = [];

  // NBA teams
  const nbaTeams = [
    'Lakers', 'Celtics', 'Warriors', 'Heat', 'Bucks', 'Nets', 'Suns', 'Clippers',
    'Nuggets', 'Mavericks', 'Grizzlies', '76ers', 'Bulls', 'Cavaliers', 'Hawks',
    'Raptors', 'Knicks', 'Pacers', 'Wizards', 'Hornets', 'Pistons', 'Magic',
    'Thunder', 'Rockets', 'Spurs', 'Kings', 'Pelicans', 'Trail Blazers', 'Timberwolves', 'Jazz'
  ];

  // NFL teams
  const nflTeams = [
    'Chiefs', 'Bills', 'Eagles', 'Cowboys', '49ers', 'Ravens', 'Bengals', 'Dolphins',
    'Chargers', 'Jaguars', 'Vikings', 'Giants', 'Jets', 'Packers', 'Seahawks',
    'Lions', 'Browns', 'Steelers', 'Commanders', 'Raiders', 'Broncos', 'Saints',
    'Buccaneers', 'Panthers', 'Falcons', 'Titans', 'Colts', 'Patriots', 'Rams', 'Cardinals', 'Texans', 'Bears'
  ];

  const allTeams = [...nbaTeams, ...nflTeams];

  for (const team of allTeams) {
    if (lowerQuery.includes(team.toLowerCase())) {
      teams.push(team);
    }
  }

  return teams;
}

/**
 * Detect league from query
 */
function detectLeague(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('nfl') || lowerQuery.includes('football')) {
    return 'NFL';
  }

  if (lowerQuery.includes('nba') || lowerQuery.includes('basketball')) {
    return 'NBA';
  }

  if (lowerQuery.includes('mlb') || lowerQuery.includes('baseball')) {
    return 'MLB';
  }

  if (lowerQuery.includes('nhl') || lowerQuery.includes('hockey')) {
    return 'NHL';
  }

  // Default to NBA
  return 'NBA';
}

/**
 * Fetch injury reports for teams mentioned in the query
 */
async function fetchInjuryData(query: string, teams: string[]): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (teams.length === 0) return '';

  try {
    // Fetch injury reports for the mentioned teams
    const { data: injuries, error } = await supabase
      .from('injury_reports')
      .select('*')
      .in('team', teams)
      .in('injury_status', ['Out', 'Doubtful', 'Questionable'])
      .order('impact_level', { ascending: false })
      .limit(20);

    if (error || !injuries || injuries.length === 0) {
      return '';
    }

    let injuryText = '\n\n🏥 INJURY REPORTS:\n';

    for (const team of teams) {
      const teamInjuries = injuries.filter(i => i.team === team);

      if (teamInjuries.length > 0) {
        injuryText += `\n${team}:\n`;

        const highImpact = teamInjuries.filter(i => i.impact_level === 'High');
        const mediumImpact = teamInjuries.filter(i => i.impact_level === 'Medium');
        const lowImpact = teamInjuries.filter(i => i.impact_level === 'Low');

        if (highImpact.length > 0) {
          injuryText += `  ⚠️ KEY INJURIES (High Impact):\n`;
          for (const inj of highImpact) {
            injuryText += `    - ${inj.player_name} (${inj.position || 'N/A'}): ${inj.injury_status}`;
            if (inj.injury_type) injuryText += ` - ${inj.injury_type}`;
            injuryText += '\n';
          }
        }

        if (mediumImpact.length > 0) {
          injuryText += `  ⚡ MODERATE IMPACT:\n`;
          for (const inj of mediumImpact) {
            injuryText += `    - ${inj.player_name}: ${inj.injury_status}\n`;
          }
        }

        if (lowImpact.length > 0 && lowImpact.length <= 3) {
          injuryText += `  ℹ️ Minor: ${lowImpact.map(i => i.player_name).join(', ')}\n`;
        }
      }
    }

    return injuryText;
  } catch (error) {
    console.error('[INJURY_FETCH] Error:', error);
    return '';
  }
}

/**
 * Fetch team trends (last 10 games, ATS record, etc.)
 */
async function fetchTeamTrends(teams: string[], league: string = 'NBA'): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (teams.length === 0) return '';

  try {
    let trendsText = '\n\n📊 TEAM TRENDS & RECENT PERFORMANCE:\n';

    for (const team of teams) {
      // Call the calculate-team-trends function
      const response = await fetch(`${supabaseUrl}/functions/v1/calculate-team-trends`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ team, league }),
      });

      if (!response.ok) {
        console.error(`[TRENDS_FETCH] Failed to fetch trends for ${team}`);
        continue;
      }

      const result = await response.json();
      const trends = result.trends;

      if (trends) {
        trendsText += `\n${team}:\n`;
        trendsText += `  Last 10 Games: ${trends.last10Record}\n`;
        trendsText += `  Last 5 Games: ${trends.last5Record} (${trends.recentForm.join('-')})\n`;
        trendsText += `  Home Record: ${trends.homeRecord}\n`;
        trendsText += `  Away Record: ${trends.awayRecord}\n`;
        trendsText += `  ATS Record: ${trends.atsRecord}\n`;
        trendsText += `  O/U Record: ${trends.ouRecord}\n`;
        trendsText += `  Avg Points Scored: ${trends.avgPointsFor}\n`;
        trendsText += `  Avg Points Allowed: ${trends.avgPointsAgainst}\n`;
        trendsText += `  Point Differential: ${trends.avgPointDifferential > 0 ? '+' : ''}${trends.avgPointDifferential}\n`;

        if (trends.currentStreak.type !== 'none') {
          trendsText += `  Current Streak: ${trends.currentStreak.count} ${trends.currentStreak.type}${trends.currentStreak.count > 1 ? 's' : ''}\n`;
        }
      }
    }

    return trendsText;
  } catch (error) {
    console.error('[TRENDS_FETCH] Error:', error);
    return '';
  }
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
      console.log(`[FETCH] Fetched ${result.count} fresh lineups via The Rundown API`);
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
      console.log(`[FETCH] Fetched ${result.count} fresh scores via The Rundown API`);

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

  // CRITICAL: Reject data older than 2 hours as too stale for reliable betting
  if (dataAgeMinutes > 120) {
    return `ERROR: Betting odds data is too stale (${dataAgeMinutes} minutes / ${Math.floor(dataAgeMinutes / 60)} hours old). Cannot provide reliable recommendations. Data last updated: ${lastUpdated.toLocaleString()}. The automated refresh system should update this data within 30 minutes. Please try again later or contact support if this persists.`;
  }

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

  // ENHANCED: Stronger, clearer staleness warnings
  if (dataAgeMinutes > 60) {
    result += `⚠️ DATA QUALITY: STALE (>1 hour old) - Lines may have significantly moved. Use with extreme caution or wait for refresh.\n\n`;
  } else if (dataAgeMinutes > 30) {
    result += `⚠️ DATA QUALITY: MODERATELY STALE (>30 min old) - Lines may have moved since last update.\n\n`;
  } else if (dataAgeMinutes > 15) {
    result += `Data Freshness: RECENT (updated ${dataAgeMinutes} min ago)\n\n`;
  } else if (dataAgeMinutes > 5) {
    result += `Data Freshness: FRESH (updated ${dataAgeMinutes} min ago) ✅\n\n`;
  } else {
    result += `Data Freshness: VERY FRESH (updated ${dataAgeMinutes} min ago) ✅✅\n\n`;
  }

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

  result += `\nData Source: The Rundown API (Live)\n`;
  result += `Total Events: ${eventMap.size}\n`;
  
  return result;
}

/**
 * Fetch pre-computed odds discrepancies from the database
 * This prevents token limit issues by using pre-calculated probability differences
 */
async function fetchOddsDiscrepancies(query: string, limit: number = 20): Promise<string> {
  const supabase = getSupabaseClient();

  console.log("Fetching odds discrepancies for query:", query);

  // Determine sport from query
  let sport = 'americanfootball_nfl'; // default
  const queryLower = query.toLowerCase();

  if (queryLower.includes('nba') || queryLower.includes('basketball')) {
    sport = 'basketball_nba';
  } else if (queryLower.includes('mlb') || queryLower.includes('baseball')) {
    sport = 'baseball_mlb';
  } else if (queryLower.includes('nhl') || queryLower.includes('hockey')) {
    sport = 'icehockey_nhl';
  } else if (queryLower.includes('ncaaf') || queryLower.includes('college football')) {
    sport = 'americanfootball_ncaaf';
  }

  try {
    // Fetch recent discrepancies (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    let query_builder = supabase
      .from('odds_discrepancies')
      .select('*')
      .gte('calculated_at', oneHourAgo)
      .order('probability_difference', { ascending: false })
      .limit(limit);

    // Filter by sport if not asking for "all" discrepancies
    if (!queryLower.includes('all sports') && !queryLower.includes('every sport')) {
      query_builder = query_builder.eq('sport', sport);
    }

    const { data: discrepancies, error } = await query_builder;

    if (error) {
      console.error('Error fetching odds discrepancies:', error);
      return "No odds discrepancy data available at the moment.";
    }

    if (!discrepancies || discrepancies.length === 0) {
      return `No significant odds discrepancies found for ${sport} in the last hour.\n\nNote: Discrepancies are automatically analyzed every 15 minutes. Check back soon or ask about a different sport.`;
    }

    return formatDiscrepanciesData(discrepancies, queryLower);

  } catch (error) {
    console.error('Exception fetching odds discrepancies:', error);
    return "Error retrieving odds discrepancy analysis. Please try again.";
  }
}

/**
 * Format discrepancies data for the AI to use in responses
 */
function formatDiscrepanciesData(discrepancies: any[], query: string): string {
  let result = "=== BETTING ODDS DISCREPANCY ANALYSIS ===\n\n";
  result += `Found ${discrepancies.length} significant odds discrepancies across bookmakers.\n`;
  result += `Data freshness: ${discrepancies[0]?.data_freshness_minutes || 'N/A'} minutes old\n\n`;

  // Group by game
  const gameMap = new Map<string, any[]>();

  for (const disc of discrepancies) {
    const gameKey = `${disc.away_team} @ ${disc.home_team}`;
    if (!gameMap.has(gameKey)) {
      gameMap.set(gameKey, []);
    }
    gameMap.get(gameKey)!.push(disc);
  }

  result += `=== TOP DISCREPANCIES BY GAME ===\n\n`;

  for (const [game, discs] of gameMap.entries()) {
    result += `📊 ${game}\n`;

    if (discs[0].game_time) {
      const gameTime = new Date(discs[0].game_time);
      result += `   Game Time: ${gameTime.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}\n`;
    }

    result += `\n`;

    // Sort by probability difference (biggest first)
    discs.sort((a, b) => b.probability_difference - a.probability_difference);

    for (const disc of discs) {
      const marketName = disc.market_key === 'h2h' ? 'Moneyline' :
                        disc.market_key === 'spreads' ? 'Spread' : 'Total';

      result += `   ${marketName}: ${disc.outcome_name}\n`;
      result += `   └─ BIGGEST DISCREPANCY: ${(disc.probability_difference * 100).toFixed(2)}%\n`;
      result += `      • ${disc.bookmaker_low}: ${disc.odds_low > 0 ? '+' : ''}${disc.odds_low} → ${(disc.probability_low * 100).toFixed(2)}% implied\n`;
      result += `      • ${disc.bookmaker_high}: ${disc.odds_high > 0 ? '+' : ''}${disc.odds_high} → ${(disc.probability_high * 100).toFixed(2)}% implied\n`;

      if (disc.point_low !== null && disc.point_low !== disc.point_high) {
        result += `      • Line difference: ${disc.point_low} vs ${disc.point_high}\n`;
      }

      result += `      • Coverage: ${disc.num_bookmakers} bookmakers\n`;
      result += `\n`;
    }

    result += `\n`;
  }

  // Add summary of biggest single discrepancy
  const biggest = discrepancies[0];
  result += `🔥 LARGEST SINGLE DISCREPANCY:\n`;
  result += `${biggest.away_team} @ ${biggest.home_team}\n`;
  result += `${biggest.market_key === 'h2h' ? 'Moneyline' : biggest.market_key === 'spreads' ? 'Spread' : 'Total'}: ${biggest.outcome_name}\n`;
  result += `Probability Range: ${(biggest.probability_low * 100).toFixed(2)}% to ${(biggest.probability_high * 100).toFixed(2)}%\n`;
  result += `Difference: ${(biggest.probability_difference * 100).toFixed(2)}%\n`;
  result += `${biggest.bookmaker_low} (${biggest.odds_low > 0 ? '+' : ''}${biggest.odds_low}) vs ${biggest.bookmaker_high} (${biggest.odds_high > 0 ? '+' : ''}${biggest.odds_high})\n\n`;

  result += `\nIMPORTANT NOTES:\n`;
  result += `- Discrepancies indicate disagreement between bookmakers\n`;
  result += `- Larger discrepancies may signal value betting opportunities\n`;
  result += `- Always verify current lines before placing bets\n`;
  result += `- Consider why bookmakers disagree (sharp action, news, injuries, etc.)\n`;

  return result;
}

// Helper function to call log-bet edge function
async function logBetViaFunction(
  betDetails: { amount: number; odds: number; description: string; team?: string },
  conversationId: string,
  userId: string,
  authHeader: string
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
      headers: {
        Authorization: authHeader,
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

/**
 * Handles logging historical bets (bets placed at external sportsbooks)
 * Patterns: "I won $200 on Lakers yesterday", "I lost $100 on Celtics last night"
 */
async function handleHistoricalBet(
  userId: string,
  conversationId: string,
  messageContent: string
): Promise<any> {
  const supabase = getSupabaseClient();

  // Patterns for historical wins
  const historicalWinPatterns = [
    /(?:i\s+)?won\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+on\s+(?:the\s+)?(.+?)(?:\s+yesterday|\s+last\s+(?:night|week|game)|$)/i,
    /(?:i\s+)?hit\s+(?:a\s+)?\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:on\s+)?(?:the\s+)?(.+?)(?:\s+yesterday|\s+last\s+(?:night|week|game)|$)/i,
    /(?:i\s+)?cashed\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+on\s+(?:the\s+)?(.+?)(?:\s+yesterday|\s+last\s+(?:night|week|game)|$)/i,
  ];

  // Patterns for historical losses
  const historicalLossPatterns = [
    /(?:i\s+)?lost\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+on\s+(?:the\s+)?(.+?)(?:\s+yesterday|\s+last\s+(?:night|week|game)|$)/i,
    /(?:i\s+)?missed\s+(?:a\s+)?\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:on\s+)?(?:the\s+)?(.+?)(?:\s+yesterday|\s+last\s+(?:night|week|game)|$)/i,
  ];

  let amount: number | null = null;
  let team: string | null = null;
  let outcome: 'win' | 'loss' | null = null;

  // Check for historical wins
  for (const pattern of historicalWinPatterns) {
    const match = messageContent.match(pattern);
    if (match && match[1] && match[2]) {
      amount = parseFloat(match[1].replace(/,/g, ''));
      team = match[2].trim();
      outcome = 'win';
      console.log(`📊 Detected historical win: $${amount} on ${team}`);
      break;
    }
  }

  // Check for historical losses if no win found
  if (!outcome) {
    for (const pattern of historicalLossPatterns) {
      const match = messageContent.match(pattern);
      if (match && match[1] && match[2]) {
        amount = parseFloat(match[1].replace(/,/g, ''));
        team = match[2].trim();
        outcome = 'loss';
        console.log(`📊 Detected historical loss: $${amount} on ${team}`);
        break;
      }
    }
  }

  if (!outcome || !amount || !team) {
    return null; // No historical bet detected
  }

  try {
    // For a win, amount is the profit; for a loss, amount is what they lost
    // We need to calculate the bet amount and actual return
    let betAmount: number;
    let actualReturn: number;
    let profitLoss: number;

    if (outcome === 'win') {
      // User said "won $X" - this is the profit
      // Assume they bet a similar amount (could ask for clarification)
      // For now, assume standard -110 odds, so bet ~110 to win 100
      betAmount = amount * 1.1; // Rough estimate
      actualReturn = betAmount + amount;
      profitLoss = amount;
    } else {
      // User said "lost $X" - this is what they wagered
      betAmount = amount;
      actualReturn = 0;
      profitLoss = -amount;
    }

    // Insert bet record with outcome already set
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        amount: betAmount,
        odds: -110, // Default odds
        description: `${team} (historical bet)`,
        potential_return: betAmount * 1.909, // -110 odds
        actual_return: actualReturn,
        outcome: outcome,
        team_bet_on: team,
        bet_type: 'straight',
        profit_loss: profitLoss,
        settled_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (betError) {
      console.error('Error inserting historical bet:', betError);
      return {
        error: true,
        message: 'Failed to log historical bet',
        code: 'INSERT_ERROR'
      };
    }

    // Update bankroll
    const { data: profile } = await supabase
      .from('profiles')
      .select('bankroll')
      .eq('id', userId)
      .single();

    const currentBankroll = profile?.bankroll || 1000;
    const newBankroll = currentBankroll + profitLoss;

    await supabase
      .from('profiles')
      .update({ bankroll: newBankroll })
      .eq('id', userId);

    await supabase
      .from('user_bankroll')
      .update({
        current_amount: newBankroll,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    // Log transaction
    await supabase
      .from('bankroll_transactions')
      .insert({
        user_id: userId,
        type: outcome === 'win' ? 'bet_won' : 'bet_lost',
        amount: Math.abs(profitLoss),
        balance_after: newBankroll,
        bet_id: bet.id,
        notes: `Historical ${outcome} on ${team}`,
        created_at: new Date().toISOString()
      });

    console.log(`✅ Historical bet logged: ${outcome} $${amount} on ${team}`);

    return {
      success: true,
      outcome,
      amount,
      team,
      betAmount,
      profitLoss,
      previousBankroll: currentBankroll,
      newBankroll,
      bet
    };
  } catch (error) {
    console.error('Error logging historical bet:', error);
    return {
      error: true,
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'PROCESSING_ERROR'
    };
  }
}

/**
 * PHASE 3: Enhanced Memory and User Intelligence System
 * Builds comprehensive user context from preferences, patterns, insights, and conversation history
 */

/**
 * Fetches user preferences including favorite teams, leagues, and betting style
 */
async function getUserPreferences(userId: string): Promise<any> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.log('[PHASE3] No user preferences found, returning defaults');
      return null;
    }

    return data;
  } catch (error) {
    console.error('[PHASE3] Error fetching user preferences:', error);
    return null;
  }
}

/**
 * Fetches betting patterns analysis
 */
async function getBettingPatterns(userId: string): Promise<any> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('betting_patterns')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.log('[PHASE3] No betting patterns found');
      return null;
    }

    return data;
  } catch (error) {
    console.error('[PHASE3] Error fetching betting patterns:', error);
    return null;
  }
}

/**
 * Fetches active user insights
 */
async function getActiveInsights(userId: string): Promise<any[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .rpc('get_active_user_insights', { p_user_id: userId });

    if (error) {
      console.log('[PHASE3] Error fetching insights:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[PHASE3] Error fetching active insights:', error);
    return [];
  }
}

/**
 * Fetches conversation memory context
 */
async function getMemoryContext(userId: string): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .rpc('get_user_memory_context', { p_user_id: userId, p_limit: 5 });

    if (error) {
      console.log('[PHASE3] Error fetching memory context:', error);
      return '';
    }

    return data || '';
  } catch (error) {
    console.error('[PHASE3] Error fetching memory context:', error);
    return '';
  }
}

/**
 * Builds comprehensive user context prompt for AI
 */
async function buildUserContextPrompt(userId: string): Promise<string> {
  if (!userId) {
    return '';
  }

  console.log('[PHASE3] Building user context prompt...');

  // Fetch all data in parallel for performance (Phase 3 + Phase 4 + Phase 5 + Phase 6)
  const [preferences, patterns, insights, memoryContext, advancedMetrics, activeLiveBets, unreadAlerts, bankrollHistory, activeGoals] = await Promise.all([
    getUserPreferences(userId),
    getBettingPatterns(userId),
    getActiveInsights(userId),
    getMemoryContext(userId),
    getAdvancedMetrics(userId), // Phase 4: CLV and advanced stats
    getActiveLiveBets(userId), // Phase 5: Live tracked bets
    getUnreadAlerts(userId), // Phase 5: Unread alerts
    getRecentBankrollHistory(userId), // Phase 6: Bankroll tracking
    getActiveGoals(userId) // Phase 6: Active goals
  ]);

  let contextPrompt = '\n\n═══════════════════════════════════════════════════════════════\n';
  contextPrompt += '🧠 USER PROFILE & INTELLIGENCE (Phase 3 Enhanced Memory)\n';
  contextPrompt += '═══════════════════════════════════════════════════════════════\n\n';

  // Add user preferences
  if (preferences) {
    contextPrompt += '👤 USER PREFERENCES:\n';

    if (preferences.favorite_teams && preferences.favorite_teams.length > 0) {
      contextPrompt += `- Favorite Teams: ${preferences.favorite_teams.join(', ')}\n`;
    }

    if (preferences.preferred_leagues && preferences.preferred_leagues.length > 0) {
      contextPrompt += `- Preferred Leagues: ${preferences.preferred_leagues.join(', ')}\n`;
    }

    if (preferences.betting_style) {
      contextPrompt += `- Betting Style: ${preferences.betting_style}\n`;
    }

    if (preferences.risk_tolerance) {
      contextPrompt += `- Risk Tolerance: ${preferences.risk_tolerance}/10\n`;
    }

    if (preferences.betting_goals) {
      contextPrompt += `- User's Goal: "${preferences.betting_goals}"\n`;
    }

    if (preferences.betting_concerns) {
      contextPrompt += `- User's Concerns: "${preferences.betting_concerns}"\n`;
    }

    contextPrompt += '\n';
  }

  // Add betting patterns
  if (patterns && patterns.total_bets > 0) {
    contextPrompt += '📊 BETTING PATTERNS & PERFORMANCE:\n';
    contextPrompt += `- Overall Record: ${patterns.total_wins}-${patterns.total_losses}-${patterns.total_pushes} (${patterns.total_bets} bets)\n`;
    contextPrompt += `- Win Rate: ${patterns.win_rate}% | ROI: ${patterns.roi > 0 ? '+' : ''}${patterns.roi}%\n`;
    contextPrompt += `- Total Wagered: $${patterns.total_wagered?.toFixed(2) || '0.00'} | P/L: ${patterns.total_profit_loss > 0 ? '+' : ''}$${patterns.total_profit_loss?.toFixed(2) || '0.00'}\n`;

    // Current streaks
    if (patterns.current_win_streak > 0) {
      contextPrompt += `- 🔥 Current Streak: ${patterns.current_win_streak} wins\n`;
    } else if (patterns.current_loss_streak > 0) {
      contextPrompt += `- ⚠️ Current Streak: ${patterns.current_loss_streak} losses\n`;
    }

    // Tilt warning
    if (patterns.tilt_score > 60) {
      contextPrompt += `- ⚠️ TILT ALERT: Score ${patterns.tilt_score}/100 - User may be chasing losses or betting erratically\n`;
    }

    // Best/worst leagues
    if (patterns.performance_by_league && Object.keys(patterns.performance_by_league).length > 0) {
      contextPrompt += '\nPerformance by League:\n';
      const leagues = Object.entries(patterns.performance_by_league as Record<string, any>)
        .sort((a, b) => (b[1].roi || 0) - (a[1].roi || 0))
        .slice(0, 3);

      for (const [league, stats] of leagues) {
        const roi = stats.roi || 0;
        contextPrompt += `  • ${league}: ${stats.wins}-${stats.losses} (${stats.win_rate}% WR, ${roi > 0 ? '+' : ''}${roi}% ROI)\n`;
      }
    }

    // Best/worst teams
    if (patterns.performance_by_team && Object.keys(patterns.performance_by_team).length > 0) {
      contextPrompt += '\nPerformance by Team (Top 3):\n';
      const teams = Object.entries(patterns.performance_by_team as Record<string, any>)
        .filter(([_, stats]) => stats.total_bets >= 3)
        .sort((a, b) => (b[1].win_rate || 0) - (a[1].win_rate || 0))
        .slice(0, 3);

      for (const [team, stats] of teams) {
        contextPrompt += `  • ${team}: ${stats.wins}-${stats.losses} (${stats.win_rate}% WR)\n`;
      }
    }

    contextPrompt += '\n';
  }

  // Phase 4: Add CLV and advanced metrics
  if (advancedMetrics) {
    contextPrompt += '📈 PHASE 4: ADVANCED METRICS (CLV & Performance):\n';

    if (advancedMetrics.avg_clv_points) {
      const clvSign = advancedMetrics.avg_clv_points > 0 ? '+' : '';
      contextPrompt += `- Average CLV: ${clvSign}${advancedMetrics.avg_clv_points} points (${clvSign}$${advancedMetrics.avg_clv_dollars?.toFixed(2) || '0.00'})\n`;
      contextPrompt += `- Beats Closing Line: ${advancedMetrics.pct_beat_closing_line}% of bets\n`;

      if (advancedMetrics.avg_clv_points > 1.5) {
        contextPrompt += `- 🔥 EXCELLENT CLV: You're consistently beating the market!\n`;
      } else if (advancedMetrics.avg_clv_points > 0.5) {
        contextPrompt += `- ✅ POSITIVE CLV: You're finding value bets\n`;
      } else if (advancedMetrics.avg_clv_points < -0.5) {
        contextPrompt += `- ⚠️ NEGATIVE CLV: You're consistently getting worse than closing line\n`;
      }
    }

    if (advancedMetrics.sharpe_ratio) {
      contextPrompt += `- Sharpe Ratio: ${advancedMetrics.sharpe_ratio?.toFixed(2)} (risk-adjusted returns)\n`;
    }

    if (advancedMetrics.avg_kelly_efficiency) {
      const kellyEff = advancedMetrics.avg_kelly_efficiency;
      if (kellyEff > 1.5) {
        contextPrompt += `- ⚠️ Kelly Efficiency: ${kellyEff?.toFixed(2)} (overbetting - too aggressive)\n`;
      } else if (kellyEff < 0.5) {
        contextPrompt += `- Kelly Efficiency: ${kellyEff?.toFixed(2)} (underbetting - very conservative)\n`;
      } else {
        contextPrompt += `- Kelly Efficiency: ${kellyEff?.toFixed(2)} (good sizing discipline)\n`;
      }
    }

    if (advancedMetrics.spread_roi !== null && advancedMetrics.total_roi !== null && advancedMetrics.moneyline_roi !== null) {
      contextPrompt += `\nROI by Market Type:\n`;
      contextPrompt += `  • Spreads: ${advancedMetrics.spread_roi > 0 ? '+' : ''}${advancedMetrics.spread_roi}%\n`;
      contextPrompt += `  • Totals: ${advancedMetrics.total_roi > 0 ? '+' : ''}${advancedMetrics.total_roi}%\n`;
      contextPrompt += `  • Moneyline: ${advancedMetrics.moneyline_roi > 0 ? '+' : ''}${advancedMetrics.moneyline_roi}%\n`;
    }

    contextPrompt += '\n';
  }

  // Add active insights
  if (insights && insights.length > 0) {
    contextPrompt += '💡 ACTIVE INSIGHTS:\n';
    // Sort by priority and take top 5
    const topInsights = insights
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, 5);

    for (const insight of topInsights) {
      const icon = insight.insight_type === 'strength' ? '✅' :
                   insight.insight_type === 'weakness' ? '⚠️' :
                   insight.insight_type === 'warning' ? '🚨' :
                   insight.insight_type === 'milestone' ? '🎉' : '💭';
      contextPrompt += `${icon} ${insight.insight_text}\n`;
    }
    contextPrompt += '\n';
  }

  // Phase 5: Add live bet tracking and alerts
  if (activeLiveBets && activeLiveBets.length > 0) {
    contextPrompt += '🔴 PHASE 5: LIVE BETS IN PROGRESS:\n';
    for (const bet of activeLiveBets) {
      const statusIcon = bet.bet_status === 'winning' ? '✅' :
                        bet.bet_status === 'losing' ? '❌' :
                        bet.bet_status === 'push' ? '🟰' : '⏳';
      contextPrompt += `${statusIcon} ${bet.home_team} vs ${bet.away_team} - ${bet.current_score}\n`;
      contextPrompt += `   Type: ${bet.bet_type} | Amount: $${bet.bet_amount} | Status: ${bet.bet_status.toUpperCase()}\n`;
      if (bet.time_remaining) {
        contextPrompt += `   Time: ${bet.time_remaining}\n`;
      }
      if (bet.points_needed !== null && bet.points_needed !== undefined) {
        const needText = bet.points_needed > 0 ? `Need ${bet.points_needed} more points` : `Covering by ${Math.abs(bet.points_needed)} points`;
        contextPrompt += `   ${needText}\n`;
      }
    }
    contextPrompt += '\n';
  }

  if (unreadAlerts && unreadAlerts.length > 0) {
    contextPrompt += '🚨 UNREAD ALERTS:\n';
    // Sort by priority and take top 5 most urgent
    const topAlerts = unreadAlerts
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, 5);

    for (const alert of topAlerts) {
      const priorityIcon = alert.priority >= 3 ? '🚨' :
                          alert.priority >= 2 ? '⚠️' :
                          alert.priority >= 1 ? 'ℹ️' : '💬';
      contextPrompt += `${priorityIcon} ${alert.alert_title}: ${alert.alert_message}\n`;
    }
    contextPrompt += '\n';
  }

  // Phase 6: Add bankroll tracking and goals
  if (bankrollHistory && bankrollHistory.length > 0) {
    contextPrompt += '💰 PHASE 6: BANKROLL TRACKING (Last 30 Days):\n';

    // Calculate stats from history
    const firstDay = bankrollHistory[0];
    const lastDay = bankrollHistory[bankrollHistory.length - 1];
    const growthAmount = lastDay.bankroll - firstDay.bankroll;
    const growthPercent = ((growthAmount / firstDay.bankroll) * 100).toFixed(1);
    const totalDailyPL = bankrollHistory.reduce((sum: number, day: any) => sum + (day.daily_profit_loss || 0), 0);
    const peakBankroll = Math.max(...bankrollHistory.map((day: any) => day.bankroll));

    contextPrompt += `- Current Bankroll: $${lastDay.bankroll.toFixed(2)}\n`;
    contextPrompt += `- 30-Day Change: ${growthAmount >= 0 ? '+' : ''}$${growthAmount.toFixed(2)} (${growthAmount >= 0 ? '+' : ''}${growthPercent}%)\n`;
    contextPrompt += `- Peak (30D): $${peakBankroll.toFixed(2)}\n`;
    contextPrompt += `- Total Daily P/L (30D): ${totalDailyPL >= 0 ? '+' : ''}$${totalDailyPL.toFixed(2)}\n`;

    if (growthAmount >= 0) {
      contextPrompt += `- ✅ Trending upward - positive momentum!\n`;
    } else {
      const drawdown = ((1 - lastDay.bankroll / peakBankroll) * 100).toFixed(1);
      contextPrompt += `- ⚠️ Down ${drawdown}% from peak - consider reviewing strategy\n`;
    }

    contextPrompt += '\n';
  }

  if (activeGoals && activeGoals.length > 0) {
    contextPrompt += '🎯 ACTIVE BETTING GOALS:\n';
    for (const goal of activeGoals.slice(0, 3)) { // Show top 3 goals
      const progress = goal.progress_percentage || 0;
      const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));

      contextPrompt += `- ${goal.goal_name}: ${progress.toFixed(0)}% [${progressBar}]\n`;
      contextPrompt += `  Target: ${goal.target_value}${goal.unit === 'percentage' ? '%' : goal.unit === 'dollars' ? ' dollars' : ''}\n`;
      contextPrompt += `  Current: ${goal.current_value}${goal.unit === 'percentage' ? '%' : goal.unit === 'dollars' ? ' dollars' : ''}\n`;

      if (goal.is_achieved) {
        contextPrompt += `  🎉 GOAL ACHIEVED!\n`;
      } else if (goal.days_remaining !== null) {
        contextPrompt += `  ⏰ ${goal.days_remaining} days remaining\n`;
      }
    }
    contextPrompt += '\n';
  }

  // Add conversation memory
  if (memoryContext && memoryContext.trim().length > 0) {
    contextPrompt += '🗂️ RECENT CONVERSATION MEMORY:\n';
    contextPrompt += memoryContext;
    contextPrompt += '\n';
  }

  contextPrompt += '═══════════════════════════════════════════════════════════════\n';
  contextPrompt += 'INSTRUCTIONS FOR USING THIS CONTEXT:\n';
  contextPrompt += '- Reference user\'s favorite teams and past performance when relevant\n';
  contextPrompt += '- Consider their betting style and risk tolerance in recommendations\n';
  contextPrompt += '- Warn them if they\'re betting on teams/leagues where they struggle\n';
  contextPrompt += '- Praise them when betting on teams/leagues where they excel\n';
  contextPrompt += '- If tilt score is high, be extra cautious with bet sizing recommendations\n';
  contextPrompt += '- Reference past conversations and advice to maintain continuity\n';
  contextPrompt += '- Proactively mention relevant insights without being asked\n';
  contextPrompt += '- [PHASE 5] Proactively mention live bets in progress and unread alerts\n';
  contextPrompt += '- [PHASE 5] If user has live bets, provide context on current game state\n';
  contextPrompt += '- [PHASE 5] Alert user to critical moments or momentum shifts they should know about\n';
  contextPrompt += '- [PHASE 6] Reference bankroll growth trends when discussing performance\n';
  contextPrompt += '- [PHASE 6] Celebrate goal achievements and encourage progress toward active goals\n';
  contextPrompt += '- [PHASE 6] Suggest viewing Analytics dashboard for detailed performance breakdown\n';
  contextPrompt += '- [PHASE 6] If user asks about stats/performance, mention the /analytics page\n';
  contextPrompt += '═══════════════════════════════════════════════════════════════\n\n';

  console.log('[PHASE3] User context prompt built successfully');
  return contextPrompt;
}

/**
 * PHASE 4: Advanced Statistical Models & EV Analysis
 * Calculates Expected Value, Kelly sizing, and game predictions
 */

/**
 * Fetches advanced metrics including CLV stats
 */
async function getAdvancedMetrics(userId: string): Promise<any> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('advanced_metrics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.log('[PHASE4] No advanced metrics found');
      return null;
    }

    return data;
  } catch (error) {
    console.error('[PHASE4] Error fetching advanced metrics:', error);
    return null;
  }
}

// Removed: predictGameWithElo function - no longer using Elo predictions

/**
 * Calculates EV and Kelly sizing for a hypothetical bet
 */
async function calculateEVForBet(
  winProbability: number,
  odds: number,
  stake: number,
  bankroll: number
): Promise<any> {
  try {
    const supabase = getSupabaseClient();

    // Calculate EV
    const { data: evData, error: evError } = await supabase
      .rpc('calculate_expected_value', {
        p_win_probability: winProbability,
        p_american_odds: odds,
        p_stake: stake
      });

    if (evError) {
      console.error('[PHASE4] Error calculating EV:', evError);
      return null;
    }

    // Calculate Kelly sizing
    const { data: kellyData, error: kellyError } = await supabase
      .rpc('calculate_kelly_sizing', {
        p_win_probability: winProbability,
        p_american_odds: odds,
        p_bankroll: bankroll,
        p_fraction: 0.25
      });

    if (kellyError) {
      console.error('[PHASE4] Error calculating Kelly:', kellyError);
      return null;
    }

    return {
      ev: evData,
      kelly: kellyData
    };
  } catch (error) {
    console.error('[PHASE4] Error in calculateEVForBet:', error);
    return null;
  }
}

// Removed: buildEVAnalysisContext function - no longer using Elo predictions for EV calculation

/**
 * PHASE 6: Advanced Analytics & Performance Dashboard
 * Provides bankroll tracking and goal management
 */

/**
 * Fetches recent bankroll history for analytics
 */
async function getRecentBankrollHistory(userId: string): Promise<any> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .rpc('get_bankroll_history', {
        p_user_id: userId,
        p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
        p_end_date: new Date().toISOString().split('T')[0]
      });

    if (error) {
      console.log('[PHASE6] Error fetching bankroll history:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[PHASE6] Error in getRecentBankrollHistory:', error);
    return null;
  }
}

/**
 * Fetches active goals for user
 */
async function getActiveGoals(userId: string): Promise<any[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .rpc('get_active_goals', { p_user_id: userId });

    if (error) {
      console.log('[PHASE6] Error fetching active goals:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[PHASE6] Error in getActiveGoals:', error);
    return [];
  }
}

/**
 * PHASE 5: Live Bet Tracking & In-Game Alerts
 * Monitors active bets in real-time and sends alerts for critical moments
 */

/**
 * Fetches active live tracked bets for a user
 */
async function getActiveLiveBets(userId: string): Promise<any[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .rpc('get_user_active_bets_live', { p_user_id: userId });

    if (error) {
      console.log('[PHASE5] Error fetching live bets:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[PHASE5] Error in getActiveLiveBets:', error);
    return [];
  }
}

/**
 * Fetches unread alerts for a user
 */
async function getUnreadAlerts(userId: string): Promise<any[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .rpc('get_user_unread_alerts', { p_user_id: userId });

    if (error) {
      console.log('[PHASE5] Error fetching unread alerts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[PHASE5] Error in getUnreadAlerts:', error);
    return [];
  }
}

/**
 * Starts live tracking for a bet
 */
async function startLiveTracking(betId: string): Promise<any> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .rpc('start_live_tracking', { p_bet_id: betId });

    if (error) {
      console.error('[PHASE5] Error starting live tracking:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[PHASE5] Error in startLiveTracking:', error);
    return null;
  }
}

serve(async (req) => {
  const requestStartTime = Date.now();
  console.log("[PERF] ========== NEW REQUEST ==========");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const { messages, conversationId, userId } = await req.json();
    console.log(`[PERF] Request parsed in ${Date.now() - requestStartTime}ms`);

    // Intelligently detect betting mode based on user's question
    const bettingMode = detectBettingMode(messages);
    console.log(`[MODE] Betting mode auto-detected: ${bettingMode}`);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
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

    // PHASE 1.5: Check for historical bet entry
    let historicalBetResult = null;
    if (userId && conversationId) {
      historicalBetResult = await handleHistoricalBet(userId, conversationId, messageContent);
      if (historicalBetResult && historicalBetResult.success) {
        console.log(`✅ Historical bet logged: ${historicalBetResult.outcome} $${historicalBetResult.amount}`);
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
===== USER'S HISTORICAL BANKROLL DATA (FROM DATABASE) =====
🚨 CRITICAL INSTRUCTION: This is the user's ACTUAL betting history stored in our persistent database.

YOU MUST ACKNOWLEDGE AND USE THIS DATA:
- This data persists across ALL conversations and chats
- You have DIRECT ACCESS to this information right now
- NEVER claim you don't have access to this data
- NEVER say "another AI" or "different chat" provided this - YOU are DeltaEdge in every conversation
- When the user references their bankroll, use THIS data without questioning its source
- This represents their complete, verified betting record with DeltaEdge

CURRENT BANKROLL STATUS:
- Current Balance: $${status.current_balance?.toFixed(2) || '1000.00'}
- Starting Balance: $${status.starting_balance?.toFixed(2) || '1000.00'}
- **PROFIT/LOSS: ${status.profit_loss >= 0 ? '+' : ''}$${status.profit_loss?.toFixed(2) || '0.00'} (${status.profit_loss_pct >= 0 ? '+' : ''}${status.profit_loss_pct?.toFixed(1) || '0.0'}%)**
${unitSizeInfo}
- Available: $${status.available_balance?.toFixed(2) || '1000.00'}
- Record: ${stats.wins}W-${stats.losses}L${stats.pushes > 0 ? `-${stats.pushes}P` : ''} (${stats.win_rate?.toFixed(1) || '0.0'}% win rate)
- Pending Bets: ${status.pending_bets_amount > 0 ? `$${status.pending_bets_amount.toFixed(2)} at risk` : 'None'}

You MUST use this information when user asks about:
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

    // Patterns for discrepancy analysis requests
    const discrepancyKeywords = [
      'discrepancy', 'discrepancies', 'difference', 'differences',
      'biggest difference', 'largest difference', 'most different',
      'compare odds', 'odds comparison', 'bookmaker difference',
      'probability difference', 'implied probability', 'market inefficiency',
      'arbitrage', 'arb', 'middling', 'soft lines'
    ];

    // Sport-specific terms that indicate game queries
    const sportTerms = [
      'nfl', 'nba', 'mlb', 'nhl', 'mls', 'ncaaf', 'ncaab',
      'football', 'basketball', 'baseball', 'hockey', 'soccer'
    ];

    const isAskingForScore = scoreKeywords.some(keyword => messageContent.includes(keyword));
    const isAskingForLineup = lineupKeywords.some(keyword => messageContent.includes(keyword));
    const isAskingForMatchup = matchupKeywords.some(keyword => messageContent.includes(keyword));
    const isAskingForDiscrepancy = discrepancyKeywords.some(keyword => messageContent.includes(keyword));
    const isAskingForBettingData = bettingKeywords.some(keyword => messageContent.includes(keyword)) ||
                                   sportTerms.some(term => messageContent.includes(term));

    // Fetch appropriate data based on query type
    let dataContext = "";
    let contextType = "";

    // PHASE 2: Extract team names and league for injury/trends data
    const teamNames = extractTeamNames(messageContent);
    const league = detectLeague(messageContent);
    console.log(`[PHASE2] Extracted teams: ${teamNames.join(', ')}, League: ${league}`);

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
          console.log("[PERF] Parallelizing lineup, matchup, odds, injuries, and trends fetches...");
          const parallelStart = Date.now();

          const [lineupData, matchupData, oddsData, injuryData, trendsData] = await Promise.all([
            fetchLineupData(lastMessage.content),
            fetchMatchupData(lastMessage.content),
            fetchLiveOdds(lastMessage.content),
            fetchInjuryData(lastMessage.content, teamNames),
            fetchTeamTrends(teamNames, league)
          ]);

          console.log(`[PERF] Parallel fetches completed in ${Date.now() - parallelStart}ms`);

          dataContext = lineupData + "\n\n" + matchupData + "\n\n" + oddsData + injuryData + trendsData;
          contextType = "comprehensive";
        } else {
          const [lineupData, injuryData, trendsData] = await Promise.all([
            fetchLineupData(lastMessage.content),
            fetchInjuryData(lastMessage.content, teamNames),
            fetchTeamTrends(teamNames, league)
          ]);
          dataContext = lineupData + injuryData + trendsData;
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
          console.log("[PERF] Parallelizing matchup, odds, injuries, and trends fetches...");
          const parallelStart = Date.now();

          const [matchupData, oddsData, injuryData, trendsData] = await Promise.all([
            fetchMatchupData(lastMessage.content),
            fetchLiveOdds(lastMessage.content),
            fetchInjuryData(lastMessage.content, teamNames),
            fetchTeamTrends(teamNames, league)
          ]);

          console.log(`[PERF] Parallel fetches completed in ${Date.now() - parallelStart}ms`);

          dataContext = matchupData + "\n\n" + oddsData + injuryData + trendsData;
          contextType = "comprehensive";
        } else {
          const [matchupData, injuryData, trendsData] = await Promise.all([
            fetchMatchupData(lastMessage.content),
            fetchInjuryData(lastMessage.content, teamNames),
            fetchTeamTrends(teamNames, league)
          ]);
          dataContext = matchupData + injuryData + trendsData;
          contextType = "matchup";
          console.log("Matchup data fetch result:", dataContext);
        }
      } catch (error) {
        console.error("Failed to fetch matchup data:", error);
        dataContext = "I could not fetch matchup analysis at the moment. Please try again shortly.";
      }
    } else if (isAskingForDiscrepancy) {
      try {
        console.log("User is asking for odds discrepancies, fetching pre-computed analysis...");

        // Fetch discrepancies along with context data if needed
        const [discrepancyData, injuryData, trendsData] = await Promise.all([
          fetchOddsDiscrepancies(lastMessage.content),
          fetchInjuryData(lastMessage.content, teamNames),
          fetchTeamTrends(teamNames, league)
        ]);

        dataContext = discrepancyData + injuryData + trendsData;
        contextType = "discrepancy";
        console.log("Discrepancy data fetch result:", dataContext);
      } catch (error) {
        console.error("Failed to fetch discrepancy data:", error);
        dataContext = "I could not fetch odds discrepancy analysis at the moment. The analysis runs every 15 minutes, so please try again shortly.";
      }
    } else if (isAskingForBettingData) {
      try {
        console.log("User is asking for game data, fetching live odds...");

        const [oddsData, injuryData, trendsData] = await Promise.all([
          fetchLiveOdds(lastMessage.content),
          fetchInjuryData(lastMessage.content, teamNames),
          fetchTeamTrends(teamNames, league)
        ]);

        dataContext = oddsData + injuryData + trendsData;
        contextType = "betting";
        console.log("Odds data fetch result:", dataContext);
      } catch (error) {
        console.error("Failed to fetch betting data:", error);
        dataContext = "ERROR: Unable to fetch live betting data at the moment. Please inform the user that you cannot provide specific betting recommendations without current odds data. You can only discuss general betting concepts.";
      }
    }

    // CRITICAL: Validate betting data availability before allowing AI to respond
    // This prevents AI from hallucinating or guessing betting lines
    if (isAskingForBettingData) {
      const hasValidBettingData = dataContext &&
                                 !dataContext.includes('ERROR') &&
                                 !dataContext.includes('No betting odds') &&
                                 !dataContext.includes('too stale') &&
                                 !dataContext.includes('not available');

      if (!hasValidBettingData) {
        console.error('[BETTING GUARDRAIL] Blocking AI response - no valid betting data available');
        console.error('[BETTING GUARDRAIL] Data context:', dataContext?.substring(0, 200));

        // Return error message in SSE streaming format so frontend can parse it
        const errorMessage = "I apologize, but I cannot provide betting recommendations at this time because I don't have access to current, accurate betting lines. The data may be unavailable or too stale. Please try again in a few minutes, or contact support if this persists.\n\nIf you need general betting advice or have questions about betting concepts, I'm happy to help with that instead!";

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Send the error message in OpenAI SSE format
            const chunks = errorMessage.split(' ');
            for (const chunk of chunks) {
              const sseData = `data: ${JSON.stringify({
                choices: [{
                  delta: { content: chunk + ' ' }
                }]
              })}\n\n`;
              controller.enqueue(encoder.encode(sseData));
            }
            // Send the done signal
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
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
    const basicModePrompt = `You are DeltaEdge - a friendly sports betting buddy who keeps things simple, casual, and conversational.

MISSION: Help users make smarter bets with quick, easy-to-digest insights. Think "helpful friend" not "stats professor."

🚨 CRITICAL RULES - NEVER BREAK THESE:
- NEVER predict who will win or what the score will be
- NEVER provide win probabilities or outcome predictions
- ONLY provide value-based recommendations by comparing odds across sportsbooks
- Focus on: best available lines, line movement, sharp action, and recent team performance

🚨 CRITICAL DATA REQUIREMENT:
- Only provide betting analysis when you have FRESH odds data from The Rundown API
- If odds are STALE or ERROR, say: "I need current odds data to give you accurate info."
- Never guess lines or use old data

CRITICAL: MEMORY & DATA ACCESS
- You have FULL ACCESS to this user's betting history, bankroll, and all past conversations
- This data is PERSISTENT across all chats - never claim you don't have access
- Use their actual data when responding

YOUR STYLE:
- Keep it casual and conversational (like texting a knowledgeable friend)
- Lead with the answer, skip the preamble
- Maximum 4-6 lines per response
- Use simple language, avoid jargon
- Never use asterisks (*) for formatting

INTENT RECOGNITION - Match user's question to these patterns:

1. LOG_BET Intent
   User says: "$50 on Lakers -4.5", "2u on Knicks ML", "Track $100 bet on 49ers"
   Response format (4 lines):
   "Logged: [bet details] @ [odds].
   You're at $[bankroll] ([X]% of roll).
   I'll track the game and update you when it settles.
   Good luck!"

2. BANKROLL_CHECK Intent
   User says: "How's my bankroll?", "show my record", "am I up or down?"
   Response format (4 lines):
   "You're sitting at $[amount] ([+/-$X] this week).
   Record: [W-L] ([%]) with [+/-]% ROI.
   Last 5 bets: [record], [trend].
   Need anything else?"

3. FIND_EDGE Intent
   User says: "any good bets?", "EV plays?", "value today?", "best edge?"
   Response format (4 lines):
   "Best value right now: [team/bet] at [book].
   [Key factor or line movement - e.g., "1 point better than consensus" or "Line moved 2 pts on sharp action"].
   Most books have [comparison line] but [book] has [better line].
   Want me to log it or keep looking?"

4. LINE_MOVEMENT Intent
   User says: "has line moved?", "check movement", "steam on [team]?"
   Response format (4 lines):
   "[Team] line moved from [old] to [new] ([reason]).
   [Sharp/public money note].
   Current market: [line] across all books.
   [Next step question]"

5. BET_SIZE_ADVICE Intent
   User says: "how much should I bet?", "bet sizing", "optimal stake?"
   Response format (4 lines):
   "With [X]% edge and $[bankroll], I'd suggest [X-Y] units.
   That's $[X-Y] (conservative Kelly).
   Keeps you safe if variance hits.
   Want me to log it at that size?"

6. TILT_MANAGEMENT Intent
   User says: "lost 3 straight", "I'm chasing", "down bad", "should I stop?"
   Response format (4 lines):
   "[Empathy for losses], but variance happens.
   You're still [+X]% ROI overall — solid long-term.
   Take a breather, maybe sit out tonight.
   Your edge doesn't disappear because of bad luck."

7. GAME ANALYSIS Intent (default for betting questions)
   User says: "thoughts on Lakers?", "who wins tonight?", "Chargers vs Bills?"
   Response format (4-6 lines max):
   "[Recognition: context about user or game]
   [Value: best available line comparison across books]
   [Interpretation: line movement or key factor in simple terms]
   [Action: question or next step]"

   Example:
   "Looks like you've got $1,250 left — nice discipline this week.
   For Lakers vs Kings, best value is Lakers -2.5 at FanDuel (most books -3).
   You're getting half a point better than consensus.
   If staying conservative, keep it around 1 unit.
   Want me to track it?"

SPORTS COVERAGE:
🏈 NFL, 🏈 NCAAF, 🏀 NBA - Full live data
Other sports - Limited data, general principles only

RESPONSE RULES:
- Keep responses SHORT (4-6 lines max)
- Lead with the answer immediately
- One key insight, not a data dump
- End with a question or action prompt
- Use casual language (e.g., "B2B" not "second night of back-to-back")
- Focus on what matters most to casual bettors

AVOID:
- Long probability breakdowns
- Multiple sections and subsections
- Heavy statistics or math
- Jargon like "CLV", "variance", "correlation"
- Prescriptive language ("you should bet")

Today's date: ${currentDate}`;

    // Advanced mode prompt - casual yet data-driven analysis
    const advancedModePrompt = `You are DeltaEdge - a sharp sports betting analyst who delivers data-driven insights in a casual, conversational way.

MISSION: Give users quick, quantified edges with the data that matters. More casual than a textbook, sharper than a forum post.

🚨 CRITICAL RULES - NEVER BREAK THESE:
- NEVER predict who will win or what the score will be
- NEVER provide win probabilities or outcome predictions
- ONLY provide value-based recommendations by comparing odds across sportsbooks
- Focus on: best available lines, line movement, sharp action, market discrepancies, and recent team performance

🚨 CRITICAL DATA FRESHNESS GUIDELINES:
- FRESH data (<2 hours): Provide full analysis with confidence
- RECENT data (2-12 hours): Provide analysis with timestamp disclaimer
- OLDER data (12-24 hours): Provide general analysis with "stale data" warning
- NO data (>24 hours or unavailable): Focus on general betting strategy, bankroll management, concepts
- ALWAYS acknowledge data age when relevant
- Never block users from getting help - adapt your response to available data

CRITICAL: MEMORY & DATA ACCESS
- You have FULL, PERSISTENT ACCESS to this user's betting history, bankroll, and all conversations
- This data lives in our database and is ALWAYS available across every chat
- Never claim you don't have access - you're the same DeltaEdge every time
- Use their real data when responding

YOUR STYLE:
- Casual but data-driven (think smart friend who knows stats)
- Lead with the numbers, skip the fluff
- Maximum 4-6 lines per response (expand only when user asks for details)
- Use abbreviations and betting lingo comfortably (EV, ROI, Kelly, sharp money, etc.)
- Never use asterisks (*) for formatting

RESPONSE STRUCTURE - Use this 4-part format:
[Recognition or Context] → [Quantified Edge or Data Summary] → [Interpretation] → [Action or Confirmation Prompt]

INTENT RECOGNITION - Match patterns and respond accordingly:

1. LOG_BET Intent
   User says: "$50 on Lakers -4.5", "2u on Knicks ML", "Track $100 bet"
   Response (4 lines):
   "Logged: [bet] @ [odds].
   Bankroll: $[amount] ([X]% of roll on this).
   Tracking live — I'll update when it settles.
   GL!"

2. BANKROLL_CHECK Intent
   User says: "How's my bankroll?", "show record", "am I up?"
   Response (4 lines):
   "Sitting at $[amount] ([+/-$X] this week).
   [W-L] ([%]) | [+/-]% ROI this month.
   Last 5: [record] — [hot/cold streak note].
   Want breakdown by sport?"

3. FIND_EDGE Intent
   User says: "any good bets?", "EV plays?", "value today?"
   Response (4 lines):
   "Best value: [team/bet] at [book] - [advantage over consensus].
   [Line movement or key factor - e.g., "moved 2 pts on sharp action"].
   Most books: [consensus line] | [Book]: [better line].
   Log it or want alternatives?"

4. LINE_MOVEMENT Intent
   User says: "line moved?", "steam?", "check movement on [team]"
   Response (4 lines):
   "[Team] moved [old line] → [new line] ([sharp/public money note]).
   [X]% of bets but [Y]% of handle on [side].
   Current across books: [line range].
   Edge still there at [current line]?"

5. BET_SIZE_ADVICE Intent
   User says: "how much?", "bet sizing?", "Kelly?"
   Response (4 lines):
   "You're 9-4 on NFL totals this month (+12% ROI).
   Model flags Over 46.5 in Chargers-Bills at +5.9% EV.
   Stake suggestion: 1.3 units (within your risk band).
   Want me to track line movement overnight?"

6. TILT_MANAGEMENT Intent
   User says: "lost 3 straight", "chasing", "should I stop?"
   Response (4 lines):
   "Three straight losses sucks, but you're still +[X]% ROI overall.
   Variance is real — long-term edge doesn't vanish.
   Take tonight off, reset mentally.
   You've been sharp, don't force it."

7. GAME ANALYSIS Intent (default - use 4-part structure)
   User says: "thoughts on [game]?", "who wins?", "[team] vs [team]?"

   CASUAL Response (4 lines):
   "Looks like you've got $1,250 left in your bankroll — nice discipline this week.
   For tonight's Lakers vs Kings, best value is Lakers -2.5 at FanDuel (consensus -3).
   You're getting half a point better than most books.
   If staying conservative, keep it around 1 unit. Want me to track it?"

   MODERATE Response (4 lines):
   "You're 9-4 on NFL totals this month (+12% ROI).
   Over 46.5 in Chargers-Bills at BetMGM (most books 47).
   Line opened at 45.5, moved up on sharp action.
   Stake suggestion: 1.3 units. Want me to track line movement overnight?"

   COMPLEX Response (when user asks for details - 6 lines):
   "Market consensus: -4.5 (FanDuel, DraftKings, Caesars).
   Best value: -4 at Pinnacle (sharp book, half point better).
   Line opened at -3.5, moved to -4/-4.5 over 3 hours.
   Notable factor: team off 2 days rest vs opponent B2B.
   Sharp action detected on favorite based on reverse line movement.
   Stake rec: 1.2 units. Confirm placement?"

SPORTS COVERAGE:
🏈 NFL, 🏈 NCAAF, 🏀 NBA - Full live data
Others - Limited coverage

RESPONSE RULES:
- Default to 4-6 lines MAX (only expand when explicitly asked)
- Lead with numbers and probabilities
- Include model probability vs market implied probability
- One key edge or factor, not a data wall
- End with action question
- Use betting abbreviations freely (EV, ROI, Kelly, CLV, sharp money, etc.)
- Keep it conversational but quantified

WHAT TO INCLUDE:
- Best available line vs consensus across books
- Line movement (opening vs current, magnitude, sharp action indicators)
- Key factor (injury, line move, rest, matchup)
- Stake suggestion in units when relevant
- Next action or tracking offer

AVOID:
- Long multi-section breakdowns (unless user asks)
- Verbose explanations
- Academic tone
- Prescriptive language ("you must bet")
- Fake guarantees

SCORE REPORTING:
For score questions, just give clean updates:
"[Team] up [score] [period]. [Brief context if relevant]."

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
- Provide detailed and thorough analysis

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

    // PHASE 3: Build user intelligence context (preferences, patterns, insights, memory)
    let userContextPrompt = '';
    if (userId) {
      try {
        userContextPrompt = await buildUserContextPrompt(userId);
      } catch (error) {
        console.error('[PHASE3] Error building user context prompt:', error);
        // Continue without user context if there's an error
      }
    }

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
- Provide a friendly and informative response
- Example: "Perfect! I've got your bankroll set at $5,000. Since you mentioned a $50 unit size, that's a conservative 1% approach - great for managing risk!"
`;
      }
    }

    // PHASE 1.5: Format historical bet context
    let historicalBetContext = '';
    if (historicalBetResult) {
      if (historicalBetResult.error) {
        historicalBetContext = `
HISTORICAL BET ENTRY ERROR:
${historicalBetResult.message}

RESPONSE INSTRUCTIONS:
Politely inform the user about the error and ask them to provide more details if needed.`;
      } else if (historicalBetResult.success) {
        const { outcome, amount, team, betAmount, profitLoss, previousBankroll, newBankroll } = historicalBetResult;
        const emoji = outcome === 'win' ? '🎉' : '😔';
        const sign = profitLoss >= 0 ? '+' : '';

        historicalBetContext = `
${emoji} HISTORICAL BET LOGGED:

Bet Details:
- Team: ${team}
- Outcome: ${outcome.toUpperCase()}
- ${outcome === 'win' ? 'Profit' : 'Loss'}: ${sign}$${Math.abs(profitLoss).toFixed(2)}
- Bet Amount: $${betAmount.toFixed(2)}

Bankroll Update:
- Previous: $${previousBankroll.toFixed(2)}
- New: $${newBankroll.toFixed(2)}
- Change: ${sign}$${profitLoss.toFixed(2)}

RESPONSE INSTRUCTIONS:
Acknowledge the historical bet entry and confirm it's been added to their tracking. Provide an empathetic response based on the outcome.
${outcome === 'win' ?
  `Example: "Nice! I've logged that $${amount.toFixed(2)} win on ${team}. Your bankroll is now at $${newBankroll.toFixed(2)}."` :
  `Example: "Got it, I've logged that $${amount.toFixed(2)} loss on ${team}. Your bankroll is now at $${newBankroll.toFixed(2)}."`
}`;
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
4. Provide a celebratory response
` : detectedOutcome === 'loss' ? `
❌ FOR A LOSS:
1. Be empathetic and encouraging
2. Acknowledge the loss: "$${Math.abs(settlement.profit).toFixed(2)}"
3. **ALWAYS mention their updated total P/L percentage: "You're now at ${plSign}${plPct.toFixed(1)}% overall"**
4. Focus on the long game and staying disciplined
5. Be supportive, not discouraging
` : `
↔️ FOR A PUSH:
1. Explain that the bet pushed (tie/voided)
2. Confirm their stake was returned: "$${bet.amount.toFixed(2)}"
3. Mention their P/L remains at ${plSign}${plPct.toFixed(1)}%
4. Provide a neutral response
`}

ALWAYS include the updated P/L percentage.`;
      }
    }

    const systemPrompt = dataContext
      ? `${basePrompt}

${userContextPrompt}

${bankrollContext}

${isAskingForScore ? 'LIVE SCORE DATA RETRIEVED:' : contextType === 'discrepancy' ? 'ODDS DISCREPANCY ANALYSIS RETRIEVED:' : 'LIVE BETTING DATA RETRIEVED:'}
${dataContext}

INSTRUCTIONS:
${isAskingForScore
  ? '- Provide clear score updates with relevant context based on the data above\n- Include game status and any relevant context\n- Only provide betting analysis if specifically requested along with the score'
  : contextType === 'discrepancy'
    ? '- Focus on the LARGEST probability discrepancies identified in the analysis above\n- Explain what these discrepancies mean and why bookmakers disagree\n- Highlight potential value opportunities but caution about verifying current lines\n- Discuss possible reasons: sharp action, news, injuries, market inefficiencies\n- Use the pre-computed data - DO NOT recalculate probabilities\n- Keep explanations concise and focused on the biggest discrepancies\n- Recommend further investigation before placing bets'
    : '- Use this live data to provide specific, concrete analysis\n- Reference actual odds, spreads, and totals from the data provided\n- Identify specific edges based on matchup analysis, injury impacts, and situational factors\n- Compare odds across different bookmakers when available\n- Provide reasoning based on the actual data, not generic principles\n- Recommend bet sizing based on your confidence level\n- Be direct and actionable with your recommendations'}`
      : bankrollUpdateContext
        ? `${basePrompt}

${userContextPrompt}

${bankrollContext}

${bankrollUpdateContext}`
      : historicalBetContext
        ? `${basePrompt}

${userContextPrompt}

${bankrollContext}

${historicalBetContext}`
      : betOutcomeContext
        ? `${basePrompt}

${userContextPrompt}

${bankrollContext}

${betOutcomeContext}`
        : `${basePrompt}

${userContextPrompt}

${bankrollContext}

If the user asks about a specific game, matchup, or betting opportunity, you will automatically receive live data. Use that data to provide concrete, quantified analysis.`;

    const dataFetchTime = Date.now() - requestStartTime;
    console.log(`[PERF] Data fetching completed in ${dataFetchTime}ms`);
    console.log(`[PERF] Sending request to AI...`);

    const aiStartTime = Date.now();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 16384,
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
          JSON.stringify({ error: "Payment required, please add funds to your OpenAI account." }),
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
      console.log('[STREAM-BACKEND] Setting up streaming with conversationId:', conversationId);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let chunkCount = 0;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            console.log('[STREAM-BACKEND] Starting to read from AI gateway...');
            while (true) {
              const { done, value } = await reader!.read();
              if (done) {
                console.log('[STREAM-BACKEND] Stream complete. Total chunks:', chunkCount);
                break;
              }

              chunkCount++;
              const chunk = decoder.decode(value, { stream: true });
              fullResponse += chunk;
              console.log(`[STREAM-BACKEND] Chunk ${chunkCount} - Size: ${value.byteLength} bytes, forwarding to client`);
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
                userId,
                authHeader
              );
            } else {
              console.log('❌ No bet pattern matched in response');
            }
            
            console.log('[STREAM-BACKEND] Closing stream controller');
            controller.close();
          } catch (error) {
            console.error('[STREAM-BACKEND] Stream error:', error);
            controller.error(error);
          }
        }
      });

      console.log('[STREAM-BACKEND] Returning streaming response with SSE headers');
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    console.log('[STREAM-BACKEND] No conversationId/userId, passing through direct stream');
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
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
