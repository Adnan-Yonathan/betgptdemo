import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stadium/venue coordinates for NFL, NCAAF, and NHL teams
const VENUE_COORDINATES: Record<string, { lat: number; lon: number; venue: string }> = {
  // NFL
  'Buffalo Bills': { lat: 42.7738, lon: -78.7870, venue: 'Highmark Stadium' },
  'Miami Dolphins': { lat: 25.9580, lon: -80.2389, venue: 'Hard Rock Stadium' },
  'New England Patriots': { lat: 42.0909, lon: -71.2643, venue: 'Gillette Stadium' },
  'New York Jets': { lat: 40.8135, lon: -74.0745, venue: 'MetLife Stadium' },
  'New York Giants': { lat: 40.8135, lon: -74.0745, venue: 'MetLife Stadium' },
  'Green Bay Packers': { lat: 44.5013, lon: -88.0622, venue: 'Lambeau Field' },
  'Chicago Bears': { lat: 41.8623, lon: -87.6167, venue: 'Soldier Field' },
  'Kansas City Chiefs': { lat: 39.0489, lon: -94.4839, venue: 'Arrowhead Stadium' },
  'Las Vegas Raiders': { lat: 36.0908, lon: -115.1833, venue: 'Allegiant Stadium' },
  'Denver Broncos': { lat: 39.7439, lon: -105.0201, venue: 'Empower Field' },
  'Dallas Cowboys': { lat: 32.7473, lon: -97.0945, venue: 'AT&T Stadium' },
  'Philadelphia Eagles': { lat: 39.9008, lon: -75.1675, venue: 'Lincoln Financial Field' },
  'Seattle Seahawks': { lat: 47.5952, lon: -122.3316, venue: 'Lumen Field' },
  'San Francisco 49ers': { lat: 37.4030, lon: -121.9697, venue: "Levi's Stadium" },
  'Pittsburgh Steelers': { lat: 40.4468, lon: -80.0158, venue: 'Acrisure Stadium' },
  'Cleveland Browns': { lat: 41.5061, lon: -81.6995, venue: 'Cleveland Browns Stadium' },
  'Baltimore Ravens': { lat: 39.2780, lon: -76.6227, venue: 'M&T Bank Stadium' },
  'Cincinnati Bengals': { lat: 39.0954, lon: -84.5160, venue: 'Paycor Stadium' },

  // College Football (Major Programs)
  'Alabama': { lat: 33.2082, lon: -87.5502, venue: 'Bryant-Denny Stadium' },
  'Georgia': { lat: 33.9496, lon: -83.3732, venue: 'Sanford Stadium' },
  'Ohio State': { lat: 40.0018, lon: -83.0197, venue: 'Ohio Stadium' },
  'Michigan': { lat: 42.2658, lon: -83.7486, venue: 'Michigan Stadium' },
  'Penn State': { lat: 40.8122, lon: -77.8563, venue: 'Beaver Stadium' },
  'Texas': { lat: 30.2839, lon: -97.7323, venue: 'Darrell K Royal Stadium' },
  'Oklahoma': { lat: 35.2055, lon: -97.4428, venue: 'Gaylord Family Oklahoma Memorial Stadium' },
  'USC': { lat: 34.0141, lon: -118.2879, venue: 'Los Angeles Memorial Coliseum' },
  'Notre Dame': { lat: 41.6990, lon: -86.2346, venue: 'Notre Dame Stadium' },
  'Clemson': { lat: 34.6782, lon: -82.8437, venue: 'Memorial Stadium' },
  'Florida': { lat: 29.6499, lon: -82.3487, venue: 'Ben Hill Griffin Stadium' },
  'LSU': { lat: 30.4121, lon: -91.1838, venue: 'Tiger Stadium' },
  'Tennessee': { lat: 35.9550, lon: -83.9252, venue: 'Neyland Stadium' },
  'Auburn': { lat: 32.6033, lon: -85.4894, venue: 'Jordan-Hare Stadium' },
  'Texas A&M': { lat: 30.6100, lon: -96.3403, venue: 'Kyle Field' },

  // NHL (outdoor games/winter classics)
  'Boston Bruins': { lat: 42.3662, lon: -71.0621, venue: 'TD Garden' },
  'New York Rangers': { lat: 40.7505, lon: -73.9934, venue: 'Madison Square Garden' },
  'Chicago Blackhawks': { lat: 41.8807, lon: -87.6742, venue: 'United Center' },
  'Detroit Red Wings': { lat: 42.3411, lon: -83.0552, venue: 'Little Caesars Arena' },
  'Toronto Maple Leafs': { lat: 43.6435, lon: -79.3791, venue: 'Scotiabank Arena' },
  'Montreal Canadiens': { lat: 45.4961, lon: -73.5693, venue: 'Bell Centre' },
  'Pittsburgh Penguins': { lat: 40.4394, lon: -79.9892, venue: 'PPG Paints Arena' },
  'Washington Capitals': { lat: 38.8981, lon: -77.0209, venue: 'Capital One Arena' },
  'Philadelphia Flyers': { lat: 39.9012, lon: -75.1720, venue: 'Wells Fargo Center' },
  'Edmonton Oilers': { lat: 53.5467, lon: -113.4969, venue: 'Rogers Place' },
  'Calgary Flames': { lat: 51.0375, lon: -114.0519, venue: 'Scotiabank Saddledome' },
  'Vancouver Canucks': { lat: 49.2778, lon: -123.1089, venue: 'Rogers Arena' },
  'Colorado Avalanche': { lat: 39.7487, lon: -105.0077, venue: 'Ball Arena' },
  'Minnesota Wild': { lat: 44.9447, lon: -93.1011, venue: 'Xcel Energy Center' }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_id, home_team, game_date } = await req.json();

    console.log(`[fetch-weather-data] Fetching weather for ${home_team} on ${game_date}`);

    // Get coordinates for the venue
    const venueData = VENUE_COORDINATES[home_team];
    if (!venueData) {
      console.log(`[fetch-weather-data] No venue data for ${home_team}`);
      return new Response(
        JSON.stringify({ message: 'No venue data available for this team' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenWeatherMap API
    const weatherApiKey = Deno.env.get('OPENWEATHER_API_KEY');
    if (!weatherApiKey) {
      console.log('[fetch-weather-data] No OpenWeatherMap API key configured');
      // Return mock data for development
      return new Response(
        JSON.stringify({
          weather: {
            temperature: 68,
            feels_like: 65,
            wind_speed: 12,
            wind_direction: 'NW',
            precipitation_prob: 15,
            humidity: 45,
            description: 'Partly cloudy',
            icon: '02d'
          },
          message: 'Mock weather data (no API key configured)'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if we need current weather or forecast
    const gameDateTime = new Date(game_date);
    const now = new Date();
    const hoursUntilGame = (gameDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    let weatherData;

    if (hoursUntilGame < 0) {
      // Game already happened - get historical (not available in free tier)
      console.log('[fetch-weather-data] Game already occurred, no historical data available');
      return new Response(
        JSON.stringify({ message: 'Game already occurred' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (hoursUntilGame <= 48) {
      // Use current weather API
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${venueData.lat}&lon=${venueData.lon}&appid=${weatherApiKey}&units=imperial`
      );

      if (!response.ok) {
        throw new Error(`OpenWeatherMap API error: ${response.status}`);
      }

      const data = await response.json();
      weatherData = {
        temperature: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        wind_speed: Math.round(data.wind.speed),
        wind_direction: degreesToCardinal(data.wind.deg),
        precipitation_prob: 0, // Not available in current weather
        humidity: data.main.humidity,
        description: data.weather[0].description,
        icon: data.weather[0].icon
      };
    } else if (hoursUntilGame <= 120) {
      // Use 5-day forecast API (3-hour intervals)
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${venueData.lat}&lon=${venueData.lon}&appid=${weatherApiKey}&units=imperial`
      );

      if (!response.ok) {
        throw new Error(`OpenWeatherMap API error: ${response.status}`);
      }

      const data = await response.json();

      // Find the forecast closest to game time
      const forecasts = data.list;
      const closestForecast = forecasts.reduce((closest: any, current: any) => {
        const currentTime = new Date(current.dt * 1000);
        const closestTime = new Date(closest.dt * 1000);
        const currentDiff = Math.abs(currentTime.getTime() - gameDateTime.getTime());
        const closestDiff = Math.abs(closestTime.getTime() - gameDateTime.getTime());
        return currentDiff < closestDiff ? current : closest;
      });

      weatherData = {
        temperature: Math.round(closestForecast.main.temp),
        feels_like: Math.round(closestForecast.main.feels_like),
        wind_speed: Math.round(closestForecast.wind.speed),
        wind_direction: degreesToCardinal(closestForecast.wind.deg),
        precipitation_prob: Math.round((closestForecast.pop || 0) * 100),
        humidity: closestForecast.main.humidity,
        description: closestForecast.weather[0].description,
        icon: closestForecast.weather[0].icon
      };
    } else {
      return new Response(
        JSON.stringify({ message: 'Game too far in future for weather forecast' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store weather data in matchup_analysis table
    if (event_id) {
      await supabase
        .from('matchup_analysis')
        .upsert({
          event_id,
          home_team,
          game_date,
          weather_impact: weatherData,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'event_id',
          ignoreDuplicates: false
        });
    }

    console.log(`[fetch-weather-data] Weather: ${weatherData.temperature}°F, ${weatherData.description}`);

    return new Response(
      JSON.stringify({
        weather: weatherData,
        venue: venueData.venue,
        coordinates: { lat: venueData.lat, lon: venueData.lon }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("fetch-weather-data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function degreesToCardinal(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}
