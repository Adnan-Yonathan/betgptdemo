import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Singleton Supabase client
let _supabaseClient: any = null;
function getSupabaseClient() {
  if (!_supabaseClient) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    _supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return _supabaseClient;
}

// Onboarding steps configuration
const ONBOARDING_STEPS = [
  {
    id: 0,
    message: "Welcome to Delta! 🎯 I'm your AI betting coach. Let's build your edge profile so I can help you manage your bankroll intelligently and maximize your ROI.",
    input_type: 'none',
  },
  {
    id: 1,
    message: "First, what's your typical bankroll size? This is the total amount you've set aside for betting.",
    input_type: 'number',
    field: 'bankroll_size',
    validation: { min: 10, max: 1000000, required: true }
  },
  {
    id: 2,
    message: "Great! How much do you usually risk per bet? (Your average unit size)",
    input_type: 'number',
    field: 'avg_unit',
    validation: { min: 1, max: 100000, required: true }
  },
  {
    id: 3,
    message: "Which sports do you mainly bet on? (You can list multiple: NBA, NFL, NCAAF, MLB, NHL, Soccer, Tennis, MMA)",
    input_type: 'multi_select',
    field: 'league_preferences',
    options: ['NBA', 'NFL', 'NCAAF', 'MLB', 'NHL', 'Soccer', 'Tennis', 'MMA']
  },
  {
    id: 4,
    message: "What types of bets do you prefer? (You can list multiple: Spreads, Totals, Moneyline, Props, Parlays, Live)",
    input_type: 'multi_select',
    field: 'bet_type_profile',
    options: ['Spreads', 'Totals', 'Moneyline', 'Props', 'Parlays', 'Live Betting']
  },
  {
    id: 5,
    message: "When you're on a losing streak, do you usually slow down or find yourself chasing losses?",
    input_type: 'choice',
    field: 'tilt_prevention',
    options: ['I slow down and stick to my plan', 'I sometimes chase losses']
  },
  {
    id: 6,
    message: "What's your betting style preference?",
    input_type: 'choice',
    field: 'volatility_preference',
    options: ['Steady returns with lower risk', 'Aggressive plays with higher variance']
  },
  {
    id: 7,
    message: "On average, how many bets do you usually make per day?",
    input_type: 'number',
    field: 'bet_frequency',
    validation: { min: 0, max: 100, required: true }
  },
  {
    id: 8,
    message: "Perfect! Let me summarize your profile...",
    input_type: 'none',
  }
];

// Parse user response based on step type
function parseUserResponse(step: any, userInput: string): any {
  const lowerInput = userInput.toLowerCase().trim();

  switch (step.input_type) {
    case 'number':
      // Extract numbers from text (e.g., "$500" -> 500, "about 50" -> 50)
      const numMatch = userInput.match(/\d+\.?\d*/);
      return numMatch ? parseFloat(numMatch[0]) : null;

    case 'multi_select':
      // Match selected options from the user input
      const selected: string[] = [];
      step.options?.forEach((option: string) => {
        if (lowerInput.includes(option.toLowerCase())) {
          selected.push(option);
        }
      });
      return selected.length > 0 ? selected : null;

    case 'choice':
      // Match the closest option
      if (step.field === 'tilt_prevention') {
        if (lowerInput.includes('slow') || lowerInput.includes('stick') || lowerInput.includes('disciplined')) {
          return true;
        } else if (lowerInput.includes('chase') || lowerInput.includes('aggressive')) {
          return false;
        }
      }
      if (step.field === 'volatility_preference') {
        if (lowerInput.includes('steady') || lowerInput.includes('lower') || lowerInput.includes('conservative')) {
          return 'steady';
        } else if (lowerInput.includes('aggressive') || lowerInput.includes('variance') || lowerInput.includes('high')) {
          return 'aggressive';
        }
      }
      return null;

    default:
      return userInput.trim();
  }
}

// Generate personalized welcome message
function generateWelcomeMessage(data: any): string {
  const leagues = data.league_preferences?.join(', ') || 'various sports';
  const style = data.volatility_preference === 'steady' ? 'balanced' : 'aggressive';

  let message = `You're all set! 🎉\n\n`;
  message += `**Your Profile:**\n`;
  message += `• Bankroll: $${data.bankroll_size?.toLocaleString()}\n`;
  message += `• Unit Size: $${data.avg_unit?.toLocaleString()}\n`;
  message += `• Focus: ${leagues}\n`;
  message += `• Style: ${style.charAt(0).toUpperCase()}${style.slice(1)}\n`;
  message += `• Bet Types: ${data.bet_type_profile?.join(', ')}\n\n`;

  if (data.tilt_prevention) {
    message += `I'll help you stay disciplined during losing streaks and optimize your staking plan. `;
  } else {
    message += `I'll help you manage risk and keep your betting in check. `;
  }

  message += `Let's build your edge together!\n\n`;
  message += `You can ask me things like:\n`;
  message += `• "Show me tonight's ${leagues.split(',')[0]} games"\n`;
  message += `• "What's the edge on Lakers vs Warriors?"\n`;
  message += `• "Log a $${data.avg_unit} bet on the Lakers spread"\n`;
  message += `• "Show my bankroll performance"`;

  return message;
}

