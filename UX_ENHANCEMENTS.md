# BetGPT UX Enhancements Documentation

This document outlines the new UX and interface features added to enhance user experience, engagement, and personalization.

## Overview

Four major features have been implemented to make the betting experience more personal, actionable, and engaging:

1. **Conversational Bet Logging** - Natural language bet entry with AI confirmation
2. **Betting Dashboard** - Performance metrics and analytics in your profile
3. **Personalized AI Feed** - Smart bet suggestions tailored to you
4. **Game Insights Screen** - Deep analytics for individual games

---

## 1. Conversational Bet Logging

### Location
- **Component**: `/src/components/BetConfirmation.tsx`
- **Utility**: `/src/utils/betParser.ts`

### Features
- Parse natural language bet entries
- AI-style confirmation with micro-animations
- "Syncing..." → "Logged" state transitions
- Automatic integration with existing `log-bet` function

### Supported Patterns

```
"$50 on Eagles -3.5"
"100 Lakers +5"
"Bet $25 on Warriors ML"
"Chiefs -7 for 50"
"50 on over 9.5"
```

### Usage Example

```tsx
import { BetConfirmation } from "@/components/BetConfirmation";
import { parseBetFromMessage, calculatePotentialReturn } from "@/utils/betParser";

// In your chat component
const message = "$50 on Eagles -3.5";
const parsedBet = parseBetFromMessage(message);

if (parsedBet && parsedBet.confidence > 70) {
  const potentialReturn = calculatePotentialReturn(parsedBet.amount, parsedBet.odds || 0);

  return (
    <BetConfirmation
      amount={parsedBet.amount}
      description={parsedBet.description}
      odds={parsedBet.odds || 0}
      potentialReturn={potentialReturn}
    />
  );
}
```

### Integration Points
- Hooks into existing `handleBetInput()` flow
- Uses the existing Supabase `log-bet` edge function
- No changes to backend required

---

## 2. Betting Dashboard

### Location
- **Component**: `/src/components/BettingDashboard.tsx`
- **Integrated In**: `/src/components/ProfileSettings.tsx`

### Features
- **ROI Calculation**: Real-time return on investment tracking
- **Win Rate**: Percentage of winning bets
- **Current Streak**: Win/loss streak visualization
- **Bankroll Tracking**: Total bankroll with daily change indicator
- **Auto-updating**: Refreshes when bets settle

### Metrics Displayed

| Metric | Description | Data Source |
|--------|-------------|-------------|
| Total Bankroll | Current available funds | `bets` table (calculated) |
| ROI | Return on investment % | `actual_return` / `amount` |
| Win Rate | % of winning bets | `outcome = 'win'` / total |
| Current Streak | Consecutive wins/losses | Recent `outcome` history |
| Today's Change | P&L for current day | Settled bets from today |
| Total Profit | Lifetime profit/loss | Sum of all returns |

### Access
1. Click your profile icon (top right)
2. Select "Settings"
3. Click "Dashboard" tab

### Mobile Optimized
- Responsive grid layout
- Stacks vertically on small screens
- Touch-friendly cards

---

## 3. Personalized AI Feed

### Location
- **Component**: `/src/components/PersonalizedFeed.tsx`
- **Page**: `/src/pages/AIFeed.tsx`
- **Route**: `/ai-feed`

### Features
- AI-suggested bets with confidence scores
- Expected Value (EV) calculations
- Detailed reasoning for each pick
- Quick action buttons:
  - **Track**: Add to bet tracking
  - **Ignore**: Remove from feed
  - **Share**: Copy to clipboard

### Data Structure

```typescript
interface AISuggestion {
  id: string;
  team: string;
  opponent: string;
  line: string;
  confidence: number;  // 0-100
  ev: number;         // Expected value %
  reasoning: string;  // AI explanation
  sport: string;
  gameTime: string;
}
```

### Future Integration
Currently uses mock data. To connect to real AI insights:

```typescript
// In PersonalizedFeed.tsx, replace mock data with:
const { data, error } = await supabase.functions.invoke('get-ai-insights', {
  body: { userId: user.id, riskProfile: profile.risk_tolerance }
});
```

### Access
- Navigation: Click "AI Picks" in main header (sparkle icon)
- Direct URL: `/ai-feed`

---

## 4. Game Insights Screen

### Location
- **Component**: `/src/components/GameInsights.tsx`
- **Demo Page**: `/src/pages/GameInsightsDemo.tsx`
- **Route**: `/game-insights`

