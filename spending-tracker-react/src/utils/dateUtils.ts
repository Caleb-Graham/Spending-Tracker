import { format } from "date-fns";

/**
 * Get today's date as a YYYY-MM-DD string in local timezone.
 * Use this instead of `new Date().toISOString().split('T')[0]` which returns UTC date.
 */
export const getLocalToday = (): string => {
  return format(new Date(), "yyyy-MM-dd");
};

/**
 * Get a Date object for today at midnight in local timezone.
 */
export const getLocalTodayDate = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/**
 * Format a date string (YYYY-MM-DD or ISO) as a local date string.
 * Strips timezone info to prevent date shifting.
 *
 * @example
 * normalizeDate('2025-11-01T00:00:00+00:00') // returns '2025-11-01'
 * normalizeDate('2025-11-01') // returns '2025-11-01'
 */
export const normalizeDate = (dateStr: string): string => {
  return dateStr.split("T")[0];
};

/**
 * Parse a date string as a local date, avoiding timezone shifting.
 * Use this instead of `new Date(dateStr)` or `parseISO(dateStr)` for date-only values.
 *
 * @example
 * parseLocalDate('2025-11-01') // returns Date for Nov 1, 2025 at local midnight
 */
export const parseLocalDate = (dateStr: string): Date => {
  const datePart = normalizeDate(dateStr);
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Format a date for display. Handles both Date objects and ISO strings.
 *
 * @example
 * formatDate('2025-11-01', 'MMM yyyy') // returns 'Nov 2025'
 * formatDate(new Date(), 'MMMM d, yyyy') // returns 'January 2, 2026'
 */
export const formatDate = (date: Date | string, formatStr: string): string => {
  const dateObj = typeof date === "string" ? parseLocalDate(date) : date;
  return format(dateObj, formatStr);
};

/**
 * Convert a Date object to YYYY-MM-DD string in local timezone.
 */
export const toDateString = (date: Date): string => {
  return format(date, "yyyy-MM-dd");
};
