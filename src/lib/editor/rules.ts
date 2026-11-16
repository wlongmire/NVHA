// What /edit is allowed to touch, and checks that stop a bad edit from breaking the site.
// Only content files can be edited: never layouts, styles or code.
import { MAX_TEXT_BYTES } from './config';
import { typeById, getPath, type DocType } from './schema';

const SLUG = '[a-z0-9][a-z0-9-]{0,80}';

/** Which kind of content a repository path is, or null when /edit may not touch it. */
export function typeOfPath(path: string): DocType | null {
  const m = path.match(new RegExp(`^src/content/(events|posts|pages|products)/${SLUG}\\.md$`));
  if (m) return typeById(m[1]) ?? null;
  if (path === 'src/data/home.json') return typeById('home') ?? null;
  return null;
}

export function splitFrontMatter(text: string): { fm: string; body: string } | null {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  return m ? { fm: m[1], body: m[2] } : null;
}

// ---- pictures ----
export const IMAGE_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
/** Pictures the editor may show a preview of: the site's own upload folder only. */
export function previewablePath(path: string): boolean {
  return !path.includes('..') && /^public\/uploads\/[A-Za-z0-9/_.-]+\.(jpe?g|png|webp)$/i.test(path);
}

export function cleanName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base || 'picture';
}

const kindOfBytes = (b: Buffer): 'jpg' | 'png' | 'webp' | null => {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
};

/** Where an uploaded picture goes (public/uploads/YYYY/MM/name.ext), checked by what the file really is, not by its name. */
export function planUpload(fileName: string, bytes: Buffer, taken: (path: string) => boolean, now = new Date()): { path: string; reference: string } | { error: string } {
  const kind = kindOfBytes(bytes);
  if (!kind) return { error: 'That is not a JPG, PNG or WebP picture.' };
  const dir = `public/uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const stem = cleanName(fileName);
  let path = `${dir}/${stem}.${kind}`;
  for (let n = 2; taken(path) && n < 50; n++) path = `${dir}/${stem}-${n}.${kind}`;
  return { path, reference: '/' + path.replace(/^public\//, '') };
}

// ---- checks before saving ----
const isStr = (v: unknown): v is string => typeof v === 'string';
const UNSAFE = /<\s*(script|iframe|object|embed|style)\b|javascript:|\son\w+\s*=/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WHEN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
const picture = (v: unknown) => v === '' || (isStr(v) && /^\/uploads\/[A-Za-z0-9/_.-]+\.(jpe?g|png|webp)$/i.test(v) && !v.includes('..'));
const webLink = (v: unknown) => v === '' || (isStr(v) && /^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|\/[A-Za-z0-9/_#?=&.-]*)$/.test(v));

function walk(v: unknown, visit: (s: string, where: string) => void, where = '') {
  if (isStr(v)) visit(v, where);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, visit, `${where}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, visit, where ? `${where}.${k}` : k);
}

/** Returns a list of plain-language problems; empty means the document may be saved. */
export function validate(type: DocType, data: Record<string, any>, body: string, original?: Record<string, any>): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['Nothing to save.'];
  if (Buffer.byteLength(JSON.stringify(data) + body) > MAX_TEXT_BYTES) errors.push('This is too long to save. Shorten the text.');
  walk(data, (s, where) => { if (UNSAFE.test(s)) errors.push(`"${where}" contains something that is not allowed (scripts, frames or styles).`); });
  if (UNSAFE.test(body)) errors.push('The text contains something that is not allowed (scripts, frames or styles).');

  // every form field with a length limit or a required mark
  const check = (fields: typeof type.fields, obj: any, prefix = '') => {
    for (const f of fields) {
      if (f.virtual) continue;
      const v = getPath(obj, f.key);
      const label = prefix + f.label;
      if (f.required && (v === undefined || v === null || v === '')) errors.push(`${label} is required.`);
      if (isStr(v) && f.max && v.length > f.max) errors.push(`${label} is too long (most ${f.max} characters).`);
      if (f.type === 'image' && v !== undefined && !picture(v)) errors.push(`${label}: choose a picture with the Upload button.`);
      if (f.type === 'checkbox' && v !== undefined && typeof v !== 'boolean') errors.push(`${label} must be on or off.`);
      if (f.type === 'repeater' && Array.isArray(v) && f.fields) v.forEach((row, i) => check(f.fields!, row, `${f.label} ${i + 1}: `));
    }
  };
  check(type.fields, data);

  switch (type.id) {
    case 'events':
      if (!isStr(data.start) || !WHEN.test(data.start)) errors.push('Choose the event date.');
      if (data.end !== '' && !(isStr(data.end) && WHEN.test(data.end))) errors.push('The last day is not a valid date.');
      else if (isStr(data.end) && data.end && isStr(data.start) && data.end < data.start) errors.push('The event cannot end before it starts.');
      if (!webLink(data.link)) errors.push('The RSVP link must be a full web address starting with https://');
      break;
    case 'posts':
      if (!isStr(data.date) || !DAY.test(data.date)) errors.push('Choose the article date.');
      break;
    case 'products':
      if (typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price < 0 || data.price > 10000) errors.push('Enter the price as a number, like 15 or 24.50.');
      if (data.buyLink !== '' && !(isStr(data.buyLink) && /^https:\/\/[^\s<>"]+$/.test(data.buyLink))) errors.push('The checkout link must be a full web address starting with https://');
      break;
    case 'home': {
      // the homepage is one JSON file: it must keep the same shape, with only the editable values changed
      if (original) for (const k of Object.keys(original)) {
        if (!(k in data)) errors.push(`The homepage is missing "${k}".`);
        else if (Array.isArray(original[k]) !== Array.isArray(data[k]) || typeof original[k] !== typeof data[k]) errors.push(`"${k}" has the wrong kind of value.`);
      }
      const amounts = getPath(data, 'donate.amounts');
      if (!Array.isArray(amounts) || amounts.length > 5 || amounts.some((a) => typeof a !== 'number' || a < 1 || a > 100000)) errors.push('Give today amounts must be up to five whole numbers.');
      break;
    }
  }
  return errors;
}
