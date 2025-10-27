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

    const { type, period = 'all' } = await req.json();

    let analytics = {};

    switch (type) {
      case 'message_feedback':
        analytics = await getMessageFeedbackAnalytics(supabaseClient, user.id, period);
        break;
      case 'prediction_feedback':
        analytics = await getPredictionFeedbackAnalytics(supabaseClient, user.id, period);
        break;
      case 'alert_feedback':
        analytics = await getAlertFeedbackAnalytics(supabaseClient, user.id, period);
        break;
      case 'overall':
        analytics = await getOverallFeedbackAnalytics(supabaseClient, user.id, period);
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid analytics type. Use: message_feedback, prediction_feedback, alert_feedback, or overall' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(JSON.stringify(analytics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in feedback-analytics function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getMessageFeedbackAnalytics(supabaseClient: any, userId: string, period: string) {
  const dateFilter = getDateFilter(period);

  const { data, error } = await supabaseClient
    .from('message_feedback')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', dateFilter);

  if (error) throw error;

  const total = data.length;
  const positive = data.filter((f: any) => f.feedback_type === 'thumbs_up' || f.is_helpful === true).length;
  const negative = data.filter((f: any) => f.feedback_type === 'thumbs_down' || f.is_helpful === false).length;

  const byResponseType = data.reduce((acc: any, f: any) => {
    const type = f.response_type || 'general';
    if (!acc[type]) {
      acc[type] = { total: 0, positive: 0, negative: 0 };
    }
    acc[type].total++;
    if (f.feedback_type === 'thumbs_up' || f.is_helpful === true) acc[type].positive++;
    if (f.feedback_type === 'thumbs_down' || f.is_helpful === false) acc[type].negative++;
    return acc;
  }, {});

  const avgRating = data
    .filter((f: any) => f.rating !== null)
    .reduce((sum: number, f: any) => sum + f.rating, 0) / data.filter((f: any) => f.rating !== null).length || 0;

  return {
    total,
    positive,
    negative,
    positiveRate: total > 0 ? (positive / total * 100).toFixed(1) : 0,
    avgRating: avgRating.toFixed(2),
    byResponseType,
    recentFeedback: data.slice(-10).reverse()
  };
}

async function getPredictionFeedbackAnalytics(supabaseClient: any, userId: string, period: string) {
  const dateFilter = getDateFilter(period);

  const { data, error } = await supabaseClient
    .from('prediction_feedback')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', dateFilter);

  if (error) throw error;

  const total = data.length;
  const helpful = data.filter((f: any) => f.was_helpful === true).length;
  const accurate = data.filter((f: any) => f.was_accurate === true).length;
  const betsPlaced = data.filter((f: any) => f.user_action === 'placed_bet').length;

  const avgConfidence = data
    .filter((f: any) => f.confidence_rating !== null)
    .reduce((sum: number, f: any) => sum + f.confidence_rating, 0) / data.filter((f: any) => f.confidence_rating !== null).length || 0;

  const avgValue = data
    .filter((f: any) => f.value_rating !== null)
    .reduce((sum: number, f: any) => sum + f.value_rating, 0) / data.filter((f: any) => f.value_rating !== null).length || 0;

  const totalProfit = data.reduce((sum: number, f: any) => sum + (f.user_profit_loss || 0), 0);

  const bySport = data.reduce((acc: any, f: any) => {
    const sport = f.sport || 'unknown';
    if (!acc[sport]) {
      acc[sport] = { total: 0, helpful: 0, accurate: 0, betsPlaced: 0 };
    }
    acc[sport].total++;
    if (f.was_helpful) acc[sport].helpful++;
    if (f.was_accurate) acc[sport].accurate++;
    if (f.user_action === 'placed_bet') acc[sport].betsPlaced++;
    return acc;
  }, {});

  return {
    total,
    helpful,
    accurate,
    helpfulRate: total > 0 ? (helpful / total * 100).toFixed(1) : 0,
    accuracyRate: total > 0 ? (accurate / total * 100).toFixed(1) : 0,
    betsPlaced,
    avgConfidence: avgConfidence.toFixed(2),
    avgValue: avgValue.toFixed(2),
    totalProfit: totalProfit.toFixed(2),
    bySport,
    recentFeedback: data.slice(-10).reverse()
  };
}

