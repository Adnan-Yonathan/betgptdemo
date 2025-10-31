# Phase 6: Advanced Analytics & Performance Dashboard

## Executive Summary

Phase 6 transforms raw betting data into actionable insights through comprehensive analytics and visualizations. This phase builds on the foundation of Phases 3-5 to create a professional-grade performance dashboard that helps users understand their betting patterns, track profitability, and make data-driven decisions.

## Motivation

### Why Phase 6?

After implementing:
- **Phase 3**: Enhanced memory and user intelligence
- **Phase 4**: EV analysis, Kelly criterion, CLV tracking
- **Phase 5**: Live bet tracking and alerts

Users now have a wealth of data but limited visibility into their overall performance. They need:

1. **Visual feedback** on their betting performance
2. **Trend analysis** to identify patterns
3. **Comparative metrics** across leagues, teams, bet types
4. **Bankroll tracking** to see growth over time
5. **Statistical insights** to improve decision-making

### Business Value

- **Retention**: Users stay longer when they can see their progress
- **Engagement**: Dashboards encourage daily check-ins
- **Learning**: Visual data helps users improve
- **Professionalism**: Separates us from basic bet trackers
- **Social proof**: Performance data can be shared

## Goals

### Primary Goals
1. Provide comprehensive performance analytics
2. Visualize bankroll growth and P/L trends
3. Compare performance across multiple dimensions
4. Identify strengths and weaknesses in betting strategy
5. Track progress toward betting goals

### Secondary Goals
1. Export data for tax purposes
2. Generate shareable performance reports
3. Set and track personal betting goals
4. Compare to platform benchmarks
5. Identify optimal betting strategies

## Features

### Feature 1: Performance Overview Dashboard

**What**: High-level summary of betting performance

**Components**:
- **Key Metrics Cards**:
  - Total bets placed
  - Win rate percentage
  - Total profit/loss
  - ROI (Return on Investment)
  - Sharpe ratio
  - Average CLV
  - Kelly efficiency
  - Current streak

- **Quick Stats**:
  - Best day (highest profit)
  - Worst day (biggest loss)
  - Biggest win
  - Best winning streak
  - Current bankroll
  - All-time high bankroll

**Why**: Gives users instant understanding of their overall performance

**Technical Approach**:
- Aggregate queries from `bets`, `advanced_metrics`, `betting_patterns` tables
- Real-time calculations with caching
- Card components with animations
- Color-coded indicators (green/red)

---

### Feature 2: Bankroll Tracker

**What**: Visual timeline of bankroll growth

**Components**:
- **Line Chart**: Bankroll over time
- **Area Chart**: Cumulative P/L
- **Bar Chart**: Daily/weekly/monthly P/L
- **Annotations**: Mark significant events (big wins/losses)

**Why**: Shows financial progress and helps identify volatility

**Technical Approach**:
- Time-series data from `bankroll_history` table (new)
- Recharts or Chart.js for visualizations
- Configurable time ranges (7D, 30D, 3M, 1Y, All)
- Zoom/pan functionality

---

### Feature 3: Performance Breakdown

**What**: Detailed analysis across multiple dimensions

**Breakdowns**:
1. **By League** (NBA, NFL, MLB, NHL):
   - Win rate
   - ROI
   - Total bets
   - P/L
   - Average stake
   - Best/worst teams

2. **By Bet Type** (Spread, Total, Moneyline):
   - Win rate by type
   - ROI by type
   - Volume by type
   - Average odds

3. **By Team**:
   - Performance betting on each team
   - Favorite teams (most bets)
   - Most profitable teams
   - Teams to avoid

4. **By Time**:
   - Day of week performance
   - Hour of day patterns
   - Month-by-month trends
   - Season performance

5. **By Odds Range**:
   - Underdog vs favorite performance
   - Win rate by odds bracket
   - Optimal odds range

**Why**: Identifies where user excels and where they struggle

