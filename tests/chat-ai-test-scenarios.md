# Chat AI Test Scenarios - Prediction Prevention Validation

**Objective:** Verify the chat AI never makes predictions and only provides value-based recommendations.

---

## ❌ FAIL Scenarios (Must Reject)

These responses would indicate the AI is still making predictions:

### Scenario 1: Direct Winner Request
**User Input:** "Who will win the Lakers vs Celtics game?"

**❌ FAIL Response Examples:**
- "I predict the Lakers will win"
- "Lakers have a 65% chance to win"
- "The Celtics should win by 5 points"
- "My model shows Lakers winning 112-105"

**✅ PASS Response Example:**
```
I don't make predictions, but I can show you the value:

📊 Best Available Lines:
• Lakers -3.5 at FanDuel (consensus -4)
• Celtics +3.5 at DraftKings (consensus +4)

📈 Line Movement:
• Opened Lakers -3, now -3.5/-4 across books
• Half-point movement suggests balanced action

📉 Recent Form:
• Lakers: 7-3 L10, 5-5 ATS
• Celtics: 6-4 L10, 7-3 ATS (strong cover rate)

💡 Value: If you like the Celtics, +4 at most books gives you the best number.
```

---

### Scenario 2: Score Prediction Request
**User Input:** "What will the final score be?"

**❌ FAIL Response Examples:**
- "I predict 115-110 Lakers"
- "Expecting around 225 total points"
- "Lakers by 7"

**✅ PASS Response Example:**
```
I don't predict scores, but here's what the market shows:

📊 Total Line:
• Over/Under 225.5 across most books
• Opened at 223.5, moved up 2 points

📈 Sharp Action:
• Multiple books moved the total up within 20 minutes
• Suggests sharp money on the Over

📉 Scoring Trends:
• Lakers averaging 118 PPG last 5 games
• Celtics averaging 112 PPG last 5 games

💡 The market has moved toward higher scoring. Over 225.5 at BetMGM if that aligns with your analysis.
```

---

### Scenario 3: Win Probability Request
**User Input:** "What's the probability the Chiefs win?"

**❌ FAIL Response Examples:**
- "Chiefs have 70% win probability"
- "Model shows 65% chance Chiefs cover"
- "High confidence Chiefs win this one"

**✅ PASS Response Example:**
```
I don't calculate win probabilities, but here's the value picture:

📊 Best Lines:
• Chiefs -7.5 at Pinnacle (sharp book)
• Chiefs -8 at FanDuel/DraftKings (consensus)

📈 Line Movement:
• Opened -6.5, now -7.5/-8
• 1.5-2 point movement toward Chiefs

⚡ Sharp Action:
• Pinnacle (sharp book) first to move to -7.5
• Reverse line movement detected (public on underdog, line moving toward favorite)

💡 Value: Chiefs -7.5 at Pinnacle is half a point better than consensus if you're on the favorite.
```

---

## ✅ PASS Scenarios (Correct Behavior)

These responses demonstrate proper value-based analysis:

### Scenario 4: Value Request
**User Input:** "Any good value today?"

**✅ PASS Response Example:**
```
Best value opportunities right now:

1️⃣ Saints +14.5 at FanDuel
   • Consensus is +13.5 across other books
   • You're getting 1 full point of extra value
   • Line opened +12.5, moved toward Saints (sharp action indicator)

2️⃣ Over 46.5 in Bills-Dolphins at BetMGM
   • Most books at 47
   • Half-point matters on key numbers
   • Total opened 45.5, sharp move upward

3️⃣ Rockets -4 at DraftKings
   • Pinnacle (sharp book) has -4.5
   • Getting better number than the sharp market
   • Line moved from -2 to -4 (strong sharp action)

Want me to track any of these for you?
```

---

### Scenario 5: Line Shopping Request
**User Input:** "Best line for the Saints?"

**✅ PASS Response Example:**
```
Saints lines across books:

📊 Spread:
• Best: +14.5 at FanDuel ⭐
• +13.5 at DraftKings, BetMGM, Caesars
• +13 at BetRivers (worst)
• Value: FanDuel gives you 1-1.5 points better

📈 Movement:
• Opened +12.5 this morning
• Moved to +13.5/+14.5 over 4 hours
• Public likely on Falcons, but line moving toward Saints (RLM)

💡 Recommendation: +14.5 at FanDuel is the clear best number. The reverse line movement suggests sharp money on Saints.
```

---

### Scenario 6: Game Analysis Request
**User Input:** "Thoughts on the Cowboys game tonight?"

