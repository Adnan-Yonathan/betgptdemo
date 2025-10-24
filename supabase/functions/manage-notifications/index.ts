import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case 'get_notifications':
        return await getNotifications(supabase, user.id, params);

      case 'mark_as_read':
        return await markAsRead(supabase, user.id, params.notificationId);

      case 'mark_all_as_read':
        return await markAllAsRead(supabase, user.id);

      case 'dismiss_notification':
        return await dismissNotification(supabase, user.id, params.notificationId);

      case 'get_preferences':
        return await getPreferences(supabase, user.id);

      case 'update_preferences':
        return await updatePreferences(supabase, user.id, params.preferences);

      case 'get_unread_count':
        return await getUnreadCount(supabase, user.id);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error('Error in manage-notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function getNotifications(supabase: any, userId: string, params: any) {
  const { limit = 50, offset = 0, unreadOnly = false } = params;

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query;

  if (error) throw error;

  return new Response(
    JSON.stringify({ notifications: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function markAsRead(supabase: any, userId: string, notificationId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select();

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true, notification: data[0] }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function markAllAsRead(supabase: any, userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function dismissNotification(supabase: any, userId: string, notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ dismissed: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getPreferences(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('user_alert_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  return new Response(
    JSON.stringify({ preferences: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function updatePreferences(supabase: any, userId: string, preferences: any) {
  const { data, error } = await supabase
    .from('user_alert_preferences')
    .upsert({
      user_id: userId,
      ...preferences,
      updated_at: new Date().toISOString()
    })
    .select();

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true, preferences: data[0] }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getUnreadCount(supabase: any, userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;

  return new Response(
    JSON.stringify({ count }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
