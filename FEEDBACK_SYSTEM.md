# Simple User Feedback System

## Overview

The app collects simple thumbs up/down feedback to improve AI recommendations over time. All feedback is tracked in the background - no dashboards, no complex forms, just simple rating buttons.

## Features

### 1. Chat Message Feedback
**Where:** Appears on hover for AI responses in the chat

Just thumbs up/down to rate if a response was helpful. Data is saved automatically and used to improve future AI responses.

### 2. Prediction Feedback
**Component:** `PredictionFeedback`

Add to prediction cards with:
```tsx
<PredictionFeedback
  predictionId={prediction.id}
  sport={prediction.sport}
/>
```

Tracks which predictions users find helpful to improve accuracy over time.

### 3. Alert Feedback
**Component:** `AlertFeedback`

Add to notification cards with:
```tsx
<AlertFeedback
  notificationId={notification.id}
  alertType={notification.alert_type}
/>
```

Tracks which alerts are useful to reduce noise and improve alert quality.

## How It Works

1. **User clicks thumbs up/down** → Feedback saved to database
2. **Backend tracks patterns** → Which responses/predictions/alerts work well
3. **AI improves** → Better responses, more accurate predictions, smarter alerts

## Database Tables

All feedback is stored in simple tables:
- `message_feedback` - Chat response ratings
- `prediction_feedback` - Prediction helpfulness
- `alert_feedback` - Alert usefulness

The database migration creates these automatically with proper security (users only see their own feedback).

## Privacy

- All feedback is private (row-level security enabled)
- Users can only see/edit their own ratings
- No personal data shared for AI training

## That's It!

No complex dashboards or analytics needed. The system quietly collects feedback and uses it to make the app better over time.
