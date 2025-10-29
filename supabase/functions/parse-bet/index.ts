import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParseBetRequest {
  message: string;
  userId: string;
}

interface ParsedBet {
  amount: number;
  selection: string;
  betType?: string;
  line?: number;
  odds?: number;
  teams?: {
    home?: string;
    away?: string;
  };
  sport?: string;
  clarificationNeeded?: boolean;
  clarificationQuestion?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId }: ParseBetRequest = await req.json();

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing message or userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Parsing bet from message: "${message}"`);

    // Use AI to parse the bet from natural language
    const parsedBets = await parseBetWithAI(message);

    return new Response(
      JSON.stringify({
        bets: parsedBets,
        success: true
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in parse-bet:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function parseBetWithAI(message: string): Promise<ParsedBet[]> {
  const prompt = `Parse betting information from this natural language message: "${message}"

Extract the following information for each bet mentioned:
- amount: The bet amount in dollars (required)
- selection: What they're betting on (e.g., "Titans +14.5", "Chiefs ML", "Lakers -5")
- betType: 'spread', 'moneyline', 'total', 'prop', or 'parlay'
- line: The point spread or total line (if applicable)
- odds: American odds format (default to -110 if not specified for spreads)
- teams: Object with 'home' and 'away' team names if identifiable
- sport: The sport (NFL, NBA, MLB, etc.) if identifiable

If the bet is ambiguous or missing critical information, set:
- clarificationNeeded: true
- clarificationQuestion: A specific question to ask the user

Return ONLY a JSON array of parsed bets. No explanatory text.

Examples:
Input: "Bet 100 on Titans +14.5"
Output: [{"amount": 100, "selection": "Titans +14.5", "betType": "spread", "line": 14.5, "odds": -110, "teams": {"away": "Titans"}, "sport": "NFL"}]

Input: "50 on Chiefs ML and 75 on Lakers -5"
Output: [{"amount": 50, "selection": "Chiefs ML", "betType": "moneyline", "teams": {"home": "Chiefs"}, "sport": "NFL"}, {"amount": 75, "selection": "Lakers -5", "betType": "spread", "line": -5, "odds": -110, "teams": {"home": "Lakers"}, "sport": "NBA"}]

Input: "Bet 25 parlay Ravens -3 and Eagles -7"
Output: [{"amount": 25, "selection": "Ravens -3 + Eagles -7", "betType": "parlay"}]

Now parse: "${message}"`;

  try {
    const aiGatewayUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiResponse = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a betting information parser. Return only valid JSON arrays of parsed bets. No markdown, no explanations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || "[]";

    // Clean up the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.slice(7);
    }
    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith("```")) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    const parsed = JSON.parse(cleanedContent);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error("Error parsing with AI:", error);
    // Return error with clarification needed
    return [{
      amount: 0,
      selection: message,
      clarificationNeeded: true,
      clarificationQuestion: "I couldn't parse that bet. Could you rephrase it? For example: 'Bet $100 on Titans +14.5'"
    }];
  }
}
