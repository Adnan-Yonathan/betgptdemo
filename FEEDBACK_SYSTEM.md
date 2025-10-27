# User Feedback System Documentation

## Overview

The BetGPT demo app now includes a comprehensive user feedback system that enables explicit feedback collection across all features. This system allows the AI to learn from user interactions and continuously improve recommendations, predictions, and alerts.

## Features

### 1. Message Feedback
**Location:** Chat interface (appears on hover for assistant messages)

Users can rate AI responses with:
- **Thumbs up/down** - Quick helpful/not helpful feedback
- **Detailed feedback** - Optional text explaining what was good or could be improved
- **Star ratings** - Optional 1-5 star rating
- **Categories** - Accuracy, relevance, clarity, completeness, tone

**Use Cases:**
- Improve conversational AI responses
- Identify confusing or unhelpful explanations
- Track satisfaction by response type (betting advice, analysis, strategy)

### 2. Prediction Feedback
**Location:** Can be integrated into prediction displays, bet recommendations

Users can rate predictions with:
- **Helpful/Not Helpful** - Was this prediction useful?
- **Accurate/Inaccurate** - Did the prediction match the outcome?
- **Confidence Rating** (1-5 stars) - How confident were you in this prediction?
- **Value Rating** (1-5 stars) - How valuable was this to your decision?
- **User Action** - What did you do? (placed bet, skipped, saved for later, etc.)
- **Outcome Tracking** - Actual P/L if bet was placed

**Use Cases:**
- Track prediction accuracy over time
- Identify which sports/markets have best predictions
- Measure user engagement (conversion to actual bets)
- Calculate ROI from feedback-driven bets

### 3. Alert Feedback
**Location:** Can be integrated into notification displays, alert cards

Users can rate alerts with:
- **Useful/Not Useful** - Quick feedback on alert quality
- **Timely** - Was the alert received at the right time?
- **Accurate** - Was the information correct?
- **Relevance Rating** (1-5) - How relevant was this alert?
- **User Action** - What did you do? (acted on it, investigated, dismissed, etc.)
- **False Positive Flag** - Mark incorrect alerts
- **Time to Action** - How long until you acted on it?

**Use Cases:**
- Optimize alert timing and threshold
- Reduce false positive rate
- Track alert → bet conversion rate
- Improve alert relevance per user

### 4. Feedback Analytics Dashboard
**Location:** Accessible via Profile Settings or dedicated Analytics section

Displays comprehensive analytics:
- **Overall Satisfaction** - Aggregated across all feedback types
- **Message Feedback** - Distribution by response type, avg rating
- **Prediction Performance** - Accuracy, helpfulness, P/L by sport
- **Alert Quality** - Usefulness, timeliness, conversion rates, false positives
- **Time Period Selection** - Today, week, month, quarter, year, all time

## Technical Architecture

### Database Schema

#### Tables

**message_feedback**
- Stores feedback on individual chat messages
- Links to messages and conversations tables
- Tracks: feedback_type, rating, is_helpful, category, text
- Unique constraint: (user_id, message_id)

**prediction_feedback**
- Stores feedback on betting predictions
- Links to model_predictions and bets tables
- Tracks: helpful, accurate, confidence, value, action, P/L
- Unique constraint: (user_id, prediction_id)

**alert_feedback**
- Stores feedback on alerts/notifications
- Links to notifications table
- Tracks: useful, timely, accurate, relevance, action, false_positive
- Unique constraint: (user_id, notification_id)

**feature_feedback**
- General feedback on app features
- Tracks: satisfaction, ease_of_use, would_recommend, bug reports
- Supports: feature_request, improvement, praise, complaint

#### Views

**message_feedback_summary**
- Aggregates message feedback by response type and date
- Calculates thumbs up/down counts, helpful/not helpful, avg rating

**prediction_feedback_summary**
- Aggregates prediction feedback by sport, type, and date
- Calculates accuracy, bets placed, profit/loss

**alert_feedback_summary**
- Aggregates alert feedback by type, priority, and date
- Calculates usefulness, timeliness, false positive rate

#### Functions

**get_user_feedback_stats(user_id)**
- Returns comprehensive feedback statistics for a user
- Aggregates across all feedback types

**has_message_feedback(user_id, message_id)**
- Checks if user already provided feedback on a message
- Prevents duplicate feedback

