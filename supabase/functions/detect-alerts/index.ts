import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { getNowInEST } from '../_shared/dateUtils.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[ALERTS] Starting alert detection...');

    const alerts = {
      lineMovement: await detectLineMovementAlerts(supabase),
      steamMoves: await detectSteamMoves(supabase),
      evDiscrepancies: await detectEVDiscrepancies(supabase),
      closingLine: await detectClosingLineAlerts(supabase),
      injuries: await detectInjuryAlerts(supabase),
      bestLine: await detectBestLineAlerts(supabase),
    };

    const totalAlerts = Object.values(alerts).reduce((sum: number, arr: any) => sum + arr.length, 0);

    // Log execution
    await supabase.from('alert_execution_log').insert({
      alert_type: 'all_alerts',
      alerts_generated: totalAlerts,
      execution_duration_ms: Date.now() - startTime,
      metadata: alerts,
    });

    console.log(`[ALERTS] Generated ${totalAlerts} alerts in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts,
        totalAlerts,
        executionTime: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[ALERTS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Detect significant line movements (steam moves and reverse line movement)
 */
async function detectLineMovementAlerts(supabase: any) {
  const alerts: any[] = [];

  // Get recent betting odds with opening lines (using Eastern Time zone)
  const { data: recentOdds } = await supabase
    .from('betting_odds')
    .select('*')
    .gte('commence_time', getNowInEST().toISOString())
    .order('last_update', { ascending: false });

  if (!recentOdds) return alerts;

  // Track line movements per event/market
  const lineMovements = new Map<string, any>();

  for (const odds of recentOdds) {
    const key = `${odds.event_id}_${odds.market_key}`;

    if (!lineMovements.has(key)) {
      lineMovements.set(key, {
        event_id: odds.event_id,
        sport: odds.sport_key,
        home_team: odds.home_team,
        away_team: odds.away_team,
        game_date: odds.commence_time,
        market_key: odds.market_key,
        bookmakers: [],
      });
    }

    const movement = lineMovements.get(key);
    movement.bookmakers.push({
      name: odds.bookmaker,
      outcomes: odds.outcomes,
      timestamp: odds.last_update,
    });
  }

  // Analyze movements
  for (const [key, movement] of lineMovements) {
    if (movement.bookmakers.length < 2) continue;

    // Sort by timestamp
    movement.bookmakers.sort((a: any, b: any) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const earliest = movement.bookmakers[0];
    const latest = movement.bookmakers[movement.bookmakers.length - 1];

    // Calculate line movement for spreads
    if (movement.market_key === 'spreads') {
      const earlySpread = earliest.outcomes[0]?.point;
      const lateSpread = latest.outcomes[0]?.point;

      if (earlySpread !== undefined && lateSpread !== undefined) {
        const lineMove = Math.abs(lateSpread - earlySpread);

        // Alert if line moved 1+ points
        if (lineMove >= 1) {
          const alert = {
            event_id: movement.event_id,
            sport: movement.sport,
            home_team: movement.home_team,
            away_team: movement.away_team,
            game_date: movement.game_date,
            market_key: movement.market_key,
            alert_type: 'line_movement',
            priority: lineMove >= 2 ? 'high' : 'medium',
            title: `Line Move: ${movement.away_team} @ ${movement.home_team}`,
            message: `Spread moved ${lineMove} points from ${earlySpread} to ${lateSpread}`,
            data: {
              lineMove,
              earlySpread,
              lateSpread,
              bookmakerCount: movement.bookmakers.length,
            },
          };

          alerts.push(alert);

          // Store in line_movement_history
          await supabase.from('line_movement_history').insert({
            event_id: movement.event_id,
            sport: movement.sport,
            home_team: movement.home_team,
            away_team: movement.away_team,
            game_date: movement.game_date,
            market_key: movement.market_key,
            bookmaker: latest.name,
            line_value: lateSpread,
            line_move_from_open: lineMove,
          });
        }
      }
    }
  }

  return alerts;
}

/**
 * Detect steam moves (rapid line movement across multiple books)
 */
async function detectSteamMoves(supabase: any) {
  const alerts: any[] = [];

  // Get odds updated in last 10 minutes (using Eastern Time zone)
  const nowEST = getNowInEST();
  const tenMinutesAgo = new Date(nowEST.getTime() - 10 * 60 * 1000).toISOString();

  const { data: recentUpdates } = await supabase
    .from('betting_odds')
    .select('*')
    .gte('last_update', tenMinutesAgo)
    .gte('commence_time', nowEST.toISOString());

  if (!recentUpdates || recentUpdates.length === 0) return alerts;

  // Group by event/market
  const eventMarkets = new Map<string, any[]>();

  for (const odds of recentUpdates) {
    const key = `${odds.event_id}_${odds.market_key}`;
    if (!eventMarkets.has(key)) {
      eventMarkets.set(key, []);
    }
    eventMarkets.get(key)!.push(odds);
  }

  // Check for steam (3+ books moving in same 10-minute window)
  for (const [key, bookmakers] of eventMarkets) {
    if (bookmakers.length >= 3) {
      const sample = bookmakers[0];

      const alert = {
        event_id: sample.event_id,
        sport: sample.sport_key,
        home_team: sample.home_team,
        away_team: sample.away_team,
        game_date: sample.commence_time,
        market_key: sample.market_key,
        alert_type: 'steam_move',
        priority: 'high',
        title: `Steam Move: ${sample.away_team} @ ${sample.home_team}`,
        message: `${bookmakers.length} books moved lines in last 10 minutes`,
        data: {
          bookmakerCount: bookmakers.length,
          bookmakers: bookmakers.map((b: any) => b.bookmaker),
        },
      };

      alerts.push(alert);

      // Store steam move
      await supabase.from('steam_moves').insert({
        event_id: sample.event_id,
        sport: sample.sport_key,
        home_team: sample.home_team,
        away_team: sample.away_team,
        game_date: sample.commence_time,
        market_key: sample.market_key,
        books_moved: bookmakers.map((b: any) => b.bookmaker),
        books_moved_count: bookmakers.length,
        movement_window_minutes: 10,
      });
    }
  }

  return alerts;
}

/**
 * Detect EV discrepancies (model predictions vs market odds)
 */
async function detectEVDiscrepancies(supabase: any) {
  const alerts: any[] = [];

  // Get model predictions with high edge (using Eastern Time zone)
  const { data: predictions } = await supabase
    .from('model_predictions')
    .select('*')
    .gte('edge_percentage', 3)
    .eq('game_completed', false)
    .gte('game_date', getNowInEST().toISOString())
    .order('edge_percentage', { ascending: false })
    .limit(50);

  if (!predictions) return alerts;

  for (const pred of predictions) {
    const alert = {
      event_id: pred.event_id,
      sport: pred.sport,
      home_team: pred.home_team,
      away_team: pred.away_team,
      game_date: pred.game_date,
      alert_type: 'ev_discrepancy',
      priority: pred.edge_percentage >= 7 ? 'high' : 'medium',
      title: `+EV: ${pred.away_team} @ ${pred.home_team}`,
      message: `Model shows ${pred.edge_percentage.toFixed(1)}% edge on ${pred.edge_side}`,
      data: {
        edgePercentage: pred.edge_percentage,
        edgeSide: pred.edge_side,
        confidence: pred.confidence_score,
        predictedSpread: pred.predicted_spread,
        marketSpread: pred.market_spread,
      },
    };

    alerts.push(alert);
  }

  return alerts;
}

/**
 * Detect closing line alerts (games closing soon with edge)
 */
async function detectClosingLineAlerts(supabase: any) {
  const alerts: any[] = [];

  // Get games starting in next 1-3 hours with model edge (using Eastern Time zone)
  const nowEST = getNowInEST();
  const oneHourFromNow = new Date(nowEST.getTime() + 60 * 60 * 1000).toISOString();
  const threeHoursFromNow = new Date(nowEST.getTime() + 3 * 60 * 60 * 1000).toISOString();

  const { data: predictions } = await supabase
    .from('model_predictions')
    .select('*')
    .gte('game_date', oneHourFromNow)
    .lte('game_date', threeHoursFromNow)
    .gte('edge_percentage', 2)
    .eq('game_completed', false);

  if (!predictions) return alerts;

  for (const pred of predictions) {
    const timeUntilGame = new Date(pred.game_date).getTime() - Date.now();
    const hoursUntilGame = Math.floor(timeUntilGame / (60 * 60 * 1000));

    const alert = {
      event_id: pred.event_id,
      sport: pred.sport,
      home_team: pred.home_team,
      away_team: pred.away_team,
      game_date: pred.game_date,
      alert_type: 'closing_line',
      priority: 'high',
      title: `Closing Soon: ${pred.away_team} @ ${pred.home_team}`,
      message: `Game starts in ${hoursUntilGame}h. ${pred.edge_percentage.toFixed(1)}% edge on ${pred.edge_side}`,
      data: {
        hoursUntilGame,
        edgePercentage: pred.edge_percentage,
        edgeSide: pred.edge_side,
      },
      expires_at: pred.game_date,
    };

    alerts.push(alert);
  }

  return alerts;
}

/**
 * Detect injury alerts (key players out/doubtful)
 */
async function detectInjuryAlerts(supabase: any) {
  const alerts: any[] = [];

  // Get high-impact injuries from last 24 hours (using Eastern Time zone)
  const nowEST = getNowInEST();
  const yesterday = new Date(nowEST.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: injuries } = await supabase
    .from('injury_reports')
    .select('*')
    .gte('last_updated', yesterday)
    .in('injury_status', ['Out', 'Doubtful'])
    .eq('impact_level', 'High');

  if (!injuries) return alerts;

  for (const injury of injuries) {
    // Get upcoming games for this team
    const { data: upcomingGames } = await supabase
      .from('sports_scores')
      .select('*')
      .or(`home_team.eq.${injury.team},away_team.eq.${injury.team}`)
      .gte('date', getNowInEST().toISOString())
      .limit(1);

    if (upcomingGames && upcomingGames.length > 0) {
      const game = upcomingGames[0];

      const alert = {
        event_id: game.event_id,
        sport: injury.league,
        home_team: game.home_team,
        away_team: game.away_team,
        game_date: game.date,
        alert_type: 'injury',
        priority: 'high',
        title: `Injury Alert: ${injury.player_name} ${injury.injury_status}`,
        message: `${injury.player_name} (${injury.team}) is ${injury.injury_status} - ${injury.injury_type || 'Unknown injury'}`,
        data: {
          player: injury.player_name,
          status: injury.injury_status,
          team: injury.team,
          position: injury.position,
          impactLevel: injury.impact_level,
        },
      };

      alerts.push(alert);
    }
  }

  return alerts;
}

/**
 * Detect best line alerts (significant odds differences across books)
 */
async function detectBestLineAlerts(supabase: any) {
  const alerts: any[] = [];

  // Get recent odds (using Eastern Time zone)
  const nowEST = getNowInEST();
  const sevenDaysFromNowEST = new Date(nowEST.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: odds } = await supabase
    .from('betting_odds')
    .select('*')
    .gte('commence_time', nowEST.toISOString())
    .lte('commence_time', sevenDaysFromNowEST.toISOString());

  if (!odds) return alerts;

  // Group by event/market
  const groupedOdds = new Map<string, any[]>();

  for (const odd of odds) {
    const key = `${odd.event_id}_${odd.market_key}`;
    if (!groupedOdds.has(key)) {
      groupedOdds.set(key, []);
    }
    groupedOdds.get(key)!.push(odd);
  }

  // Find significant differences
  for (const [key, bookmakers] of groupedOdds) {
    if (bookmakers.length < 3) continue;

    // For spreads, check for point differences
    if (bookmakers[0].market_key === 'spreads') {
      const spreads = bookmakers
        .map((b: any) => b.outcomes[0]?.point)
        .filter((p: any) => p !== undefined);

      if (spreads.length >= 3) {
        const minSpread = Math.min(...spreads);
        const maxSpread = Math.max(...spreads);
        const spreadDiff = Math.abs(maxSpread - minSpread);

        // Alert if 0.5+ point difference
        if (spreadDiff >= 0.5) {
          const sample = bookmakers[0];

          const alert = {
            event_id: sample.event_id,
            sport: sample.sport_key,
            home_team: sample.home_team,
            away_team: sample.away_team,
            game_date: sample.commence_time,
            alert_type: 'best_line',
            priority: 'medium',
            title: `Best Line: ${sample.away_team} @ ${sample.home_team}`,
            message: `${spreadDiff} point difference across books (${minSpread} to ${maxSpread})`,
            data: {
              spreadDiff,
              minSpread,
              maxSpread,
              bookmakerCount: bookmakers.length,
            },
          };

          alerts.push(alert);
        }
      }
    }
  }

  return alerts;
}