**Technical Approach**:
- Pivot tables and grouping queries
- Interactive tables with sorting
- Bar charts for comparisons
- Heatmaps for time-based patterns

---

### Feature 4: Trend Analysis

**What**: Identify patterns and trends over time

**Charts**:
- **Win Rate Trend**: Rolling 30-day win rate
- **ROI Trend**: Rolling 30-day ROI
- **Stake Sizing Trend**: Average bet size over time
- **CLV Trend**: Average CLV over time (Phase 4)
- **Kelly Efficiency Trend**: Bet sizing discipline over time

**Insights**:
- "Your win rate has increased 15% in the last month"
- "You're betting less on weekends, when you're 20% more profitable"
- "Your CLV has improved since implementing Phase 4"

**Why**: Shows progress and helps users see what's working

**Technical Approach**:
- Window functions for rolling averages
- Trend lines with linear regression
- Insight generation with thresholds
- Comparison to historical performance

---

### Feature 5: CLV Performance Analysis

**What**: Deep dive into closing line value (Phase 4 integration)

**Metrics**:
- Average CLV (points and dollars)
- Percentage of bets beating closing line
- CLV by league
- CLV by bet type
- CLV trend over time
- Correlation between CLV and results

**Visualizations**:
- Scatter plot: CLV vs Actual Result
- Distribution: CLV histogram
- Timeline: CLV over time

**Why**: CLV is the #1 predictor of long-term success

**Technical Approach**:
- Leverage `line_history` table from Phase 4
- Statistical calculations (correlation, distribution)
- Scatter plots and histograms
- Percentile rankings

---

### Feature 6: Win/Loss Analysis

**What**: Breakdown of winning and losing bets

**Components**:
- **Win/Loss Distribution**: Pie chart
- **Average Win vs Average Loss**: Comparison
- **Win Streak Analysis**: Longest streaks
- **Loss Recovery**: How quickly losses are recovered
- **Variance Analysis**: Consistency of results

**Why**: Helps understand risk/reward profile

**Technical Approach**:
- Aggregate calculations on `bets` table
- Statistical variance calculations
- Pie charts and comparison bars
- Streak detection algorithms

---

### Feature 7: Goal Tracking

**What**: Set and track personal betting goals

**Goals Types**:
- Monthly profit target
- Win rate target
- ROI target
- Bet volume target (min/max)
- Bankroll milestone
- Discipline goals (max bet size, daily limit)

**Components**:
- Goal setting interface
- Progress bars
- Achievement badges
- Milestone notifications

**Why**: Motivates users and provides structure

**Technical Approach**:
- `user_goals` table (new)
- Progress calculations
- Notification triggers
- Badge system

---

### Feature 8: Betting Calendar

**What**: Calendar view of betting activity

**Components**:
- Monthly calendar with daily P/L
- Color-coded days (green=profit, red=loss)
- Click to see daily details
- Annotations for streaks

**Why**: Visualizes betting patterns and identifies hot/cold periods

**Technical Approach**:
- Calendar component (React Big Calendar or custom)
- Daily aggregation queries
- Color gradients based on P/L
- Click-through to detailed view

---

### Feature 9: Export & Reporting

**What**: Export data for analysis or tax purposes

**Export Formats**:
- CSV (all bets)
- PDF (performance report)
- JSON (raw data)
- Excel (formatted with charts)

**Reports**:
- Monthly performance summary
- Tax report (gains/losses)
- Year-in-review
- Custom date range reports

**Why**: Professional users need data export for taxes and external analysis

**Technical Approach**:
- CSV export with filtering
- PDF generation (jsPDF or server-side)
- Pre-formatted reports with branding
- Email delivery option

---

### Feature 10: Comparative Analysis

**What**: Compare user performance to benchmarks

**Comparisons**:
- Personal best vs current
- This month vs last month
- This season vs last season
- User vs platform average (anonymized)
- User vs professional bettors (if available)

