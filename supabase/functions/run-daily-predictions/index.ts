import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log("[run-daily-predictions] Starting daily prediction run at", new Date().toISOString());

    const results = {
      nfl: { success: false, count: 0, error: null as string | null },
      nba: { success: false, count: 0, error: null as string | null },
      mlb: { success: false, count: 0, error: null as string | null },
      playerProps: { success: false, count: 0, error: null as string | null },
      sharpMoney: { success: false, count: 0, error: null as string | null },
      alerts: { success: false, count: 0, error: null as string | null },
    };

    // Run NFL predictions
    try {
      console.log("[run-daily-predictions] Running NFL predictions...");
      const { data: nflData, error: nflError } = await supabase.functions.invoke("predict-nfl");

      if (nflError) throw nflError;

      results.nfl.success = true;
      results.nfl.count = nflData?.predictions?.length || 0;
      console.log(`[run-daily-predictions] NFL: Generated ${results.nfl.count} predictions`);
    } catch (error) {
      console.error("[run-daily-predictions] NFL Error:", error);
      results.nfl.error = error instanceof Error ? error.message : String(error);
    }

    // Run NBA predictions
    try {
      console.log("[run-daily-predictions] Running NBA predictions...");
      const { data: nbaData, error: nbaError } = await supabase.functions.invoke("predict-nba");

      if (nbaError) throw nbaError;

      results.nba.success = true;
      results.nba.count = nbaData?.predictions?.length || 0;
      console.log(`[run-daily-predictions] NBA: Generated ${results.nba.count} predictions`);
    } catch (error) {
      console.error("[run-daily-predictions] NBA Error:", error);
      results.nba.error = error instanceof Error ? error.message : String(error);
    }

    // Run MLB predictions
    try {
      console.log("[run-daily-predictions] Running MLB predictions...");
      const { data: mlbData, error: mlbError } = await supabase.functions.invoke("predict-mlb");

      if (mlbError) throw mlbError;

      results.mlb.success = true;
      results.mlb.count = mlbData?.predictions?.length || 0;
      console.log(`[run-daily-predictions] MLB: Generated ${results.mlb.count} predictions`);
    } catch (error) {
      console.error("[run-daily-predictions] MLB Error:", error);
      results.mlb.error = error instanceof Error ? error.message : String(error);
    }

    // Run player props predictions
    try {
      console.log("[run-daily-predictions] Running player props predictions...");
      const { data: propsData, error: propsError } = await supabase.functions.invoke("predict-player-props");

      if (propsError) throw propsError;

      results.playerProps.success = true;
      results.playerProps.count = propsData?.predictions?.length || 0;
      console.log(`[run-daily-predictions] Player Props: Generated ${results.playerProps.count} predictions`);
    } catch (error) {
      console.error("[run-daily-predictions] Player Props Error:", error);
      results.playerProps.error = error instanceof Error ? error.message : String(error);
    }

    // Run sharp money detection
    try {
      console.log("[run-daily-predictions] Running sharp money detection...");
      const { data: sharpData, error: sharpError } = await supabase.functions.invoke("detect-sharp-money");

      if (sharpError) throw sharpError;

      results.sharpMoney.success = true;
      results.sharpMoney.count = sharpData?.signals?.length || 0;
      console.log(`[run-daily-predictions] Sharp Money: Detected ${results.sharpMoney.count} signals`);
    } catch (error) {
      console.error("[run-daily-predictions] Sharp Money Error:", error);
      results.sharpMoney.error = error instanceof Error ? error.message : String(error);
    }

    // Run alert detection
    try {
      console.log("[run-daily-predictions] Running alert detection...");
      const { data: alertsData, error: alertsError } = await supabase.functions.invoke("detect-alerts");

      if (alertsError) throw alertsError;

      results.alerts.success = true;
      results.alerts.count = alertsData?.alerts?.length || 0;
      console.log(`[run-daily-predictions] Alerts: Generated ${results.alerts.count} alerts`);
    } catch (error) {
      console.error("[run-daily-predictions] Alerts Error:", error);
      results.alerts.error = error instanceof Error ? error.message : String(error);
    }

    // Calculate totals
    const totalPredictions = results.nfl.count + results.nba.count + results.mlb.count + results.playerProps.count;
    const successfulJobs = Object.values(results).filter(r => r.success).length;
    const totalJobs = Object.keys(results).length;

    console.log(`[run-daily-predictions] Completed: ${successfulJobs}/${totalJobs} jobs successful`);
    console.log(`[run-daily-predictions] Total predictions generated: ${totalPredictions}`);

    // Log the job execution to database
    try {
      const supabaseServiceUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseService = createClient(supabaseServiceUrl, supabaseServiceKey);

      await supabaseService.rpc("log_prediction_job", {
        p_job_name: "daily-ai-predictions",
        p_status: successfulJobs === totalJobs ? "success" : "partial_success",
        p_predictions_generated: totalPredictions,
        p_error_message: successfulJobs === totalJobs ? null : "Some jobs failed",
        p_metadata: results,
      });
    } catch (logError) {
      console.error("[run-daily-predictions] Failed to log job execution:", logError);
      // Don't fail the whole job if logging fails
    }

    return new Response(
      JSON.stringify({
        success: successfulJobs === totalJobs,
        timestamp: new Date().toISOString(),
        summary: {
          totalPredictions,
          successfulJobs,
          totalJobs,
        },
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[run-daily-predictions] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
