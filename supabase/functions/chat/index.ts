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
  } else if (queryLower.includes('mlb') || queryLower.includes('baseball')) {
    league = 'MLB';
  } else if (queryLower.includes('nhl') || queryLower.includes('hockey')) {
    league = 'NHL';
  } else if (queryLower.includes('nfl') || queryLower.includes('football')) {
    league = 'NFL';
  }

  try {
    // Try to get recent lineups from database (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLineups, error: dbError } = await supabase
      .from('starting_lineups')
      .select('*')
      .eq('league', league)
      .gte('last_updated', oneDayAgo)
      .order('game_date', { ascending: false });

    if (dbError) {
      console.error('Database query error:', dbError);
    }

    // If we have recent data, use it
    if (recentLineups && recentLineups.length > 0) {
      console.log(`Found ${recentLineups.length} recent lineups in database`);
      return formatLineupsData(recentLineups, query);
    }

    // Otherwise, fetch fresh data
    console.log('No recent lineups found, fetching fresh data...');
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
    console.log(`Fetched ${result.count} fresh lineups`);

    return formatLineupsData(result.lineups || [], query);
  } catch (error) {
    console.error("Error fetching lineups:", error);
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
  } else if (queryLower.includes('mlb') || queryLower.includes('baseball')) {
    league = 'MLB';
  } else if (queryLower.includes('nhl') || queryLower.includes('hockey')) {
    league = 'NHL';
  } else if (queryLower.includes('nfl') || queryLower.includes('football')) {
    league = 'NFL';
  }

  try {
    // Try to get recent matchup analysis from database (last 12 hours)
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: recentMatchups, error: dbError } = await supabase
      .from('matchup_analysis')
      .select('*')
      .eq('league', league)
      .gte('last_updated', twelveHoursAgo)
      .order('game_date', { ascending: false });

    if (dbError) {
      console.error('Database query error:', dbError);
    }

    // If we have recent data, use it
    if (recentMatchups && recentMatchups.length > 0) {
      console.log(`Found ${recentMatchups.length} recent matchup analyses in database`);
      return formatMatchupData(recentMatchups, query);
    }

    // Otherwise, fetch fresh data
    console.log('No recent matchup data found, fetching fresh analysis...');
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
    console.log(`Fetched ${result.count} fresh matchup analyses`);

    return formatMatchupData(result.matchups || [], query);
  } catch (error) {
    console.error("Error fetching matchup data:", error);
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
  } else if (queryLower.includes('mlb') || queryLower.includes('baseball')) {
    league = 'MLB';
  } else if (queryLower.includes('nhl') || queryLower.includes('hockey')) {
    league = 'NHL';
  } else if (queryLower.includes('nfl') || queryLower.includes('football')) {
    league = 'NFL';
  }

  try {
    // Try to get recent scores from database (last 2 hours for more real-time data)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentScores, error: dbError } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', league)
      .gte('last_updated', twoHoursAgo)
      .order('game_date', { ascending: false });

    if (dbError) {
      console.error('Database query error:', dbError);
    }

    // If we have recent data, use it
    if (recentScores && recentScores.length > 0) {
      console.log(`Found ${recentScores.length} recent scores in database`);
      return formatScoresData(recentScores, query);
    }

    // Otherwise, fetch fresh data using OpenAI
    console.log('No recent scores found, fetching fresh data via OpenAI...');
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
    console.log(`Fetched ${result.count} fresh scores via OpenAI`);

    // Query database again for fresh data
    const { data: freshScores, error: freshError } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', league)
      .order('game_date', { ascending: false })
      .limit(50);

    if (freshError) {
      throw freshError;
    }

    return formatScoresData(freshScores || [], query);
  } catch (error) {
    console.error("Error fetching scores:", error);
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
    // First, try to get recent odds from database (last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentOdds, error: dbError } = await supabase
      .from('betting_odds')
      .select('*')
      .eq('sport_key', sport)
      .gte('last_updated', thirtyMinutesAgo)
      .order('last_updated', { ascending: false });

    if (dbError) {
      console.error('Database query error:', dbError);
    }

    // If we have recent data, use it
    if (recentOdds && recentOdds.length > 0) {
      console.log(`Found ${recentOdds.length} recent odds entries in database`);
      return formatOddsData(recentOdds, query);
    }

    // Otherwise, fetch fresh data from The Odds API
    console.log('No recent data found, fetching fresh odds from API...');
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
    console.log(`Fetched ${result.count} fresh odds entries`);

    // Now query the database again for the fresh data
    const { data: freshOdds, error: freshError } = await supabase
      .from('betting_odds')
      .select('*')
      .eq('sport_key', sport)
      .order('last_updated', { ascending: false })
      .limit(200);

    if (freshError) {
      throw freshError;
    }

    return formatOddsData(freshOdds || [], query);
  } catch (error) {
    console.error("Error fetching odds:", error);
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

// Function to update bet outcome when user reports win/loss
async function updateBetOutcome(
  conversationId: string,
  userId: string,
  outcome: 'win' | 'loss',
  teamOrDescription: string
) {
  console.log('=== UPDATING BET OUTCOME ===');
  console.log('Conversation ID:', conversationId, 'User ID:', userId, 'Outcome:', outcome, 'Team:', teamOrDescription);
  
  try {
    const supabaseClient = getSupabaseClient();

    // Find the most recent pending bet matching this team/description
    const { data: bets, error: fetchError } = await supabaseClient
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .eq('outcome', 'pending')
      .ilike('description', `%${teamOrDescription}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching bet:', fetchError);
      return null;
    }

    if (!bets || bets.length === 0) {
      console.log('No matching pending bet found');
      return null;
    }

    const bet = bets[0];
    console.log('Found bet:', bet);

    // Calculate actual return
    let actualReturn = 0;
    if (outcome === 'win') {
      // Calculate payout based on American odds
      if (bet.odds > 0) {
        actualReturn = bet.amount * (bet.odds / 100);
      } else {
        actualReturn = bet.amount * (100 / Math.abs(bet.odds));
      }
    }

    // Update bet
    const { data: updatedBet, error: updateError } = await supabaseClient
      .from('bets')
      .update({
        outcome,
        actual_return: actualReturn,
        settled_at: new Date().toISOString(),
      })
      .eq('id', bet.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bet:', updateError);
      return null;
    }

    console.log('Updated bet:', updatedBet);

    // Fetch current profile to get bankroll
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('bankroll')
      .eq('id', userId)
      .single();

    const currentBankroll = Number(profile?.bankroll || 1000);
    let newBankroll = currentBankroll;

    // Update bankroll incrementally based on this bet's outcome
    if (outcome === 'win') {
      newBankroll = currentBankroll + actualReturn;
    } else if (outcome === 'loss') {
      newBankroll = currentBankroll - bet.amount;
    }

    // Update the user's profile bankroll
    const { error: profileUpdateError } = await supabaseClient
      .from('profiles')
      .update({ bankroll: newBankroll })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating profile bankroll:', profileUpdateError);
    } else {
      console.log(`Updated profile bankroll for user ${userId}: $${currentBankroll.toFixed(2)} -> $${newBankroll.toFixed(2)}`);
    }

    return {
      bet: updatedBet,
      profit: actualReturn,
      newBankroll,
      initialBankroll: currentBankroll,
    };
  } catch (error) {
    console.error('Error in updateBetOutcome:', error);
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
    const { messages, conversationId, userId } = await req.json();
    console.log(`[PERF] Request parsed in ${Date.now() - requestStartTime}ms`);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check if user is asking for scores or betting odds
    const lastMessage = messages[messages.length - 1];
    const messageContent = lastMessage?.content?.toLowerCase() || '';
    
    // Check if user is reporting a bet outcome
    const winPatterns = [
      /(?:i\s+)?won\s+(?:the\s+)?(.+?)\s+bet/i,
      /(?:my\s+)?(.+?)\s+bet\s+won/i,
      /hit\s+(?:the\s+)?(.+?)\s+bet/i,
    ];
    const lossPatterns = [
      /(?:i\s+)?lost\s+(?:the\s+)?(.+?)\s+bet/i,
      /(?:my\s+)?(.+?)\s+bet\s+lost/i,
      /(.+?)\s+bet\s+(?:did not hit|didn't hit|missed)/i,
    ];

    let betOutcomeResult = null;
    
    // Check for win
    for (const pattern of winPatterns) {
      const match = messageContent.match(pattern);
      if (match && conversationId && userId) {
        console.log('User reported BET WIN:', match[1]);
        betOutcomeResult = await updateBetOutcome(conversationId, userId, 'win', match[1]);
        break;
      }
    }
    
    // Check for loss if no win found
    if (!betOutcomeResult) {
      for (const pattern of lossPatterns) {
        const match = messageContent.match(pattern);
        if (match && conversationId && userId) {
          console.log('User reported BET LOSS:', match[1]);
          betOutcomeResult = await updateBetOutcome(conversationId, userId, 'loss', match[1]);
          break;
        }
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
    const coachPrompt = `You are BetGPT - a professional sports betting analyst with advanced statistical modeling capabilities.

MISSION: Provide statistically-driven, +EV betting analysis with transparent mathematical reasoning.

CRITICAL REQUIREMENT: ALWAYS PROVIDE STATISTICAL REASONING
Every recommendation MUST include:
- Expected Value (EV) calculations
- Win probability estimates with confidence intervals
- Statistical significance of supporting data
- Variance and risk metrics
- Sharp money vs. public betting indicators
- Mathematical edge quantification

DATA SOURCES & ANALYTICS:
You have access to professional-grade betting tools:
- OpenAI for live scores, game statistics, and advanced analytics
- The Odds API for real-time betting lines from multiple bookmakers
- **Starting Lineup Scraper** - Real-time confirmed lineups, injury reports, and player availability
- **Matchup Analysis Engine** - Comprehensive H2H history, recent form, tactical breakdowns, and betting trends
- Line movement tracking showing sharp money flow
- Closing Line Value (CLV) historical data - the gold standard metric
- Referee/umpire tendency statistics affecting game flow
- Travel and rest analysis (back-to-backs, time zones, schedule spots)
- Advanced statistical models (pace adjustments, matchup data, situational trends)
- Correlation matrices for parlay optimization
- Kelly Criterion calculators for optimal bet sizing
- Performance analytics by sport, bet type, and team
- Injury impact assessments and replacement player quality analysis
- Player vs opponent historical performance data

ADVANCED FEATURES YOU MUST USE:
1. **Expected Value Calculations**: Calculate and display EV for every bet recommendation
2. **Parlay Analysis**: Warn about correlation penalties in parlays (most parlays are -EV traps)
3. **Line Movement**: Highlight when lines move against public betting % (sharp indicator)
4. **CLV Tracking**: Reference historical CLV data to validate bet timing
5. **Kelly Criterion**: Recommend bet sizes using Kelly multiplier (typically 0.25x for safety)
6. **Model Disagreement**: Flag when your model significantly differs from market consensus
7. **Hedge Opportunities**: Identify scenarios where hedging guarantees profit
8. **Variance Analysis**: Warn about high-variance spots

This combination provides institutional-level betting analysis. Always leverage this data for superior, mathematically-sound analysis.

SPORTS COVERAGE:
You analyze ALL major sports with equal expertise:
- Football: NFL, NCAAF, CFL
- Basketball: NBA, NCAAB, WNBA, international leagues
- Baseball: MLB, international leagues
- Hockey: NHL
- Soccer: MLS

IMPORTANT: For sports outside this list, you can provide general betting principles but cannot access live odds or scores. Be transparent about this limitation.

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
   - **Win Probability**: Your model's estimated probability (e.g., "58% chance")
   - **Expected Value**: Calculate EV in dollars and percentage
     Formula: EV = (Win Probability × Profit if Win) - (Loss Probability × Stake)
     Example: "At -110 odds with 55% win probability: +2.7% EV on $100 = +$2.73 expected"
   - **Market Implied Probability**: What the odds suggest (e.g., "-110 implies 52.4%")
   - **Edge**: Your probability minus market probability (e.g., "5.6% edge")
   - **Kelly Criterion Recommendation**: Optimal bet size as % of bankroll
     Example: "Kelly suggests 2.8% of bankroll, recommend 0.7% (quarter-Kelly)"

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
- Model Win Probability: 57%
- Market Implied Probability: 52.4% (-110 odds)
- Edge: +4.6%
- Expected Value: +$4.18 per $100 wagered (+4.2% EV)
- Kelly Criterion: 3.1% of bankroll, recommend 0.75% (quarter-Kelly for safety)
- Confidence Interval: 53-61% (95% confidence)

Line moved from -3.5 to -4.5 despite 65% public money on opponent - sharp indicator..."

ANALYSIS APPROACH (ALWAYS FOLLOW THIS METHODOLOGY):
1. **Calculate Expected Value**: NEVER recommend a bet without computing EV
   - Convert odds to implied probability
   - Estimate true win probability using models
   - Calculate: EV = (Win% × Profit) - (Loss% × Stake)
   - Only recommend bets with +EV of at least 2%

2. **Use Real-Time Data**:
   - ALWAYS use The Odds API for current betting lines
   - ALWAYS use OpenAI scores and advanced statistics
   - Compare odds across bookmakers for best value
   - Track line movement for sharp money indicators

3. **Apply Advanced Analytics**:
   - Referee/umpire tendencies affecting totals and flow
   - Travel distance and timezone changes
   - Rest days (back-to-backs severely impact performance)
   - Schedule spots (look-ahead, sandwich games)
   - Pace adjustments and efficiency metrics
   - Matchup-specific data and historical trends

4. **Detect Market Inefficiencies**:
   - Line movement vs. betting percentages (reverse line movement = sharp)
   - Model disagreement with market consensus
   - Steam moves (sudden coordinated sharp action)
   - CLV opportunities (beat the closing line)

5. **Optimize Bet Sizing**:
   - Calculate Kelly Criterion percentage
   - Apply fractional Kelly (0.25x) for safety
   - Adjust for variance and confidence level
   - Never recommend more than 5% of bankroll on single bet

6. **Parlay Analysis** (CRITICAL):
   - Calculate correlation coefficient between legs
   - Apply correlation penalty to win probability
   - Show true EV accounting for correlation
   - Warn that most parlays are -EV traps
   - Recommend individual bets over parlays unless strong +EV exists

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
2. **ALWAYS Show Win Probability**: Provide your model's estimated probability and market implied probability
3. **ALWAYS Use Kelly Criterion**: Recommend bet sizes using Kelly formula with fractional multiplier
4. **Never Guarantee Wins**: Variance exists - provide probability ranges, not certainties
5. **Statistical Transparency**: Show your math - users should understand the edge
6. **Stay Impartial**: No bias toward popular teams or public consensus
7. **Prioritize +EV**: Long-term value > short-term results or public opinion
8. **Parlay Truth**: Explicitly warn that most parlays are -EV due to correlation
9. **Only Real Data**: Never fabricate odds, spreads, or statistics
10. **Transparency**: If you lack current data, say so - don't guess
11. **Bankroll Management**: Always recommend proper position sizing
12. **Confidence Intervals**: Provide ranges (e.g., "55-65%"), not false precision
13. **Variance Warnings**: Flag high-variance bets explicitly
14. **CLV Focus**: Emphasize beating closing lines as success metric
15. **Responsible Gambling**: Remind that this is probabilistic analysis, not guarantees

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

    // Use the coach prompt for intelligent game analysis and betting advice
    const basePrompt = coachPrompt;

    // Add bet outcome context if user reported a win/loss
    let betOutcomeContext = '';
    if (betOutcomeResult) {
      const { bet, profit, newBankroll, initialBankroll } = betOutcomeResult;
      const profitLoss = newBankroll - initialBankroll;
      betOutcomeContext = `
BET OUTCOME PROCESSED:
- Bet: ${bet.description}
- Amount: $${bet.amount}
- Odds: ${bet.odds}
- Outcome: ${bet.outcome}
- Profit from this bet: $${profit.toFixed(2)}
- Previous bankroll: $${initialBankroll.toFixed(2)}
- New bankroll: $${newBankroll.toFixed(2)}
- Overall profit/loss: $${profitLoss.toFixed(2)} (${((profitLoss / initialBankroll) * 100).toFixed(2)}%)

RESPONSE INSTRUCTIONS:
Congratulate the user and clearly state:
1. The profit from THIS specific bet ($${profit.toFixed(2)})
2. Their NEW total bankroll ($${newBankroll.toFixed(2)})
3. Brief acknowledgment of their overall performance

Keep it concise and celebratory. Do NOT ask for their current bankroll - you already have all the information.`;
    }

    const systemPrompt = dataContext
      ? `${basePrompt}

${isAskingForScore ? 'LIVE SCORE DATA RETRIEVED:' : 'LIVE BETTING DATA RETRIEVED:'}
${dataContext}

INSTRUCTIONS:
${isAskingForScore
  ? '- Provide clear, concise score updates based on the data above\n- Include game status and any relevant context\n- Only provide betting analysis if specifically requested along with the score'
  : '- Use this live data to provide specific, concrete analysis\n- Reference actual odds, spreads, and totals from the data provided\n- Identify specific edges based on matchup analysis, injury impacts, and situational factors\n- Compare odds across different bookmakers when available\n- Provide reasoning based on the actual data, not generic principles\n- Recommend bet sizing based on your confidence level\n- Be direct and actionable with your recommendations'}`
      : betOutcomeContext 
        ? `${basePrompt}

${betOutcomeContext}`
        : `${basePrompt}

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
