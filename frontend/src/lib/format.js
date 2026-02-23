/**
 * Format a 24h time string (HH:mm or HH:mm:ss) to 12h AM/PM.
 * @param {string} t - e.g. "14:00", "09:30", "14:00:00"
 * @returns {string} e.g. "2:00 PM", "9:30 AM"
 */
export function formatTime12h(t) {
  if (t == null || String(t).trim() === '') return '—';
  const parts = String(t).trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
