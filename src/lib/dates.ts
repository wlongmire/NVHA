// Event dates are written the way staff type them (2026-06-28 or 2026-06-28T14:00) and have no time zone: they are Camden time.
const parts = (s: string) => {
  const [d, t = ''] = s.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h = 0, min = 0] = t ? t.split(':').map(Number) : [];
  return new Date(y, m - 1, day, h, min);
};

export const eventDate = (s: string) => parts(s);
export const hasTime = (s: string) => s.includes('T');

/** An event is upcoming until the end of the day it ends (or starts, when it has no end date). */
export function isUpcoming(e: { start: string; end: string }, now = new Date()): boolean {
  const last = parts((e.end || e.start).slice(0, 10));
  last.setDate(last.getDate() + 1);
  return last > now;
}

export const fmtDay = (s: string) => parts(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
export const fmtMonthDay = (s: string) => parts(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
export const fmtTime = (s: string) => parts(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const fmtPostDate = (s: string) => parts(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
