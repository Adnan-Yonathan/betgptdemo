/**
 * EST TIMEZONE UTILITIES FOR EDGE FUNCTIONS
 * All date calculations use America/New_York timezone (Eastern Time)
 * This ensures consistent behavior regardless of server timezone
 */

/**
 * Gets the current date/time in Eastern Time
 */
export function getNowInEST(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * Gets midnight (start of day) today in Eastern Time
 */
export function getTodayStartEST(): Date {
  const nowEST = getNowInEST();
  return new Date(nowEST.getFullYear(), nowEST.getMonth(), nowEST.getDate());
}

/**
 * Gets end of day tomorrow in Eastern Time (23:59:59)
 */
export function getTomorrowEndEST(): Date {
  const todayStart = getTodayStartEST();
  const tomorrowEnd = new Date(todayStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 2); // Start of day after tomorrow
  tomorrowEnd.setMilliseconds(-1); // End of tomorrow
  return tomorrowEnd;
}

/**
 * Formats a date in YYYY-MM-DD format using EST timezone
 * This should be used instead of toISOString().split('T')[0] to avoid UTC conversion issues
 */
export function formatDateEST(date: Date = new Date()): string {
  const estDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const year = estDate.getFullYear();
  const month = String(estDate.getMonth() + 1).padStart(2, '0');
  const day = String(estDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date in YYYY-MM-DD format using EST timezone
 */
export function getTodayEST(): string {
  return formatDateEST(new Date());
}

/**
 * Gets yesterday's date in YYYY-MM-DD format using EST timezone
 */
export function getYesterdayEST(): string {
  const nowEST = getNowInEST();
  nowEST.setDate(nowEST.getDate() - 1);
  return formatDateEST(nowEST);
}

/**
 * Adds days to a date and returns YYYY-MM-DD format in EST
 */
export function addDaysEST(days: number, baseDate: Date = new Date()): string {
  const estDate = new Date(baseDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  estDate.setDate(estDate.getDate() + days);
  return formatDateEST(estDate);
}
