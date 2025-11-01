import { BetData } from '@/contexts/BetContext';

/**
 * Check if a message indicates the user wants to track a bet
 */
export function isBetTrackingIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  const trackingKeywords = [
    'track',
    'add bet',
    'place bet',
    'betting',
    'wager',
    'put money',
    'going with',
    'taking',
    'i bet',
    'my bet',
    'bet on',
    'placing',
    'putting',
  ];

  return trackingKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Extract bet amount from message
 */
function extractAmount(text: string): number {
  // Match patterns like: $50, $100.00, 50 dollars, 100 bucks
  const dollarMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
  if (dollarMatch) {
    return parseFloat(dollarMatch[1]);
  }

  const numberMatch = text.match(/(\d+(?:\.\d{2})?)\s*(?:dollars?|bucks?)/i);
  if (numberMatch) {
    return parseFloat(numberMatch[1]);
  }

  // Default amount if not specified
  return 0;
}

/**
 * Extract odds from message or AI response
 */
function extractOdds(text: string): string {
  // Match patterns like: -110, +150, -4.5, +200
  const oddsMatch = text.match(/([+-]\d+(?:\.\d+)?)/);
  if (oddsMatch) {
    return oddsMatch[1];
  }

  return '-110'; // Default odds
}

/**
 * Extract team name from message
 */
function extractTeam(text: string): string | undefined {
  // Common team name patterns
  const teamPatterns = [
    /(?:on|for|with)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:-\d+|[\+\-]\d+)/,
  ];

  for (const pattern of teamPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Detect bet type from message
 */
function detectBetType(text: string): BetData['type'] {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('spread') || /[-+]\d+\.5/.test(text)) {
    return 'spread';
  }
  if (lowerText.includes('moneyline') || lowerText.includes('ml') || lowerText.includes('straight up')) {
    return 'moneyline';
  }
  if (lowerText.includes('over') || lowerText.includes('under') || lowerText.includes('total')) {
    return 'total';
  }
  if (lowerText.includes('prop') || lowerText.includes('player')) {
    return 'prop';
  }
  if (lowerText.includes('parlay') || lowerText.includes('multi')) {
    return 'parlay';
  }

  return 'unknown';
}

/**
 * Extract league/sport from message
 */
function extractLeague(text: string): string | undefined {
  const leagues = ['NBA', 'NFL', 'MLB', 'NHL', 'CFB', 'CBB', 'UFC', 'Soccer'];

  for (const league of leagues) {
    if (text.toUpperCase().includes(league)) {
      return league;
    }
  }

  return undefined;
}

/**
 * Create a display description for the bet
 */
function createDisplayDescription(betData: Partial<BetData>): string {
  const parts: string[] = [];

  if (betData.gameInfo?.team) {
    parts.push(betData.gameInfo.team);
  }

  if (betData.gameInfo?.line) {
    parts.push(betData.gameInfo.line);
  } else if (betData.type === 'spread' && betData.odds) {
    parts.push(betData.odds);
  }

  if (betData.type && betData.type !== 'unknown') {
    parts.push(`(${betData.type})`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Bet tracked';
}

/**
 * Extract bet data from user message and AI response
 */
export function extractBetData(
  userMessage: string,
  aiResponse?: string
): Omit<BetData, 'id' | 'createdAt' | 'status'> {
  const combinedText = `${userMessage} ${aiResponse || ''}`;

  const amount = extractAmount(userMessage);
  const odds = extractOdds(combinedText);
  const team = extractTeam(combinedText);
  const type = detectBetType(combinedText);
  const league = extractLeague(combinedText);
  const line = odds;

  const betData: Omit<BetData, 'id' | 'createdAt' | 'status'> = {
    type,
    amount,
    odds,
    gameInfo: {
      team,
      league,
      line,
    },
    description: userMessage.slice(0, 100),
  };

  betData.displayDescription = createDisplayDescription(betData);

  return betData;
}

/**
 * Validate that bet data has minimum required information
 */
export function isValidBetData(betData: Partial<BetData>): boolean {
  // A valid bet should have at least an amount or team/game info
  const hasAmount = betData.amount && betData.amount > 0;
  const hasGameInfo =
    betData.gameInfo?.team ||
    betData.gameInfo?.league ||
    betData.description;

  return !!(hasAmount || hasGameInfo);
}