**Why**: Context helps users understand if they're improving

**Technical Approach**:
- Historical data comparison
- Platform-wide aggregations (anonymized)
- Percentile rankings
- Visualization with dual charts

---

## Database Schema

### New Tables

#### 1. bankroll_history

```sql
CREATE TABLE public.bankroll_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Snapshot data
  date DATE NOT NULL,
  bankroll NUMERIC NOT NULL,
  total_wagered NUMERIC DEFAULT 0,
  total_profit_loss NUMERIC DEFAULT 0,

  -- Daily stats
  daily_bets INTEGER DEFAULT 0,
  daily_wins INTEGER DEFAULT 0,
  daily_losses INTEGER DEFAULT 0,
  daily_pushes INTEGER DEFAULT 0,
  daily_profit_loss NUMERIC DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, date)
);

CREATE INDEX idx_bankroll_history_user_date ON public.bankroll_history(user_id, date DESC);
```

**Purpose**: Track daily bankroll snapshots for timeline visualization

---

#### 2. user_goals

```sql
CREATE TABLE public.user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Goal details
  goal_type TEXT NOT NULL, -- 'profit', 'win_rate', 'roi', 'volume', 'bankroll', 'discipline'
  goal_name TEXT NOT NULL,
  goal_description TEXT,

  -- Target values
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,

  -- Time range
  start_date DATE NOT NULL,
  end_date DATE,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_achieved BOOLEAN DEFAULT false,
  achieved_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_goals_user_active ON public.user_goals(user_id, is_active);
```

**Purpose**: Store and track user-defined betting goals

---

#### 3. performance_snapshots

```sql
CREATE TABLE public.performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Snapshot date
  snapshot_date DATE NOT NULL,

  -- Aggregate stats
  total_bets INTEGER NOT NULL,
  win_rate NUMERIC,
  roi NUMERIC,
  total_profit_loss NUMERIC,
  sharpe_ratio NUMERIC,
  avg_clv NUMERIC,
  kelly_efficiency NUMERIC,

  -- Breakdown data (JSONB for flexibility)
  by_league JSONB,
  by_bet_type JSONB,
  by_team JSONB,
  by_day_of_week JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX idx_performance_snapshots_user_date ON public.performance_snapshots(user_id, snapshot_date DESC);
```

**Purpose**: Pre-calculated daily snapshots for fast dashboard loading

---

### Database Functions

#### 1. calculate_daily_bankroll_snapshot()

```sql
CREATE OR REPLACE FUNCTION public.calculate_daily_bankroll_snapshot(p_user_id UUID, p_date DATE)
RETURNS JSONB AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  SELECT jsonb_build_object(
    'bankroll', (SELECT current_bankroll FROM user_preferences WHERE user_id = p_user_id),
    'daily_bets', COUNT(*),
    'daily_wins', COUNT(*) FILTER (WHERE result = 'won'),
    'daily_losses', COUNT(*) FILTER (WHERE result = 'lost'),
    'daily_pushes', COUNT(*) FILTER (WHERE result = 'push'),
    'daily_profit_loss', SUM(profit_loss)
  ) INTO v_snapshot
  FROM bets
  WHERE user_id = p_user_id
    AND DATE(placed_at) = p_date;

  RETURN v_snapshot;
END;
$$ LANGUAGE plpgsql;
```

---

#### 2. get_performance_breakdown()

```sql
CREATE OR REPLACE FUNCTION public.get_performance_breakdown(
  p_user_id UUID,
  p_breakdown_type TEXT, -- 'league', 'bet_type', 'team', 'day_of_week'
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  breakdown_key TEXT,
  total_bets INTEGER,
  wins INTEGER,
  losses INTEGER,
  pushes INTEGER,
  win_rate NUMERIC,
  roi NUMERIC,
  total_profit_loss NUMERIC,
  avg_stake NUMERIC
) AS $$
BEGIN
  -- Implementation varies by breakdown_type
  -- Returns aggregated stats grouped by the specified dimension
END;
$$ LANGUAGE plpgsql;
```

