import type { APIRoute } from 'astro';
import { load as yamlLoad, JSON_SCHEMA } from 'js-yaml';
import { guard, json } from '../../../lib/editor/auth';
import { list, read, storageMode, storageReady } from '../../../lib/editor/storage';
import { splitFrontMatter } from '../../../lib/editor/rules';
import { getPath, typeById } from '../../../lib/editor/schema';

export const prerender = false;

const front = (text: string | undefined): Record<string, any> => {
  const parts = text ? splitFrontMatter(text) : null;
  if (!parts) return {};
  try { return (yamlLoad(parts.fm, { schema: JSON_SCHEMA }) as any) ?? {}; } catch { return {}; }
};

/** Runs `fn` over `items` a few at a time, so listing many files does not flood GitHub. */
async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

// The list down the left side of /edit: ?type=events|posts|pages|products. (The homepage is a single document.)
export const GET: APIRoute = async ({ request }) => {
  const blocked = guard(request);
  if (blocked) return blocked;
  if (!storageReady()) return json({ error: 'GITHUB_TOKEN is not set, so there is nowhere to save yet.' }, 503);
  const type = typeById(new URL(request.url).searchParams.get('type') ?? '');
  if (!type || !type.dir) return json({ error: 'Unknown kind of content.' }, 400);
  try {
    const files = (await list(type.dir)).filter((f) => f.name.endsWith('.md'));
    const items = await pool(files, 8, async (f) => {
      const d = front((await read(f.path))?.text);
      return { id: f.name.replace(/\.md$/, ''), path: f.path, title: String(d.title ?? f.name), date: String(d.start ?? d.date ?? ''), draft: !!d.draft };
    });
    // events: newest first; articles: newest first; pages and products: by title
    const byDate = type.id === 'events' || type.id === 'posts';
    items.sort((a, b) => (byDate ? b.date.localeCompare(a.date) : a.title.localeCompare(b.title)));
    return json({ mode: storageMode(), items });
  } catch (e: any) {
    return json({ error: e.message ?? 'Could not load the list.' }, 502);
  }
};
