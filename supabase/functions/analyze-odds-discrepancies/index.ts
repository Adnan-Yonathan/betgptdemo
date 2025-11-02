// Deno Edge Function to analyze betting odds discrepancies across bookmakers
// This function calculates probability differences to identify the biggest discrepancies
// and stores them in the database to prevent token limit issues in chat responses

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookmakerOdds {
  bookmaker: string;
  odds: number;
  point?: number;
  last_updated: string;
}

interface OddsDiscrepancy {
  event_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  game_time: string | null;
  market_key: string;
  outcome_name: string;
  bookmaker_low: string;
  odds_low: number;
  probability_low: number;
  point_low: number | null;
  bookmaker_high: string;
  odds_high: number;
  probability_high: number;
  point_high: number | null;
  probability_difference: number;
  percentage_difference: number;
  num_bookmakers: number;
  bookmakers_data: BookmakerOdds[];
  data_freshness_minutes: number;
}

// Convert American odds to implied probability
function americanToImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    // Underdog: +150 -> 100 / (150 + 100) = 0.4
    return 100 / (americanOdds + 100);
  } else {
    // Favorite: -150 -> 150 / (150 + 100) = 0.6
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

// Identify sharp vs recreational books
const SHARP_BOOKS = ['Pinnacle', 'CRIS', 'Circa Sports', '5Dimes', 'Bookmaker'];
const RECREATIONAL_BOOKS = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'BetRivers'];

function getBookmakerType(bookmaker: string): 'sharp' | 'recreational' | 'unknown' {
  if (SHARP_BOOKS.includes(bookmaker)) return 'sharp';
  if (RECREATIONAL_BOOKS.includes(bookmaker)) return 'recreational';
  return 'unknown';
}

// Generate contextual reasoning for the discrepancy
function generateReasoning(
  bookmakerLow: string,
  bookmakerHigh: string,
  probabilityDiff: number,
  market: string
): string {
  const lowType = getBookmakerType(bookmakerLow);
  const highType = getBookmakerType(bookmakerHigh);
  const diffPercent = (probabilityDiff * 100).toFixed(2);

  if (probabilityDiff > 0.03) {
    // >3% difference - significant value
    if (highType === 'sharp') {
      return `Significant ${diffPercent}% value opportunity. ${bookmakerHigh} (sharp book) has much better odds than ${bookmakerLow}. Sharp books typically have efficient lines, suggesting this is real value.`;
    } else if (lowType === 'recreational') {
      return `Significant ${diffPercent}% discrepancy. ${bookmakerLow} (recreational book) has a soft line. These books often have less efficient pricing - good opportunity.`;
    }
    return `Large ${diffPercent}% discrepancy between ${bookmakerHigh} and ${bookmakerLow}. Strong value opportunity.`;
  } else if (probabilityDiff > 0.02) {
    // 2-3% difference - good value
    return `Notable ${diffPercent}% value at ${bookmakerHigh} compared to ${bookmakerLow}. Solid line shopping opportunity.`;
  } else if (probabilityDiff > 0.01) {
    // 1-2% difference - decent value
    if (market === 'spreads') {
      return `${diffPercent}% better odds at ${bookmakerHigh}. Could translate to half a point or better on the spread.`;
    }
    return `${diffPercent}% edge at ${bookmakerHigh}. Worthwhile if this aligns with your analysis.`;
  }

  return `${diffPercent}% difference between books. Line shopping adds up over time.`;
}