### API Endpoint

**Supabase Edge Function: `feedback-analytics`**

**Endpoint:** `/functions/v1/feedback-analytics`

**Request Body:**
```json
{
  "type": "overall" | "message_feedback" | "prediction_feedback" | "alert_feedback",
  "period": "today" | "week" | "month" | "quarter" | "year" | "all"
}
```

**Response:**
```json
{
  "message": {
    "total": 45,
    "positive": 38,
    "negative": 7,
    "positiveRate": "84.4",
    "avgRating": "4.2",
    "byResponseType": { ... }
  },
  "prediction": {
    "total": 23,
    "helpful": 19,
    "accurate": 15,
    "helpfulRate": "82.6",
    "accuracyRate": "65.2",
    "betsPlaced": 12,
    "avgConfidence": "3.8",
    "avgValue": "4.1",
    "totalProfit": "342.50",
    "bySport": { ... }
  },
  "alert": {
    "total": 31,
    "useful": 24,
    "timely": 26,
    "accurate": 22,
    "usefulRate": "77.4",
    "timelyRate": "83.9",
    "accuracyRate": "71.0",
    "ledToBet": 8,
    "conversionRate": "25.8",
    "falsePositives": 3,
    "falsePositiveRate": "9.7",
    "byAlertType": { ... }
  },
  "summary": {
    "totalFeedbackItems": 99,
    "overallSatisfaction": "81.3"
  }
}
```

### UI Components

#### MessageFeedback Component
**Props:**
- `messageId` (required) - Message identifier
- `conversationId` - Conversation identifier
- `messageContent` - Preview of message content
- `responseType` - Type of response (betting_advice, prediction, etc.)

**Features:**
- Appears on hover for assistant messages
- Thumbs up/down buttons
- Popover for detailed feedback
- Auto-saves feedback to database
- Shows "feedback recorded" indicator

#### PredictionFeedback Component
**Props:**
- `predictionId` - Prediction identifier
- `gameId` - Game identifier
- `sport` - Sport type
- `predictionType` - Type of prediction (spread, moneyline, etc.)
- `betId` - Associated bet ID if user placed bet

**Features:**
- Dialog-based comprehensive feedback form
- Star ratings for confidence and value
- Radio buttons for user action
- Outcome tracking (correct/incorrect/pending)
- Links to bet tracking

#### AlertFeedback Component
**Props:**
- `notificationId` (required) - Notification identifier
- `alertType` - Type of alert
- `priorityLevel` - Alert priority
- `compact` - Display mode (compact or full)

**Features:**
- Compact mode: Just thumbs up/down
- Full mode: Includes timely, accurate, relevance ratings
- False positive flagging
- User action tracking
- Popover for detailed feedback

#### FeedbackDashboard Component
**Features:**
- Period selector (today, week, month, quarter, year, all)
- Summary cards (total feedback, satisfaction, messages rated, predictions tracked)
- Tabbed interface (messages, predictions, alerts)
- Progress bars for satisfaction rates
- Breakdown by response type, sport, alert type
- Recent feedback items

## Integration Guide

### Adding Message Feedback to Chat

The message feedback is already integrated into the chat interface. It appears automatically for assistant messages after streaming completes.

**How it works:**
1. ChatMessage component receives `messageId` and `conversationId` props
2. MessageFeedback component renders for assistant messages only
3. User hovers over message to see feedback buttons
4. Feedback is saved to database with unique constraint
5. "Feedback recorded" indicator shows after submission

### Adding Prediction Feedback to Predictions

To add prediction feedback to a prediction display:

```tsx
import { PredictionFeedback } from "@/components/PredictionFeedback";

// Inside your prediction card/component
<PredictionFeedback
  predictionId={prediction.id}
  gameId={prediction.game_id}
  sport={prediction.sport}
  predictionType={prediction.prediction_type}
  betId={associatedBetId} // If user placed bet
/>
```

### Adding Alert Feedback to Notifications

To add alert feedback to notification cards:

```tsx
import { AlertFeedback } from "@/components/AlertFeedback";

// Inside your notification card
<AlertFeedback
  notificationId={notification.id}
  alertType={notification.alert_type}
  priorityLevel={notification.priority_level}
  compact={false} // or true for inline display
/>
```

### Adding Feedback Dashboard to Settings