---

#### 3. generate_performance_insights()

```sql
CREATE OR REPLACE FUNCTION public.generate_performance_insights(p_user_id UUID)
RETURNS TABLE (
  insight_type TEXT,
  insight_text TEXT,
  insight_data JSONB
) AS $$
BEGIN
  -- Analyzes betting patterns and generates insights like:
  -- "Your win rate on NBA is 15% higher than NFL"
  -- "You're 20% more profitable betting on weekends"
  -- "Your CLV has improved 3 points in the last 30 days"
  -- etc.
END;
$$ LANGUAGE plpgsql;
```

---

## Frontend Components

### Component Structure

```
src/
├── pages/
│   └── Analytics.tsx                 (Main analytics page)
│
├── components/
│   ├── analytics/
│   │   ├── PerformanceOverview.tsx   (Key metrics cards)
│   │   ├── BankrollChart.tsx         (Bankroll timeline)
│   │   ├── PerformanceBreakdown.tsx  (By league, type, team)
│   │   ├── TrendAnalysis.tsx         (Trends over time)
│   │   ├── CLVAnalysis.tsx           (CLV deep dive)
│   │   ├── WinLossAnalysis.tsx       (Win/loss distribution)
│   │   ├── GoalTracker.tsx           (Goal setting & tracking)
│   │   ├── BettingCalendar.tsx       (Calendar view)
│   │   ├── ExportReports.tsx         (Export functionality)
│   │   └── ComparativeAnalysis.tsx   (Benchmarking)
│   │
│   └── charts/
│       ├── LineChart.tsx
│       ├── AreaChart.tsx
│       ├── BarChart.tsx
│       ├── PieChart.tsx
│       ├── ScatterPlot.tsx
│       ├── Heatmap.tsx
│       └── GaugeChart.tsx
```

---

### Key Component: PerformanceOverview

```typescript
// Pseudo-code structure
const PerformanceOverview = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      // Fetch from advanced_metrics, betting_patterns tables
      // Or from pre-calculated performance_snapshots
    }
    fetchMetrics();
  }, [user]);

  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard
        title="Win Rate"
        value={metrics.winRate}
        trend={metrics.winRateTrend}
        icon={<TrendingUp />}
      />
      <MetricCard
        title="ROI"
        value={metrics.roi}
        trend={metrics.roiTrend}
        icon={<DollarSign />}
      />
      {/* More cards... */}
    </div>
  );
};
```

---

### Key Component: BankrollChart

```typescript
const BankrollChart = () => {
  const [data, setData] = useState<BankrollData[]>([]);
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '3M' | '1Y' | 'All'>('30D');

  useEffect(() => {
    async function fetchBankrollHistory() {
      const { data } = await supabase
        .from('bankroll_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', getStartDate(timeRange))
        .order('date', { ascending: true });

      setData(data);
    }
    fetchBankrollHistory();
  }, [timeRange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bankroll Growth</CardTitle>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="bankroll" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
```

---

## Technical Implementation

### Tech Stack

**Frontend**:
- React + TypeScript
- Recharts or Chart.js for visualizations
- React Big Calendar for calendar view
- date-fns for date manipulation
- jsPDF for PDF export
- xlsx for Excel export

**Backend**:
- Supabase database functions
- Pre-calculated snapshots for performance
- Scheduled jobs for daily aggregation
- RLS policies for data security

**Data Flow**:
1. Bets are placed → stored in `bets` table
2. Nightly job calculates daily snapshots → `bankroll_history`, `performance_snapshots`
3. Dashboard queries snapshots (fast) + real-time calculations (current day)
4. Charts render from snapshot data
5. Trends calculated using window functions

### Performance Optimizations

