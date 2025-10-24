/**
 * Test script to evaluate BALLDONTLIE API
 *
 * This script tests various endpoints to assess:
 * - Data availability and quality
 * - Response times
 * - API structure and usability
 * - Comparison with ESPN API requirements
 */

const BASE_URL = 'https://api.balldontlie.io/v1';

// Helper function to make API requests
async function makeRequest(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

  const startTime = Date.now();

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      }
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime
      };
    }

    const data = await response.json();

    return {
      success: true,
      status: response.status,
      data,
      responseTime,
      dataSize: JSON.stringify(data).length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

// Test functions
async function testPlayers() {
  console.log('\n=== TESTING PLAYERS ENDPOINT ===');

  // Test: Get first page of players
  const result1 = await makeRequest('/players', { per_page: 10 });
  console.log('✓ Get players (10 records):', {
    success: result1.success,
    status: result1.status,
    responseTime: `${result1.responseTime}ms`,
    recordsReturned: result1.data?.data?.length || 0,
    hasMetadata: !!result1.data?.meta
  });

  if (result1.success && result1.data?.data?.length > 0) {
    const samplePlayer = result1.data.data[0];
    console.log('\nSample Player Data Structure:');
    console.log(JSON.stringify(samplePlayer, null, 2));
  }

  // Test: Search for a specific player
  const result2 = await makeRequest('/players', { search: 'LeBron' });
  console.log('\n✓ Search for "LeBron":', {
    success: result2.success,
    responseTime: `${result2.responseTime}ms`,
    playersFound: result2.data?.data?.length || 0
  });

  if (result2.success && result2.data?.data?.length > 0) {
    console.log('Players found:', result2.data.data.map(p => ({
      name: `${p.first_name} ${p.last_name}`,
      team: p.team?.full_name,
      position: p.position
    })));
  }

  return result1;
}

async function testTeams() {
  console.log('\n=== TESTING TEAMS ENDPOINT ===');

  const result = await makeRequest('/teams');
  console.log('✓ Get all teams:', {
    success: result.success,
    status: result.status,
    responseTime: `${result.responseTime}ms`,
    teamsReturned: result.data?.data?.length || 0
  });

  if (result.success && result.data?.data?.length > 0) {
    const sampleTeam = result.data.data[0];
    console.log('\nSample Team Data Structure:');
    console.log(JSON.stringify(sampleTeam, null, 2));

    console.log('\nAll NBA Teams:');
    result.data.data.forEach(team => {
      console.log(`  - ${team.full_name} (${team.abbreviation}) - ${team.city}`);
    });
  }

  return result;
}

async function testGames() {
  console.log('\n=== TESTING GAMES ENDPOINT ===');

  // Get today's date
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  // Test: Get games from a recent date
  const result1 = await makeRequest('/games', {
    dates: [dateStr],
    per_page: 10
  });

  console.log(`✓ Get games for ${dateStr}:`, {
    success: result1.success,
    status: result1.status,
    responseTime: `${result1.responseTime}ms`,
    gamesFound: result1.data?.data?.length || 0
  });

  // Try yesterday if no games today
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const result2 = await makeRequest('/games', {
    dates: [yesterdayStr],
    per_page: 10
  });

  console.log(`✓ Get games for ${yesterdayStr}:`, {
    success: result2.success,
    responseTime: `${result2.responseTime}ms`,
    gamesFound: result2.data?.data?.length || 0
  });

  // Try a date from the current season with guaranteed games
  const seasonDate = '2024-12-15';
  const result3 = await makeRequest('/games', {
    dates: [seasonDate],
    per_page: 10
  });

  console.log(`✓ Get games for ${seasonDate}:`, {
    success: result3.success,
    responseTime: `${result3.responseTime}ms`,
    gamesFound: result3.data?.data?.length || 0
  });

  if (result3.success && result3.data?.data?.length > 0) {
    const sampleGame = result3.data.data[0];
    console.log('\nSample Game Data Structure:');
    console.log(JSON.stringify(sampleGame, null, 2));
  }

  return result3;
}

async function testStats() {
  console.log('\n=== TESTING STATS ENDPOINT ===');

  // Get stats from a specific date
  const seasonDate = '2024-12-15';

  const result = await makeRequest('/stats', {
    dates: [seasonDate],
    per_page: 25
  });

  console.log(`✓ Get stats for ${seasonDate}:`, {
    success: result.success,
    status: result.status,
    responseTime: `${result.responseTime}ms`,
    statsReturned: result.data?.data?.length || 0
  });

  if (result.success && result.data?.data?.length > 0) {
    const sampleStat = result.data.data[0];
    console.log('\nSample Stats Data Structure:');
    console.log(JSON.stringify(sampleStat, null, 2));

    console.log('\nSample Player Performance:');
    result.data.data.slice(0, 5).forEach(stat => {
      console.log(`  ${stat.player?.first_name} ${stat.player?.last_name} (${stat.team?.abbreviation}): ${stat.pts} pts, ${stat.reb} reb, ${stat.ast} ast`);
    });
  }

  return result;
}

async function testSeasonAverages() {
  console.log('\n=== TESTING SEASON AVERAGES ENDPOINT ===');

  // This endpoint might require authentication
  const result = await makeRequest('/season_averages', {
    season: 2024,
    player_ids: [237] // LeBron James ID (example)
  });

  console.log('✓ Get season averages:', {
    success: result.success,
    status: result.status,
    responseTime: `${result.responseTime}ms`,
    error: result.error || 'None'
  });

  if (result.success && result.data?.data) {
    console.log('\nSeason Averages Data:');
    console.log(JSON.stringify(result.data, null, 2));
  }

  return result;
}

async function testRateLimits() {
  console.log('\n=== TESTING RATE LIMITS ===');

  const requests = [];
  const numRequests = 5;

  console.log(`Making ${numRequests} concurrent requests...`);

  for (let i = 0; i < numRequests; i++) {
    requests.push(makeRequest('/teams'));
  }

  const results = await Promise.all(requests);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

  console.log('✓ Concurrent requests results:', {
    total: numRequests,
    successful,
    failed,
    avgResponseTime: `${avgResponseTime.toFixed(0)}ms`
  });

  if (failed > 0) {
    console.log('Failed requests:', results.filter(r => !r.success).map(r => ({
      status: r.status,
      error: r.error
    })));
  }
}

// Main test execution
async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        BALLDONTLIE API EVALUATION TEST SUITE            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\nAPI Base URL:', BASE_URL);
  console.log('Test Date:', new Date().toISOString());

  try {
    const playersResult = await testPlayers();
    const teamsResult = await testTeams();
    const gamesResult = await testGames();
    const statsResult = await testStats();
    const seasonAvgResult = await testSeasonAverages();
    await testRateLimits();

    // Summary
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    const endpoints = [
      { name: 'Players', result: playersResult },
      { name: 'Teams', result: teamsResult },
      { name: 'Games', result: gamesResult },
      { name: 'Stats', result: statsResult },
      { name: 'Season Averages', result: seasonAvgResult }
    ];

    endpoints.forEach(({ name, result }) => {
      const status = result.success ? '✅ PASSED' : '❌ FAILED';
      const time = result.responseTime ? `${result.responseTime}ms` : 'N/A';
      console.log(`${status} - ${name.padEnd(20)} Response Time: ${time}`);
    });

    console.log('\n--- Data Quality Assessment ---');
    console.log('Players endpoint provides:', playersResult.success ? '✓ Player info with team and position' : '✗ Not accessible');
    console.log('Teams endpoint provides:', teamsResult.success ? '✓ Full team roster' : '✗ Not accessible');
    console.log('Games endpoint provides:', gamesResult.success ? '✓ Game schedules and scores' : '✗ Not accessible');
    console.log('Stats endpoint provides:', statsResult.success ? '✓ Detailed player statistics' : '✗ Not accessible');
    console.log('Season Averages:', seasonAvgResult.success ? '✓ Available' : '✗ May require API key');

    console.log('\n--- Comparison with ESPN API Requirements ---');
    const requirements = [
      { feature: 'Player identification', status: playersResult.success ? '✅' : '❌' },
      { feature: 'Team information', status: teamsResult.success ? '✅' : '❌' },
      { feature: 'Game scores', status: gamesResult.success ? '✅' : '❌' },
      { feature: 'Player stats (pts, reb, ast)', status: statsResult.success ? '✅' : '❌' },
      { feature: 'Historical data', status: statsResult.success ? '✅' : '❌' },
      { feature: 'Season averages', status: seasonAvgResult.success ? '✅' : '⚠️  (May need auth)' },
    ];

    requirements.forEach(({ feature, status }) => {
      console.log(`${status} ${feature}`);
    });

  } catch (error) {
    console.error('\n❌ Test suite encountered an error:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test execution completed.');
  console.log('='.repeat(60) + '\n');
}

// Run the tests
runAllTests().catch(console.error);
