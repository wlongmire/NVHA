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
  if (path === 'src/data/people.json') return typeById('people') ?? null;
  if (path === 'src/data/site.json') return typeById('site') ?? null;
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
// The old website's picture addresses are accepted too, so the temporary photos on Board & Staff can be saved around.
const OLD_SITE_PICTURE = /^https:\/\/nickvirgiliohaiku\.org\/wp-content\/uploads\/[A-Za-z0-9/_.-]+$/;
const picture = (v: unknown) => v === '' || (isStr(v) && (OLD_SITE_PICTURE.test(v) || (/^\/uploads\/[A-Za-z0-9/_.-]+\.(jpe?g|png|webp)$/i.test(v) && !v.includes('..'))));
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
      if (!webLink(getPath(data, 'featured.href'))) errors.push('The featured button must go to a page on this site (starting with /) or a full web address.');
      for (const k of ['educators.href', 'educators.prospectusHref']) if (!webLink(getPath(data, k))) errors.push('The For Educators buttons must go to a page on this site (starting with /) or a full web address.');
      const amounts = getPath(data, 'donate.amounts');
      if (!Array.isArray(amounts) || amounts.length > 5 || amounts.some((a) => typeof a !== 'number' || a < 1 || a > 100000)) errors.push('Give today amounts must be up to five whole numbers.');
      break;
    }
    case 'people': {
      if (original) for (const k of Object.keys(original)) if (!(k in data) || Array.isArray(original[k]) !== Array.isArray(data[k])) errors.push(`"${k}" has the wrong kind of value.`);
      const KINDS = ['instagram', 'facebook', 'x', 'linkedin', 'youtube', 'bluesky', 'website', 'email'];
      for (const group of ['board', 'staff']) {
        (Array.isArray(data[group]) ? data[group] : []).forEach((p: any, i: number) => {
          const who = p?.name || `${group} ${i + 1}`;
          for (const l of Array.isArray(p?.links) ? p.links : []) {
            if (!KINDS.includes(l?.type)) errors.push(`${who}: choose a kind for each link.`);
            else if (l.type === 'email' ? !(isStr(l.href) && /^(mailto:)?[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(l.href)) : !(isStr(l.href) && /^https?:\/\/[^\s<>"]+$/.test(l.href))) errors.push(`${who}: a link needs a full web address starting with https://`);
          }
        });
      }
      break;
    }
    case 'site': {
      if (original) for (const k of Object.keys(original)) if (!(k in data) || Array.isArray(original[k]) !== Array.isArray(data[k]) || typeof original[k] !== typeof data[k]) errors.push(`"${k}" has the wrong kind of value.`);
      const a = data.announcements;
      if (!Array.isArray(a) || a.length < 1 || a.length > 6) errors.push('Keep between one and six announcement messages.');
      else a.forEach((m: any, i: number) => { if (!isStr(m?.text) || !m.text.trim()) errors.push(`Message ${i + 1} is empty.`); if (!webLink(m?.href)) errors.push(`Message ${i + 1} must go to a page on this site (starting with /) or a full web address.`); });
      if (data.contactFormAction !== '' && !(isStr(data.contactFormAction) && /^https:\/\/[^\s<>"]+$/.test(data.contactFormAction))) errors.push('The contact form address must start with https://');
      break;
    }
  }
  return errors;
}
