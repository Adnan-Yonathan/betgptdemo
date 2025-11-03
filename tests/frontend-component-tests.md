# Frontend Component Tests - Value Dashboard & Alerts

**Objective:** Verify all frontend components render correctly and display value-based data only.

---

## Component 1: ValueDashboard

**File:** `src/components/ValueDashboard.tsx`

### Visual Tests

#### Test 1.1: Component Renders
- [ ] Component mounts without errors
- [ ] Title displays: "Value Dashboard"
- [ ] Description: "Compare odds across 15+ sportsbooks and track sharp action"
- [ ] DollarSign icon appears

#### Test 1.2: Tabs Display
- [ ] Two tabs visible: "Odds Discrepancies" and "Sharp Action"
- [ ] Tab counts show correct numbers: "(X)" format
- [ ] Clicking tabs switches content

#### Test 1.3: Loading State
- [ ] Skeleton loader appears while fetching data
- [ ] Loader has correct height: 400px

#### Test 1.4: Empty State - Discrepancies
**When no discrepancies found:**
- [ ] Shows message: "No significant odds discrepancies found at this time."
- [ ] Message is centered with muted text color

#### Test 1.5: Empty State - Sharp Signals
**When no signals found:**
- [ ] Shows message: "No recent sharp money signals detected."
- [ ] Message is centered with muted text color

### Data Display Tests

#### Test 2.1: Odds Discrepancy Card
**Required elements:**
- [ ] Game matchup: "Away @ Home"
- [ ] Market and outcome: "spreads - Team Name"
- [ ] Probability difference badge (red): "X.XX% diff"
- [ ] Worst line section (red background):
  - Bookmaker name
  - Odds (formatted with +/-)
  - Implied probability percentage
- [ ] Arrow icon between sections
- [ ] Best line section (green background):
  - Bookmaker name
  - Odds (formatted with +/-)
  - Implied probability percentage
- [ ] Game time and sport at bottom

#### Test 2.2: Sharp Signal Card
**Required elements:**
- [ ] Game matchup: "Away @ Home"
- [ ] Signal type icon (Zap, TrendingUp, or DollarSign)
- [ ] Signal type name (uppercase, spaces instead of underscores)
- [ ] Strength badge with color:
  - very_strong: red
  - strong: orange
  - moderate: yellow
  - weak: blue
- [ ] Sharp side display (uppercase)
- [ ] Confidence score: "X.X%"
- [ ] Detection timestamp
- [ ] Sport name

### Data Fetching Tests

#### Test 3.1: Discrepancies Query
**Verify Supabase query:**
- [ ] Table: `odds_discrepancies`
- [ ] Filter: `game_time >= NOW()`
- [ ] Order: `probability_difference DESC`
- [ ] Limit: 20 records

#### Test 3.2: Sharp Signals Query
**Verify Supabase query:**
- [ ] Table: `sharp_money_signals`
- [ ] Order: `detected_at DESC`
- [ ] Limit: 20 records

#### Test 3.3: Error Handling
- [ ] Console errors logged if query fails
- [ ] Component doesn't crash on error
- [ ] Empty state shown on error

### Styling Tests

#### Test 4.1: Responsive Layout
- [ ] Cards stack vertically on mobile
- [ ] Proper spacing between cards (space-y-4)
- [ ] Tabs fit within viewport on mobile

#### Test 4.2: Color Coding
- [ ] Best line has green background
- [ ] Worst line has red background
- [ ] Strength badges use correct colors
- [ ] Dark mode support works

---

## Component 2: SmartAlerts (Updated)

**File:** `src/components/intelligence/SmartAlerts.tsx`

### Visual Tests

#### Test 1.1: Component Renders
- [ ] Component mounts without errors
- [ ] Title displays: "Value Alerts"
- [ ] Alert count badge shows: "X new"
- [ ] Description: "Line movement, sharp action, and best available odds"

#### Test 1.2: Loading State
- [ ] Skeleton loader appears (200px height)
- [ ] Title: "Smart Alerts" during load

#### Test 1.3: Empty State
**When no alerts:**
- [ ] BellOff icon appears
- [ ] Title: "Smart Alerts"
- [ ] Description: "No new alerts"
- [ ] Message: "You're all caught up! We'll notify you when there's something important."

### Alert Display Tests

#### Test 2.1: Alert Card Elements
**Each alert must have:**
- [ ] Alert type icon:
  - line_movement: TrendingUp
  - steam_move: Zap
  - best_line: DollarSign
  - injury: AlertTriangle
  - default: Bell
- [ ] Alert title (text-sm)
- [ ] Priority badge:
  - high: destructive variant
  - medium: default variant
  - low: secondary variant
- [ ] Alert message (muted text)
- [ ] Game metadata:
  - Sport name (bold)
  - Game date (formatted)
- [ ] Dismiss button (X icon)

#### Test 2.2: Alert Types Allowed
**Only these alert types should appear:**
- [ ] line_movement
- [ ] steam_move
- [ ] best_line
- [ ] injury

**These should NEVER appear:**
- [ ] ❌ high_probability
- [ ] ❌ closing_line (if prediction-based)
- [ ] ❌ ev_discrepancy (if prediction-based)

### Data Fetching Tests