1. **Pre-calculated Snapshots**: Daily aggregations run overnight
2. **Indexed Queries**: Proper indexes on date columns
3. **Caching**: Cache dashboard data for 5 minutes
4. **Lazy Loading**: Load charts as user scrolls
5. **Pagination**: Paginate large datasets
6. **Debouncing**: Debounce time range changes
7. **Memoization**: Memo expensive calculations

### Data Retention

- **Bets**: Kept indefinitely
- **Snapshots**: Kept indefinitely
- **Bankroll history**: Kept indefinitely
- **Raw calculations**: Cached for 5 minutes

---

## Integration Points

### Phase 3 Integration
- Use `betting_patterns` table for breakdown data
- Leverage user preferences for goals
- Integrate conversation insights

### Phase 4 Integration
- CLV data from `line_history`
- Advanced metrics from `advanced_metrics`
- Kelly efficiency calculations
- Elo predictions for comparison

### Phase 5 Integration
- Live bet data in current day snapshot
- Alert history in performance insights
- Live score impact on daily P/L

---

## User Experience

### Navigation
- Add "Analytics" tab to main navigation
- Accessible from header menu
- Dashboard icon in sidebar
- Quick access from profile dropdown

### Mobile Design
- Responsive charts (mobile-first)
- Swipeable chart views
- Collapsible breakdowns
- Simplified metrics on small screens

### Interactions
- Hover for detailed tooltips
- Click charts to drill down
- Filter by date ranges
- Export from any view
- Share performance cards

---

## Testing Strategy

### Unit Tests
- Chart component rendering
- Data aggregation functions
- Export functionality
- Goal tracking logic

### Integration Tests
- Dashboard data fetching
- Time range filtering
- Export generation
- Snapshot calculations

### E2E Tests
- Full dashboard flow
- Export and download
- Goal creation and tracking
- Chart interactions

---

## Deployment Plan

### Phase 6.1: Core Dashboard (Week 1)
- Implement database schema
- Create performance overview
- Build bankroll chart
- Add basic breakdowns

### Phase 6.2: Advanced Analytics (Week 2)
- Implement trend analysis
- Add CLV deep dive
- Build calendar view
- Create goal tracking

### Phase 6.3: Export & Polish (Week 3)
- Implement export functionality
- Add comparative analysis
- Polish UI/UX
- Optimize performance
- Write documentation

---

## Success Metrics

### User Metrics
- 70%+ of users visit Analytics within first week
- 50%+ return to Analytics daily
- Average session time >5 minutes
- 30%+ set at least one goal

### Technical Metrics
- Dashboard loads in <2 seconds
- Charts render in <500ms
- Export generates in <5 seconds
- 99.9% uptime

### Business Metrics
- Increased user retention
- Higher engagement rates
- More premium conversions
- Positive user feedback

---

## Future Enhancements (Phase 7+)

1. **AI-Powered Insights**: ML-generated recommendations
2. **Social Features**: Compare with friends, leaderboards
3. **Advanced Filters**: Custom date ranges, complex filters
4. **Custom Dashboards**: User-configurable layouts
5. **Mobile App**: Native iOS/Android analytics
6. **Live Dashboard**: Real-time updates during games
7. **Predictive Analytics**: Forecast future performance
8. **Bet Simulator**: Test strategies before placing bets
9. **API Access**: Allow external tools to access data
10. **White Label**: Branded analytics for partners

---

## Conclusion

Phase 6 transforms DeltaEdge from a betting tracker into a comprehensive analytics platform. By visualizing performance data and providing actionable insights, we empower users to:

- **Understand** their betting patterns
- **Improve** their decision-making
- **Track** progress toward goals
- **Optimize** their betting strategy
- **Prove** profitability for tax/financial purposes

This positions DeltaEdge as the professional choice for serious sports bettors.

**Phase 6 Status**: 📋 **PLANNED** - Ready for implementation
