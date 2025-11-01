import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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

    const { message, userId } = await req.json();

    console.log('=== TRACKING CHAT REQUEST ===');
    console.log('User ID:', userId);
    console.log('Message:', message);

    // Fetch user's active bets
    const { data: activeBets, error: betsError } = await supabaseClient
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .eq('outcome', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);

    if (betsError) {
      console.error('Error fetching bets:', betsError);
    }

    console.log('Active bets found:', activeBets?.length || 0);

    // Fetch recent live scores for games user has bets on
    const eventIds = activeBets?.map(bet => bet.event_id).filter(Boolean) || [];
    let liveScores: any[] = [];

    if (eventIds.length > 0) {
      const { data: scores } = await supabaseClient
        .from('sports_scores')
        .select('*')
        .in('event_id', eventIds)
        .order('last_updated', { ascending: false });

      liveScores = scores || [];
      console.log('Live scores found:', liveScores.length);
    }

    // Get user's bankroll info
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('bankroll, unit_size')
      .eq('id', userId)
      .single();

    // Build context for AI
    const betsContext = activeBets?.map((bet, idx) => {
      const score = liveScores.find(s => s.event_id === bet.event_id);
      return `
Bet ${idx + 1}:
- Description: ${bet.description}
- Amount: $${bet.amount}
- Odds: ${bet.odds > 0 ? '+' : ''}${bet.odds}
- Potential Return: $${bet.potential_return}
- Team: ${bet.team_bet_on || 'N/A'}
- League: ${bet.league || 'Unknown'}
- Event ID: ${bet.event_id || 'N/A'}
${score ? `- Current Score: ${score.away_team} ${score.away_score} @ ${score.home_team} ${score.home_score}
- Status: ${score.game_status}
- Period: ${score.period || 'N/A'}` : '- Status: Game not started or no live data available'}
`;
    }).join('\n') || 'No active bets';

    const systemPrompt = `You are a Live Bet Tracking Assistant for a sports betting application. Your role is to help users track and analyze their active bets in real-time.

USER PROFILE:
- User ID: ${userId}
- Bankroll: ${profile?.bankroll ? `$${profile.bankroll}` : 'Not set'}
- Unit Size: ${profile?.unit_size ? `$${profile.unit_size}` : 'Not set'}

ACTIVE BETS (${activeBets?.length || 0} total):
${betsContext}

IMPORTANT GUIDELINES:
1. Focus on the user's ACTIVE bets only
2. Provide real-time updates on game status when available
3. Calculate current bet status (winning/losing/uncertain)
4. Be encouraging but realistic about bet outcomes
5. Suggest when to check back for updates
6. Keep responses concise and focused on tracking
7. DO NOT recommend new bets - this is for tracking only
8. If no live data is available, explain the game hasn't started yet
9. Use the actual data provided - never make up scores or results

RESPONSE STYLE:
- Be conversational and supportive
- Use emojis sparingly (✅ ❌ 🏀 🏈 ⚾ ⚽ 🎯)
- Format numbers clearly ($100, +150, etc.)
- Keep responses under 150 words unless asked for details

Current time: ${new Date().toISOString()}`;

    // Call OpenAI with streaming
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openAIResponse.ok) {
      throw new Error(`OpenAI API error: ${openAIResponse.statusText}`);
    }

    // Set up SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openAIResponse.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);

                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const token = parsed.choices?.[0]?.delta?.content;

                  if (token) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
                    );
                  }
                } catch (e) {
                  console.error('Error parsing OpenAI chunk:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in tracking-chat function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