// Calculate data freshness in minutes
function calculateFreshnessMinutes(lastUpdated: string): number {
  const now = new Date();
  const updated = new Date(lastUpdated);
  const diffMs = now.getTime() - updated.getTime();
  return Math.floor(diffMs / 60000);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    console.log("[ODDS-DISCREPANCY] Starting odds discrepancy analysis...");

    // Parse request body (optional filters)
    const { sport, min_bookmakers = 2 } = await req.json().catch(() => ({}));

    // Fetch recent betting odds (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    let query = supabaseClient
      .from("betting_odds")
      .select("*")
      .gte("last_updated", twoHoursAgo)
      .order("last_updated", { ascending: false });

    if (sport) {
      query = query.eq("sport", sport);
    }

    const { data: oddsData, error: oddsError } = await query;

    if (oddsError) {
      console.error("[ODDS-DISCREPANCY] Error fetching odds:", oddsError);
      throw oddsError;
    }

    if (!oddsData || oddsData.length === 0) {
      console.log("[ODDS-DISCREPANCY] No recent odds data found");
      return new Response(
        JSON.stringify({
          message: "No recent odds data found",
          discrepancies_found: 0
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`[ODDS-DISCREPANCY] Analyzing ${oddsData.length} odds entries...`);

    // Group odds by event, market, and outcome
    const groupedOdds = new Map<string, {
      event_id: string;
      sport: string;
      home_team: string;
      away_team: string;
      game_time: string | null;
      market_key: string;
      outcome_name: string;
      odds: BookmakerOdds[];
    }>();

    for (const odd of oddsData) {
      const key = `${odd.event_id}|${odd.market_key}|${odd.outcome_name}`;

      if (!groupedOdds.has(key)) {
        groupedOdds.set(key, {
          event_id: odd.event_id,
          sport: odd.sport,
          home_team: odd.home_team,
          away_team: odd.away_team,
          game_time: odd.game_time,
          market_key: odd.market_key,
          outcome_name: odd.outcome_name,
          odds: [],
        });
      }

      groupedOdds.get(key)!.odds.push({
        bookmaker: odd.bookmaker,
        odds: odd.outcome_price,
        point: odd.outcome_point,
        last_updated: odd.last_updated,
      });
    }

    console.log(`[ODDS-DISCREPANCY] Grouped into ${groupedOdds.size} unique market outcomes`);

    // Analyze discrepancies
    const discrepancies: OddsDiscrepancy[] = [];

    for (const [key, group] of groupedOdds.entries()) {
      // Only analyze if we have multiple bookmakers
      if (group.odds.length < min_bookmakers) {
        continue;
      }

      // Calculate implied probabilities for each bookmaker
      const probabilities = group.odds.map(odd => ({
        bookmaker: odd.bookmaker,
        odds: odd.odds,
        point: odd.point,
        probability: americanToImpliedProbability(odd.odds),
        last_updated: odd.last_updated,
      }));

      // Find min and max probabilities
      probabilities.sort((a, b) => a.probability - b.probability);
      const lowest = probabilities[0];
      const highest = probabilities[probabilities.length - 1];

      const probabilityDiff = highest.probability - lowest.probability;
      const percentageDiff = (probabilityDiff / lowest.probability) * 100;

      // Only store significant discrepancies (> 0.5% probability difference)
      if (probabilityDiff > 0.005) {
        // Calculate average freshness
        const avgFreshness = Math.floor(
          group.odds.reduce((sum, odd) => {
            return sum + calculateFreshnessMinutes(odd.last_updated);
          }, 0) / group.odds.length
        );

        discrepancies.push({
          event_id: group.event_id,
          sport: group.sport,
          home_team: group.home_team,
          away_team: group.away_team,
          game_time: group.game_time,
          market_key: group.market_key,
          outcome_name: group.outcome_name,
          bookmaker_low: lowest.bookmaker,
          odds_low: lowest.odds,
          probability_low: lowest.probability,
          point_low: lowest.point || null,
          bookmaker_high: highest.bookmaker,
          odds_high: highest.odds,
          probability_high: highest.probability,
          point_high: highest.point || null,
          probability_difference: probabilityDiff,
          percentage_difference: percentageDiff,
          num_bookmakers: group.odds.length,
          bookmakers_data: group.odds,
          data_freshness_minutes: avgFreshness,
        });
      }
    }

    console.log(`[ODDS-DISCREPANCY] Found ${discrepancies.length} significant discrepancies`);

    if (discrepancies.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No significant discrepancies found",
          discrepancies_found: 0
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Store discrepancies in database
    const { error: insertError } = await supabaseClient
      .from("odds_discrepancies")
      .insert(discrepancies);

    if (insertError) {
      console.error("[ODDS-DISCREPANCY] Error inserting discrepancies:", insertError);
      throw insertError;
    }

    // Get the top 10 biggest discrepancies for the response
    const topDiscrepancies = discrepancies
      .sort((a, b) => b.probability_difference - a.probability_difference)
      .slice(0, 10)
      .map(d => ({
        game: `${d.away_team} @ ${d.home_team}`,
        market: d.market_key,
        outcome: d.outcome_name,
        probability_difference: `${(d.probability_difference * 100).toFixed(2)}%`,
        bookmaker_low: `${d.bookmaker_low} (${(d.probability_low * 100).toFixed(2)}%)`,
        bookmaker_high: `${d.bookmaker_high} (${(d.probability_high * 100).toFixed(2)}%)`,
      }));

    console.log("[ODDS-DISCREPANCY] Analysis complete!");

    return new Response(
      JSON.stringify({
        message: "Odds discrepancy analysis completed successfully",
        discrepancies_found: discrepancies.length,
        top_discrepancies: topDiscrepancies,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("[ODDS-DISCREPANCY] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
