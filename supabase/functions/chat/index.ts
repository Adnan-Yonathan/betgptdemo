import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchLiveScores(query: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Fetching live scores for query:", query);

  // Determine league from query
  let league = 'NFL'; // default
  const queryLower = query.toLowerCase();
  
  if (queryLower.includes('nba') || queryLower.includes('basketball')) {
    league = 'NBA';
  } else if (queryLower.includes('mlb') || queryLower.includes('baseball')) {
    league = 'MLB';
  } else if (queryLower.includes('nhl') || queryLower.includes('hockey')) {
    league = 'NHL';
  } else if (queryLower.includes('nfl') || queryLower.includes('football')) {
    league = 'NFL';
  }

  try {
    // Try to get recent scores from database (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentScores, error: dbError } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', league)
      .gte('last_updated', oneDayAgo)
      .order('game_date', { ascending: false });

    if (dbError) {
      console.error('Database query error:', dbError);
    }

    // If we have recent data, use it
    if (recentScores && recentScores.length > 0) {
      console.log(`Found ${recentScores.length} recent scores in database`);
      return formatScoresData(recentScores, query);
    }

    // Otherwise, fetch fresh data
    console.log('No recent scores found, fetching fresh data from ESPN...');
    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-sports-scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ league: league.toLowerCase() }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch scores: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Fetched ${result.count} fresh scores`);

    // Query database again for fresh data
    const { data: freshScores, error: freshError } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', league)
      .order('game_date', { ascending: false })
      .limit(50);

    if (freshError) {
      throw freshError;
    }

    return formatScoresData(freshScores || [], query);
  } catch (error) {
    console.error("Error fetching scores:", error);
    return "Unable to fetch live scores at the moment. Please try again shortly.";
  }
}

function formatScoresData(scores: any[], query: string): string {
  if (!scores || scores.length === 0) {
    return "No scores found for this query. The games may not have started yet or the league may be in the off-season.";
  }

  let result = `LIVE SCORES (Last Updated: ${new Date().toLocaleString()}):\n\n`;

  for (const score of scores) {
    const gameTime = new Date(score.game_date).toLocaleString();
    const status = score.game_status;
    
    result += `${score.away_team} @ ${score.home_team}\n`;
    result += `Score: ${score.away_team} ${score.away_score} - ${score.home_team} ${score.home_score}\n`;
    result += `Status: ${status}\n`;
    result += `League: ${score.league}\n`;
    result += `Game Time: ${gameTime}\n`;
    result += '\n---\n\n';
  }

  result += `Total Games: ${scores.length}\n`;
  
  return result;
}

async function fetchLiveOdds(query: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Fetching live odds data for query:", query);

  // Determine sport from query with comprehensive detection
  let sport = 'americanfootball_nfl'; // default
  const queryLower = query.toLowerCase();
  
  // MLB team names
  const mlbTeams = ['yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'dodgers', 'giants', 'padres', 
    'athletics', 'angels', 'astros', 'rangers', 'mariners', 'white sox', 'indians', 'guardians', 
    'tigers', 'royals', 'twins', 'brewers', 'cardinals', 'cubs', 'reds', 'pirates', 'braves', 
    'marlins', 'mets', 'phillies', 'nationals', 'rockies', 'diamondbacks'];
  
  // NBA team names
  const nbaTeams = ['lakers', 'celtics', 'warriors', 'nets', 'knicks', 'bulls', 'heat', 'mavericks',
    'suns', 'bucks', 'clippers', 'nuggets', 'rockets', 'sixers', '76ers', 'raptors', 'grizzlies',
    'hawks', 'hornets', 'jazz', 'kings', 'spurs', 'thunder', 'trail blazers', 'blazers', 'wizards',
    'pistons', 'magic', 'cavaliers', 'cavs', 'pelicans', 'timberwolves', 'wolves', 'pacers'];
  
  // NHL team names
  const nhlTeams = ['bruins', 'maple leafs', 'canadiens', 'senators', 'sabres', 'rangers', 'islanders',
    'devils', 'penguins', 'flyers', 'capitals', 'hurricanes', 'blue jackets', 'panthers', 'lightning',
    'predators', 'stars', 'blues', 'blackhawks', 'avalanche', 'wild', 'jets', 'flames', 'oilers',
    'canucks', 'golden knights', 'kraken', 'ducks', 'kings', 'sharks', 'coyotes'];
  
  // Check for sport keywords first
  if (queryLower.includes('nba') || queryLower.includes('basketball') || 
      nbaTeams.some(team => queryLower.includes(team))) {
    sport = 'basketball_nba';
  } else if (queryLower.includes('mlb') || queryLower.includes('baseball') || 
             mlbTeams.some(team => queryLower.includes(team))) {
    sport = 'baseball_mlb';
  } else if (queryLower.includes('nhl') || queryLower.includes('hockey') || 
             nhlTeams.some(team => queryLower.includes(team))) {
    sport = 'icehockey_nhl';
  } else if (queryLower.includes('soccer') || queryLower.includes('mls')) {
    sport = 'soccer_usa_mls';
  }

  try {
    // First, try to get recent odds from database (last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentOdds, error: dbError } = await supabase
      .from('betting_odds')
      .select('*')
      .eq('sport_key', sport)
      .gte('last_updated', thirtyMinutesAgo)
      .order('last_updated', { ascending: false });

    if (dbError) {
      console.error('Database query error:', dbError);
    }

    // If we have recent data, use it
    if (recentOdds && recentOdds.length > 0) {
      console.log(`Found ${recentOdds.length} recent odds entries in database`);
      return formatOddsData(recentOdds, query);
    }

    // Otherwise, fetch fresh data from The Odds API
    console.log('No recent data found, fetching fresh odds from API...');
    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-betting-odds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sport }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch odds: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Fetched ${result.count} fresh odds entries`);

    // Now query the database again for the fresh data
    const { data: freshOdds, error: freshError } = await supabase
      .from('betting_odds')
      .select('*')
      .eq('sport_key', sport)
      .order('last_updated', { ascending: false })
      .limit(200);

    if (freshError) {
      throw freshError;
    }

    return formatOddsData(freshOdds || [], query);
  } catch (error) {
    console.error("Error fetching odds:", error);
    return "Unable to fetch live odds at the moment. Please try again shortly.";
  }
}

