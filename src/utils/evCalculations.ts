/**
 * EV (Expected Value) Calculation Utilities
 *
 * These functions help calculate the expected value of sports bets
 * using American odds format and estimated win probabilities.
 */

/**
 * Convert American odds to implied probability
 * @param americanOdds - American odds format (e.g., +150, -200)
 * @returns Implied probability as a decimal (0-1)
 */
export function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    // Positive odds: probability = 100 / (odds + 100)
    return 100 / (americanOdds + 100);
  } else {
    // Negative odds: probability = |odds| / (|odds| + 100)
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

/**
 * Convert American odds to decimal odds
 * @param americanOdds - American odds format (e.g., +150, -200)
 * @returns Decimal odds
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

/**
 * Calculate Expected Value (EV) of a bet
 * @param trueWinProbability - Your estimated true probability of winning (0-1)
 * @param americanOdds - The odds offered by the bookmaker
 * @param stake - The amount you're betting (default: 100)
 * @returns Expected value as a percentage of stake
 */
export function calculateEV(
  trueWinProbability: number,
  americanOdds: number,
  stake: number = 100
): number {
  // Calculate the profit if we win
  let profit: number;
  if (americanOdds > 0) {
    profit = stake * (americanOdds / 100);
  } else {
    profit = stake * (100 / Math.abs(americanOdds));
  }

  // EV = (Win Probability × Profit) - (Loss Probability × Stake)
  const lossProbability = 1 - trueWinProbability;
  const ev = (trueWinProbability * profit) - (lossProbability * stake);

  // Return as percentage of stake
  return (ev / stake) * 100;
}

/**
 * Calculate EV for a spread or total bet
 * @param trueWinProbability - Your estimated probability of covering the spread/total (0-1)
 * @param americanOdds - The odds for this spread/total option
 * @param stake - The amount you're betting (default: 100)
 * @returns Expected value as a percentage of stake
 */
export function calculateSpreadEV(
  trueWinProbability: number,
  americanOdds: number,
  stake: number = 100
): number {
  // Spread and total bets use the same EV calculation as moneyline
  return calculateEV(trueWinProbability, americanOdds, stake);
}

/**
 * Format EV for display
 * @param ev - Expected value as a percentage
 * @returns Formatted string (e.g., "+5.2%", "-2.1%")
 */
export function formatEV(ev: number): string {
  const sign = ev >= 0 ? '+' : '';
  return `${sign}${ev.toFixed(1)}%`;
}

/**
 * Get color class based on EV value
 * @param ev - Expected value as a percentage
 * @returns Tailwind color class
 */
export function getEVColorClass(ev: number): string {
  if (ev >= 5) {
    return 'text-green-600 font-bold';
  } else if (ev >= 2) {
    return 'text-green-500';
  } else if (ev >= 0) {
    return 'text-yellow-600';
  } else {
    return 'text-muted-foreground';
  }
}

/**
 * Determine if a bet has positive EV
 * @param ev - Expected value as a percentage
 * @returns True if EV is positive
 */
export function isPositiveEV(ev: number): boolean {
  return ev > 0;
}

/**
 * Calculate the Kelly Criterion bet size
 * @param trueWinProbability - Your estimated probability of winning (0-1)
 * @param americanOdds - The odds offered
 * @param bankroll - Your total bankroll
 * @param fraction - Kelly fraction (default 0.25 for quarter Kelly)
 * @returns Recommended bet size
 */
export function calculateKellyBetSize(
  trueWinProbability: number,
  americanOdds: number,
  bankroll: number,
  fraction: number = 0.25
): number {
  const decimalOdds = americanToDecimal(americanOdds);
  const q = 1 - trueWinProbability; // Probability of losing
  const b = decimalOdds - 1; // Net odds received

  // Kelly formula: f = (bp - q) / b
  const kellyPercentage = (b * trueWinProbability - q) / b;

  // Apply fraction and ensure non-negative
  const fractionalKelly = Math.max(0, kellyPercentage * fraction);

  return bankroll * fractionalKelly;
}

/**
 * Remove vig (overround) from odds to get fair odds
 * @param odds - Array of all outcomes' implied probabilities
 * @returns Array of fair probabilities that sum to 1
 */
export function removeVig(impliedProbabilities: number[]): number[] {
  const totalProb = impliedProbabilities.reduce((sum, prob) => sum + prob, 0);

  if (totalProb <= 1) {
    // No vig present
    return impliedProbabilities;
  }

  // Remove vig proportionally
  return impliedProbabilities.map(prob => prob / totalProb);
}

/**
 * Calculate the break-even win rate for given odds
 * @param americanOdds - The odds offered
 * @returns Break-even win rate as a percentage
 */
export function calculateBreakEvenRate(americanOdds: number): number {
  return calculateImpliedProbability(americanOdds) * 100;
}
