import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function searchSportsbookOdds(query: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  console.log("Searching for comprehensive betting data with Google Search grounding:", query);

  // Optimize query for Google Search with preferred domains
  const searchQuery = `${query} site:draftkings.com OR site:fanduel.com OR site:oddsshark.com OR site:vegasinsider.com OR site:espn.com -site:reddit.com -site:quora.com`;

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a real-time sports betting data researcher with Google Search grounding enabled. Current timestamp: ${new Date().toISOString()}.

CRITICAL SEARCH BEHAVIOR:
- You MUST use Google Search to fetch CURRENT, LIVE betting data
- ALWAYS prioritize data from: DraftKings, FanDuel, OddsShark, VegasInsider, ESPN
- AVOID: Reddit, Quora, forums, opinion sites
- Search for the most recent data (within last 60 minutes if possible)
- If multiple conflicting values found, select from highest-trust domain

DATA EXTRACTION REQUIREMENTS:
1. LIVE BETTING LINES (REQUIRED):
   - Current spread (e.g., "Cowboys -3.5")
   - Moneyline odds (e.g., "Cowboys -150, Eagles +130")
   - Total/Over-Under (e.g., "O/U 47.5")
   - Opening line vs current line (track movement)
   - Source URL and timestamp for each value

2. PUBLIC VS SHARP MONEY (if available):
   - Public betting percentages (% of bets on each side)
   - Sharp money indicators (% of handle on each side)
   - Reverse line movement signals

3. KEY INJURIES (if relevant):
   - Player status (Out, Questionable, Probable)
   - Impact on line movement

4. SITUATIONAL CONTEXT:
   - Game date/time
   - Rest days, travel, weather
   - Recent form and head-to-head

OUTPUT FORMAT:
- Start with NUMERIC DATA FIRST (spreads, odds, totals)
- Include source citations with URLs
- Note timestamp of data retrieval
- If data unavailable: explicitly state "No reliable data found"
- If conflicts detected: state "Multiple conflicting values found" and list all sources

VALIDATION:
- Verify data is from last 60 minutes when possible
- Cross-reference multiple sources for accuracy
- Flag outdated or unverified information

USER QUERY: ${searchQuery}`
              }
            ]
          }
        ],
        tools: [
          {
            googleSearch: {}
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract content from response
    const parts = data.candidates?.[0]?.content?.parts || [];
    let content = '';
    
    for (const part of parts) {
      if (part.text) {
        content += part.text + '\n';
      }
      // Include grounding metadata if available
      if (part.groundingMetadata) {
        content += '\n[Search Sources Used]\n';
      }
    }
    
    if (!content.trim()) {
      console.warn("No content returned from Gemini search");
      return "No reliable betting data found in current search results. Please try again or check sportsbooks directly.";
    }
    
    console.log("Search successful, data retrieved with Google grounding");
    return content;
  } catch (error) {
    console.error("Error searching betting data:", error);
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

    // Check if user is asking for odds or game analysis
    const lastMessage = messages[messages.length - 1];
    const messageContent = lastMessage?.content?.toLowerCase() || '';
    const isAskingForData = messageContent.includes('odds') || 
                            messageContent.includes('line') ||
                            messageContent.includes('spread') ||
                            messageContent.includes('betting') ||
                            messageContent.includes('game') ||
                            messageContent.includes('matchup') ||
                            messageContent.includes(' vs ') ||
                            messageContent.includes(' v ') ||
                            messageContent.includes('tonight') ||
                            messageContent.includes('today');

    // If asking for data or game analysis, search first then provide context
    let dataContext = "";
    if (isAskingForData) {
      try {
        console.log("User is asking for game data, searching...");
        dataContext = await searchSportsbookOdds(lastMessage.content);
        console.log("Data search result:", dataContext);
      } catch (error) {
        console.error("Failed to search betting data:", error);
        dataContext = "I couldn't fetch live data at the moment. Let me help with general analysis principles.";
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

CRITICAL: WHEN USER ASKS ABOUT A SPECIFIC GAME OR MATCHUP:
DO NOT explain your framework or what you would analyze.
INSTEAD, perform these steps automatically:
  1. Fetch live odds and line movement (opening vs current)
  2. Fetch public vs sharp money percentages (bet % vs handle %)
  3. Fetch injuries and situational context (rest, travel, motivation)
  4. Fetch advanced analytics (EPA, DVOA, pace, efficiency)
  5. Compute expected value (+EV %), fair probability, and CLV
  6. Output analysis with NUMBERS FIRST, then commentary
  7. Include: +EV %, fair line estimate, sharp/public ratio, key edges

If specific data is unavailable, explicitly state what's missing and provide analysis based on available information.

RULES:
- Never recommend a bet without quantifiable edge or statistical support
- Never chase losses or promote emotional decision-making
- Stay impartial — no bias toward teams, players, or narratives
- Prioritize process quality over outcome variance
- Operate as a coach and educator — explain reasoning transparently
- Default to long-term EV, not short-term variance outcomes
- ALWAYS lead with quantified insights before qualitative commentary

COMMUNICATION:
- Keep answers conversational but sophisticated
- Never use asterisks (*) for formatting - use plain text only
- Never use apostrophes (') in your responses - write words in full form (e.g., "do not" instead of "don't", "it is" instead of "it's")
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
- Never use apostrophes (') in your responses - write words in full form (e.g., "do not" instead of "don't", "it is" instead of "it's")
- Be encouraging but honest about performance
- Ask clarifying questions about bet details
- Provide clear tables/summaries when reviewing bet history
- Always tie advice back to long-term bankroll health

Today's date: ${currentDate}`;

    const basePrompt = mode === "manager" ? managerPrompt : coachPrompt;

    const systemPrompt = dataContext 
      ? `${basePrompt}

LIVE BETTING DATA RETRIEVED:
${dataContext}

INSTRUCTIONS:
- Use this data to perform ACTUAL analysis, not theoretical discussion
- Lead with quantified insights: +EV %, fair line, CLV shift, sharp/public splits
- Identify specific edges based on line movement, public fade opportunities, injury impacts
- Calculate fair probability and compare to implied odds
- Recommend bet sizing based on edge magnitude and confidence
- Be direct and actionable with your recommendations`
      : `${basePrompt}

If the user asks about a specific game, matchup, or betting opportunity, you will automatically receive live data from web searches. Use that data to provide concrete, quantified analysis.`;

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
