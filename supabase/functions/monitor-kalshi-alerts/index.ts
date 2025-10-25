import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// ALERT MONITORING
// ============================================================================

interface Alert {
  type: 'high_edge' | 'price_drop' | 'volume_spike' | 'closing_soon' | 'arbitrage';
  market: any;
  trigger_value: number;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  action_url?: string;
}

/**
 * Check for high-edge market alerts
 */
async function checkHighEdgeAlerts(supabase: any): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    // Fetch markets with analysis showing high edge
    const { data: analytics, error } = await supabase
      .from('kalshi_market_analytics')
      .select(`
        *,
        kalshi_markets!inner(*)
      `)
      .gte('edge', 0.08) // 8% or higher edge
      .gte('confidence_score', 70) // High confidence
      .eq('kalshi_markets.status', 'open')
      .order('edge', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (analytics && analytics.length > 0) {
      for (const analysis of analytics) {
        const market = analysis.kalshi_markets;
        const edge = analysis.edge * 100;

        alerts.push({
          type: 'high_edge',
          market,
          trigger_value: edge,
          message: `High edge detected: ${market.title} has ${edge.toFixed(1)}% edge with ${analysis.confidence_score}% confidence`,
          priority: edge >= 15 ? 'urgent' : edge >= 10 ? 'high' : 'medium',
          action_url: `/kalshi?market=${market.ticker}`,
        });
      }
    }
  } catch (error) {
    console.error('[ALERTS] Error checking high edge:', error);
  }

  return alerts;
}

/**
 * Check for significant price movements
 */
async function checkPriceMovementAlerts(supabase: any): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    // Fetch markets with recent price changes
    const { data: markets, error } = await supabase
      .from('kalshi_markets')
      .select('*')
      .eq('status', 'open')
      .not('previous_yes_ask', 'is', null)
      .order('volume', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (markets && markets.length > 0) {
      for (const market of markets) {
        const currentPrice = market.yes_ask;
        const previousPrice = market.previous_yes_ask;

        if (!currentPrice || !previousPrice) continue;

        const priceChange = Math.abs(currentPrice - previousPrice);
        const priceChangePercent = (priceChange / previousPrice) * 100;

        // Alert if price moved more than 10%
        if (priceChangePercent >= 10) {
          const direction = currentPrice > previousPrice ? 'up' : 'down';

          alerts.push({
            type: 'price_drop',
            market,
            trigger_value: priceChangePercent,
            message: `Significant price movement: ${market.title} moved ${direction} ${priceChangePercent.toFixed(1)}%`,
            priority: priceChangePercent >= 20 ? 'high' : 'medium',
            action_url: `/kalshi?market=${market.ticker}`,
          });
        }
      }
    }
  } catch (error) {
    console.error('[ALERTS] Error checking price movements:', error);
  }

  return alerts;
}

/**
 * Check for volume spikes
 */
async function checkVolumeSpikes(supabase: any): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    // Fetch markets with high volume
    const { data: markets, error } = await supabase
      .from('kalshi_markets')
      .select('*')
      .eq('status', 'open')
      .gte('volume_24h', 1000) // At least 1000 contracts in 24h
      .order('volume_24h', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (markets && markets.length > 0) {
      for (const market of markets) {
        // If 24h volume is significantly higher than total volume
        // (indicates recent spike)
        const recentVolumeRatio = market.volume_24h / (market.volume || 1);

        if (recentVolumeRatio >= 0.5) {
          alerts.push({
            type: 'volume_spike',
            market,
            trigger_value: market.volume_24h,
            message: `Volume spike: ${market.title} has ${market.volume_24h.toLocaleString()} contracts in 24h`,
            priority: 'medium',
            action_url: `/kalshi?market=${market.ticker}`,
          });
        }
      }
    }
  } catch (error) {
    console.error('[ALERTS] Error checking volume spikes:', error);
  }

  return alerts;
}

/**
 * Check for markets closing soon
 */
async function checkClosingSoonAlerts(supabase: any): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Fetch markets closing within 1 hour
    const { data: markets, error } = await supabase
      .from('kalshi_markets')
      .select('*')
      .eq('status', 'open')
      .lte('close_time', oneHourFromNow.toISOString())
      .gte('close_time', now.toISOString())
      .order('close_time', { ascending: true })
      .limit(10);

    if (error) throw error;

    if (markets && markets.length > 0) {
      for (const market of markets) {
        const closeTime = new Date(market.close_time);
        const minutesUntilClose = Math.floor((closeTime.getTime() - now.getTime()) / (1000 * 60));

        alerts.push({
          type: 'closing_soon',
          market,
          trigger_value: minutesUntilClose,
          message: `Market closing soon: ${market.title} closes in ${minutesUntilClose} minutes`,
          priority: minutesUntilClose <= 15 ? 'urgent' : minutesUntilClose <= 30 ? 'high' : 'medium',
          action_url: `/kalshi?market=${market.ticker}`,
        });
      }
    }
  } catch (error) {
    console.error('[ALERTS] Error checking closing soon:', error);
  }

  return alerts;
}

/**
 * Store alerts in database
 */
async function storeAlerts(supabase: any, alerts: Alert[]): Promise<void> {
  if (alerts.length === 0) return;

  try {
    // Store alerts (assuming you have an alerts table)
    const alertRecords = alerts.map(alert => ({
      type: alert.type,
      market_ticker: alert.market.ticker,
      message: alert.message,
      priority: alert.priority,
      trigger_value: alert.trigger_value,
      action_url: alert.action_url,
      created_at: new Date().toISOString(),
    }));

    // Note: You'd need to create a kalshi_alerts table
    // For now, just log them
    console.log('[ALERTS] Would store alerts:', alertRecords);

  } catch (error) {
    console.error('[ALERTS] Error storing alerts:', error);
  }
}

/**
 * Send notifications (placeholder for real implementation)
 */
async function sendNotifications(alerts: Alert[]): Promise<void> {
  // TODO: Implement with email, push notifications, etc.
  console.log(`[ALERTS] Would send ${alerts.length} notifications`);

  for (const alert of alerts) {
    console.log(`[${alert.priority.toUpperCase()}] ${alert.message}`);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[ALERTS] Starting alert monitoring...');

    // Run all alert checks in parallel
    const [
      highEdgeAlerts,
      priceAlerts,
      volumeAlerts,
      closingAlerts,
    ] = await Promise.all([
      checkHighEdgeAlerts(supabase),
      checkPriceMovementAlerts(supabase),
      checkVolumeSpikes(supabase),
      checkClosingSoonAlerts(supabase),
    ]);

    // Combine all alerts
    const allAlerts = [
      ...highEdgeAlerts,
      ...priceAlerts,
      ...volumeAlerts,
      ...closingAlerts,
    ];

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    allAlerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    console.log(`[ALERTS] Found ${allAlerts.length} total alerts`);

    // Store and send alerts
    await storeAlerts(supabase, allAlerts);
    await sendNotifications(allAlerts.filter(a => a.priority !== 'low'));

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        total_alerts: allAlerts.length,
        alerts_by_type: {
          high_edge: highEdgeAlerts.length,
          price_movement: priceAlerts.length,
          volume_spike: volumeAlerts.length,
          closing_soon: closingAlerts.length,
        },
        alerts_by_priority: {
          urgent: allAlerts.filter(a => a.priority === 'urgent').length,
          high: allAlerts.filter(a => a.priority === 'high').length,
          medium: allAlerts.filter(a => a.priority === 'medium').length,
          low: allAlerts.filter(a => a.priority === 'low').length,
        },
        alerts: allAlerts.slice(0, 50), // Return top 50
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[ALERTS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
