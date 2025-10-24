import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GameInsights {
  valuePercent: number;
  sharpMoneyPercent: number;
  lineMovement: {
    opening: number;
    current: number;
    direction: "up" | "down" | "stable";
  };
  dataConfidence: number;
  injuries: string[];
  weather: string;
  publicBettingPercent: number;
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

    // Fetch prediction for this game
    const { data: prediction, error: predError } = await supabase
      .from("model_predictions")
      .select("*")
      .eq("event_id", eventId)
      .single();

    if (predError && predError.code !== "PGRST116") {
      console.error("[get-game-insights] Error fetching prediction:", predError);
    }

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

    // Build insights object
    const insights: GameInsights = {
      valuePercent: prediction?.edge_percentage || 0,
      sharpMoneyPercent: sharpSignals?.sharp_percentage || 50,
      lineMovement: {
        opening: openingClosing?.opening_spread || lineHistory?.[0]?.spread || 0,
        current: lineHistory?.[lineHistory.length - 1]?.spread || openingClosing?.opening_spread || 0,
        direction: "stable",
      },
      dataConfidence: prediction?.confidence_score || 75,
      injuries: [],
      weather: "",
      publicBettingPercent: sharpSignals?.public_percentage || 50,
    };

    // Calculate line movement direction
    if (insights.lineMovement.current > insights.lineMovement.opening + 0.5) {
      insights.lineMovement.direction = "up";
    } else if (insights.lineMovement.current < insights.lineMovement.opening - 0.5) {
      insights.lineMovement.direction = "down";
    }

    // Extract injuries from feature values
    if (prediction?.feature_values) {
      const features = prediction.feature_values as Record<string, any>;
      if (features.injuries && Array.isArray(features.injuries)) {
        insights.injuries = features.injuries;
      }
      if (features.weather) {
        insights.weather = features.weather;
      }
    }

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
        error: error.message || "Internal server error",
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
