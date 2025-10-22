import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      amount,
      odds,
      description,
      team,
      conversationId,
      eventId,
      sport,
      league,
      marketKey,
      bookmaker,
      modelProbability,
      confidenceScore,
      betType = 'straight'
    } = await req.json();

    console.log('=== LOG-BET FUNCTION CALLED ===');
    console.log('Request body:', {
      amount, odds, description, team, conversationId, eventId,
      sport, league, marketKey, bookmaker, modelProbability, confidenceScore, betType
    });
    console.log('User ID:', user.id);

    // Validate required fields
    if (!amount || !odds || !description) {
      console.error('❌ Missing required fields');
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: amount, odds, description' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Validation passed. Logging bet:', { amount, odds, description, team, eventId });

    // Try to match game if team is provided
    let matchedEventId = eventId;
    let matchedTeam = team;

    if (team && !eventId) {
      // Query sports_scores for recent/upcoming games with this team
      const { data: games } = await supabaseClient
        .from('sports_scores')
        .select('*')
        .or(`home_team.ilike.%${team}%,away_team.ilike.%${team}%`)
        .order('game_date', { ascending: false })
        .limit(5);

      if (games && games.length > 0) {
        // Find the closest match (prefer upcoming or in-progress games)
        const game = games.find(g => 
          g.game_status !== 'STATUS_FINAL' && 
          (g.home_team.toLowerCase().includes(team.toLowerCase()) || 
           g.away_team.toLowerCase().includes(team.toLowerCase()))
        ) || games[0];

        matchedEventId = game.event_id;
        matchedTeam = game.home_team.toLowerCase().includes(team.toLowerCase()) 
          ? game.home_team 
          : game.away_team;
        
        console.log('Matched game:', { eventId: matchedEventId, team: matchedTeam });
      }
    }

    // Calculate potential return based on American odds
    const oddsNum = Number(odds);
    let potentialReturn = 0;

    if (oddsNum > 0) {
      // Positive odds: profit = (stake * odds) / 100
      potentialReturn = Number(amount) + (Number(amount) * oddsNum / 100);
    } else {
      // Negative odds: profit = (stake * 100) / abs(odds)
      potentialReturn = Number(amount) + (Number(amount) * 100 / Math.abs(oddsNum));
    }

    // Get user's bankroll and Kelly settings for calculations
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('bankroll, kelly_multiplier')
      .eq('id', user.id)
      .single();

    // Calculate Expected Value if model probability is provided
    let expectedValue = null;
    let kellyFraction = null;

    if (modelProbability) {
      // Convert American odds to decimal
      const decimalOdds = oddsNum > 0 ? (oddsNum / 100) + 1 : (100 / Math.abs(oddsNum)) + 1;
      const profitIfWin = Number(amount) * (decimalOdds - 1);

      // EV = (win_prob * profit) - (loss_prob * stake)
      expectedValue = (modelProbability * profitIfWin) - ((1 - modelProbability) * Number(amount));

      // Kelly Criterion: (bp - q) / b where b = decimal_odds - 1, p = win_prob, q = 1 - p
      if (profile?.bankroll && profile?.kelly_multiplier) {
        const b = decimalOdds - 1;
        const p = modelProbability;
        const q = 1 - p;
        const kellyPct = ((b * p) - q) / b;

        // Apply fractional Kelly for safety
        kellyFraction = Math.max(0, kellyPct * profile.kelly_multiplier);
      }
    }

    // Fetch current market odds to capture opening line
    let openingLine = oddsNum; // Default to bet odds
    let currentBookmaker = bookmaker || 'Unknown';

    if (matchedEventId && matchedTeam && marketKey) {
      const { data: currentOdds } = await supabaseClient
        .from('betting_odds')
        .select('outcome_price, bookmaker')
        .eq('event_id', matchedEventId)
        .eq('outcome_name', matchedTeam)
        .eq('market_key', marketKey || 'h2h')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (currentOdds) {
        openingLine = currentOdds.outcome_price;
        currentBookmaker = currentOdds.bookmaker;
        console.log(`Opening line captured: ${openingLine} from ${currentBookmaker}`);
      }
    }

    // Insert bet with advanced analytics
    const { data: bet, error: betError } = await supabaseClient
      .from('bets')
      .insert({
        user_id: user.id,
        conversation_id: conversationId || null,
        amount: Number(amount),
        odds: oddsNum,
        description,
        potential_return: potentialReturn,
        outcome: 'pending',
        event_id: matchedEventId || null,
        team_bet_on: matchedTeam || null,
        bet_type: betType || 'straight',
        sport: sport || null,
        league: league || null,
        market_key: marketKey || 'h2h',
        bookmaker: currentBookmaker,
        opening_line: openingLine,
        model_probability: modelProbability || null,
        confidence_score: confidenceScore || null,
        expected_value: expectedValue,
        kelly_fraction: kellyFraction,
      })
      .select()
      .single();

    if (betError) {
      console.error('❌ Error inserting bet:', betError);
      return new Response(JSON.stringify({ 
        error: 'Failed to log bet',
        details: betError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Bet logged successfully!');
    console.log('Bet ID:', bet.id);
    console.log('Description:', bet.description);
    console.log('Amount:', bet.amount);
    console.log('Potential Return:', bet.potential_return);

    return new Response(JSON.stringify({ 
      success: true, 
      betId: bet.id,
      message: `Bet logged: ${description} for $${amount} at ${odds > 0 ? '+' : ''}${odds}`,
      eventId: matchedEventId,
      team: matchedTeam,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in log-bet function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