function formatOddsData(odds: any[], query: string): string {
  if (!odds || odds.length === 0) {
    return "No betting odds found for this query. The game may not have lines available yet.";
  }

  // Group odds by event
  const eventMap = new Map<string, any[]>();
  for (const odd of odds) {
    const eventKey = `${odd.home_team} vs ${odd.away_team}`;
    if (!eventMap.has(eventKey)) {
      eventMap.set(eventKey, []);
    }
    eventMap.get(eventKey)!.push(odd);
  }

  let result = `LIVE BETTING ODDS (Last Updated: ${new Date().toLocaleString()}):\n\n`;

  for (const [event, eventOdds] of eventMap.entries()) {
    const firstOdd = eventOdds[0];
    const gameTime = new Date(firstOdd.commence_time).toLocaleString();
    
    result += `${event}\n`;
    result += `Game Time: ${gameTime}\n`;
    result += `Sport: ${firstOdd.sport_title}\n\n`;

    // Group by bookmaker
    const bookmakerMap = new Map<string, any[]>();
    for (const odd of eventOdds) {
      if (!bookmakerMap.has(odd.bookmaker)) {
        bookmakerMap.set(odd.bookmaker, []);
      }
      bookmakerMap.get(odd.bookmaker)!.push(odd);
    }

    // Show top 3 bookmakers
    let bookCount = 0;
    for (const [bookmaker, bookOdds] of bookmakerMap.entries()) {
      if (bookCount >= 3) break;
      
      result += `${bookmaker}:\n`;
      
      // Organize by market type
      const h2hOdds = bookOdds.filter(o => o.market_key === 'h2h');
      const spreadOdds = bookOdds.filter(o => o.market_key === 'spreads');
      const totalsOdds = bookOdds.filter(o => o.market_key === 'totals');

      if (h2hOdds.length > 0) {
        result += `  Moneyline: `;
        result += h2hOdds.map(o => `${o.outcome_name} ${o.outcome_price > 0 ? '+' : ''}${o.outcome_price}`).join(', ');
        result += '\n';
      }

      if (spreadOdds.length > 0) {
        result += `  Spread: `;
        result += spreadOdds.map(o => `${o.outcome_name} ${o.outcome_point > 0 ? '+' : ''}${o.outcome_point} (${o.outcome_price > 0 ? '+' : ''}${o.outcome_price})`).join(', ');
        result += '\n';
      }

      if (totalsOdds.length > 0) {
        result += `  Total: `;
        result += totalsOdds.map(o => `${o.outcome_name} ${o.outcome_point} (${o.outcome_price > 0 ? '+' : ''}${o.outcome_price})`).join(', ');
        result += '\n';
      }

      result += '\n';
      bookCount++;
    }

    result += '---\n\n';
  }

  result += `\nData Source: The Odds API (Live)\n`;
  result += `Total Events: ${eventMap.size}\n`;
  
  return result;
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

    // Check if user is asking for scores or betting odds
    const lastMessage = messages[messages.length - 1];
    const messageContent = lastMessage?.content?.toLowerCase() || '';
    
    // Patterns for score requests
    const scoreKeywords = [
      'score', 'final score', 'current score', 'what is the score', 'whats the score',
      'who is winning', 'whos winning', 'who won', 'final', 'result', 'results'
    ];
    
    // Comprehensive patterns for betting questions
    const bettingKeywords = [
      'odds', 'line', 'spread', 'betting', 'bet on', 'best bet', 'should i bet',
      'moneyline', 'ml', 'over', 'under', 'total', 'parlay',
      'game', 'matchup', 'tonight', 'today', 'this week',
      'pick', 'prediction', 'recommend', 'who wins', 'who should i',
      'what do you think', 'analysis', 'vs', ' v ', 'against',
      'worth betting', 'good bet', 'value', '+ev', 'edge',
      'sharp money', 'public', 'line movement', 'juice'
    ];
    
    // Sport-specific terms that indicate game queries
    const sportTerms = [
      'nfl', 'nba', 'mlb', 'nhl', 'mls', 'ncaaf', 'ncaab',
      'football', 'basketball', 'baseball', 'hockey', 'soccer'
    ];
    
    const isAskingForScore = scoreKeywords.some(keyword => messageContent.includes(keyword));
    const isAskingForBettingData = bettingKeywords.some(keyword => messageContent.includes(keyword)) ||
                                   sportTerms.some(term => messageContent.includes(term));

    // Fetch appropriate data based on query type
    let dataContext = "";
    if (isAskingForScore) {
      try {
        console.log("User is asking for scores, fetching live scores...");
        dataContext = await fetchLiveScores(lastMessage.content);
        console.log("Score data fetch result:", dataContext);
      } catch (error) {
        console.error("Failed to fetch score data:", error);
        dataContext = "I could not fetch live scores at the moment. Please try again shortly.";
      }
    } else if (isAskingForBettingData) {
      try {
        console.log("User is asking for game data, fetching live odds...");
        dataContext = await fetchLiveOdds(lastMessage.content);
        console.log("Odds data fetch result:", dataContext);
      } catch (error) {
        console.error("Failed to fetch betting data:", error);
        dataContext = "I could not fetch live data at the moment. Let me help with general analysis principles.";
      }
    }

    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Define system prompts for each mode
    const coachPrompt = `You are BetGPT - a knowledgeable sports betting coach AND sports reporter covering ALL major sports (NFL, NBA, MLB, NHL, soccer/MLS, UFC, tennis, golf, college football, college basketball, and more).

MISSION: Provide intelligent, data-driven betting analysis across all sports AND report live scores when requested.

SPORTS COVERAGE:
You analyze ALL major sports with equal expertise:
- Football: NFL, NCAAF, CFL
- Basketball: NBA, NCAAB, WNBA, international leagues
- Baseball: MLB, international leagues
- Hockey: NHL
- Soccer: MLS, EPL, La Liga, Champions League, World Cup, etc.
- Combat Sports: UFC, boxing
- Individual Sports: tennis, golf, racing
- Other: esports, cricket, rugby, and more

CRITICAL: NEVER say you only cover one sport. You are a multi-sport expert.

SCORE REPORTING:
When users ask for scores ("What is the score?", "Who won?", "Current score?"), provide:
- Clear, concise score updates
- Game status (Final, In Progress, Scheduled)
- Key game context if relevant (overtime, blowout, close game)
- No betting analysis unless specifically requested

RECOGNIZING BETTING QUESTIONS:
When users ask about games or matchups, treat these as betting inquiries even without the word "bet":
- "Who wins [team] vs [team]?" = betting question
- "Thoughts on tonight's game?" = betting question  
- "What do you like for [team]?" = betting question
- "Should I bet on [game]?" = obvious betting question
- Simply mentioning a matchup = potential betting question

RESPONSE STRUCTURE FOR GAME ANALYSIS:
When analyzing a specific game or match, provide:

1. RECOMMENDED BET (be specific)
   - Bet type: spread/moneyline/total/prop
   - The actual pick (e.g., "Lakers -4.5" or "Over 218.5")

2. KEY REASONS (3-4 supporting factors)
   - Specific stats, trends, or situational edges
   - Injury impacts or rest advantages
   - Matchup analysis or historical context
   - Line value or market inefficiencies

3. RISK ASSESSMENT
   - Risk level: Low/Medium/High
   - Suggested unit size (e.g., "1-2 units" or "0.5 units")
   - Confidence level in the pick

4. RESPONSIBLE GAMBLING REMINDER
   - Always include a brief reminder to bet responsibly
   - Emphasize this is analysis, not a guarantee

ANALYSIS APPROACH:
- Use live odds data when available
- Use live scores when reporting game results
- Consider injuries, rest, travel, motivation
- Analyze line movement and public/sharp money
- Look for +EV opportunities and market inefficiencies
- Factor in pace, efficiency, matchup dynamics
- Weigh recent form vs. season-long trends

COMMUNICATION STYLE:
- Confident and conversational, not robotic
- Focus on value and educated picks, never guarantees
- Never use asterisks (*) for formatting - use plain text only
- Never use apostrophes (') - write words in full (e.g., "do not" vs "don't")
- Assume users understand basic betting terms (spread, juice, units)
- Be direct and actionable - users want picks, not just theory
- Show your expertise but stay humble about outcomes

RULES:
- Never guarantee wins - variance exists in all sports
- Always provide reasoning, never just "pick this team"
- Stay impartial - no bias toward popular teams
- Prioritize long-term value over short-term results
- Encourage disciplined bankroll management
- Remind users that past performance does not guarantee future results

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

${isAskingForScore ? 'LIVE SCORE DATA RETRIEVED:' : 'LIVE BETTING DATA RETRIEVED:'}
${dataContext}

INSTRUCTIONS:
${isAskingForScore 
  ? '- Provide clear, concise score updates based on the data above\n- Include game status and any relevant context\n- Only provide betting analysis if specifically requested along with the score'
  : '- Use this data to perform ACTUAL analysis, not theoretical discussion\n- Lead with quantified insights: +EV %, fair line, CLV shift, sharp/public splits\n- Identify specific edges based on line movement, public fade opportunities, injury impacts\n- Calculate fair probability and compare to implied odds\n- Recommend bet sizing based on edge magnitude and confidence\n- Be direct and actionable with your recommendations'}`
      : `${basePrompt}

If the user asks about a specific game, matchup, or betting opportunity, you will automatically receive live data. Use that data to provide concrete, quantified analysis.`;

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
