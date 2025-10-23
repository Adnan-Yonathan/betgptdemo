import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dateRange, sport } = await req.json();

    // Calculate date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let endDate = new Date(today);

    if (dateRange === 'today') {
      endDate.setDate(endDate.getDate() + 1);
    } else if (dateRange === 'tomorrow') {
      today.setDate(today.getDate() + 1);
      endDate.setDate(endDate.getDate() + 2);
    } else if (dateRange === 'week') {
      endDate.setDate(endDate.getDate() + 7);
    } else {
      // Default to next 14 days
      endDate.setDate(endDate.getDate() + 14);
    }

    console.log(`[fetch-all-games] Fetching games from ${today.toISOString()} to ${endDate.toISOString()}`);

    // Step 1: Fetch upcoming games from betting_odds (since it has current games)
    let oddsQuery = supabase
      .from('betting_odds')
      .select('event_id, sport_key, sport_title, home_team, away_team, commence_time')
      .gte('commence_time', today.toISOString())
      .lte('commence_time', endDate.toISOString())
      .order('commence_time', { ascending: true });

    if (sport) {
      oddsQuery = oddsQuery.eq('sport_key', sport);
    }

    const { data: oddsData, error: oddsError } = await oddsQuery;

    if (oddsError) {
      console.error('Error fetching odds:', oddsError);
      throw oddsError;
    }

    // Get unique games
    const uniqueGames = new Map();
    oddsData?.forEach(odd => {
      if (!uniqueGames.has(odd.event_id)) {
        uniqueGames.set(odd.event_id, {
          event_id: odd.event_id,
          sport: odd.sport_key,
          league: extractLeague(odd.sport_title),
          home_team: odd.home_team,
          away_team: odd.away_team,
          game_date: odd.commence_time,
          game_status: 'STATUS_SCHEDULED'
        });
      }
    });

    const games = Array.from(uniqueGames.values());
    console.log(`[fetch-all-games] Found ${games.length} unique games`);

    // Step 2: Enrich each game with additional data
    const enrichedGames = await Promise.all(
      games.map(async (game) => {
        // Fetch all odds for this game
        const { data: gameOdds } = await supabase
          .from('betting_odds')
          .select('*')
          .eq('event_id', game.event_id)
          .order('last_updated', { ascending: false })
          .limit(50);

        // Fetch injuries from injury_reports table
        const { data: injuries } = await supabase
          .from('injury_reports')
          .select('*')
          .or(`home_team.eq.${game.home_team},away_team.eq.${game.away_team}`)
          .gte('report_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        // Fetch schedule factors
        const scheduleFactor = await calculateScheduleFactors(supabase, game);

        // Fetch weather for outdoor sports
        let weather = null;
        if (isOutdoorSport(game.sport)) {
          weather = await fetchWeather(game);
        }

        // Generate AI recommendation
        const aiRecommendation = await generateAIRecommendation(game, gameOdds || [], injuries || [], scheduleFactor, weather);

        return {
          ...game,
          odds: gameOdds || [],
          injuries: injuries || [],
          weather,
          schedule_factors: scheduleFactor,
          ai_recommendation: aiRecommendation
        };
      })
    );

    // Sort by AI edge (highest first)
    enrichedGames.sort((a, b) => {
      const edgeA = a.ai_recommendation?.edge || 0;
      const edgeB = b.ai_recommendation?.edge || 0;
      return edgeB - edgeA;
    });

    console.log(`[fetch-all-games] Enriched ${enrichedGames.length} games with data`);

    return new Response(
      JSON.stringify({
        games: enrichedGames,
        count: enrichedGames.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("fetch-all-games error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function extractLeague(sportTitle: string): string {
  const leagueMap: Record<string, string> = {
    'NFL': 'NFL',
    'NCAAF': 'NCAAF',
    'NCAA': 'NCAAF',
    'College Football': 'NCAAF',
    'NHL': 'NHL',
    'NBA': 'NBA',
    'MLB': 'MLB'
  };

  for (const [key, value] of Object.entries(leagueMap)) {
    if (sportTitle.includes(key)) {
      return value;
    }
  }

  return sportTitle;
}

function isOutdoorSport(sport: string): boolean {
  const outdoorSports = ['americanfootball_nfl', 'americanfootball_ncaaf', 'baseball_mlb'];
  return outdoorSports.includes(sport);
}

async function calculateScheduleFactors(supabase: any, game: any) {
  // Calculate rest days for both teams
  const homeRest = await calculateRestDays(supabase, game.home_team, game.game_date, game.league);
  const awayRest = await calculateRestDays(supabase, game.away_team, game.game_date, game.league);

  return {
    home_rest_days: homeRest,
    away_rest_days: awayRest
  };
}

async function calculateRestDays(supabase: any, team: string, gameDate: string, league: string): Promise<number> {
  // Find the last game this team played
  const { data: lastGame } = await supabase
    .from('sports_scores')
    .select('game_date')
    .eq('league', league)
    .or(`home_team.eq.${team},away_team.eq.${team}`)
    .lt('game_date', gameDate)
    .order('game_date', { ascending: false })
    .limit(1);

  if (!lastGame || lastGame.length === 0) {
    return 7; // Default to 7 days if no previous game found
  }

  const lastGameDate = new Date(lastGame[0].game_date);
  const currentGameDate = new Date(gameDate);
  const diffTime = currentGameDate.getTime() - lastGameDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

async function fetchWeather(game: any) {
  // Check if we have cached weather data
  try {
    const weatherApiKey = Deno.env.get('OPENWEATHER_API_KEY');
    if (!weatherApiKey) {
      console.log('[fetch-weather] No weather API key configured');
      return null;
    }

    // For now, return mock data - in production, call OpenWeatherMap API
    // You would need to map team to location/coordinates
    return {
      temperature: 65,
      wind_speed: 8,
      precipitation_prob: 10
    };
  } catch (error) {
    console.error('[fetch-weather] Error fetching weather:', error);
    return null;
  }
}

async function generateAIRecommendation(game: any, odds: any[], injuries: any[], scheduleFactor: any, weather: any) {
  // EV-based recommendation system
  // Calculates true win probabilities and finds highest +EV bets

  try {
    // Get all available markets
    const h2hOdds = odds.filter(o => o.market_key === 'h2h');
    const spreadOdds = odds.filter(o => o.market_key === 'spreads');
    const totalOdds = odds.filter(o => o.market_key === 'totals');

    if (h2hOdds.length === 0) {
      return null;
    }

    // Calculate base probabilities from market odds (remove vig)
    const homeH2HOdds = h2hOdds.filter(o => o.outcome_name === game.home_team);
    const awayH2HOdds = h2hOdds.filter(o => o.outcome_name === game.away_team);

    if (homeH2HOdds.length === 0 || awayH2HOdds.length === 0) {
      return null;
    }

    // Calculate average implied probabilities
    const avgHomeImplied = homeH2HOdds.reduce((sum, o) => sum + calculateImpliedProbability(o.outcome_price), 0) / homeH2HOdds.length;
    const avgAwayImplied = awayH2HOdds.reduce((sum, o) => sum + calculateImpliedProbability(o.outcome_price), 0) / awayH2HOdds.length;

    // Remove vig to get fair market probabilities
    const totalImplied = avgHomeImplied + avgAwayImplied;
    let homeBaseProb = avgHomeImplied / totalImplied;
    let awayBaseProb = avgAwayImplied / totalImplied;

    // Adjust probabilities based on situational factors
    let homeProbAdjustment = 0;
    let awayProbAdjustment = 0;
    const reasoning = [];

    // Rest advantage (±2-3% per extra rest day)
    const restDiff = scheduleFactor.home_rest_days - scheduleFactor.away_rest_days;
    if (Math.abs(restDiff) > 1) {
      const restImpact = Math.min(Math.abs(restDiff) * 0.02, 0.05); // Cap at 5%
      if (restDiff > 0) {
        homeProbAdjustment += restImpact;
        awayProbAdjustment -= restImpact;
        reasoning.push(`${game.home_team} has ${restDiff} more rest days (+${(restImpact * 100).toFixed(1)}%)`);
      } else {
        awayProbAdjustment += restImpact;
        homeProbAdjustment -= restImpact;
        reasoning.push(`${game.away_team} has ${Math.abs(restDiff)} more rest days (+${(restImpact * 100).toFixed(1)}%)`);
      }
    }

    // Injury impact (1-3% per significant injury)
    const homeInjuries = injuries.filter(i => i.home_team === game.home_team || i.team === game.home_team);
    const awayInjuries = injuries.filter(i => i.away_team === game.away_team || i.team === game.away_team);

    const injuryDiff = homeInjuries.length - awayInjuries.length;
    if (Math.abs(injuryDiff) > 0) {
      const injuryImpact = Math.min(Math.abs(injuryDiff) * 0.015, 0.04); // Cap at 4%
      if (injuryDiff > 0) {
        // Home team has more injuries - disadvantage
        homeProbAdjustment -= injuryImpact;
        awayProbAdjustment += injuryImpact;
        reasoning.push(`${game.home_team} has ${homeInjuries.length} key injuries (-${(injuryImpact * 100).toFixed(1)}%)`);
      } else {
        awayProbAdjustment -= injuryImpact;
        homeProbAdjustment += injuryImpact;
        reasoning.push(`${game.away_team} has ${awayInjuries.length} key injuries (-${(injuryImpact * 100).toFixed(1)}%)`);
      }
    }

    // Home field advantage already factored into market odds
    // Only add additional adjustment if weather is extreme (for outdoor sports)
    if (weather && isOutdoorSport(game.sport)) {
      if (weather.wind_speed && weather.wind_speed > 15) {
        // High wind typically favors under and running games
        reasoning.push(`High winds (${weather.wind_speed} mph) may impact passing game`);
      }
      if (weather.precipitation_prob && weather.precipitation_prob > 60) {
        reasoning.push(`High chance of precipitation (${weather.precipitation_prob}%)`);
      }
    }

    // Apply adjustments and normalize
    let homeTrueProb = Math.max(0.05, Math.min(0.95, homeBaseProb + homeProbAdjustment));
    let awayTrueProb = Math.max(0.05, Math.min(0.95, awayBaseProb + awayProbAdjustment));

    // Normalize to sum to 1
    const totalTrueProb = homeTrueProb + awayTrueProb;
    homeTrueProb = homeTrueProb / totalTrueProb;
    awayTrueProb = awayTrueProb / totalTrueProb;

    // Find best available odds for each team
    const bestHomeOdds = Math.max(...homeH2HOdds.map(o => o.outcome_price));
    const bestAwayOdds = Math.max(...awayH2HOdds.map(o => o.outcome_price));

    // Calculate EV for each option
    const homeEV = calculateEV(homeTrueProb, bestHomeOdds);
    const awayEV = calculateEV(awayTrueProb, bestAwayOdds);

    // Find the best +EV opportunity
    let bestPick = null;
    let bestEV = -Infinity;
    let bestOdds = 0;
    let bestWinProb = 0;

    if (homeEV > bestEV) {
      bestEV = homeEV;
      bestPick = `${game.home_team} Moneyline`;
      bestOdds = bestHomeOdds;
      bestWinProb = homeTrueProb;
    }

    if (awayEV > bestEV) {
      bestEV = awayEV;
      bestPick = `${game.away_team} Moneyline`;
      bestOdds = bestAwayOdds;
      bestWinProb = awayTrueProb;
    }

    // Only recommend if EV is positive (at least 0.5%)
    if (bestEV < 0.5) {
      return null;
    }

    // Format pick with odds
    const formattedPick = `${bestPick} (${bestOdds > 0 ? '+' : ''}${bestOdds})`;

    // Add EV information to reasoning
    reasoning.unshift(`Expected Value: +${bestEV.toFixed(1)}% (estimated ${(bestWinProb * 100).toFixed(1)}% win probability)`);

    return {
      pick: formattedPick,
      ev: bestEV,
      edge: bestEV, // Keep 'edge' for backward compatibility
      win_probability: bestWinProb,
      odds: bestOdds,
      reasoning
    };

  } catch (error) {
    console.error('[generateAIRecommendation] Error:', error);
    return null;
  }
}

// Helper function to calculate EV
function calculateEV(trueWinProbability: number, americanOdds: number): number {
  const stake = 100;
  let profit: number;

  if (americanOdds > 0) {
    profit = stake * (americanOdds / 100);
  } else {
    profit = stake * (100 / Math.abs(americanOdds));
  }

  const lossProbability = 1 - trueWinProbability;
  const ev = (trueWinProbability * profit) - (lossProbability * stake);

  return (ev / stake) * 100;
}

function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}