### Features

#### Core Metrics
- **Value %**: Expected edge on the bet
- **Sharp Money %**: Where professional bettors are placing money
- **Line Movement**: Visual tracker showing opening → current line
- **Data Confidence**: 0-100% meter showing data quality

#### Expandable Section
- Injury reports
- Weather conditions
- Recent team form (W/L streaks)
- Historical trends

### Visual Elements
- Gradient line movement sparklines
- Color-coded confidence indicators
- Animated expand/collapse transitions
- Progress bars for data confidence

### Integration with Existing Data

The component is designed to accept props from your existing data:

```typescript
// Example: Connecting to existing game data
const gameData = await supabase
  .from("sports_scores")
  .select("*, betting_odds(*)")
  .eq("id", gameId)
  .single();

<GameInsights
  homeTeam={gameData.home_team}
  awayTeam={gameData.away_team}
  valuePercent={gameData.stats?.value_percent}
  sharpMoneyPercent={gameData.odds?.sharp_money_percent}
  lineMovement={{
    opening: gameData.odds?.opening_line,
    current: gameData.odds?.current_line,
    direction: gameData.odds?.line_movement_direction
  }}
  dataConfidence={gameData.stats?.confidence}
  injuries={gameData.injury_report}
  weather={gameData.weather}
/>
```

### Access
- Navigation: Click "Insights" in main header
- Direct URL: `/game-insights`

---

## Technical Implementation

### Design Principles
- **Non-Breaking**: All features layer on top of existing logic
- **Modular**: Each component is independently toggleable
- **Mobile-First**: Optimized for small screens, scales up
- **Dark Mode**: Follows app theme (neon green/yellow accents)
- **Performance**: Lazy loading, optimized renders, minimal blocking

### Dependencies
All UI components use existing shadcn/ui primitives:
- `Card`, `CardHeader`, `CardContent`
- `Button`, `Badge`, `Progress`
- `Skeleton` for loading states
- `Tooltip` for contextual help
- `Tabs` for multi-view layouts

### State Management
- React hooks for local state
- Supabase client for data fetching
- React Query caching (inherited from app config)
- Real-time subscriptions for bet updates

### Styling
- Tailwind CSS utility classes
- Consistent with existing design system
- HSL color variables from `/src/index.css`
- Responsive breakpoints: sm, md, lg

---

## Configuration & Customization

### Toggle Features

Each feature can be independently enabled/disabled:

```typescript
// In your feature flags or config
const FEATURES = {
  conversationalBetLogging: true,
  bettingDashboard: true,
  personalizedFeed: true,
  gameInsights: true,
};

// Then conditionally render
{FEATURES.bettingDashboard && <BettingDashboard />}
```

### Customize Thresholds

```typescript
// Bet parser confidence threshold
const MIN_CONFIDENCE = 70; // Only show confirmation if 70%+ confident

// Dashboard refresh interval
const DASHBOARD_REFRESH_MS = 30000; // Refresh every 30 seconds

// AI Feed mock data vs real API
const USE_MOCK_AI_FEED = true; // Set false when API ready
```

### Theme Customization

Colors are defined in `/src/index.css`:

```css
--primary: 250 95% 63%;        /* Purple */
--green-500: 142 71% 45%;      /* Success */
--yellow-500: 45 93% 47%;      /* Warning */
--red-500: 0 72% 51%;          /* Error */
```

---

## Backend Integration Checklist

To fully connect these features to your backend:

### Conversational Bet Logging
- [x] `log-bet` function exists (already working)
- [ ] Add bet confirmation response to chat stream
- [ ] Optional: Store parsed bet metadata in `bets` table

### Dashboard
- [x] Queries `bets` table (already working)
- [ ] Optional: Create `performance_summary` materialized view for faster queries
- [ ] Optional: Add `bankroll` column to `profiles` table

### Personalized Feed
- [ ] Create `get-ai-insights` edge function
- [ ] Connect to existing prediction functions (`predict-nba`, etc.)
- [ ] Use `risk_tolerance` from user profile
- [ ] Return format: `AISuggestion[]`

### Game Insights
- [ ] Add `stats` field to `sports_scores` table (JSON)
- [ ] Calculate `value_percent` in odds fetch
- [ ] Track `sharp_money_percent` from odds movements
- [ ] Add `line_movement_direction` to `betting_odds`

---

## Testing

### Manual Testing Checklist

