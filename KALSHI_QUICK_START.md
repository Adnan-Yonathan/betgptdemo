# Kalshi Quick Start 🚀

## Current Issue
**"No active data from Kalshi being used"**

The Kalshi integration is fully built but needs configuration.

---

## Fix in 3 Steps

### 1️⃣ Configure Credentials (Supabase Dashboard)

Go to: https://supabase.com/dashboard/project/dskfsnbdgyjizoaafqfk/settings/functions

Add these secrets:
```
KALSHI_EMAIL=your-kalshi-email@example.com
KALSHI_PASSWORD=your-kalshi-password
OPENAI_API_KEY=sk-your-openai-key
```

### 2️⃣ Test Connection

```bash
./scripts/diagnose-kalshi.sh
```

Expected output: `✅ Kalshi API connection successful`

### 3️⃣ Sync Market Data

```bash
curl -X POST "https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/fetch-kalshi-markets" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRza2ZzbmJkZ3lqaXpvYWFmcWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODkwMTIsImV4cCI6MjA3NjQ2NTAxMn0.I9tilT4RzFlB21iy2xL7O2ttv_XDAfFNiMZbnzFTJlA"
```

---

## ✅ What You Get

- **Prediction markets** for NBA, NFL, MLB, NHL
- **Real-time prices** via WebSocket
- **AI analysis** with edge detection
- **Arbitrage opportunities** between Kalshi and sportsbooks
- **Portfolio tracking** for positions and P&L
- **Trading alerts** for high-value opportunities

---

## 📍 Access Point

Navigate to: `/kalshi` in your app

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Access denied" | Add credentials in Supabase (Step 1) |
| "No markets found" | Run sync command (Step 3) |
| Connection test fails | Check Kalshi email/password are correct |
| Still no data | Run `./scripts/diagnose-kalshi.sh` for details |

---

## 📚 Full Documentation

See `KALSHI_SETUP_GUIDE.md` for complete setup instructions and feature details.

---

**Don't have Kalshi account?** Sign up at https://kalshi.com
