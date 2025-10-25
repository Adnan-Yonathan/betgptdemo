#!/bin/bash

echo "🚀 Deploying Kalshi Integration..."
echo ""

# 1. Link project
echo "📡 Linking Supabase project..."
npx supabase link --project-ref dskfsnbdgyjizoaafqfk
echo ""

# 2. Check secrets
echo "🔑 Checking secrets..."
echo "Please ensure you've set the following secrets:"
echo "  - KALSHI_EMAIL"
echo "  - KALSHI_PASSWORD"
echo "  - OPENAI_API_KEY (optional for AI analysis)"
echo ""
read -p "Have you set the secrets? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⚠️  Please set secrets first:"
    echo "   npx supabase secrets set KALSHI_EMAIL=your-email@example.com"
    echo "   npx supabase secrets set KALSHI_PASSWORD=your-password"
    echo "   npx supabase secrets set OPENAI_API_KEY=sk-your-key"
    exit 1
fi

# 3. Deploy functions
echo "📦 Deploying edge functions..."
npx supabase functions deploy test-kalshi-connection
npx supabase functions deploy fetch-kalshi-markets
npx supabase functions deploy analyze-kalshi-market
npx supabase functions deploy detect-arbitrage
npx supabase functions deploy monitor-kalshi-alerts
echo ""

# 4. Test connection
echo "🧪 Testing connection..."
RESULT=$(curl -s -X POST "https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/test-kalshi-connection" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRza2ZzbmJkZ3lqaXpvYWFmcWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODkwMTIsImV4cCI6MjA3NjQ2NTAxMn0.I9tilT4RzFlB21iy2xL7O2ttv_XDAfFNiMZbnzFTJlA" \
  -H "Content-Type: application/json")

if echo "$RESULT" | grep -q '"success":true'; then
    echo "✅ Connection test PASSED"
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "Next steps:"
    echo "  1. Sync market data: bash scripts/diagnose-kalshi.sh"
    echo "  2. Open your app and go to /kalshi"
    echo "  3. Markets should now appear!"
else
    echo "❌ Connection test FAILED"
    echo "Response: $RESULT"
    echo ""
    echo "Please check:"
    echo "  1. Kalshi credentials are correct"
    echo "  2. Secrets are set in Supabase"
    echo "  3. Edge functions deployed successfully"
fi
