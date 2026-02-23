/**
 * Shared calendar date helpers.
 */

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DEFAULT_YEAR_MIN = 1900;
export const DEFAULT_YEAR_MAX = 2100;

export function toYYYYMMDD(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

export function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

export function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function addMonths(d, n) {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

export function addYears(d, n) {
  const out = new Date(d);
  out.setFullYear(out.getFullYear() + n);
  return out;
}

export function clampDate(date, minDate, maxDate) {
  if (!date) return date;
  let d = date;
  if (minDate && d < minDate) d = new Date(minDate.getTime());
  if (maxDate && d > maxDate) d = new Date(maxDate.getTime());
  return d;
}
