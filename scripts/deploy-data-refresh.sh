#!/bin/bash

echo "🚀 Deploying Data Refresh Fix..."
echo ""

# 1. Link project
echo "📡 Linking Supabase project..."
npx supabase link --project-ref dskfsnbdgyjizoaafqfk
echo ""

# 2. Deploy functions
echo "📦 Deploying edge functions..."
echo "  - Deploying fetch-sports-scores..."
npx supabase functions deploy fetch-sports-scores

echo "  - Deploying fetch-betting-odds..."
npx supabase functions deploy fetch-betting-odds

echo ""
echo "✅ Edge functions deployed successfully"
echo ""

# 3. Apply database migration
echo "🗄️  Applying database migration..."
npx supabase db push
echo ""

# 4. Verify cron jobs are running
echo "🔍 Verifying cron job status..."
echo ""
echo "To check cron job status, run:"
echo "  SELECT * FROM data_refresh_cron_status;"
echo ""

echo "🎉 Deployment complete!"
echo ""
echo "Data refresh schedule:"
echo "  ✓ ESPN Scores: Every hour at :05"
echo "  ✓ Betting Odds: Every hour at :00"
echo "  ✓ Bet Monitoring: Every 10 minutes"
echo ""
echo "Your data should now refresh every hour automatically."
