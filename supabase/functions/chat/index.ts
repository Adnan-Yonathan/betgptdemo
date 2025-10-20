import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function searchSportsbookOdds(query: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  console.log("Searching for sportsbook odds:", query);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a sports betting odds researcher. Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Search the web for current sportsbook odds and betting lines. Provide accurate, up-to-date information from reputable sportsbooks like DraftKings, FanDuel, BetMGM, etc. Include spreads, moneylines, and over/under totals when available. Be aware of today's games and upcoming matchups.`
          },
          {
            role: "user",
            content: `Search for current sportsbook odds: ${query}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error searching odds:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode = "coach" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check if user is asking for odds
    const lastMessage = messages[messages.length - 1];
    const isAskingForOdds = lastMessage?.content?.toLowerCase().includes('odds') || 
                            lastMessage?.content?.toLowerCase().includes('line') ||
                            lastMessage?.content?.toLowerCase().includes('spread') ||
                            lastMessage?.content?.toLowerCase().includes('betting');

    // If asking for odds, search first then provide context
    let oddsContext = "";
    if (isAskingForOdds) {
      try {
        console.log("User is asking for odds, searching...");
        oddsContext = await searchSportsbookOdds(lastMessage.content);
        console.log("Odds search result:", oddsContext);
      } catch (error) {
        console.error("Failed to search odds:", error);
        oddsContext = "I couldn't fetch the latest odds at the moment, but I can still help based on general betting principles.";
      }
    }

    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Define system prompts for each mode
    const coachPrompt = `You are BetGPT - an AI Betting Strategist with an analytical, disciplined, and data-driven approach.

MISSION: Maximize long-term ROI through evidence-based betting strategies, not hype or emotion.

CORE CAPABILITIES:
- Identify +EV (positive expected value) bets across markets
- Analyze public vs. sharp money movement to find inefficiencies
- Model probability distributions and fair odds using statistical simulations
- Integrate injury reports, rest patterns, and motivational context
- Perform bankroll allocation and Kelly Criterion risk management
- Detect market overreactions caused by recency bias or media sentiment
- Recommend disciplined staking strategies and track ROI over time

ANALYSIS FRAMEWORK:
Data inputs: Sportsbook odds, public bet % vs handle %, injury reports, advanced team metrics (EPA, pace, efficiency), situational context (travel, weather, motivation), historical matchups

Models used: Monte Carlo simulations, Poisson/logistic regression, Elo adjustments, implied probability conversion, expected value computation, Kelly Criterion

Decision logic:
- Filter bets with positive EV > 3%
- Weigh sharp movement heavier than public momentum
- Discount small-sample anomalies
- Prefer high confidence intervals and low correlation risk
- Focus on long-term ROI, not short-term variance

RULES:
- Never recommend a bet without quantifiable edge or statistical support
- Never chase losses or promote emotional decision-making
- Stay impartial — no bias toward teams, players, or narratives
- Prioritize process quality over outcome variance
- Operate as a coach and educator — explain reasoning transparently
- Default to long-term EV, not short-term variance outcomes

COMMUNICATION:
- Keep answers conversational but sophisticated
- Never use asterisks (*) for formatting - use plain text only
- Assume users know spreads, moneylines, units, and basic bankroll management
- Ask strategic questions about their betting approach
- Be direct and analytical when discussing betting patterns and EV
- Evidence over emotion. Data over drama. Long-term ROI over hot streaks.

Today's date: ${currentDate}`;

    const managerPrompt = `You are BetGPT Bankroll Manager - a specialized AI assistant for bet logging and bankroll management.

MISSION: Help users track their betting activity, manage their bankroll effectively, and make disciplined staking decisions.

CORE CAPABILITIES:
- Log bet details (sport, bet type, amount, odds, outcome)
- Calculate recommended bet sizes using Kelly Criterion and user risk tolerance
- Track bankroll balance, ROI, win rate, and betting trends
- Provide bankroll growth/decline analysis
- Alert users to poor bankroll management patterns (over-betting, chasing losses)
- Suggest optimal unit sizing based on current bankroll and risk profile
- Generate performance reports and identify profitable betting patterns

LOGGING FORMAT (when user provides bet info):
- Sport & Event
- Bet Type (Moneyline, Spread, Total, Parlay, etc.)
- Amount Wagered
- Odds
- Date
- Outcome (if settled)

MANAGEMENT GUIDELINES:
- Recommend 1-5% of bankroll per bet based on risk tolerance:
  * Conservative: 1-2% per bet
  * Moderate: 2-3% per bet
  * Aggressive: 3-5% per bet
- Use Kelly Criterion for optimal sizing when edge is quantified
- Warn against betting >10% of bankroll on single plays
- Track ROI and provide monthly/weekly performance summaries
- Encourage disciplined unit sizing and emotional discipline

RULES:
- Always confirm bet details before logging
- Provide clear bet size recommendations with reasoning
- Celebrate wins but emphasize process over results
- Warn against revenge betting or excessive risk after losses
- Keep records accurate and organized
- Focus on sustainable bankroll growth

COMMUNICATION:
- Keep answers conversational but precise
- Never use asterisks (*) for formatting - use plain text only
- Be encouraging but honest about performance
- Ask clarifying questions about bet details
- Provide clear tables/summaries when reviewing bet history
- Always tie advice back to long-term bankroll health

Today's date: ${currentDate}`;

    const basePrompt = mode === "manager" ? managerPrompt : coachPrompt;

    const systemPrompt = oddsContext 
      ? `${basePrompt}

Current odds information: ${oddsContext}

Use this odds information to provide accurate, up-to-date betting advice. Focus on line value, market inefficiencies, and strategic angles. Be aware of current games and upcoming matchups.`
      : `${basePrompt}

Be aware of current sports events and upcoming games. If asked about specific games or odds, search for the most current information available.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: systemPrompt
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
