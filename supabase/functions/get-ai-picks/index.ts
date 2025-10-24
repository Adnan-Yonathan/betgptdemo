import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIPickData {
  id: string;
  team: string;
  opponent: string;
  line: string;
  confidence: number;
  ev: number;
  reasoning: string;
  sport: string;
  gameTime: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Verify user authentication
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    console.log(`[get-ai-picks] Fetching predictions for user ${user.id}`);

    // Fetch top predictions from the database
    // Only get predictions for games that haven't started yet
    // Join with prediction_models to get active models
    const { data: predictions, error: predictionsError } = await supabase
      .from("model_predictions")
      .select(`
        *,
        prediction_models!inner(
          model_name,
          is_active
        )
      `)
      .eq("prediction_models.is_active", true)
      .eq("game_started", false)
      .gte("game_date", new Date().toISOString())
      .order("confidence_score", { ascending: false })
      .order("edge_percentage", { ascending: false })
      .limit(10);

    if (predictionsError) {
      console.error("[get-ai-picks] Error fetching predictions:", predictionsError);
      throw predictionsError;
    }

    console.log(`[get-ai-picks] Found ${predictions?.length || 0} predictions`);

    // Transform predictions to match frontend format
    const aiPicks: AIPickData[] = (predictions || [])
      .filter((p) => p.edge_percentage > 0 && p.confidence_score >= 60)
      .map((p) => {
        const isSpread = p.prediction_type === "spread";
        const isTotal = p.prediction_type === "total";
        const isMoneyline = p.prediction_type === "moneyline";

        let line = "";
        let team = "";
        let opponent = "";

        if (isSpread) {
          const favorHome = p.edge_side === "home";
          team = favorHome ? p.home_team : p.away_team;
          opponent = favorHome ? `vs ${p.away_team}` : `@ ${p.home_team}`;
          line = `${favorHome ? "" : "+"}${Math.abs(p.predicted_spread).toFixed(1)}`;
        } else if (isTotal) {
          team = `${p.away_team} @ ${p.home_team}`;
          opponent = "";
          line = `${p.edge_side === "over" ? "Over" : "Under"} ${p.market_total?.toFixed(1) || p.predicted_total?.toFixed(1)}`;
        } else if (isMoneyline) {
          const favorHome = p.edge_side === "home";
          team = favorHome ? p.home_team : p.away_team;
          opponent = favorHome ? `vs ${p.away_team}` : `@ ${p.home_team}`;
          line = "ML";
        }

        // Build reasoning from feature values
        const features = p.feature_values as Record<string, any> || {};
        const reasoningParts: string[] = [];

        if (features.home_advantage) {
          reasoningParts.push(`Strong ${p.edge_side === "home" ? "home" : "away"} advantage`);
        }
        if (features.injuries_impact && features.injuries_impact > 0.5) {
          reasoningParts.push(`Key injury impact favoring ${p.edge_side}`);
        }
        if (features.recent_form && features.recent_form > 0.6) {
          reasoningParts.push(`Excellent recent form`);
        }
        if (features.rest_days && features.rest_days > 2) {
          reasoningParts.push(`Well-rested team`);
        }

        // Default reasoning if no features
        if (reasoningParts.length === 0) {
          reasoningParts.push(`Model identifies ${p.edge_percentage.toFixed(1)}% edge based on statistical analysis`);
        }

        const reasoning = reasoningParts.join(". ") + ".";

        // Format game time
        const gameDate = new Date(p.game_date);
        const now = new Date();
        const isToday = gameDate.toDateString() === now.toDateString();
        const isTomorrow = gameDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();

        let gameTime = "";
        if (isToday) {
          gameTime = `Today ${gameDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
        } else if (isTomorrow) {
          gameTime = `Tomorrow ${gameDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
        } else {
          gameTime = gameDate.toLocaleDateString("en-US", {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit"
          });
        }

        return {
          id: p.id,
          team,
          opponent,
          line,
          confidence: Math.round(p.confidence_score),
          ev: parseFloat(p.edge_percentage.toFixed(1)),
          reasoning,
          sport: p.sport.toUpperCase(),
          gameTime,
        };
      });

    console.log(`[get-ai-picks] Returning ${aiPicks.length} formatted picks`);

    return new Response(
      JSON.stringify({
        picks: aiPicks,
        lastUpdated: new Date().toISOString(),
        nextUpdate: getNextUpdateTime(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[get-ai-picks] Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        picks: [],
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

// Calculate next update time (daily at 6 AM ET)
function getNextUpdateTime(): string {
  const now = new Date();
  const nextUpdate = new Date();
  nextUpdate.setHours(6, 0, 0, 0); // 6 AM ET

  // If we're past 6 AM today, set to 6 AM tomorrow
  if (now.getHours() >= 6) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
  }

  return nextUpdate.toISOString();
}
