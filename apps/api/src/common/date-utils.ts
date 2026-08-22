/** Adds `days` to `date` in UTC — avoids daylight-saving shifts affecting date-only math. */
export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Adds `months` to `date`, clamping the day-of-month to the target
 * month's actual length (e.g. anchored on the 31st, adding a month that
 * only has 30 days lands on the 30th — never rolls over into the month
 * after). Without this, `new Date(...)`'s native month-overflow behavior
 * would silently shift the anchor day across months over time.
 */
export function addUtcMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const firstOfTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const daysInTargetMonth = new Date(
    Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  firstOfTargetMonth.setUTCDate(Math.min(day, daysInTargetMonth));
  return firstOfTargetMonth;
}
