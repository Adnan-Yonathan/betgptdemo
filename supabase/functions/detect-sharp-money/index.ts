import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[SHARP_MONEY] Starting sharp money detection...');

    // Get betting odds with line movement history
    const signals = [];

    // Detect reverse line movement
    const rlmSignals = await detectReverseLineMovement(supabase);
    signals.push(...rlmSignals);

    // Detect steam moves
    const steamSignals = await detectSteamMoves(supabase);
    signals.push(...steamSignals);

    // Detect sharp book consensus
    const consensusSignals = await detectSharpBookConsensus(supabase);
    signals.push(...consensusSignals);

    // Store signals in database
    for (const signal of signals) {
      await supabase.from('sharp_money_signals').upsert(signal, {
        onConflict: 'event_id,market_key,signal_type,detected_at',
      });
    }

    // Store opening/closing lines
    await updateOpeningClosingLines(supabase);

    console.log(`[SHARP_MONEY] Detected ${signals.length} sharp money signals`);

    return new Response(
      JSON.stringify({
        success: true,
        signals: signals.length,
        data: signals,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SHARP_MONEY] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Detect Reverse Line Movement (RLM)
 * Line moves opposite to public betting percentage
 */
async function detectReverseLineMovement(supabase: any) {
  const signals = [];

  // Get recent line movements
  const { data: movements } = await supabase
    .from('line_movement_history')
    .select('*')
    .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('timestamp', { ascending: false });

  if (!movements || movements.length === 0) return signals;

  // Group by event/market
  const groupedMovements = new Map<string, any[]>();

  for (const movement of movements) {
    const key = `${movement.event_id}_${movement.market_key}`;
    if (!groupedMovements.has(key)) {
      groupedMovements.set(key, []);
    }
    groupedMovements.get(key).push(movement);
  }

  // Analyze each event for RLM
  for (const [key, moves] of groupedMovements) {
    if (moves.length < 2) continue;

    // Sort by timestamp
    moves.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const earliest = moves[0];
    const latest = moves[moves.length - 1];

    // Calculate line movement
    const lineMove = latest.line_value - earliest.line_value;

    // Check for reverse line movement
    // If public is on one side but line moved opposite direction
    if (latest.bet_percentage_home && latest.bet_percentage_away) {
      const publicSide = latest.bet_percentage_home > 60 ? 'home' :
                         latest.bet_percentage_away > 60 ? 'away' : null;

      if (publicSide) {
        // Check if line moved opposite to public
        const rlmDetected =
          (publicSide === 'home' && lineMove < 0) || // Public on home, line moved toward away
          (publicSide === 'away' && lineMove > 0);   // Public on away, line moved toward home

        if (rlmDetected && Math.abs(lineMove) >= 0.5) {
          const sharpSide = publicSide === 'home' ? 'away' : 'home';
          const rlmDivergence = Math.abs(lineMove);

          signals.push({
            event_id: latest.event_id,
            sport: latest.sport,
            home_team: latest.home_team,
            away_team: latest.away_team,
            game_date: latest.game_date,
            market_key: latest.market_key,
            signal_type: 'reverse_line_movement',
            strength: rlmDivergence >= 1.5 ? 'strong' : rlmDivergence >= 1.0 ? 'moderate' : 'weak',
            confidence_score: Math.min(100, rlmDivergence * 40),
            sharp_side: sharpSide,
            line_movement: lineMove,
            public_bet_percentage: publicSide === 'home' ? latest.bet_percentage_home : latest.bet_percentage_away,
            rlm_divergence: rlmDivergence,
            data: {
              publicSide,
              lineMove,
              betPercentage: latest.bet_percentage_home,
            },
          });
        }
      }
    }
  }

  return signals;
}

/**
 * Detect Steam Moves
 * Rapid line movement across multiple bookmakers
 */
async function detectSteamMoves(supabase: any) {
  const signals = [];

  // Get odds from last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: recentOdds } = await supabase
    .from('betting_odds')
    .select('*')
    .gte('last_update', fifteenMinutesAgo)
    .gte('commence_time', new Date().toISOString());

  if (!recentOdds || recentOdds.length === 0) return signals;

  // Group by event/market
  const groupedOdds = new Map<string, any[]>();

  for (const odds of recentOdds) {
    const key = `${odds.event_id}_${odds.market_key}`;
    if (!groupedOdds.has(key)) {
      groupedOdds.set(key, []);
    }
    groupedOdds.get(key).push(odds);
  }

  // Detect steam (3+ books moving in 15 minutes)
  for (const [key, bookmakers] of groupedOdds) {
    if (bookmakers.length >= 3) {
      const sample = bookmakers[0];

      // Calculate average line movement
      const lines = bookmakers.map((b: any) => b.outcomes[0]?.point).filter((l: any) => l !== undefined);
      if (lines.length < 3) continue;

      const avgLine = lines.reduce((a: number, b: number) => a + b, 0) / lines.length;

      signals.push({
        event_id: sample.event_id,
        sport: sample.sport_key,
        home_team: sample.home_team,
        away_team: sample.away_team,
        game_date: sample.commence_time,
        market_key: sample.market_key,
        signal_type: 'steam_move',
        strength: bookmakers.length >= 5 ? 'very_strong' : bookmakers.length >= 4 ? 'strong' : 'moderate',
        confidence_score: Math.min(100, bookmakers.length * 15),
        sharp_side: avgLine > 0 ? 'away' : 'home',
        number_of_books_moved: bookmakers.length,
        movement_velocity: Math.round((bookmakers.length / 15) * 60), // Books per hour
        data: {
          bookmakers: bookmakers.map((b: any) => b.bookmaker),
          avgLine,
        },
      });
    }
  }

  return signals;
}

/**
 * Detect Sharp Book Consensus
 * When known sharp books (Pinnacle, etc.) agree on a line
 */
async function detectSharpBookConsensus(supabase: any) {
  const signals = [];

  const SHARP_BOOKS = ['Pinnacle', 'CRIS', 'Circa Sports', '5Dimes'];

  // Get current odds from sharp books
  const { data: odds } = await supabase
    .from('betting_odds')
    .select('*')
    .in('bookmaker', SHARP_BOOKS)
    .gte('commence_time', new Date().toISOString())
    .lte('commence_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

  if (!odds || odds.length === 0) return signals;

  // Group by event/market
  const groupedOdds = new Map<string, any[]>();

  for (const odd of odds) {
    const key = `${odd.event_id}_${odd.market_key}`;
    if (!groupedOdds.has(key)) {
      groupedOdds.set(key, []);
    }
    groupedOdds.get(key).push(odd);
  }

  // Check for consensus among sharp books
  for (const [key, books] of groupedOdds) {
    if (books.length >= 2) {
      const lines = books.map((b: any) => b.outcomes[0]?.point).filter((l: any) => l !== undefined);

      if (lines.length >= 2) {
        // Check if lines are within 0.5 points of each other (consensus)
        const minLine = Math.min(...lines);
        const maxLine = Math.max(...lines);
        const spread = maxLine - minLine;

        if (spread <= 0.5) {
          const sample = books[0];
          const avgLine = lines.reduce((a: number, b: number) => a + b, 0) / lines.length;

          signals.push({
            event_id: sample.event_id,
            sport: sample.sport_key,
            home_team: sample.home_team,
            away_team: sample.away_team,
            game_date: sample.commence_time,
            market_key: sample.market_key,
            signal_type: 'consensus_sharp',
            strength: books.length >= 3 ? 'strong' : 'moderate',
            confidence_score: Math.min(100, books.length * 25),
            sharp_side: avgLine > 0 ? 'away' : 'home',
            number_of_books_moved: books.length,
            data: {
              sharpBooks: books.map((b: any) => b.bookmaker),
              avgLine,
              spread,
            },
          });
        }
      }
    }
  }

  return signals;
}

/**
 * Track opening and closing lines
 */
async function updateOpeningClosingLines(supabase: any) {
  // Get all upcoming games
  const { data: games } = await supabase
    .from('betting_odds')
    .select('event_id, sport_key, home_team, away_team, commence_time, market_key')
    .gte('commence_time', new Date().toISOString())
    .lte('commence_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

  if (!games) return;

  // Get unique events
  const uniqueEvents = new Map();
  for (const game of games) {
    const key = `${game.event_id}_${game.market_key}`;
    if (!uniqueEvents.has(key)) {
      uniqueEvents.set(key, game);
    }
  }

  for (const [key, game] of uniqueEvents) {
    // Get all odds for this event/market
    const { data: allOdds } = await supabase
      .from('betting_odds')
      .select('*')
      .eq('event_id', game.event_id)
      .eq('market_key', game.market_key)
      .order('last_update', { ascending: true });

    if (!allOdds || allOdds.length === 0) continue;

    const opening = allOdds[0];
    const closing = allOdds[allOdds.length - 1];

    const openingLine = opening.outcomes[0]?.point || 0;
    const closingLine = closing.outcomes[0]?.point || 0;
    const lineMovement = Math.abs(closingLine - openingLine);

    await supabase.from('opening_closing_lines').upsert({
      event_id: game.event_id,
      sport: game.sport_key,
      home_team: game.home_team,
      away_team: game.away_team,
      game_date: game.commence_time,
      market_key: game.market_key,
      opening_line: openingLine,
      opening_home_odds: opening.outcomes.find((o: any) => o.name === opening.home_team)?.price,
      opening_timestamp: opening.last_update,
      closing_line: closingLine,
      closing_home_odds: closing.outcomes.find((o: any) => o.name === closing.home_team)?.price,
      closing_timestamp: closing.last_update,
      total_line_movement: lineMovement,
      movement_direction: closingLine > openingLine ? 'toward_away' : 'toward_home',
    }, {
      onConflict: 'event_id,market_key',
    });
  }
}
