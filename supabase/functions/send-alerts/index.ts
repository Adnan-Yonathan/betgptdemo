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

    const { alerts } = await req.json();

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notificationsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SEND_ALERTS] Processing ${alerts.length} alerts`);

    // Get all users with their preferences
    const { data: users } = await supabase
      .from('user_alert_preferences')
      .select('*');

    if (!users) {
      console.log('[SEND_ALERTS] No users found');
      return new Response(
        JSON.stringify({ success: true, notificationsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalNotifications = 0;

    for (const user of users) {
      const userNotifications = [];

      for (const alert of alerts) {
        // Check if user wants this type of alert
        if (!shouldSendAlert(user, alert)) {
          continue;
        }

        // Check if alert matches user preferences (sports, teams, etc.)
        if (!matchesUserPreferences(user, alert)) {
          continue;
        }

        // Check daily limit
        const todayCount = await getTodayNotificationCount(supabase, user.user_id);
        if (todayCount >= user.max_alerts_per_day) {
          console.log(`[SEND_ALERTS] User ${user.user_id} hit daily limit`);
          continue;
        }

        // Check quiet hours
        if (isInQuietHours(user)) {
          continue;
        }

        // Create notification
        const notification = {
          user_id: user.user_id,
          alert_type: alert.alert_type,
          priority: alert.priority,
          event_id: alert.event_id,
          sport: alert.sport,
          league: alert.league,
          home_team: alert.home_team,
          away_team: alert.away_team,
          game_date: alert.game_date,
          title: alert.title,
          message: alert.message,
          action_url: `/games?event=${alert.event_id}`,
          data: alert.data,
          expires_at: alert.expires_at,
        };

        userNotifications.push(notification);
      }

      // Bulk insert notifications for this user
      if (userNotifications.length > 0) {
        const { error } = await supabase
          .from('notifications')
          .insert(userNotifications);

        if (error) {
          console.error(`[SEND_ALERTS] Error inserting notifications for user ${user.user_id}:`, error);
        } else {
          totalNotifications += userNotifications.length;
          console.log(`[SEND_ALERTS] Sent ${userNotifications.length} notifications to user ${user.user_id}`);
        }
      }
    }

    console.log(`[SEND_ALERTS] Sent ${totalNotifications} total notifications to ${users.length} users`);

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: totalNotifications,
        usersNotified: users.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SEND_ALERTS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function shouldSendAlert(user: any, alert: any): boolean {
  const alertTypeMap: { [key: string]: string } = {
    'line_movement': 'line_movement_alerts',
    'steam_move': 'steam_move_alerts',
    'ev_discrepancy': 'ev_discrepancy_alerts',
    'closing_line': 'closing_line_alerts',
    'injury': 'injury_alerts',
    'best_line': 'best_line_alerts',
    'sharp_money': 'sharp_money_alerts',
  };

  const preferenceKey = alertTypeMap[alert.alert_type];
  if (!preferenceKey) return false;

  return user[preferenceKey] === true;
}

function matchesUserPreferences(user: any, alert: any): boolean {
  // Check EV threshold for EV-related alerts
  if (alert.alert_type === 'ev_discrepancy' || alert.alert_type === 'closing_line') {
    const edgePercentage = alert.data?.edgePercentage || 0;
    if (edgePercentage < user.min_ev_percentage) {
      return false;
    }
  }

  // Check line movement threshold
  if (alert.alert_type === 'line_movement') {
    const lineMove = alert.data?.lineMove || 0;
    if (lineMove < user.min_line_move_points) {
      return false;
    }
  }

  // Check steam velocity
  if (alert.alert_type === 'steam_move') {
    const bookmakerCount = alert.data?.bookmakerCount || 0;
    if (bookmakerCount < user.min_steam_velocity) {
      return false;
    }
  }

  // Check favorite sports
  if (user.favorite_sports && user.favorite_sports.length > 0) {
    if (!user.favorite_sports.includes(alert.sport)) {
      return false;
    }
  }

  // Check favorite teams
  if (user.favorite_teams && user.favorite_teams.length > 0) {
    const hasTeam = user.favorite_teams.includes(alert.home_team) ||
                    user.favorite_teams.includes(alert.away_team);
    if (!hasTeam) {
      return false;
    }
  }

  return true;
}

async function getTodayNotificationCount(supabase: any, userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', today.toISOString());

  return count || 0;
}

function isInQuietHours(user: any): boolean {
  if (!user.quiet_hours_start || !user.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = user.quiet_hours_start.split(':').map(Number);
  const [endHour, endMin] = user.quiet_hours_end.split(':').map(Number);

  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }

  return currentTime >= startTime && currentTime <= endTime;
}