async function getAlertFeedbackAnalytics(supabaseClient: any, userId: string, period: string) {
  const dateFilter = getDateFilter(period);

  const { data, error } = await supabaseClient
    .from('alert_feedback')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', dateFilter);

  if (error) throw error;

  const total = data.length;
  const useful = data.filter((f: any) => f.was_useful === true).length;
  const timely = data.filter((f: any) => f.was_timely === true).length;
  const accurate = data.filter((f: any) => f.was_accurate === true).length;
  const ledToBet = data.filter((f: any) => f.led_to_bet === true).length;
  const falsePositives = data.filter((f: any) => f.false_positive === true).length;

  const avgRelevance = data
    .filter((f: any) => f.relevance_rating !== null)
    .reduce((sum: number, f: any) => sum + f.relevance_rating, 0) / data.filter((f: any) => f.relevance_rating !== null).length || 0;

  const avgTimeToAction = data
    .filter((f: any) => f.time_to_action_seconds !== null)
    .reduce((sum: number, f: any) => sum + f.time_to_action_seconds, 0) / data.filter((f: any) => f.time_to_action_seconds !== null).length || 0;

  const byAlertType = data.reduce((acc: any, f: any) => {
    const type = f.alert_type || 'unknown';
    if (!acc[type]) {
      acc[type] = { total: 0, useful: 0, ledToBet: 0, falsePositives: 0 };
    }
    acc[type].total++;
    if (f.was_useful) acc[type].useful++;
    if (f.led_to_bet) acc[type].ledToBet++;
    if (f.false_positive) acc[type].falsePositives++;
    return acc;
  }, {});

  const actionDistribution = data.reduce((acc: any, f: any) => {
    const action = f.user_action || 'unknown';
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {});

  return {
    total,
    useful,
    timely,
    accurate,
    usefulRate: total > 0 ? (useful / total * 100).toFixed(1) : 0,
    timelyRate: total > 0 ? (timely / total * 100).toFixed(1) : 0,
    accuracyRate: total > 0 ? (accurate / total * 100).toFixed(1) : 0,
    ledToBet,
    conversionRate: total > 0 ? (ledToBet / total * 100).toFixed(1) : 0,
    falsePositives,
    falsePositiveRate: total > 0 ? (falsePositives / total * 100).toFixed(1) : 0,
    avgRelevance: avgRelevance.toFixed(2),
    avgTimeToAction: avgTimeToAction.toFixed(0),
    byAlertType,
    actionDistribution,
    recentFeedback: data.slice(-10).reverse()
  };
}

async function getOverallFeedbackAnalytics(supabaseClient: any, userId: string, period: string) {
  const [messageStats, predictionStats, alertStats] = await Promise.all([
    getMessageFeedbackAnalytics(supabaseClient, userId, period),
    getPredictionFeedbackAnalytics(supabaseClient, userId, period),
    getAlertFeedbackAnalytics(supabaseClient, userId, period)
  ]);

  return {
    message: messageStats,
    prediction: predictionStats,
    alert: alertStats,
    summary: {
      totalFeedbackItems: messageStats.total + predictionStats.total + alertStats.total,
      overallSatisfaction: (
        (parseFloat(messageStats.positiveRate) +
         parseFloat(predictionStats.helpfulRate) +
         parseFloat(alertStats.usefulRate)) / 3
      ).toFixed(1)
    }
  };
}

function getDateFilter(period: string): string {
  const now = new Date();
  let daysAgo = 0;

  switch (period) {
    case 'today':
      daysAgo = 0;
      break;
    case 'week':
      daysAgo = 7;
      break;
    case 'month':
      daysAgo = 30;
      break;
    case 'quarter':
      daysAgo = 90;
      break;
    case 'year':
      daysAgo = 365;
      break;
    default:
      return '2000-01-01'; // All time
  }

  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString();
}
