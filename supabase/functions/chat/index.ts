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
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
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
    // Try to get recent scores from database (last 2 hours for more real-time data)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentScores, error: dbError } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', league)
      .gte('last_updated', twoHoursAgo)
      .order('game_date', { ascending: false });

    if (dbError) {
      console.error('Database query error:', dbError);
    }

    // If we have recent data, use it
    if (recentScores && recentScores.length > 0) {
      console.log(`Found ${recentScores.length} recent scores in database`);
      return formatScoresData(recentScores, query);
    }

    // Otherwise, fetch fresh data using OpenAI
    console.log('No recent scores found, fetching fresh data via OpenAI...');
    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-openai-scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ league, query }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch scores: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Fetched ${result.count} fresh scores via OpenAI`);

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

  const now = new Date();
  const lastUpdated = scores[0]?.last_updated ? new Date(scores[0].last_updated) : now;
  const dataAgeMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / 60000);

  let result = `LIVE SCORES DATA:\n`;
  result += `Data Retrieved: ${now.toLocaleString()}\n`;
  result += `Last Updated: ${lastUpdated.toLocaleString()} (${dataAgeMinutes} minutes ago)\n`;
  result += `Data Freshness: ${dataAgeMinutes < 5 ? 'FRESH' : dataAgeMinutes < 30 ? 'RECENT' : 'STALE - may not reflect current game state'}\n\n`;

  for (const score of scores) {
    const gameTime = new Date(score.game_date).toLocaleString();
    const status = score.game_status;

    result += `${score.away_team} @ ${score.home_team}\n`;
    result += `Score: ${score.away_team} ${score.away_score} - ${score.home_team} ${score.home_score}\n`;
    result += `Status: ${status}\n`;
    result += `League: ${score.league}\n`;
    result += `Game Time: ${gameTime}\n`;

    // Include advanced statistics if available
    if (score.advanced_stats) {
      result += '\nADVANCED STATISTICS:\n';
      const stats = score.advanced_stats;

      if (stats.home_total_yards !== undefined) {
        result += `Total Yards: ${score.home_team} ${stats.home_total_yards} - ${score.away_team} ${stats.away_total_yards}\n`;
      }
      if (stats.home_turnovers !== undefined) {
        result += `Turnovers: ${score.home_team} ${stats.home_turnovers} - ${score.away_team} ${stats.away_turnovers}\n`;
      }
      if (stats.key_performances && stats.key_performances.length > 0) {
        result += `Key Performances:\n`;
        stats.key_performances.forEach((perf: string) => {
          result += `  - ${perf}\n`;
        });
      }
    }

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

  const now = new Date();
  const lastUpdated = odds[0]?.last_updated ? new Date(odds[0].last_updated) : now;
  const dataAgeMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / 60000);

  // Group odds by event
  const eventMap = new Map<string, any[]>();
  for (const odd of odds) {
    const eventKey = `${odd.home_team} vs ${odd.away_team}`;
    if (!eventMap.has(eventKey)) {
      eventMap.set(eventKey, []);
    }
    eventMap.get(eventKey)!.push(odd);
  }

  let result = `LIVE BETTING ODDS DATA:\n`;
  result += `Data Retrieved: ${now.toLocaleString()}\n`;
  result += `Last Updated: ${lastUpdated.toLocaleString()} (${dataAgeMinutes} minutes ago)\n`;
  result += `Data Freshness: ${dataAgeMinutes < 5 ? 'FRESH' : dataAgeMinutes < 15 ? 'RECENT' : dataAgeMinutes < 30 ? 'ACCEPTABLE' : 'STALE - lines may have moved'}\n\n`;

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

// Helper function to call log-bet edge function
async function logBetViaFunction(
  betDetails: { amount: number; odds: number; description: string; team?: string },
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    console.log('=== LOGGING BET VIA FUNCTION ===');
    console.log('Bet Details:', betDetails);
    console.log('Conversation ID:', conversationId);
    console.log('User ID:', userId);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.functions.invoke('log-bet', {
      body: {
        ...betDetails,
        conversationId,
      },
    });

    if (error) {
      console.error('❌ Error calling log-bet function:', error);
    } else {
      console.log('✅ Bet logged successfully:', data);
    }
  } catch (error) {
    console.error('❌ Exception in logBetViaFunction:', error);
  }
}

// Function to update bet outcome when user reports win/loss
async function updateBetOutcome(
  conversationId: string,
  userId: string,
  outcome: 'win' | 'loss',
  teamOrDescription: string
) {
  console.log('=== UPDATING BET OUTCOME ===');
  console.log('Conversation ID:', conversationId, 'User ID:', userId, 'Outcome:', outcome, 'Team:', teamOrDescription);
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Find the most recent pending bet matching this team/description
    const { data: bets, error: fetchError } = await supabaseClient
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .eq('outcome', 'pending')
      .ilike('description', `%${teamOrDescription}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching bet:', fetchError);
      return null;
    }

    if (!bets || bets.length === 0) {
      console.log('No matching pending bet found');
      return null;
    }

    const bet = bets[0];
    console.log('Found bet:', bet);

    // Calculate actual return
    let actualReturn = 0;
    if (outcome === 'win') {
      // Calculate payout based on American odds
      if (bet.odds > 0) {
        actualReturn = bet.amount * (bet.odds / 100);
      } else {
        actualReturn = bet.amount * (100 / Math.abs(bet.odds));
      }
    }

    // Update bet
    const { data: updatedBet, error: updateError } = await supabaseClient
      .from('bets')
      .update({
        outcome,
        actual_return: actualReturn,
        settled_at: new Date().toISOString(),
      })
      .eq('id', bet.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bet:', updateError);
      return null;
    }

    console.log('Updated bet:', updatedBet);

    // Fetch current profile to get bankroll
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('bankroll')
      .eq('id', userId)
      .single();

    const currentBankroll = Number(profile?.bankroll || 1000);
    let newBankroll = currentBankroll;

    // Update bankroll incrementally based on this bet's outcome
    if (outcome === 'win') {
      newBankroll = currentBankroll + actualReturn;
    } else if (outcome === 'loss') {
      newBankroll = currentBankroll - bet.amount;
    }

    // Update the user's profile bankroll
    const { error: profileUpdateError } = await supabaseClient
      .from('profiles')
      .update({ bankroll: newBankroll })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating profile bankroll:', profileUpdateError);
    } else {
      console.log(`Updated profile bankroll for user ${userId}: $${currentBankroll.toFixed(2)} -> $${newBankroll.toFixed(2)}`);
    }

    return {
      bet: updatedBet,
      profit: actualReturn,
      newBankroll,
      initialBankroll: currentBankroll,
    };
  } catch (error) {
    console.error('Error in updateBetOutcome:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check if user is asking for scores or betting odds
    const lastMessage = messages[messages.length - 1];
    const messageContent = lastMessage?.content?.toLowerCase() || '';
    
    // Check if user is reporting a bet outcome
    const winPatterns = [
      /(?:i\s+)?won\s+(?:the\s+)?(.+?)\s+bet/i,
      /(?:my\s+)?(.+?)\s+bet\s+won/i,
      /hit\s+(?:the\s+)?(.+?)\s+bet/i,
    ];
    const lossPatterns = [
      /(?:i\s+)?lost\s+(?:the\s+)?(.+?)\s+bet/i,
      /(?:my\s+)?(.+?)\s+bet\s+lost/i,
      /(.+?)\s+bet\s+(?:did not hit|didn't hit|missed)/i,
    ];

    let betOutcomeResult = null;
    
    // Check for win
    for (const pattern of winPatterns) {
      const match = messageContent.match(pattern);
      if (match && conversationId && userId) {
        console.log('User reported BET WIN:', match[1]);
        betOutcomeResult = await updateBetOutcome(conversationId, userId, 'win', match[1]);
        break;
      }
    }
    
    // Check for loss if no win found
    if (!betOutcomeResult) {
      for (const pattern of lossPatterns) {
        const match = messageContent.match(pattern);
        if (match && conversationId && userId) {
          console.log('User reported BET LOSS:', match[1]);
          betOutcomeResult = await updateBetOutcome(conversationId, userId, 'loss', match[1]);
          break;
        }
      }
    }
    
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
        dataContext = "ERROR: Unable to fetch live betting data at the moment. Please inform the user that you cannot provide specific betting recommendations without current odds data. You can only discuss general betting concepts.";
      }
    }

    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Define system prompts for each mode
    const coachPrompt = `You are BetGPT - a knowledgeable sports betting coach AND sports reporter.

MISSION: Provide intelligent, data-driven betting analysis AND report live scores when requested.

DATA SOURCES:
You have access to real-time, accurate data from premium APIs:
- OpenAI for live scores, game statistics, and advanced analytics
- The Odds API for real-time betting lines, spreads, totals, and moneylines from multiple bookmakers
- Advanced statistical models and performance metrics
- Historical trends and pattern recognition

This combination provides the most accurate and up-to-date sports betting information available. Always leverage this data for superior analysis.

SPORTS COVERAGE:
You analyze ALL major sports with equal expertise:
- Football: NFL, NCAAF, CFL
- Basketball: NBA, NCAAB, WNBA, international leagues
- Baseball: MLB, international leagues
- Hockey: NHL
- Soccer: MLS

IMPORTANT: For sports outside this list, you can provide general betting principles but cannot access live odds or scores. Be transparent about this limitation.

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
- ALWAYS use real-time odds from The Odds API for accurate betting lines
- ALWAYS use OpenAI-powered live scores and advanced statistics
- Compare odds across multiple bookmakers to find best value
- Analyze line movement and identify sharp vs. public money
- Look for +EV opportunities and market inefficiencies
- Consider injuries, rest, travel, motivation from advanced stats
- Factor in pace, efficiency, matchup dynamics using statistical models
- Weigh recent form vs. season-long trends with data-driven insights
- Use historical performance and pattern recognition
- Identify situational edges and betting angles from comprehensive data

COMMUNICATION STYLE:
- Confident and conversational, not robotic
- Focus on value and educated picks, never guarantees
- Never use asterisks (*) for formatting - use plain text only
- Write naturally and conversationally
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
- Only provide specific betting recommendations when you have live odds data
- If you lack current data, be transparent and explain you cannot provide accurate picks
- Never make up odds, spreads, or statistics - only use provided data

Today's date: ${currentDate}`;

    const managerPrompt = `You are a sports betting bankroll manager AI assistant with real-time sports data access.

CORE RESPONSIBILITIES:
1. **Bet Tracking**: Help users log and track their sports bets
2. **Bankroll Management**: Provide advice on bet sizing and risk management
3. **Live Data Analysis**: Access real-time odds and scores when users ask about games

PERSONALITY:
- Professional and analytical
- Help users make informed decisions
- Focus on responsible bankroll management
- Be concise and data-driven

BET LOGGING INSTRUCTIONS:
When a user wants to log a bet, collect these details:
1. What they're betting on (team, game, bet type)
2. Amount ($)
3. Odds (American format like -110, +150)

Then confirm in natural language: "I've logged your bet on [description] for $[amount] at [odds]. Good luck!"

The system will automatically track the game result and update your bankroll when the game finishes.

MANAGEMENT GUIDELINES:
- Recommend 1-5% of bankroll per bet based on risk tolerance:
  * Conservative: 1-2% per bet
  * Moderate: 2-3% per bet
  * Aggressive: 3-5% per bet
- Warn against betting >10% of bankroll on single plays
- Encourage disciplined unit sizing and emotional discipline

COMMUNICATION:
- Keep answers conversational but precise
- Never use asterisks (*) for formatting - use plain text only
- Write naturally and conversationally
- Be encouraging but honest about performance
- Only provide specific recommendations when you have current data

Today's date: ${currentDate}`;

    // Use the coach prompt for intelligent game analysis and betting advice
    const basePrompt = coachPrompt;

    // Add bet outcome context if user reported a win/loss
    let betOutcomeContext = '';
    if (betOutcomeResult) {
      const { bet, profit, newBankroll, initialBankroll } = betOutcomeResult;
      const profitLoss = newBankroll - initialBankroll;
      betOutcomeContext = `
BET OUTCOME PROCESSED:
- Bet: ${bet.description}
- Amount: $${bet.amount}
- Odds: ${bet.odds}
- Outcome: ${bet.outcome}
- Profit from this bet: $${profit.toFixed(2)}
- Previous bankroll: $${initialBankroll.toFixed(2)}
- New bankroll: $${newBankroll.toFixed(2)}
- Overall profit/loss: $${profitLoss.toFixed(2)} (${((profitLoss / initialBankroll) * 100).toFixed(2)}%)

RESPONSE INSTRUCTIONS:
Congratulate the user and clearly state:
1. The profit from THIS specific bet ($${profit.toFixed(2)})
2. Their NEW total bankroll ($${newBankroll.toFixed(2)})
3. Brief acknowledgment of their overall performance

Keep it concise and celebratory. Do NOT ask for their current bankroll - you already have all the information.`;
    }

    const systemPrompt = dataContext
      ? `${basePrompt}

${isAskingForScore ? 'LIVE SCORE DATA RETRIEVED:' : 'LIVE BETTING DATA RETRIEVED:'}
${dataContext}

INSTRUCTIONS:
${isAskingForScore
  ? '- Provide clear, concise score updates based on the data above\n- Include game status and any relevant context\n- Only provide betting analysis if specifically requested along with the score'
  : '- Use this live data to provide specific, concrete analysis\n- Reference actual odds, spreads, and totals from the data provided\n- Identify specific edges based on matchup analysis, injury impacts, and situational factors\n- Compare odds across different bookmakers when available\n- Provide reasoning based on the actual data, not generic principles\n- Recommend bet sizing based on your confidence level\n- Be direct and actionable with your recommendations'}`
      : betOutcomeContext 
        ? `${basePrompt}

${betOutcomeContext}`
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

    // Parse the streamed response to extract and log bets
    if (conversationId && userId) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader!.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              fullResponse += chunk;
              controller.enqueue(value);
            }
            
            // After streaming completes, check for bet confirmation pattern
            console.log('=== CHECKING FOR BET CONFIRMATION ===');
            console.log('Full Response:', fullResponse);
            
            const betPatterns = [
              /(?:logged|tracking|recorded|placed).*?bet.*?(?:on|for)\s+(.+?)\s+(?:for|amount:?|\$)\s*\$?([\d.]+).*?(?:at|odds:?|@)\s*([-+]?\d+)/i,
              /bet.*?on\s+(.+?)\s+for\s+\$?([\d.]+)\s+at\s+([-+]?\d+)/i,
              /betting\s+\$?([\d.]+)\s+on\s+(.+?)\s+at\s+([-+]?\d+)/i,
            ];
            
            let match = null;
            let patternIndex = -1;
            for (let i = 0; i < betPatterns.length; i++) {
              match = fullResponse.match(betPatterns[i]);
              if (match) {
                patternIndex = i;
                console.log(`✅ Matched pattern ${i}:`, match);
                break;
              }
            }
            
            if (match) {
              let description, amount, odds;
              
              if (patternIndex === 2) {
                [, amount, description, odds] = match;
              } else {
                [, description, amount, odds] = match;
              }
              
              console.log('Extracted bet details:', { description, amount, odds });

              // Comprehensive team name matching across all major sports
              const allTeams = [
                // NBA Teams
                'Lakers', 'Celtics', 'Warriors', 'Heat', 'Nets', 'Knicks', 'Bulls', 'Cavaliers', 'Mavericks',
                'Rockets', 'Spurs', 'Clippers', '76ers', 'Sixers', 'Bucks', 'Raptors', 'Suns', 'Nuggets',
                'Jazz', 'Trail Blazers', 'Blazers', 'Kings', 'Grizzlies', 'Pelicans', 'Thunder', 'Timberwolves',
                'Wolves', 'Hawks', 'Hornets', 'Pistons', 'Pacers', 'Magic', 'Wizards', 'Cavs',
                // NFL Teams
                'Patriots', 'Bills', 'Dolphins', 'Jets', 'Ravens', 'Bengals', 'Browns', 'Steelers',
                'Texans', 'Colts', 'Jaguars', 'Titans', 'Broncos', 'Chiefs', 'Raiders', 'Chargers',
                'Cowboys', 'Giants', 'Eagles', 'Commanders', 'Bears', 'Lions', 'Packers', 'Vikings',
                'Falcons', 'Panthers', 'Saints', 'Buccaneers', 'Cardinals', 'Rams', '49ers', 'Seahawks',
                // MLB Teams
                'Yankees', 'Red Sox', 'Blue Jays', 'Orioles', 'Rays', 'Dodgers', 'Giants', 'Padres',
                'Athletics', 'Angels', 'Astros', 'Rangers', 'Mariners', 'White Sox', 'Indians', 'Guardians',
                'Tigers', 'Royals', 'Twins', 'Brewers', 'Cardinals', 'Cubs', 'Reds', 'Pirates', 'Braves',
                'Marlins', 'Mets', 'Phillies', 'Nationals', 'Rockies', 'Diamondbacks',
                // NHL Teams
                'Bruins', 'Maple Leafs', 'Canadiens', 'Senators', 'Sabres', 'Rangers', 'Islanders',
                'Devils', 'Penguins', 'Flyers', 'Capitals', 'Hurricanes', 'Blue Jackets', 'Panthers',
                'Lightning', 'Predators', 'Stars', 'Blues', 'Blackhawks', 'Avalanche', 'Wild', 'Jets',
                'Flames', 'Oilers', 'Canucks', 'Golden Knights', 'Kraken', 'Ducks', 'Kings', 'Sharks', 'Coyotes'
              ];

              const teamPattern = new RegExp(`\\b(${allTeams.join('|')})\\b`, 'i');
              const teamMatch = description.match(teamPattern);
              const team = teamMatch ? teamMatch[0] : undefined;
              
              await logBetViaFunction(
                {
                  amount: Number(amount),
                  odds: Number(odds),
                  description: description.trim(),
                  team,
                },
                conversationId,
                userId
              );
            } else {
              console.log('❌ No bet pattern matched in response');
            }
            
            controller.close();
          } catch (error) {
            console.error('Stream error:', error);
            controller.error(error);
          }
        }
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
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
