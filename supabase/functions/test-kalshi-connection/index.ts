import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// KALSHI API TEST
// ============================================================================

const KALSHI_API_KEY = Deno.env.get('KALSHI_API_KEY');
const KALSHI_PRIVATE_KEY = Deno.env.get('KALSHI_PRIVATE_KEY');
const KALSHI_EMAIL = Deno.env.get('KALSHI_EMAIL');
const KALSHI_PASSWORD = Deno.env.get('KALSHI_PASSWORD');

const BASE_URL = 'https://trading-api.kalshi.com/trade-api/v2';

interface KalshiLoginResponse {
  token?: string;
  member_id?: string;
  error?: string;
}

/**
 * Test Kalshi API connection and authentication
 */
async function testKalshiConnection() {
  const results: any = {
    timestamp: new Date().toISOString(),
    credentials_found: {
      api_key: !!KALSHI_API_KEY,
      private_key: !!KALSHI_PRIVATE_KEY,
      email: !!KALSHI_EMAIL,
      password: !!KALSHI_PASSWORD,
    },
    tests: {},
  };

  // Test 1: Exchange Status (Public endpoint - no auth required)
  try {
    console.log('[TEST 1] Testing public exchange status endpoint...');
    const statusResponse = await fetch(`${BASE_URL}/exchange/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const statusData = await statusResponse.json();
    results.tests.exchange_status = {
      success: statusResponse.ok,
      status: statusResponse.status,
      data: statusData,
    };
    console.log('[TEST 1] Result:', statusResponse.ok ? 'SUCCESS' : 'FAILED');
  } catch (error) {
    results.tests.exchange_status = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    console.error('[TEST 1] Error:', error);
  }

  // Test 2: Login with email/password (if available)
  if (KALSHI_EMAIL && KALSHI_PASSWORD) {
    try {
      console.log('[TEST 2] Testing login with email/password...');
      const loginResponse = await fetch(`${BASE_URL}/login`, {
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

      const loginData: KalshiLoginResponse = await loginResponse.json();
      results.tests.login = {
        success: loginResponse.ok && !!loginData.token,
        status: loginResponse.status,
        has_token: !!loginData.token,
        member_id: loginData.member_id,
      };
      console.log('[TEST 2] Result:', loginResponse.ok ? 'SUCCESS' : 'FAILED');

      // Test 3: Fetch markets with token (if login succeeded)
      if (loginData.token) {
        try {
          console.log('[TEST 3] Testing authenticated markets endpoint...');
          const marketsResponse = await fetch(`${BASE_URL}/markets?limit=5&status=open`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${loginData.token}`,
              'Accept': 'application/json',
            },
          });

          const marketsData = await marketsResponse.json();
          results.tests.markets = {
            success: marketsResponse.ok,
            status: marketsResponse.status,
            market_count: marketsData.markets?.length || 0,
            sample_market: marketsData.markets?.[0]?.ticker || null,
          };
          console.log('[TEST 3] Result:', marketsResponse.ok ? 'SUCCESS' : 'FAILED');
        } catch (error) {
          results.tests.markets = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
          console.error('[TEST 3] Error:', error);
        }
      }
    } catch (error) {
      results.tests.login = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      console.error('[TEST 2] Error:', error);
    }
  } else {
    results.tests.login = {
      success: false,
      error: 'Email or password not found in environment',
    };
    console.log('[TEST 2] Skipped - no credentials');
  }

  // Test 4: API Key authentication (if available)
  if (KALSHI_API_KEY) {
    try {
      console.log('[TEST 4] Testing API key authentication...');
      const apiKeyResponse = await fetch(`${BASE_URL}/markets?limit=5`, {
        method: 'GET',
        headers: {
          'Authorization': KALSHI_API_KEY,
          'Accept': 'application/json',
        },
      });

      const apiKeyData = await apiKeyResponse.json();
      results.tests.api_key = {
        success: apiKeyResponse.ok,
        status: apiKeyResponse.status,
        data: apiKeyData,
      };
      console.log('[TEST 4] Result:', apiKeyResponse.ok ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      results.tests.api_key = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      console.error('[TEST 4] Error:', error);
    }
  } else {
    results.tests.api_key = {
      success: false,
      error: 'API key not found in environment',
    };
    console.log('[TEST 4] Skipped - no API key');
  }

  return results;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[KALSHI TEST] Starting connection tests...');
    const results = await testKalshiConnection();
    console.log('[KALSHI TEST] Tests complete');

    // Determine overall success
    const anySuccess = Object.values(results.tests).some(
      (test: any) => test.success === true
    );

    return new Response(
      JSON.stringify({
        success: anySuccess,
        message: anySuccess
          ? 'Kalshi API connection successful!'
          : 'All connection tests failed',
        results,
      }, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: anySuccess ? 200 : 500,
      }
    );
  } catch (error) {
    console.error('[KALSHI TEST] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        message: 'Failed to test Kalshi connection',
      }, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
