import type { APIRoute } from 'astro';
import { dump as yamlDump, load as yamlLoad, JSON_SCHEMA } from 'js-yaml';
import { guard, json } from '../../../lib/editor/auth';
import { Conflict, read, shaOf, write } from '../../../lib/editor/storage';
import { splitFrontMatter, typeOfPath, validate } from '../../../lib/editor/rules';

export const prerender = false;

// One endpoint for every editable document, as data instead of raw text. The form on /edit sends and receives these
// objects; this file turns them back into the Markdown or JSON file, after the checks in rules.ts.

const pathOf = (url: string) => new URL(url).searchParams.get('path') ?? '';
const dumpYaml = (data: unknown) => yamlDump(data, { lineWidth: -1, noRefs: true, quotingType: '"' });

/** Comment lines at the very top of a file's front matter, so a save never loses them. */
function leadingComments(text: string | null): string {
  const parts = text ? splitFrontMatter(text) : null;
  if (!parts) return '';
  const lines: string[] = [];
  for (const l of parts.fm.split('\n')) { if (l.startsWith('#')) lines.push(l); else break; }
  return lines.length ? lines.join('\n') + '\n' : '';
}

const toMarkdown = (data: unknown, body: string, current: string | null) => {
  const text = body.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  return `---\n${leadingComments(current)}${dumpYaml(data)}---\n${text ? `\n${text}\n` : ''}`;
};

export const GET: APIRoute = async ({ request }) => {
  const blocked = guard(request);
  if (blocked) return blocked;
  const path = pathOf(request.url);
  const type = typeOfPath(path);
  if (!type) return json({ error: 'That file cannot be edited here.' }, 400);
  try {
    const doc = await read(path);
    if (!doc) return json({ error: 'That file was not found.' }, 404);
    if (type.format === 'json') return json({ path, type: type.id, data: JSON.parse(doc.text), body: '', sha: doc.sha });
    const parts = splitFrontMatter(doc.text);
    if (!parts) return json({ error: 'That file is not formatted the way the editor expects.' }, 422);
    return json({ path, type: type.id, data: yamlLoad(parts.fm, { schema: JSON_SCHEMA }) ?? {}, body: parts.body.replace(/^\n+/, ''), sha: doc.sha });
  } catch (e: any) {
    return json({ error: e.message }, 502);
  }
};

async function save(request: Request, creating: boolean) {
  const blocked = guard(request, { change: true });
  if (blocked) return blocked;
  const input = await request.json().catch(() => null);
  const path = String(input?.path ?? '');
  const type = typeOfPath(path);
  if (!type || (creating && !type.creatable)) return json({ error: 'That file cannot be edited here.' }, 400);
  const data = input?.data;
  const body = typeof input?.body === 'string' ? input.body : '';
  try {
    const current = await shaOf(path);
    if (creating && current) return json({ error: 'Something with that name already exists.' }, 409);
    if (!creating && !current) return json({ error: 'That file no longer exists.' }, 404);
    if (!creating && String(input?.sha ?? '') !== current)
      return json({ error: 'Someone else changed this after you opened it. Reload to see their changes.' }, 409);
    const existing = creating ? null : (await read(path))?.text ?? null;

    let original: Record<string, any> | undefined;
    if (existing && type.format === 'json') original = JSON.parse(existing);
    const errors = validate(type, data, body, original);
    if (errors.length) return json({ error: 'Not saved. Please fix this first:', problems: errors }, 422);

    const text = type.format === 'json' ? JSON.stringify(data, null, 2) + '\n' : toMarkdown(data, body, existing);
    const sha = await write(path, text, `${creating ? 'Add' : 'Edit'} ${path} from the edit page`, creating ? undefined : current!);
    return json({ ok: true, sha });
  } catch (e: any) {
    if (e instanceof Conflict) return json({ error: 'The file changed while saving. Reload and try again.' }, 409);
    return json({ error: e.message ?? 'Saving failed.' }, 502);
  }
}

export const PUT: APIRoute = ({ request }) => save(request, false);
export const POST: APIRoute = ({ request }) => save(request, true);
