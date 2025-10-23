import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stadium/venue coordinates for NFL, MLB, and MLS teams
const VENUE_COORDINATES: Record<string, { lat: number; lon: number; venue: string }> = {
  // NFL
  'Buffalo Bills': { lat: 42.7738, lon: -78.7870, venue: 'Highmark Stadium' },
  'Miami Dolphins': { lat: 25.9580, lon: -80.2389, venue: 'Hard Rock Stadium' },
  'New England Patriots': { lat: 42.0909, lon: -71.2643, venue: 'Gillette Stadium' },
  'New York Jets': { lat: 40.8135, lon: -74.0745, venue: 'MetLife Stadium' },
  'Green Bay Packers': { lat: 44.5013, lon: -88.0622, venue: 'Lambeau Field' },
  'Chicago Bears': { lat: 41.8623, lon: -87.6167, venue: 'Soldier Field' },
  'Kansas City Chiefs': { lat: 39.0489, lon: -94.4839, venue: 'Arrowhead Stadium' },
  'Las Vegas Raiders': { lat: 36.0908, lon: -115.1833, venue: 'Allegiant Stadium' },
  'Denver Broncos': { lat: 39.7439, lon: -105.0201, venue: 'Empower Field' },
  'Dallas Cowboys': { lat: 32.7473, lon: -97.0945, venue: 'AT&T Stadium' },
  'Philadelphia Eagles': { lat: 39.9008, lon: -75.1675, venue: 'Lincoln Financial Field' },
  'Seattle Seahawks': { lat: 47.5952, lon: -122.3316, venue: 'Lumen Field' },
  'San Francisco 49ers': { lat: 37.4030, lon: -121.9697, venue: "Levi's Stadium" },

  // MLB (outdoor stadiums)
  'Boston Red Sox': { lat: 42.3467, lon: -71.0972, venue: 'Fenway Park' },
  'New York Yankees': { lat: 40.8296, lon: -73.9262, venue: 'Yankee Stadium' },
  'Chicago Cubs': { lat: 41.9484, lon: -87.6553, venue: 'Wrigley Field' },
  'Los Angeles Dodgers': { lat: 34.0739, lon: -118.2400, venue: 'Dodger Stadium' },
  'San Francisco Giants': { lat: 37.7786, lon: -122.3893, venue: 'Oracle Park' },
  'Colorado Rockies': { lat: 39.7559, lon: -104.9942, venue: 'Coors Field' },

  // MLS (outdoor)
  'Seattle Sounders': { lat: 47.5952, lon: -122.3316, venue: 'Lumen Field' },
  'Portland Timbers': { lat: 45.5215, lon: -122.6919, venue: 'Providence Park' },
  'LA Galaxy': { lat: 33.8644, lon: -118.2611, venue: 'Dignity Health Sports Park' }
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
