/**
 * Bet Parser Utility
 * Detects and parses bet entries from conversational input
 * Supports patterns like:
 * - "$50 on Eagles -3.5"
 * - "100 Lakers +5"
 * - "Bet $25 on Warriors ML"
 * - "Chiefs -7 for 50"
 */

export interface ParsedBet {
  amount: number;
  team: string;
  odds?: number;
  description: string;
  confidence: number; // How confident we are this is a bet (0-100)
}

/**
 * Parse a message to extract bet information
 * Returns null if no bet pattern is detected
 */
export function parseBetFromMessage(message: string): ParsedBet | null {
  const normalizedMessage = message.trim();

  // Pattern 1: "$50 on Eagles -3.5" or "50 on Eagles -3.5"
  const pattern1 = /\$?(\d+(?:\.\d{2})?)\s+(?:on|for)\s+([A-Za-z\s]+?)\s+([-+]?\d+(?:\.\d{1,2})?)/i;
  let match = normalizedMessage.match(pattern1);

  if (match) {
    const amount = parseFloat(match[1]);
    const team = match[2].trim();
    const odds = parseFloat(match[3]);

    return {
      amount,
      team,
      odds,
      description: `${team} ${odds > 0 ? '+' : ''}${odds}`,
      confidence: 90,
    };
  }

  // Pattern 2: "Eagles -3.5 for $50"
  const pattern2 = /([A-Za-z\s]+?)\s+([-+]?\d+(?:\.\d{1,2})?)\s+(?:for|at)\s+\$?(\d+(?:\.\d{2})?)/i;
  match = normalizedMessage.match(pattern2);

  if (match) {
    const team = match[1].trim();
    const odds = parseFloat(match[2]);
    const amount = parseFloat(match[3]);

    return {
      amount,
      team,
      odds,
      description: `${team} ${odds > 0 ? '+' : ''}${odds}`,
      confidence: 90,
    };
  }

  // Pattern 3: "Bet $100 on Lakers" (no odds specified)
  const pattern3 = /(?:bet|place|put)\s+\$?(\d+(?:\.\d{2})?)\s+(?:on|for)\s+([A-Za-z\s]+)/i;
  match = normalizedMessage.match(pattern3);

  if (match) {
    const amount = parseFloat(match[1]);
    const team = match[2].trim();

    return {
      amount,
      team,
      description: `${team}`,
      confidence: 75,
    };
  }

  // Pattern 4: "$50 Lakers ML" or "50 Lakers moneyline"
  const pattern4 = /\$?(\d+(?:\.\d{2})?)\s+([A-Za-z\s]+?)\s+(?:ML|moneyline|money\s+line)/i;
  match = normalizedMessage.match(pattern4);

  if (match) {
    const amount = parseFloat(match[1]);
    const team = match[2].trim();

    return {
      amount,
      team,
      description: `${team} ML`,
      confidence: 85,
    };
  }

  // Pattern 5: "100 on over 9.5"
  const pattern5 = /\$?(\d+(?:\.\d{2})?)\s+(?:on|for)\s+(over|under)\s+(\d+(?:\.\d{1,2})?)/i;
  match = normalizedMessage.match(pattern5);

  if (match) {
    const amount = parseFloat(match[1]);
    const overUnder = match[2].charAt(0).toUpperCase() + match[2].slice(1);
    const line = parseFloat(match[3]);

    return {
      amount,
      team: overUnder,
      description: `${overUnder} ${line}`,
      confidence: 80,
    };
  }

  return null;
}

/**
 * Calculate potential return from American odds
 */
export function calculatePotentialReturn(amount: number, odds: number): number {
  if (odds > 0) {
    // Positive odds (underdog)
    return amount + (amount * odds) / 100;
  } else {
    // Negative odds (favorite)
    return amount + (amount * 100) / Math.abs(odds);
  }
}

/**
 * Check if a message likely contains betting intent
 * Lower threshold for suggesting the user might want to log a bet
 */
export function hasBettingIntent(message: string): boolean {
  const bettingKeywords = [
    'bet',
    'wager',
    'stake',
    'risk',
    'put money',
    'taking',
    'playing',
    'backing',
  ];

  const normalizedMessage = message.toLowerCase();

  // Check for betting keywords
  const hasKeyword = bettingKeywords.some((keyword) =>
    normalizedMessage.includes(keyword)
  );

  // Check for dollar amounts
  const hasDollarAmount = /\$\d+|\d+\s*(?:dollars|bucks)/.test(normalizedMessage);

  // Check for odds patterns
  const hasOdds = /[-+]\d+(?:\.\d)?/.test(normalizedMessage);

  // Strong signal: has keyword + amount, or has keyword + odds
  if (hasKeyword && (hasDollarAmount || hasOdds)) {
    return true;
  }

  // Medium signal: has amount + odds (might be asking about a bet)
  if (hasDollarAmount && hasOdds) {
    return true;
  }

  return false;
}