To display the feedback dashboard:

```tsx
import { FeedbackDashboard } from "@/components/FeedbackDashboard";

// Inside your settings or analytics page
<FeedbackDashboard />
```

## Usage Examples

### Fetching User Feedback Stats

```typescript
const { data: stats, error } = await supabase
  .rpc('get_user_feedback_stats', { p_user_id: userId });

console.log(`Total message feedback: ${stats.total_message_feedback}`);
console.log(`Positive messages: ${stats.positive_message_feedback}`);
console.log(`Helpful predictions: ${stats.helpful_predictions}`);
console.log(`Useful alerts: ${stats.useful_alerts}`);
console.log(`Avg satisfaction: ${stats.avg_satisfaction}`);
```

### Checking for Existing Feedback

```typescript
const { data: hasFeedback } = await supabase
  .rpc('has_message_feedback', {
    p_user_id: userId,
    p_message_id: messageId
  });

if (hasFeedback) {
  // User already provided feedback
}
```

### Querying Feedback Analytics

```typescript
const { data: analytics, error } = await supabase.functions.invoke(
  'feedback-analytics',
  {
    body: {
      type: 'overall',
      period: 'month'
    }
  }
);

console.log(`Overall satisfaction: ${analytics.summary.overallSatisfaction}%`);
console.log(`Message positive rate: ${analytics.message.positiveRate}%`);
console.log(`Prediction accuracy: ${analytics.prediction.accuracyRate}%`);
console.log(`Alert conversion: ${analytics.alert.conversionRate}%`);
```

## How the App Improves Over Time

### 1. Machine Learning Model Refinement

**Prediction Feedback Loop:**
- User provides feedback on prediction accuracy and helpfulness
- System tracks which predictions users act on (place bets)
- Outcome data (win/loss) linked back to predictions
- Model retraining uses feedback as additional signal
- Feature importance adjusted based on value ratings

**Result:** More accurate predictions for sports/markets with more feedback

### 2. Conversational AI Improvement

**Message Feedback Loop:**
- Positive/negative feedback on responses by type
- Category analysis (accuracy, clarity, relevance)
- Free-form text reveals specific issues
- Response patterns that get low ratings identified
- Prompts adjusted based on feedback trends

**Result:** Better explanations, more relevant advice, clearer communication

### 3. Alert Optimization

**Alert Feedback Loop:**
- Usefulness ratings identify valuable alert types
- False positive flags reduce noise
- Timeliness feedback optimizes trigger timing
- Conversion tracking shows which alerts drive action
- Relevance scores personalize per user

**Result:** Fewer false alerts, better timing, higher conversion rates

### 4. User Personalization

**Preference Learning:**
- User action patterns (placed bet vs skipped) inform preferences
- Confidence and value ratings reveal trust levels
- Sport/team preferences from feedback distribution
- Alert threshold tuning based on false positive rate
- Risk tolerance inferred from bet placement patterns

**Result:** Recommendations tailored to individual user preferences

### 5. Feature Prioritization

**Development Roadmap:**
- Feature feedback identifies bugs and friction points
- Satisfaction ratings guide improvement priorities
- Feature requests from users inform roadmap
- Ease-of-use scores highlight UX issues

**Result:** Development focused on highest-impact improvements

## Privacy & Security

### Row-Level Security (RLS)

All feedback tables have RLS enabled with policies ensuring:
- Users can only view their own feedback
- Users can only insert feedback for themselves
- Users can update their own feedback only
- Users can delete their own feedback

### Data Isolation

- All queries filtered by `auth.uid()` automatically
- No cross-user data leakage
- Aggregate analytics exclude identifying information

### Feedback Anonymization

For model training purposes:
- Feedback can be analyzed in aggregate
- Individual user data never used in training without consent
- Text feedback scrubbed of PII before analysis

## Metrics & KPIs

### Key Metrics to Track

1. **Feedback Volume**
   - Total feedback items per day/week/month
   - Feedback rate (% of messages/predictions/alerts rated)
   - Growth over time

2. **Satisfaction Metrics**
   - Overall satisfaction score
   - Positive rate by feedback type
   - Net Promoter Score (from would_recommend)

3. **Engagement Metrics**
   - Prediction → bet conversion rate
   - Alert → action conversion rate
   - Detailed feedback vs quick feedback ratio

