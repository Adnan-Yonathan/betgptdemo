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
        const aiRecommendation = await generateAIRecommendation(game, gameOdds, injuries, scheduleFactor, weather);

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
    'NHL': 'NHL'
  };

  for (const [key, value] of Object.entries(leagueMap)) {
    if (sportTitle.includes(key)) {
      return value;
    }
  }

  return sportTitle;
}

function isOutdoorSport(sport: string): boolean {
  const outdoorSports = ['americanfootball_nfl', 'americanfootball_ncaaf'];
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
  // Simple heuristic-based recommendation
  // In production, this would call your ML model or sophisticated analysis

  try {
    // Find best odds for each team
    const h2hOdds = odds.filter(o => o.market_key === 'h2h');

    if (h2hOdds.length === 0) {
      return null;
    }

    // Get home and away odds
    const homeOdds = h2hOdds.filter(o => o.outcome_name === game.home_team);
    const awayOdds = h2hOdds.filter(o => o.outcome_name === game.away_team);

    if (homeOdds.length === 0 || awayOdds.length === 0) {
      return null;
    }

    // Calculate implied probabilities
    const homeImpliedProb = calculateImpliedProbability(homeOdds[0].outcome_price);
    const awayImpliedProb = calculateImpliedProbability(awayOdds[0].outcome_price);

    // Simple model: adjust probabilities based on factors
    let homeEdge = 0;
    let awayEdge = 0;
    const reasoning = [];

    // Rest advantage
    if (scheduleFactor.home_rest_days > scheduleFactor.away_rest_days + 1) {
      homeEdge += 2;
      reasoning.push(`${game.home_team} has ${scheduleFactor.home_rest_days - scheduleFactor.away_rest_days} more rest days`);
    } else if (scheduleFactor.away_rest_days > scheduleFactor.home_rest_days + 1) {
      awayEdge += 2;
      reasoning.push(`${game.away_team} has ${scheduleFactor.away_rest_days - scheduleFactor.home_rest_days} more rest days`);
    }

    // Injury impact
    const homeInjuries = injuries.filter(i => i.home_team === game.home_team || i.team === game.home_team);
    const awayInjuries = injuries.filter(i => i.away_team === game.away_team || i.team === game.away_team);

    if (awayInjuries.length > homeInjuries.length + 1) {
      homeEdge += 3;
      reasoning.push(`${game.away_team} has ${awayInjuries.length} injuries`);
    } else if (homeInjuries.length > awayInjuries.length + 1) {
      awayEdge += 3;
      reasoning.push(`${game.home_team} has ${homeInjuries.length} injuries`);
    }

    // Home field advantage (general)
    homeEdge += 2;
    reasoning.push(`Home field advantage for ${game.home_team}`);

    // Determine recommendation
    const totalHomeEdge = homeEdge - awayEdge;
    let pick = "";
    let confidence = 50;
    let edge = 0;

    if (totalHomeEdge > 3) {
      pick = `${game.home_team} Moneyline (${homeOdds[0].outcome_price > 0 ? '+' : ''}${homeOdds[0].outcome_price})`;
      confidence = Math.min(50 + totalHomeEdge * 5, 85);
      edge = totalHomeEdge;
    } else if (totalHomeEdge < -3) {
      pick = `${game.away_team} Moneyline (${awayOdds[0].outcome_price > 0 ? '+' : ''}${awayOdds[0].outcome_price})`;
      confidence = Math.min(50 + Math.abs(totalHomeEdge) * 5, 85);
      edge = Math.abs(totalHomeEdge);
    } else {
      // No strong recommendation
      return null;
    }

    return {
      pick,
      confidence,
      edge,
      reasoning
    };

  } catch (error) {
    console.error('[generateAIRecommendation] Error:', error);
    return null;
  }
}

function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}
