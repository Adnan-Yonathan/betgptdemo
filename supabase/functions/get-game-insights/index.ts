import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GameInsights {
  lineMovement: {
    opening: number;
    current: number;
    direction: "up" | "down" | "stable";
    magnitude: number;
  };
  sharpMoneyIndicators: {
    hasSharpAction: boolean;
    sharpSide?: string;
    signalType?: string;
    strength?: string;
  };
  oddsComparison: {
    bestSpread?: { bookmaker: string; point: number; odds: number };
    worstSpread?: { bookmaker: string; point: number; odds: number };
    spreadRange?: number;
  };
  discrepancies: Array<{
    market: string;
    outcome: string;
    probabilityDiff: number;
    bestBook: string;
    worstBook: string;
  }>;
  injuries: Array<{ player: string; status: string; team: string }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get game ID from query params
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");

    if (!eventId) {
      throw new Error("Missing eventId parameter");
    }

    console.log(`[get-game-insights] Fetching insights for event ${eventId}`);

    // Fetch sharp money signals
    const { data: sharpSignals, error: sharpError } = await supabase
      .from("sharp_money_signals")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (sharpError && sharpError.code !== "PGRST116") {
      console.error("[get-game-insights] Error fetching sharp signals:", sharpError);
    }

    // Fetch line movement history
    const { data: lineHistory, error: lineError } = await supabase
      .from("line_movement_history")
      .select("*")
      .eq("event_id", eventId)
      .order("recorded_at", { ascending: true });

    if (lineError) {
      console.error("[get-game-insights] Error fetching line history:", lineError);
    }

    // Fetch opening/closing lines
    const { data: openingClosing, error: ocError } = await supabase
      .from("opening_closing_lines")
      .select("*")
      .eq("event_id", eventId)
      .single();

    if (ocError && ocError.code !== "PGRST116") {
      console.error("[get-game-insights] Error fetching opening/closing:", ocError);
    }

    // Fetch current betting odds for comparison
    const { data: currentOdds, error: oddsError } = await supabase
      .from("betting_odds")
      .select("*")
      .eq("event_id", eventId)
      .eq("market_key", "spreads")
      .order("last_update", { ascending: false });

    if (oddsError) {
      console.error("[get-game-insights] Error fetching odds:", oddsError);
    }

    // Fetch odds discrepancies for this game
    const { data: discrepancies, error: discError } = await supabase
      .from("odds_discrepancies")
      .select("*")
      .eq("event_id", eventId)
      .order("probability_difference", { ascending: false })
      .limit(5);

    if (discError) {
      console.error("[get-game-insights] Error fetching discrepancies:", discError);
    }

    // Fetch injury reports
    const { data: injuries, error: injuryError } = await supabase
      .from("injury_reports")
      .select("player_name, injury_status, team, position")
      .eq("event_id", eventId)
      .in("injury_status", ["Out", "Doubtful", "Questionable"]);

    if (injuryError) {
      console.error("[get-game-insights] Error fetching injuries:", injuryError);
    }

    // Calculate line movement
    const opening = openingClosing?.opening_spread || lineHistory?.[0]?.spread || 0;
    const current = lineHistory?.[lineHistory.length - 1]?.spread || openingClosing?.opening_spread || 0;
    const magnitude = Math.abs(current - opening);
    let direction: "up" | "down" | "stable" = "stable";

    if (current > opening + 0.5) {
      direction = "up";
    } else if (current < opening - 0.5) {
      direction = "down";
    }

    // Find best and worst spreads
    let bestSpread = null;
    let worstSpread = null;
    if (currentOdds && currentOdds.length > 0) {
      const spreads = currentOdds
        .filter((o: any) => o.outcome_point !== null)
        .map((o: any) => ({
          bookmaker: o.bookmaker,
          point: o.outcome_point,
          odds: o.outcome_price,
        }));

      if (spreads.length > 0) {
        spreads.sort((a, b) => b.point - a.point);
        bestSpread = spreads[0];
        worstSpread = spreads[spreads.length - 1];
      }
    }

    // Build insights object with value-based data
    const insights: GameInsights = {
      lineMovement: {
        opening,
        current,
        direction,
        magnitude,
      },
      sharpMoneyIndicators: {
        hasSharpAction: !!sharpSignals,
        sharpSide: sharpSignals?.sharp_side,
        signalType: sharpSignals?.signal_type,
        strength: sharpSignals?.strength,
      },
      oddsComparison: {
        bestSpread: bestSpread || undefined,
        worstSpread: worstSpread || undefined,
        spreadRange: bestSpread && worstSpread
          ? Math.abs(bestSpread.point - worstSpread.point)
          : undefined,
      },
      discrepancies: (discrepancies || []).map((d: any) => ({
        market: d.market_key,
        outcome: d.outcome_name,
        probabilityDiff: d.probability_difference,
        bestBook: d.bookmaker_high,
        worstBook: d.bookmaker_low,
      })),
      injuries: (injuries || []).map((inj: any) => ({
        player: inj.player_name,
        status: inj.injury_status,
        team: inj.team,
      })),
    };

    console.log(`[get-game-insights] Returning insights for event ${eventId}`);

    return new Response(
      JSON.stringify({
        insights,
        lastUpdated: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[get-game-insights] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