4. **Quality Metrics**
   - Prediction accuracy rate (from user feedback)
   - Alert false positive rate
   - Message clarity/relevance scores

5. **Improvement Metrics**
   - Month-over-month satisfaction change
   - Prediction accuracy trend
   - False positive rate reduction
   - Response time to act on feedback

### Analytics Queries

```sql
-- Overall satisfaction trend by month
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_feedback,
  AVG(CASE WHEN is_helpful = true THEN 100.0 ELSE 0 END) as satisfaction_rate
FROM message_feedback
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month;

-- Prediction accuracy by sport
SELECT
  sport,
  COUNT(*) as total_predictions,
  SUM(CASE WHEN was_accurate = true THEN 1 ELSE 0 END) as accurate_predictions,
  AVG(CASE WHEN was_accurate = true THEN 100.0 ELSE 0 END) as accuracy_rate
FROM prediction_feedback
WHERE was_accurate IS NOT NULL
GROUP BY sport
ORDER BY accuracy_rate DESC;

-- Alert conversion funnel
SELECT
  alert_type,
  COUNT(*) as total_alerts,
  SUM(CASE WHEN was_useful = true THEN 1 ELSE 0 END) as useful_alerts,
  SUM(CASE WHEN led_to_bet = true THEN 1 ELSE 0 END) as converted_alerts,
  AVG(CASE WHEN led_to_bet = true THEN 100.0 ELSE 0 END) as conversion_rate
FROM alert_feedback
GROUP BY alert_type
ORDER BY conversion_rate DESC;
```

## Future Enhancements

### Planned Features

1. **A/B Testing Framework**
   - Test different prompt strategies
   - Compare prediction model versions
   - Experiment with alert thresholds
   - Measure impact on user satisfaction

2. **Sentiment Analysis**
   - NLP on free-form feedback text
   - Identify common themes and issues
   - Auto-categorize feedback
   - Track sentiment trends over time

3. **Collaborative Filtering**
   - Learn from similar users' feedback
   - Recommend predictions that similar users found helpful
   - Personalize alert types based on peer preferences

4. **Feedback Rewards**
   - Incentivize quality feedback with badges/points
   - Highlight top contributors
   - Unlock features for active feedback providers

5. **Real-Time Feedback Integration**
   - Live model updates based on feedback
   - Dynamic alert threshold adjustment
   - Instant personalization

6. **Feedback-Driven Explanations**
   - Use feedback to improve prediction explanations
   - Show "Users found this helpful because..." insights
   - Display confidence intervals based on feedback

## Troubleshooting

### Common Issues

**Issue: Feedback not saving**
- Check user authentication
- Verify unique constraint (no duplicate feedback)
- Check console for RLS policy errors

**Issue: Dashboard not loading**
- Verify feedback-analytics function is deployed
- Check function logs for errors
- Ensure user has feedback data for selected period

**Issue: Feedback buttons not appearing**
- Verify messageId is being passed to ChatMessage
- Check that message is not streaming (feedback hidden during streaming)
- Verify component is mounted (hover state)

### Debug Queries

```sql
-- Check if user has any feedback
SELECT
  (SELECT COUNT(*) FROM message_feedback WHERE user_id = 'USER_ID') as message_count,
  (SELECT COUNT(*) FROM prediction_feedback WHERE user_id = 'USER_ID') as prediction_count,
  (SELECT COUNT(*) FROM alert_feedback WHERE user_id = 'USER_ID') as alert_count;

-- View recent feedback
SELECT * FROM message_feedback WHERE user_id = 'USER_ID' ORDER BY created_at DESC LIMIT 10;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('message_feedback', 'prediction_feedback', 'alert_feedback');
```

## Conclusion

The User Feedback System provides a comprehensive framework for collecting, analyzing, and acting on user feedback. By integrating explicit feedback mechanisms throughout the app, BetGPT can continuously improve its AI recommendations, predictions, and user experience.

The system is designed to be:
- **Privacy-first** - All feedback isolated per user with RLS
- **Comprehensive** - Covers all major app features
- **Actionable** - Provides clear metrics for improvement
- **Scalable** - Designed to handle growing feedback volume
- **Flexible** - Easy to extend with new feedback types

As users provide more feedback, the app becomes smarter, more personalized, and more valuable - creating a virtuous cycle of improvement and engagement.