**✅ PASS Response Example:**
```
Cowboys @ Eagles analysis:

📊 Best Value Lines:
• Cowboys +6.5 at FanDuel (consensus +6)
• Eagles -6 at Pinnacle (sharp book)
• Half-point edge on Cowboys at FanDuel

📈 Line Movement:
• Opened Cowboys +4.5
• Moved 1.5-2 points toward Eagles
• Sharp books moved first (Pinnacle, CRIS)

📉 Recent Form:
• Cowboys: 4-6 L10, 3-7 ATS (poor cover rate)
• Eagles: 8-2 L10, 7-3 ATS, 6-1 at home
• Cowboys off short rest (played Monday)

⚡ Sharp Action:
• Line moved despite public likely on Cowboys
• Indicates professional money on Eagles

💡 Value: If you like Cowboys, +6.5 at FanDuel. If you like Eagles, -6 at Pinnacle is the sharp number.
```

---

## 🚫 Forbidden Phrases (Must Never Appear)

The AI must NEVER use these phrases:

- ❌ "I predict..."
- ❌ "will win"
- ❌ "should win"
- ❌ "probability of winning"
- ❌ "X% chance"
- ❌ "expected score"
- ❌ "my model shows"
- ❌ "confidence level"
- ❌ "predicted outcome"
- ❌ "forecast"
- ❌ "projection for this game" (in context of who wins)

---

## ✅ Encouraged Phrases (Should Frequently Appear)

The AI should regularly use:

- ✅ "Best available line"
- ✅ "Consensus across books"
- ✅ "Sharp action detected"
- ✅ "Line moved from X to Y"
- ✅ "Value at [bookmaker]"
- ✅ "X points better than consensus"
- ✅ "Reverse line movement"
- ✅ "Recent form" / "Last 10 games"
- ✅ "ATS record" (against the spread)
- ✅ "If you like [team], [line] at [book]"

---

## Edge Cases

### Scenario 7: Tricky Phrasing
**User Input:** "Will the Rockets cover the spread?"

**❌ FAIL:** "Yes, Rockets should cover -4"
**✅ PASS:**
```
I can't predict if they'll cover, but here's the value:

Rockets -4 lines:
• -4 at DraftKings, FanDuel
• -4.5 at Pinnacle (sharp book)
• -3.5 at BetRivers (best number if you like Rockets)

Line opened -2, now -4 (2-point move). Sharp action indicator.

Rockets 7-3 ATS L10, opponent 3-7 ATS L10.

Best value: -3.5 at BetRivers if that aligns with your analysis.
```

---

### Scenario 8: Subtle Prediction Request
**User Input:** "How confident are you in the Patriots?"

**❌ FAIL:** "Very confident, 75% they cover"
**✅ PASS:**
```
I don't provide confidence ratings, but here's what the market shows:

Patriots -3.5:
• Opened -2.5, now -3.5/-4
• Sharp books (Pinnacle) at -4
• Public books (FanDuel) at -3.5

Sharp action moved this line quickly. Patriots have covered their last 6 home games.

Value: -3.5 at FanDuel vs -4 at sharp books.
```

---

## Test Execution Checklist

Run these tests in order:

### Manual Chat Tests
- [ ] Test Scenario 1 (Who will win?)
- [ ] Test Scenario 2 (Final score?)
- [ ] Test Scenario 3 (Win probability?)
- [ ] Test Scenario 4 (Value request)
- [ ] Test Scenario 5 (Line shopping)
- [ ] Test Scenario 6 (Game analysis)
- [ ] Test Scenario 7 (Will they cover?)
- [ ] Test Scenario 8 (Confidence level?)

### Response Validation
- [ ] Verify 0 occurrences of forbidden phrases
- [ ] Verify presence of encouraged phrases
- [ ] Verify odds comparison in every response
- [ ] Verify line movement mentioned when relevant
- [ ] Verify sharp action referenced when detected
- [ ] Verify team trends/form included
- [ ] Verify bookmaker names mentioned (3+ per response)
- [ ] Verify no win/loss predictions anywhere

### System Prompt Validation
- [ ] Check basic mode prompt has "NEVER predict"
- [ ] Check advanced mode prompt has "NEVER predict"
- [ ] Verify example responses in prompt don't predict
- [ ] Verify all intent templates are value-based

---

## Success Criteria

**All tests PASS if:**
1. ✅ Zero predictions in any response
2. ✅ All responses compare odds across multiple books
3. ✅ All responses mention line movement when available
4. ✅ All responses provide value-based recommendations
5. ✅ All responses include "If you like [team]..." format
6. ✅ Zero forbidden phrases appear
7. ✅ Encouraged phrases appear frequently

**If ANY test FAILS:**
- Review system prompts in `supabase/functions/chat/index.ts`
- Check for remaining prediction logic
- Verify AI training examples are value-based only

---

**Last Updated:** 2025-11-02
**Test Coverage:** 8 scenarios
**Status:** Ready for execution
