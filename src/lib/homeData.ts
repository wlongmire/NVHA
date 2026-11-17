// What every homepage version needs: the next events (or the latest past ones when nothing is scheduled) and the store items.
import { getCollection } from 'astro:content';
import { isUpcoming } from './dates';

export async function loadHome() {
  const events = await getCollection('events', (e) => !e.data.draft);
  const next = events.filter((e) => isUpcoming(e.data)).sort((a, b) => a.data.start.localeCompare(b.data.start)).slice(0, 3);
  const upcoming = next.length ? next : [...events].sort((a, b) => b.data.start.localeCompare(a.data.start)).slice(0, 3);
  const products = (await getCollection('products', (p) => !p.data.draft));
  return { hasNext: next.length > 0, upcoming, products };
}