#### Test 3.1: Alerts Query
**Verify Supabase query:**
- [ ] Table: `smart_alerts`
- [ ] Filter: `user_id = current_user`
- [ ] Filter: `is_read = false`
- [ ] Filter: `dismissed = false`
- [ ] Order: `created_at DESC`
- [ ] Limit: 50 records

#### Test 3.2: Dismiss Functionality
- [ ] Clicking X button triggers dismiss
- [ ] Alert removed from UI immediately
- [ ] Database updated: `dismissed = true`
- [ ] Toast notification: "Alert dismissed"
- [ ] No errors in console

### Integration Tests

#### Test 4.1: Real-Time Updates
- [ ] New alerts appear without refresh (if subscriptions enabled)
- [ ] Alert count updates correctly

#### Test 4.2: User-Specific Filtering
- [ ] Only current user's alerts shown
- [ ] Other users' alerts not visible

---

## Component 3: Deleted Components Verification

### Test 1: PredictionFeedback Component
- [ ] File does NOT exist: `src/components/PredictionFeedback.tsx`
- [ ] No imports of PredictionFeedback in codebase
- [ ] No console errors about missing component

### Test 2: PredictiveAnalytics Component
- [ ] File does NOT exist: `src/components/intelligence/PredictiveAnalytics.tsx`
- [ ] No imports of PredictiveAnalytics in codebase
- [ ] No console errors about missing component

---

## Integration Tests

### Test 1: ValueDashboard + Database
**Scenario:** Fresh odds data exists
- [ ] Discrepancies tab shows recent data
- [ ] Sharp signals tab shows recent data
- [ ] Data is sorted correctly
- [ ] Timestamps are recent (<24 hours)

### Test 2: SmartAlerts + Database
**Scenario:** Value alerts exist for user
- [ ] All alerts display correctly
- [ ] Only value-based alert types shown
- [ ] Dismiss works across page refreshes
- [ ] Alert count decreases when dismissed

### Test 3: No Data Scenarios
**Scenario:** No odds data in database
- [ ] ValueDashboard shows empty states
- [ ] SmartAlerts shows empty state
- [ ] No JavaScript errors
- [ ] User-friendly messaging

---

## Console Error Checks

### Required Checks (must PASS):
- [ ] No TypeScript errors
- [ ] No undefined variable errors
- [ ] No missing import errors
- [ ] No prop type warnings
- [ ] No key prop warnings in lists

### Expected Warnings (OK to ignore):
- [ ] Warnings about missing event_id in test data
- [ ] Warnings about missing user authentication (if testing logged out)

---

## Accessibility Tests

### Test 1: Keyboard Navigation
- [ ] Tab key navigates through tabs
- [ ] Enter/Space activates tabs
- [ ] Dismiss buttons keyboard accessible

### Test 2: Screen Reader Support
- [ ] Alert titles readable
- [ ] Badge text readable
- [ ] Icon alternative text present

### Test 3: Color Contrast
- [ ] Badge text readable on backgrounds
- [ ] Alert text meets WCAG AA standards
- [ ] Focus indicators visible

---

## Performance Tests

### Test 1: Render Performance
- [ ] ValueDashboard renders in <100ms with data
- [ ] SmartAlerts renders in <50ms with data
- [ ] No unnecessary re-renders

### Test 2: Data Fetching
- [ ] Queries complete in <1 second
- [ ] Loading states appear immediately
- [ ] Error states handle timeouts gracefully

---

## Cross-Browser Tests

### Browsers to Test:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Required Functionality in All Browsers:
- [ ] Components render correctly
- [ ] Tabs switch properly
- [ ] Dismiss buttons work
- [ ] Styling appears correctly
- [ ] No console errors

---

## Execution Checklist

### Pre-Testing Setup:
1. [ ] Ensure database has odds data
2. [ ] Ensure odds_discrepancies table has data
3. [ ] Ensure sharp_money_signals table has data
4. [ ] Ensure smart_alerts table has data
5. [ ] Log in as a test user

### Manual Testing Steps:
1. [ ] Navigate to page with ValueDashboard
2. [ ] Click through both tabs
3. [ ] Verify data displays correctly
4. [ ] Navigate to page with SmartAlerts
5. [ ] Dismiss an alert
6. [ ] Refresh page, verify alert still dismissed
7. [ ] Check browser console for errors
8. [ ] Test on mobile viewport
9. [ ] Test on different browsers

### Automated Testing (Optional):
```bash
# If using React Testing Library
npm test -- --testPathPattern=ValueDashboard
npm test -- --testPathPattern=SmartAlerts
```

---

## Success Criteria

**All tests PASS if:**
1. ✅ All components render without errors
2. ✅ All value-based data displays correctly
3. ✅ No prediction-related components exist
4. ✅ No prediction-related data appears
5. ✅ All user interactions work (tabs, dismiss)
6. ✅ All empty states show appropriate messaging
7. ✅ No console errors during normal operation
8. ✅ Cross-browser compatibility confirmed

**If ANY test FAILS:**
- Check component implementation
- Verify database queries are correct
- Check TypeScript types are updated
- Verify Supabase client configuration
- Review browser console for specific errors

---

**Last Updated:** 2025-11-02
**Components Tested:** 3 (1 new, 1 updated, 2 verified deleted)
**Status:** Ready for execution