// Track analytics for onboarding step
async function trackStepAnalytics(
  userId: string,
  stepNumber: number,
  stepName: string,
  completed: boolean,
  timeSpent: number
) {
  const supabase = getSupabaseClient();

  await supabase.from('onboarding_analytics').insert({
    user_id: userId,
    step_number: stepNumber,
    step_name: stepName,
    entered_at: new Date(Date.now() - timeSpent * 1000).toISOString(),
    exited_at: new Date().toISOString(),
    completed,
    time_spent_seconds: timeSpent
  });
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, userId, userInput, currentStep, startTime } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    // Action: START - Initialize onboarding
    if (action === 'start') {
      // Update profile with onboarding started
      await supabase.from('profiles').update({
        onboarding_step: 0,
        onboarding_started_at: new Date().toISOString()
      }).eq('id', userId);

      // Return first step
      return new Response(
        JSON.stringify({
          step: ONBOARDING_STEPS[0],
          currentStep: 0,
          totalSteps: ONBOARDING_STEPS.length - 1,
          progress: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: NEXT - Process user response and move to next step
    if (action === 'next') {
      const step = ONBOARDING_STEPS[currentStep];
      let parsedValue = null;

      // Parse user input if the step requires input
      if (step.input_type !== 'none' && userInput) {
        parsedValue = parseUserResponse(step, userInput);

        // Validate input
        if (step.validation?.required && !parsedValue) {
          return new Response(
            JSON.stringify({
              error: 'Invalid input. Please try again.',
              step,
              currentStep,
              totalSteps: ONBOARDING_STEPS.length - 1
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update profile with the parsed value
        if (step.field) {
          const updateData: any = { onboarding_step: currentStep };

          // Map field names to database columns
          if (step.field === 'bankroll_size') {
            updateData.bankroll = parsedValue;
            updateData.initial_bankroll = parsedValue;
          } else if (step.field === 'avg_unit') {
            updateData.default_bet_size = parsedValue;
          } else if (step.field === 'league_preferences') {
            updateData.league_preferences = parsedValue;
          } else if (step.field === 'bet_type_profile') {
            updateData.bet_type_profile = parsedValue;
          } else if (step.field === 'tilt_prevention') {
            updateData.tilt_prevention = parsedValue;
          } else if (step.field === 'volatility_preference') {
            updateData.volatility_preference = parsedValue;
          } else if (step.field === 'bet_frequency') {
            updateData.bet_frequency = parsedValue;
          }

          await supabase.from('profiles').update(updateData).eq('id', userId);
        }

        // Track analytics
        if (startTime) {
          const timeSpent = Math.floor((Date.now() - startTime) / 1000);
          await trackStepAnalytics(userId, currentStep, step.field || `step_${currentStep}`, true, timeSpent);
        }
      }

      // Move to next step
      const nextStepIndex = currentStep + 1;

      // Check if onboarding is complete
      if (nextStepIndex >= ONBOARDING_STEPS.length) {
        // Get profile data to generate welcome message
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        // Mark onboarding as completed
        await supabase.from('profiles').update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_step: ONBOARDING_STEPS.length
        }).eq('id', userId);

        // Generate welcome message
        const welcomeMessage = generateWelcomeMessage({
          bankroll_size: profile.bankroll,
          avg_unit: profile.default_bet_size,
          league_preferences: profile.league_preferences,
          bet_type_profile: profile.bet_type_profile,
          tilt_prevention: profile.tilt_prevention,
          volatility_preference: profile.volatility_preference,
          bet_frequency: profile.bet_frequency
        });

        return new Response(
          JSON.stringify({
            completed: true,
            welcomeMessage,
            profile
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return next step
      const nextStep = ONBOARDING_STEPS[nextStepIndex];
      const progress = Math.round((nextStepIndex / (ONBOARDING_STEPS.length - 1)) * 100);

      return new Response(
        JSON.stringify({
          step: nextStep,
          currentStep: nextStepIndex,
          totalSteps: ONBOARDING_STEPS.length - 1,
          progress
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: SKIP - Skip onboarding
    if (action === 'skip') {
      await supabase.from('profiles').update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: -1 // Indicates skipped
      }).eq('id', userId);

      return new Response(
        JSON.stringify({ skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Onboarding error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