- [ ] Conversational Bet Logging
  - [ ] Parse "$50 on Eagles -3.5" correctly
  - [ ] Show syncing animation
  - [ ] Display confirmation with correct amounts
  - [ ] Auto-dismiss after 2.5 seconds

- [ ] Dashboard
  - [ ] Displays accurate ROI
  - [ ] Win rate matches actual percentage
  - [ ] Streak updates on new bets
  - [ ] Mobile layout stacks correctly

- [ ] Personalized Feed
  - [ ] Cards display with confidence scores
  - [ ] EV colors match thresholds (green/yellow/blue)
  - [ ] Track button shows toast
  - [ ] Ignore button removes card

- [ ] Game Insights
  - [ ] Line movement visualization renders
  - [ ] Expandable section animates smoothly
  - [ ] Data confidence progress bar updates
  - [ ] Responsive on mobile

---

## Performance Considerations

### Optimizations Implemented
- **Lazy Loading**: Pages load on-demand via React.lazy()
- **Skeleton States**: Prevent layout shift during load
- **Debounced Parsing**: Bet parser runs max once per 500ms
- **Memoization**: Dashboard calculations cached
- **Conditional Rendering**: Hidden components don't mount

### Load Time Targets
- BetConfirmation: < 50ms
- BettingDashboard: < 300ms (with data)
- PersonalizedFeed: < 500ms (with mock data)
- GameInsights: < 100ms

---

## Accessibility

- **Keyboard Navigation**: All buttons and links accessible via Tab
- **Screen Readers**: Semantic HTML with ARIA labels
- **Color Contrast**: WCAG AA compliant (4.5:1 minimum)
- **Focus Indicators**: Visible focus rings on interactive elements
- **Animations**: Respect `prefers-reduced-motion`

---

## Future Enhancements

### Phase 2 Ideas
1. **Bankroll Chart**: Line chart showing bankroll over time
2. **Bet Slip Preview**: Drag-and-drop bet builder
3. **Social Sharing**: Share picks to Twitter/Discord
4. **Push Notifications**: Alerts for line movements
5. **Voice Bet Entry**: "Hey BetGPT, log $50 on Lakers"
6. **Bet Comparison**: Side-by-side odds from multiple books
7. **Parlay Builder**: AI-assisted parlay optimization
8. **Historical Analysis**: Head-to-head bet comparisons

---

## Support & Troubleshooting

### Common Issues

**Dashboard not loading?**
- Ensure user is authenticated (`user` context exists)
- Check `bets` table has data for user
- Verify Supabase client is initialized

**Bet parser not detecting bets?**
- Check pattern matches supported formats
- Try adding more patterns to `betParser.ts`
- Lower `MIN_CONFIDENCE` threshold for testing

**AI Feed empty?**
- Currently uses mock data by default
- To enable real data, implement `get-ai-insights` function
- Update `USE_MOCK_AI_FEED` flag to false

---

## Code Comments & Documentation

All new components include:
- JSDoc comments explaining purpose
- Inline comments for complex logic
- Props interface with descriptions
- Integration notes for backend connections

Example:
```typescript
/**
 * Conversational bet confirmation component
 * Shows AI-style confirmation with micro-animations
 * Uses existing log-bet function via ChatMessage flow
 */
export const BetConfirmation = ({ ... }) => { ... }
```

---

## File Structure

```
src/
├── components/
│   ├── BetConfirmation.tsx          # Conversational bet logging UI
│   ├── BettingDashboard.tsx         # Performance metrics dashboard
│   ├── PersonalizedFeed.tsx         # AI suggestions feed
│   ├── GameInsights.tsx             # Enhanced game analysis
│   └── ProfileSettings.tsx          # Updated with dashboard integration
├── pages/
│   ├── AIFeed.tsx                   # AI Picks page
│   └── GameInsightsDemo.tsx         # Game Insights demo page
├── utils/
│   └── betParser.ts                 # Bet parsing logic
└── App.tsx                          # Updated with new routes
```

---

## Version History

- **v1.0.0** (2025-10-24): Initial UX enhancements release
  - Conversational Bet Logging
  - Betting Dashboard in Profile
  - Personalized AI Feed
  - Game Insights Screen

---

## Contributing

When adding new features:
1. Follow the existing component structure
2. Use TypeScript for type safety
3. Add JSDoc comments
4. Ensure mobile responsiveness
5. Test in both light and dark modes
6. Update this documentation

---

## License

Proprietary - BetGPT AI Sports Betting Coach
