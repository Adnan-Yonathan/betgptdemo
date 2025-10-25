/**
 * Comprehensive Kalshi Integration Test Script
 * Tests all components of the Kalshi integration to identify issues
 */

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dskfsnbdgyjizoaafqfk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRza2ZzbmJkZ3lqaXpvYWFmcWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODkwMTIsImV4cCI6MjA3NjQ2NTAxMn0.I9tilT4RzFlB21iy2xL7O2ttv_XDAfFNiMZbnzFTJlA';

const KALSHI_BASE_URL = 'https://trading-api.kalshi.com/trade-api/v2';
const KALSHI_EMAIL = process.env.KALSHI_EMAIL;
const KALSHI_PASSWORD = process.env.KALSHI_PASSWORD;

const results = [];

function log(message) {
  console.log(`[TEST] ${message}`);
}

function addResult(result) {
  results.push(result);
  const emoji = {
    'PASS': '✅',
    'FAIL': '❌',
    'SKIP': '⏭️ ',
    'WARN': '⚠️ ',
  }[result.status];

  console.log(`${emoji} ${result.test}: ${result.message}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
}

// ============================================================================
// TEST 1: Environment Variables
// ============================================================================

async function testEnvironmentVariables() {
  log('Testing environment variables...');

  const requiredVars = {
    'SUPABASE_URL': SUPABASE_URL,
    'SUPABASE_ANON_KEY': SUPABASE_ANON_KEY,
    'KALSHI_EMAIL': KALSHI_EMAIL,
    'KALSHI_PASSWORD': KALSHI_PASSWORD,
  };

  for (const [name, value] of Object.entries(requiredVars)) {
    if (value) {
      addResult({
        test: `Env: ${name}`,
        status: 'PASS',
        message: 'Found',
        details: name.includes('KEY') || name.includes('PASSWORD')
          ? '***hidden***'
          : value.substring(0, 30) + '...',
      });
    } else {
      addResult({
        test: `Env: ${name}`,
        status: name.includes('KALSHI') ? 'WARN' : 'FAIL',
        message: 'Not found',
        error: `${name} is not set`,
      });
    }
  }
}

// ============================================================================
// TEST 2: Kalshi API - Public Endpoint
// ============================================================================

async function testKalshiPublicAPI() {
  log('Testing Kalshi public API endpoint...');

  try {
    const response = await fetch(`${KALSHI_BASE_URL}/exchange/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      addResult({
        test: 'Kalshi Public API',
        status: 'PASS',
        message: 'Exchange status endpoint accessible',
        details: data,
      });
      return true;
    } else {
      addResult({
        test: 'Kalshi Public API',
        status: 'FAIL',
        message: `Status ${response.status}`,
        error: JSON.stringify(data),
      });
      return false;
    }
  } catch (error) {
    addResult({
      test: 'Kalshi Public API',
      status: 'FAIL',
      message: 'Request failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ============================================================================
// TEST 3: Kalshi Authentication
// ============================================================================

async function testKalshiAuthentication() {
  if (!KALSHI_EMAIL || !KALSHI_PASSWORD) {
    addResult({
      test: 'Kalshi Authentication',
      status: 'SKIP',
      message: 'Credentials not provided',
      error: 'Set KALSHI_EMAIL and KALSHI_PASSWORD to test',
    });
    return null;
  }

  log('Testing Kalshi authentication...');

  try {
    const response = await fetch(`${KALSHI_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email: KALSHI_EMAIL,
        password: KALSHI_PASSWORD,
      }),
    });

    const data = await response.json();

    if (response.ok && data.token) {
      addResult({
        test: 'Kalshi Authentication',
        status: 'PASS',
        message: 'Login successful',
        details: {
          member_id: data.member_id,
          token_length: data.token.length,
        },
      });
      return data.token;
    } else {
      addResult({
        test: 'Kalshi Authentication',
        status: 'FAIL',
        message: 'Login failed',
        error: JSON.stringify(data),
      });
      return null;
    }
  } catch (error) {
    addResult({
      test: 'Kalshi Authentication',
      status: 'FAIL',
      message: 'Login request failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// TEST 4: Kalshi Markets API
// ============================================================================

async function testKalshiMarketsAPI(token) {
  log('Testing Kalshi markets API...');

  try {
    const response = await fetch(`${KALSHI_BASE_URL}/markets?limit=5&status=open`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok && data.markets) {
      const sportsMarkets = data.markets.filter(m =>
        ['NBA', 'NFL', 'MLB', 'NHL'].some(sport =>
          m.ticker?.includes(sport) || m.series_ticker?.includes(sport)
        )
      );

      addResult({
        test: 'Kalshi Markets API',
        status: 'PASS',
        message: `Fetched ${data.markets.length} markets (${sportsMarkets.length} sports)`,
        details: {
          total: data.markets.length,
          sports: sportsMarkets.length,
          sample: data.markets.slice(0, 2).map(m => ({
            ticker: m.ticker,
            title: m.title,
            yes_ask: m.yes_ask,
          })),
        },
      });
    } else {
      addResult({
        test: 'Kalshi Markets API',
        status: 'FAIL',
        message: `Status ${response.status}`,
        error: JSON.stringify(data),
      });
    }
  } catch (error) {
    addResult({
      test: 'Kalshi Markets API',
      status: 'FAIL',
      message: 'Request failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// TEST 5: Edge Functions
// ============================================================================

async function testEdgeFunctions() {
  log('Testing edge functions...');

  const functions = [
    'test-kalshi-connection',
    'fetch-kalshi-markets',
    'analyze-kalshi-market',
  ];

  for (const func of functions) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/${func}`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      const text = await response.text();

      if (response.ok) {
        addResult({
          test: `Function: ${func}`,
          status: 'PASS',
          message: 'Deployed and accessible',
        });
      } else if (text === 'Access denied') {
        addResult({
          test: `Function: ${func}`,
          status: 'FAIL',
          message: 'Not deployed',
          error: 'Function returns "Access denied"',
        });
      } else {
        addResult({
          test: `Function: ${func}`,
          status: 'WARN',
          message: `Status ${response.status}`,
          details: text.substring(0, 200),
        });
      }
    } catch (error) {
      addResult({
        test: `Function: ${func}`,
        status: 'FAIL',
        message: 'Request failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('========================================');
  console.log('  KALSHI INTEGRATION TEST SUITE');
  console.log('========================================\n');

  // Run tests
  await testEnvironmentVariables();
  console.log('');

  const publicAPIWorks = await testKalshiPublicAPI();
  console.log('');

  let token = null;
  if (publicAPIWorks) {
    token = await testKalshiAuthentication();
    console.log('');
  }

  if (token) {
    await testKalshiMarketsAPI(token);
    console.log('');
  }

  await testEdgeFunctions();
  console.log('');

  // Summary
  console.log('========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`⏭️  Skipped: ${skipped}\n`);

  // Critical issues
  const criticalIssues = results.filter(r => r.status === 'FAIL');
  if (criticalIssues.length > 0) {
    console.log('========================================');
    console.log('  CRITICAL ISSUES');
    console.log('========================================\n');

    criticalIssues.forEach(issue => {
      console.log(`❌ ${issue.test}`);
      console.log(`   ${issue.message}`);
      if (issue.error) {
        console.log(`   Error: ${issue.error}`);
      }
      console.log('');
    });
  }

  // Recommendations
  console.log('========================================');
  console.log('  RECOMMENDATIONS');
  console.log('========================================\n');

  // Check for Kalshi credentials
  if (!KALSHI_EMAIL || !KALSHI_PASSWORD) {
    console.log('1. Set Kalshi credentials:');
    console.log('   export KALSHI_EMAIL="your-email@example.com"');
    console.log('   export KALSHI_PASSWORD="your-password"');
    console.log('   Then set them in Supabase:');
    console.log('   npx supabase secrets set KALSHI_EMAIL=your-email@example.com');
    console.log('   npx supabase secrets set KALSHI_PASSWORD=your-password');
    console.log('');
  }

  // Check for edge function deployment
  const edgeFunctionsFailed = results.some(r =>
    r.test.startsWith('Function:') && r.status === 'FAIL'
  );

  if (edgeFunctionsFailed) {
    console.log('2. Deploy edge functions:');
    console.log('   npx supabase login');
    console.log('   npx supabase link --project-ref dskfsnbdgyjizoaafqfk');
    console.log('   npx supabase functions deploy test-kalshi-connection');
    console.log('   npx supabase functions deploy fetch-kalshi-markets');
    console.log('   npx supabase functions deploy analyze-kalshi-market');
    console.log('');
  }

  console.log('========================================\n');

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
