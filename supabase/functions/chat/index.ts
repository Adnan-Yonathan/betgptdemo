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
            content: "You are a sports betting odds researcher. Search the web for current sportsbook odds and betting lines. Provide accurate, up-to-date information from reputable sportsbooks like DraftKings, FanDuel, BetMGM, etc. Include spreads, moneylines, and over/under totals when available."
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
    const { messages } = await req.json();
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

    const systemPrompt = oddsContext 
      ? `You are BetGPT, an AI betting coach that learns user patterns. Keep answers conversational and helpful. Ask questions to understand their betting behavior. Be supportive but honest when you see patterns that could lead to losses.

Current odds information: ${oddsContext}

Use this odds information to provide accurate, up-to-date betting advice.`
      : "You are BetGPT, an AI betting coach that learns user patterns. Keep answers conversational and helpful. Ask questions to understand their betting behavior. Be supportive but honest when you see patterns that could lead to losses.";

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
