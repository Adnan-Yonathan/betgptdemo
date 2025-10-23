/**
 * Test script for Phase 1: Betting Odds Data Testing
 *
 * This script will:
 * 1. Check current data in betting_odds table
 * 2. Call fetch-betting-odds for NFL
 * 3. Verify data was populated
 * 4. Test fetch-all-games
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dskfsnbdgyjizoaafqfk.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRza2ZzbmJkZ3lqaXpvYWFmcWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODkwMTIsImV4cCI6MjA3NjQ2NTAxMn0.I9tilT4RzFlB21iy2xL7O2ttv_XDAfFNiMZbnzFTJlA';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('='.repeat(80));
console.log('PHASE 1: BETTING ODDS DATA TESTING');
console.log('='.repeat(80));
console.log();

async function test() {
  try {
    // Step 1: Check current state of betting_odds table
    console.log('[TEST 1] Checking current betting_odds table data...');
    console.log('-'.repeat(80));

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Check NFL data for today
    const { data: nflData, error: nflError } = await supabase
      .from('betting_odds')
      .select('event_id, sport_key, home_team, away_team, commence_time')
      .eq('sport_key', 'americanfootball_nfl')
      .gte('commence_time', `${todayStr}T00:00:00.000Z`)
      .lte('commence_time', `${todayStr}T23:59:59.999Z`);

    if (nflError) {
      console.error('❌ Error querying NFL data:', nflError.message);
    } else {
      console.log(`✅ NFL games found for ${todayStr}: ${nflData?.length || 0}`);
      if (nflData && nflData.length > 0) {
        console.log('\nNFL Games:');
        nflData.forEach(game => {
          const gameTime = new Date(game.commence_time).toLocaleTimeString();
          console.log(`  - ${game.away_team} @ ${game.home_team} (${gameTime})`);
        });
      } else {
        console.log('  ⚠️  No NFL games found in database for today');
      }
    }
    console.log();

    // Check NBA data for today
    const { data: nbaData, error: nbaError } = await supabase
      .from('betting_odds')
      .select('event_id, sport_key, home_team, away_team, commence_time')
      .eq('sport_key', 'basketball_nba')
      .gte('commence_time', `${todayStr}T00:00:00.000Z`)
      .lte('commence_time', `${todayStr}T23:59:59.999Z`);

    if (nbaError) {
      console.error('❌ Error querying NBA data:', nbaError.message);
    } else {
      console.log(`✅ NBA games found for ${todayStr}: ${nbaData?.length || 0}`);
      if (nbaData && nbaData.length > 0) {
        console.log('\nNBA Games:');
        nbaData.slice(0, 5).forEach(game => {
          const gameTime = new Date(game.commence_time).toLocaleTimeString();
          console.log(`  - ${game.away_team} @ ${game.home_team} (${gameTime})`);
        });
        if (nbaData.length > 5) {
          console.log(`  ... and ${nbaData.length - 5} more`);
        }
      } else {
        console.log('  ⚠️  No NBA games found in database for today');
      }
    }
    console.log();
    console.log('='.repeat(80));

    // Step 2: Test fetch-betting-odds edge function for NFL
    console.log('[TEST 2] Calling fetch-betting-odds for NFL...');
    console.log('-'.repeat(80));
    console.log('⏳ Fetching NFL odds from The Odds API...');

    const { data: fetchResult, error: fetchError } = await supabase.functions.invoke('fetch-betting-odds', {
      body: {
        sport: 'americanfootball_nfl',
        regions: 'us',
        markets: 'h2h,spreads,totals'
      }
    });

    if (fetchError) {
      console.error('❌ Error calling fetch-betting-odds:', fetchError.message);
      console.log('\n⚠️  This likely means:');
      console.log('   1. The Odds API key is not configured');
      console.log('   2. The API key has no remaining quota');
      console.log('   3. The edge function is not deployed');
      console.log('   4. Network connectivity issues');
    } else {
      console.log('✅ fetch-betting-odds completed successfully!');
      console.log(`   - Events found: ${fetchResult.events || 0}`);
      console.log(`   - Odds entries: ${fetchResult.count || 0}`);
      console.log(`   - Line movements tracked: ${fetchResult.line_movements_tracked || 0}`);
      if (fetchResult.api_requests_remaining) {
        console.log(`   - API requests remaining: ${fetchResult.api_requests_remaining}`);
      }
    }
    console.log();
    console.log('='.repeat(80));

    // Step 3: Re-check betting_odds table to verify data was populated
    console.log('[TEST 3] Verifying NFL data was populated...');
    console.log('-'.repeat(80));

    // Wait a moment for data to be written
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: nflDataAfter, error: nflErrorAfter } = await supabase
      .from('betting_odds')
      .select('event_id, sport_key, home_team, away_team, commence_time, bookmaker, market_key, last_updated')
      .eq('sport_key', 'americanfootball_nfl')
      .gte('commence_time', `${todayStr}T00:00:00.000Z`)
      .lte('commence_time', `${todayStr}T23:59:59.999Z`)
      .order('commence_time', { ascending: true });

    if (nflErrorAfter) {
      console.error('❌ Error querying NFL data after fetch:', nflErrorAfter.message);
    } else {
      const uniqueGames = new Set(nflDataAfter?.map(d => d.event_id) || []);
      console.log(`✅ NFL games now in database: ${uniqueGames.size}`);
      console.log(`   Total odds entries: ${nflDataAfter?.length || 0}`);

      if (nflDataAfter && nflDataAfter.length > 0) {
        console.log('\nNFL Games with Odds:');
        const gameMap = new Map();
        nflDataAfter.forEach(odd => {
          if (!gameMap.has(odd.event_id)) {
            gameMap.set(odd.event_id, {
              home: odd.home_team,
              away: odd.away_team,
              time: odd.commence_time,
              bookmakers: new Set(),
              markets: new Set()
            });
          }
          gameMap.get(odd.event_id).bookmakers.add(odd.bookmaker);
          gameMap.get(odd.event_id).markets.add(odd.market_key);
        });

        gameMap.forEach((game, id) => {
          const gameTime = new Date(game.time).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          });
          console.log(`  - ${game.away} @ ${game.home}`);
          console.log(`    Time: ${gameTime}`);
          console.log(`    Bookmakers: ${game.bookmakers.size}`);
          console.log(`    Markets: ${Array.from(game.markets).join(', ')}`);
        });

        // Check for Vikings vs Chargers specifically
        const vikingsGame = nflDataAfter.find(
          odd => (odd.home_team.toLowerCase().includes('chargers') && odd.away_team.toLowerCase().includes('vikings')) ||
                 (odd.home_team.toLowerCase().includes('vikings') && odd.away_team.toLowerCase().includes('chargers'))
        );

        if (vikingsGame) {
          console.log('\n🎯 FOUND: Vikings vs Chargers game!');
          console.log(`   ${vikingsGame.away_team} @ ${vikingsGame.home_team}`);
          console.log(`   Time: ${new Date(vikingsGame.commence_time).toLocaleString()}`);
        } else {
          console.log('\n⚠️  Vikings vs Chargers game not found');
          console.log('   This could mean:');
          console.log('   - The game is not scheduled for today (Oct 23)');
          console.log('   - The Odds API does not have this game yet');
          console.log('   - Team names in API differ from expected');
        }
      } else {
        console.log('⚠️  Still no NFL data found after fetch');
        console.log('   This confirms the fetch-betting-odds function may have failed');
      }
    }
    console.log();
    console.log('='.repeat(80));

    // Step 4: Test fetch-all-games edge function
    console.log('[TEST 4] Testing fetch-all-games endpoint...');
    console.log('-'.repeat(80));

    const { data: gamesResult, error: gamesError } = await supabase.functions.invoke('fetch-all-games', {
      body: {
        dateRange: 'today',
        sport: 'americanfootball_nfl'
      }
    });

    if (gamesError) {
      console.error('❌ Error calling fetch-all-games:', gamesError.message);
    } else {
      console.log('✅ fetch-all-games completed successfully!');
      console.log(`   - Games returned: ${gamesResult.games?.length || 0}`);

      if (gamesResult.games && gamesResult.games.length > 0) {
        console.log('\nGames from fetch-all-games:');
        gamesResult.games.forEach(game => {
          const gameTime = new Date(game.game_date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          console.log(`  - ${game.away_team} @ ${game.home_team} (${gameTime})`);
          console.log(`    League: ${game.league}`);
          console.log(`    Odds entries: ${game.odds?.length || 0}`);
          if (game.ai_recommendation) {
            console.log(`    AI Pick: ${game.ai_recommendation.pick} (${game.ai_recommendation.edge}% EV)`);
          }
        });

        // Check for Vikings vs Chargers
        const vikingsGame = gamesResult.games.find(
          game => (game.home_team?.toLowerCase().includes('chargers') && game.away_team?.toLowerCase().includes('vikings')) ||
                  (game.home_team?.toLowerCase().includes('vikings') && game.away_team?.toLowerCase().includes('chargers'))
        );

        if (vikingsGame) {
          console.log('\n🎯 SUCCESS: Vikings vs Chargers appears in fetch-all-games!');
        } else {
          console.log('\n⚠️  Vikings vs Chargers NOT in fetch-all-games results');
        }
      } else {
        console.log('⚠️  No games returned from fetch-all-games');
        console.log('   This confirms the Games dashboard would be empty');
      }
    }
    console.log();
    console.log('='.repeat(80));

    // Summary
    console.log('[SUMMARY] Phase 1 Test Results');
    console.log('-'.repeat(80));
    console.log(`NBA Data Present: ${(nbaData?.length || 0) > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`NFL Data Present (before): ${(nflData?.length || 0) > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`fetch-betting-odds works: ${!fetchError ? '✅ YES' : '❌ NO'}`);
    console.log(`NFL Data Present (after): ${(nflDataAfter?.length || 0) > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`fetch-all-games works: ${!gamesError ? '✅ YES' : '❌ NO'}`);
    console.log();

    console.log('[CONCLUSION]');
    if (fetchError) {
      console.log('❌ Root cause confirmed: fetch-betting-odds is not working properly');
      console.log('   Action needed: Fix API key configuration or quota issues');
    } else if ((nflData?.length || 0) === 0 && (nflDataAfter?.length || 0) > 0) {
      console.log('✅ Root cause confirmed: No automated data fetching');
      console.log('   The API works, but data only appears when manually fetched');
      console.log('   Solution: Implement Phase 2 (Automated Cron Job)');
    } else if ((nflDataAfter?.length || 0) === 0) {
      console.log('⚠️  NFL data still not present after fetch');
      console.log('   This could mean the game is not available in The Odds API yet');
      console.log('   Or there may be an issue with the API response');
    } else {
      console.log('✅ System is working as designed');
      console.log('   But still needs automated fetching for better UX');
    }

    console.log();
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error);
  }
}

// Run the test
test().then(() => {
  console.log('\n✅ Phase 1 testing complete\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
