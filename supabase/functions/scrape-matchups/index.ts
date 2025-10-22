import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchupData {
  event_id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  game_date: string;
  h2h_history?: any;
  home_team_recent_form?: any;
  away_team_recent_form?: any;
  key_player_matchups?: any;
  coaching_matchup?: any;
  tactical_analysis?: string;
  statistical_edges?: any;
  betting_trends?: any;
  situational_trends?: string[];
  weather_impact?: string;
  venue_advantages?: string[];
  ai_prediction?: any;
  source_urls?: string[];
  data_quality: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Parse request body
    const {
      sport = 'NFL',
      league = 'NFL',
      home_team = null,
      away_team = null,
      event_id = null,
      game_date = null
    } = await req.json().catch(() => ({}));

    if (!home_team && !event_id) {
      throw new Error('Either home_team or event_id must be provided');
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log(`Scraping matchup analysis for ${home_team} vs ${away_team || 'TBD'}...`);

    // Build comprehensive matchup analysis prompt
    const prompt = `You are a professional sports analyst with access to comprehensive matchup data, historical trends, and betting analytics.

Today's date is ${currentDate}.

Task: Provide a comprehensive matchup analysis for the ${league} game${event_id ? ` (event_id: ${event_id})` : ''}:
${home_team ? `Home Team: ${home_team}` : ''}
${away_team ? `Away Team: ${away_team}` : ''}
${game_date ? `Game Date: ${game_date}` : ''}

Provide a detailed analysis including:

1. **Head-to-Head History**
   - Last 5-10 meetings between these teams
   - Results, scores, and notable trends
   - Home/away splits in the matchup

2. **Recent Form**
   - Each team's last 5-10 games
   - Win/loss record, scoring trends
   - Momentum and current streaks

3. **Key Player Matchups**
   - Critical individual matchups (e.g., QB vs Secondary, Top Scorer vs Top Defender)
   - Player advantages and disadvantages
   - Star player performance in this matchup historically

4. **Coaching Matchup**
   - Head coach records against each other
   - Coaching styles and tactical preferences
   - Historical success in this matchup

5. **Statistical Edges**
   - Offensive/defensive rating comparisons
   - Pace, efficiency, and style matchups
   - Statistical mismatches and advantages

6. **Betting Trends**
   - Against the spread (ATS) records
   - Over/under trends
   - Public vs sharp money indicators
   - Line movement patterns

7. **Situational Analysis**
   - Rest days and schedule factors
   - Back-to-back games or long rest
   - Travel distance and timezone changes
   - Motivation factors (rivalry, playoff implications, etc.)

8. **Weather Impact** (for outdoor sports)
   - Current forecast
   - How weather affects each team's style
   - Historical performance in similar conditions

9. **Venue-Specific Factors**
   - Home court/field advantage statistics
   - Altitude, crowd noise, surface type
   - Historical performance at this venue

10. **AI Prediction & Key Factors**
    - Predicted winner with confidence level
    - Top 3-5 factors driving the prediction
    - Value bet opportunities
    - Risk factors to monitor

Return data in this JSON format:
{
  "matchups": [
    {
      "event_id": "unique_game_id",
      "sport": "${sport}",
      "league": "${league}",
      "home_team": "Team Name",
      "away_team": "Team Name",
      "game_date": "ISO 8601 datetime",

      "h2h_history": {
        "total_games": 15,
        "home_team_wins": 8,
        "away_team_wins": 7,
        "last_5_meetings": [
          {
            "date": "2024-01-15",
            "winner": "Home Team",
            "score": "105-98",
            "location": "Home"
          }
        ],
        "home_team_ats": "9-6",
        "away_team_ats": "6-9",
        "over_under": "8-7 O"
      },

      "home_team_recent_form": {
        "last_10_record": "7-3",
        "last_5_results": ["W", "W", "L", "W", "W"],
        "avg_points_scored": 112.5,
        "avg_points_allowed": 105.2,
        "offensive_rating": 115.2,
        "defensive_rating": 108.5,
        "current_streak": "W3"
      },

      "away_team_recent_form": {
        "last_10_record": "6-4",
        "last_5_results": ["W", "L", "W", "W", "L"],
        "avg_points_scored": 108.3,
        "avg_points_allowed": 110.1,
        "offensive_rating": 110.8,
        "defensive_rating": 112.3,
        "current_streak": "L1"
      },

      "key_player_matchups": [
        {
          "matchup": "Star PG vs Elite Defender",
          "advantage": "home_team",
          "reasoning": "Home PG averaging 28ppg vs this defender historically",
          "impact_level": "high"
        }
      ],

      "coaching_matchup": {
        "h2h_record": "Coach A: 5 wins, Coach B: 3 wins",
        "tactical_edge": "home_team",
        "notes": "Home coach 8-2 after losses this season"
      },

      "tactical_analysis": "Detailed tactical breakdown of how teams match up stylistically...",

      "statistical_edges": {
        "pace_advantage": "home_team",
        "offensive_efficiency": "home_team",
        "defensive_efficiency": "away_team",
        "rebounding": "home_team",
        "three_point_shooting": "away_team",
        "turnover_battle": "even"
      },

      "betting_trends": {
        "home_team_ats_last_10": "7-3",
        "away_team_ats_last_10": "4-6",
        "home_team_as_favorite": "6-4 ATS",
        "away_team_as_underdog": "5-5 ATS",
        "over_under_trend": "6-4 Over in last 10",
        "sharp_money": "70% on home team",
        "public_money": "55% on away team",
        "line_movement": "Moved from -5.5 to -7 (toward home)"
      },

      "situational_trends": [
        "Home team is 8-2 ATS after a loss",
        "Away team is 3-7 ATS on back-to-backs",
        "Home team covers 75% of the time in this rivalry"
      ],

      "weather_impact": "Clear skies, 68°F - ideal conditions favor high-scoring game",

      "venue_advantages": [
        "Home team is 12-3 at home this season",
        "Loud crowd creates communication issues for visitors",
        "Fast-paced court favors home team's style"
      ],

      "ai_prediction": {
        "predicted_winner": "home_team",
        "confidence": 72,
        "predicted_spread": -6.5,
        "predicted_total": 220.5,
        "key_factors": [
          "Home team has significant rest advantage (3 days vs 0)",
          "Star player matchup heavily favors home team",
          "Sharp money and line movement toward home team",
          "Historical dominance in this matchup at home"
        ],
        "value_bets": [
          {
            "bet_type": "spread",
            "recommendation": "Home team -7",
            "confidence": "medium",
            "reasoning": "Line movement shows value, historical edge"
          }
        ],
        "risk_factors": [
          "Key home player questionable with ankle injury",
          "Away team desperate for a win (playoff implications)"
        ]
      },

      "data_quality": "comprehensive"
    }
  ]
}

Provide accurate, detailed analysis with specific statistics and trends. Focus on actionable insights for betting decisions.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional sports matchup analyst providing comprehensive game breakdowns with statistical analysis, betting trends, and tactical insights. Always return valid JSON with detailed matchup data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0].message.content;
    const parsedData = JSON.parse(content);

    console.log(`OpenAI returned ${parsedData.matchups?.length || 0} matchup analyses`);

    // Process and store each matchup
    const results = [];
    const matchups = parsedData.matchups || [];

    for (const matchup of matchups) {
      const matchupData: MatchupData = {
        event_id: matchup.event_id || event_id || `${league}-${matchup.home_team}-${matchup.away_team}-${new Date().getTime()}`,
        sport: matchup.sport || sport,
        league: matchup.league || league,
        home_team: matchup.home_team || home_team,
        away_team: matchup.away_team || away_team,
        game_date: matchup.game_date || game_date || new Date().toISOString(),
        h2h_history: matchup.h2h_history,
        home_team_recent_form: matchup.home_team_recent_form,
        away_team_recent_form: matchup.away_team_recent_form,
        key_player_matchups: matchup.key_player_matchups,
        coaching_matchup: matchup.coaching_matchup,
        tactical_analysis: matchup.tactical_analysis,
        statistical_edges: matchup.statistical_edges,
        betting_trends: matchup.betting_trends,
        situational_trends: matchup.situational_trends || [],
        weather_impact: matchup.weather_impact,
        venue_advantages: matchup.venue_advantages || [],
        ai_prediction: matchup.ai_prediction,
        source_urls: matchup.source_urls || [],
        data_quality: matchup.data_quality || 'comprehensive',
      };

      // Upsert the matchup analysis
      const { data: upsertData, error } = await supabase
        .from('matchup_analysis')
        .upsert(matchupData, {
          onConflict: 'event_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting matchup:', error);
      } else {
        results.push(upsertData);

        // Also update/insert historical matchup data
        if (matchup.h2h_history) {
          const h2h = matchup.h2h_history;
          const [team1, team2] = [matchup.home_team, matchup.away_team].sort();

          const historicalData = {
            sport: matchupData.sport,
            league: matchupData.league,
            team_1: team1,
            team_2: team2,
            total_games: h2h.total_games || 0,
            team_1_wins: team1 === matchup.home_team ? h2h.home_team_wins : h2h.away_team_wins,
            team_2_wins: team2 === matchup.home_team ? h2h.home_team_wins : h2h.away_team_wins,
            last_5_results: h2h.last_5_meetings || [],
            team_1_ats_record: team1 === matchup.home_team ? h2h.home_team_ats : h2h.away_team_ats,
            team_2_ats_record: team2 === matchup.home_team ? h2h.home_team_ats : h2h.away_team_ats,
            over_under_record: h2h.over_under,
          };

          const { error: h2hError } = await supabase
            .from('historical_matchups')
            .upsert(historicalData, {
              onConflict: 'sport,league,team_1,team_2',
              ignoreDuplicates: false
            });

          if (h2hError) {
            console.error('Error storing historical matchup:', h2hError);
          }
        }
      }
    }

    console.log(`Successfully processed ${results.length} matchup analyses`);

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        matchups: results,
        source: 'OpenAI + Comprehensive Analysis',
        raw_response: parsedData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error scraping matchups:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
