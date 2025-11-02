import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValueOpportunity {
  type: 'best_line' | 'sharp_action' | 'line_movement' | 'market_discrepancy';
  recommendation: string;
  reasoning: string;
  comparison?: string;
  value_rating: number;
  details: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { eventId } = await req.json();

    if (!eventId) {
      throw new Error('eventId is required');
    }

    console.log(`[VALUE-INSIGHTS] Generating insights for event ${eventId}`);

    // Fetch current odds for this event
    const { data: currentOdds, error: oddsError } = await supabase
      .from('betting_odds')
      .select('*')
      .eq('event_id', eventId)
      .order('last_update', { ascending: false });

    if (oddsError) throw oddsError;

    // Fetch opening/closing lines
    const { data: openingClosing, error: ocError } = await supabase
      .from('opening_closing_lines')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (ocError && ocError.code !== 'PGRST116') {
      console.error('[VALUE-INSIGHTS] Error fetching opening/closing lines:', ocError);
    }

    // Fetch sharp money signals
    const { data: sharpSignals, error: sharpError } = await supabase
      .from('sharp_money_signals')
      .select('*')
      .eq('event_id', eventId)
      .order('detected_at', { ascending: false })
      .limit(1);

    if (sharpError) {
      console.error('[VALUE-INSIGHTS] Error fetching sharp signals:', sharpError);
    }

    // Fetch odds discrepancies
    const { data: discrepancies, error: discError } = await supabase
      .from('odds_discrepancies')
      .select('*')
      .eq('event_id', eventId)
      .order('probability_difference', { ascending: false })
      .limit(5);

    if (discError) {
      console.error('[VALUE-INSIGHTS] Error fetching discrepancies:', discError);
    }

    const opportunities: ValueOpportunity[] = [];

    // Analyze best line opportunities
    if (currentOdds && currentOdds.length > 0) {
      const spreadOdds = currentOdds.filter(o => o.market_key === 'spreads' && o.outcome_point != null);

      if (spreadOdds.length >= 3) {
        // Group by team
        const homeTeam = spreadOdds[0].home_team;
        const awayTeam = spreadOdds[0].away_team;

        const homeSpreads = spreadOdds
          .filter(o => o.outcome_name === homeTeam)
          .map(o => ({ bookmaker: o.bookmaker, point: o.outcome_point, odds: o.outcome_price }))
          .sort((a, b) => b.point - a.point);

        if (homeSpreads.length > 0) {
          const bestHomeSpread = homeSpreads[0];
          const worstHomeSpread = homeSpreads[homeSpreads.length - 1];
          const spreadDiff = Math.abs(bestHomeSpread.point - worstHomeSpread.point);

          if (spreadDiff >= 0.5) {
            const consensusSpread = homeSpreads[Math.floor(homeSpreads.length / 2)].point;
            opportunities.push({
              type: 'best_line',
              recommendation: `${homeTeam} ${bestHomeSpread.point >= 0 ? '+' : ''}${bestHomeSpread.point} at ${bestHomeSpread.bookmaker}`,
              reasoning: `Most books have ${homeTeam} at ${consensusSpread >= 0 ? '+' : ''}${consensusSpread}. You're getting ${spreadDiff.toFixed(1)} points better value at ${bestHomeSpread.bookmaker}.`,
              comparison: `${bestHomeSpread.bookmaker}: ${bestHomeSpread.point} | Consensus: ${consensusSpread} | Worst: ${worstHomeSpread.point} at ${worstHomeSpread.bookmaker}`,
              value_rating: Math.min(5, spreadDiff * 2),
              details: {
                bestBook: bestHomeSpread.bookmaker,
                bestLine: bestHomeSpread.point,
                consensusLine: consensusSpread,
                pointsAdvantage: spreadDiff,
              },
            });
          }
        }
      }
    }

    // Analyze sharp action
    if (sharpSignals && sharpSignals.length > 0) {
      const signal = sharpSignals[0];
      let reasoning = '';

      switch (signal.signal_type) {
        case 'reverse_line_movement':
          reasoning = `Reverse line movement detected. Public betting one way but line moved opposite direction, indicating sharp money on ${signal.sharp_side}.`;
          break;
        case 'steam_move':
          reasoning = `Steam move detected. Multiple books moved simultaneously on ${signal.sharp_side}, indicating coordinated sharp action.`;
          break;
        case 'consensus_sharp':
          reasoning = `Sharp books (Pinnacle, CRIS, etc.) are in consensus on ${signal.sharp_side}.`;
          break;
        default:
          reasoning = `Sharp money detected on ${signal.sharp_side}.`;
      }

      const valueRating = signal.confidence_score / 20; // Convert 0-100 to 0-5

      opportunities.push({
        type: 'sharp_action',
        recommendation: `${signal.sharp_side.toUpperCase()} - Sharp action detected`,
        reasoning,
        value_rating: Math.min(5, valueRating),
        details: {
          signalType: signal.signal_type,
          strength: signal.strength,
          confidence: signal.confidence_score,
          sharpSide: signal.sharp_side,
          detectedAt: signal.detected_at,
        },
      });
    }

    // Analyze line movement
    if (openingClosing) {
      const { opening_spread, closing_spread } = openingClosing;

      if (opening_spread != null && closing_spread != null) {
        const movement = Math.abs(closing_spread - opening_spread);

        if (movement >= 1) {
          const direction = closing_spread > opening_spread ? 'up' : 'down';
          const favoredTeam = direction === 'up' ? 'home team' : 'away team';

          opportunities.push({
            type: 'line_movement',
            recommendation: `Line moved ${movement} points from opening`,
            reasoning: `Spread opened at ${opening_spread >= 0 ? '+' : ''}${opening_spread} and is now ${closing_spread >= 0 ? '+' : ''}${closing_spread}. This ${movement >= 2 ? 'significant' : 'notable'} movement suggests sharp action on the ${favoredTeam}.`,
            value_rating: Math.min(5, movement / 2),
            details: {
              openingLine: opening_spread,
              currentLine: closing_spread,
              movement,
              direction,
            },
          });
        }
      }
    }

    // Analyze market discrepancies
    if (discrepancies && discrepancies.length > 0) {
      for (const disc of discrepancies.slice(0, 2)) {
        if (disc.probability_difference >= 1.0) {
          opportunities.push({
            type: 'market_discrepancy',
            recommendation: `${disc.outcome_name} at ${disc.bookmaker_high}`,
            reasoning: `${disc.bookmaker_high} is offering ${disc.probability_difference.toFixed(2)}% better implied probability than ${disc.bookmaker_low} on the same outcome.`,
            comparison: `${disc.bookmaker_high}: ${(disc.probability_high * 100).toFixed(1)}% implied | ${disc.bookmaker_low}: ${(disc.probability_low * 100).toFixed(1)}% implied`,
            value_rating: Math.min(5, disc.probability_difference / 2),
            details: {
              market: disc.market_key,
              outcome: disc.outcome_name,
              bestBook: disc.bookmaker_high,
              worstBook: disc.bookmaker_low,
              probabilityDifference: disc.probability_difference,
            },
          });
        }
      }
    }

    // Sort by value rating
    opportunities.sort((a, b) => b.value_rating - a.value_rating);

    console.log(`[VALUE-INSIGHTS] Generated ${opportunities.length} opportunities for event ${eventId}`);

    return new Response(
      JSON.stringify({
        success: true,
        eventId,
        opportunities,
        totalOpportunities: opportunities.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[VALUE-INSIGHTS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
