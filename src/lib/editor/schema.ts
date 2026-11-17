// What staff can edit on /edit, described as data: which kinds of content there are, and which form fields each one has.
// This file has no server-only code, so the /edit page (in the browser) and the save checks (on the server) share it.

export type Field = {
  key: string;                       // the key in the file; "seo.title" reaches into a nested object
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'checkbox' | 'image' | 'lines' | 'numbers' | 'repeater';
  help?: string;
  required?: boolean;
  max?: number;                      // longest allowed text
  placeholder?: string;
  fields?: Field[];                  // repeater: the fields of each row
  addLabel?: string;                 // repeater: text of the "add" button
  virtual?: boolean;                 // shown in the form but turned into other keys when saving (see toFile)
};

export type DocType = {
  id: 'events' | 'posts' | 'pages' | 'products' | 'home';
  label: string;                     // sidebar tab
  singular: string;
  format: 'md' | 'json';
  dir?: string;                      // folder of markdown files
  file?: string;                     // the one JSON file (home)
  titleKey: string;
  creatable: boolean;
  body?: { label: string; help: string };
  fields: Field[];
  empty: () => Record<string, unknown>;
};

const SEO: Field[] = [
  { key: 'seo.title', label: 'Search result title', type: 'text', max: 120, help: 'Shown on Google. Leave empty to use the page title. Around 60 characters works best.' },
  { key: 'seo.description', label: 'Search result description', type: 'textarea', max: 320, help: 'One or two sentences shown under the title on Google. Around 150 characters works best.' },
  { key: 'seo.ogImage', label: 'Picture for sharing', type: 'image', help: 'Shown when the page is shared on Facebook, Instagram or by text. Leave empty to use the main picture.' },
];
const DRAFT: Field = { key: 'draft', label: 'Hide from the site', type: 'checkbox', help: 'Tick this to keep it off the website. Nothing is deleted.' };

export const TYPES: DocType[] = [
  {
    id: 'events', label: 'Events', singular: 'event', format: 'md', dir: 'src/content/events', titleKey: 'title', creatable: true,
    body: { label: 'About this event', help: 'What happens, who it is for, anything to bring.' },
    fields: [
      { key: 'title', label: 'Event name', type: 'text', required: true, max: 200 },
      { key: 'startDate', label: 'Date', type: 'date', required: true, virtual: true },
      { key: 'startTime', label: 'Start time', type: 'time', virtual: true, help: 'Leave empty for an all-day event.' },
      { key: 'endDate', label: 'Last day', type: 'date', virtual: true, help: 'Only for events that run more than one day.' },
      { key: 'endTime', label: 'End time', type: 'time', virtual: true },
      { key: 'venue', label: 'Where', type: 'text', max: 200, placeholder: 'Nick Virgilio Writers House' },
      { key: 'address', label: 'Address', type: 'text', max: 200 },
      { key: 'link', label: 'RSVP or sign-up link', type: 'text', max: 500, help: 'A full web address starting with https://' },
      { key: 'cost', label: 'Cost', type: 'text', max: 100, placeholder: 'Free' },
      { key: 'image', label: 'Picture', type: 'image' },
      { key: 'featured', label: 'Feature this event', type: 'checkbox' },
      DRAFT,
    ],
    empty: () => ({ title: '', start: '', end: '', allDay: true, venue: 'Nick Virgilio Writers House', address: '1801 Broadway, Camden, NJ', link: '', cost: 'Free', image: '', featured: false, draft: false }),
  },
  {
    id: 'posts', label: 'Articles', singular: 'article', format: 'md', dir: 'src/content/posts', titleKey: 'title', creatable: true,
    body: { label: 'Article text', help: 'Use ## for headings, **bold**, *italic*, and - for bullet lists.' },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, max: 200 },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'excerpt', label: 'Short summary', type: 'textarea', max: 500, help: 'Shown on the Articles page.' },
      { key: 'image', label: 'Picture', type: 'image' },
      ...SEO,
      DRAFT,
    ],
    empty: () => ({ title: '', date: new Date().toISOString().slice(0, 10), excerpt: '', image: '', seo: {}, draft: false }),
  },
  {
    id: 'pages', label: 'Pages', singular: 'page', format: 'md', dir: 'src/content/pages', titleKey: 'title', creatable: false,
    body: { label: 'Page text', help: 'Use ## for headings, **bold**, *italic*, and - for bullet lists. Forms (donate, newsletter) are added automatically.' },
    fields: [
      { key: 'title', label: 'Page title', type: 'text', required: true, max: 200 },
      { key: 'lede', label: 'Opening sentence', type: 'textarea', max: 400 },
      { key: 'image', label: 'Top picture', type: 'image' },
      { key: 'imageAlt', label: 'Describe the picture', type: 'text', max: 200, help: 'For people who cannot see it, and for search engines.' },
      ...SEO,
    ],
    empty: () => ({}),
  },
  {
    id: 'products', label: 'Store', singular: 'product', format: 'md', dir: 'src/content/products', titleKey: 'title', creatable: true,
    body: { label: 'Description', help: 'A sentence or two about the book or item.' },
    fields: [
      { key: 'title', label: 'Product name', type: 'text', required: true, max: 200 },
      { key: 'price', label: 'Price (US dollars)', type: 'number', required: true },
      { key: 'image', label: 'Picture', type: 'image' },
      { key: 'buyLink', label: 'Checkout link', type: 'text', max: 500, help: 'The link where people pay (from Stripe, Square or similar). Starts with https://' },
      { key: 'inStock', label: 'In stock', type: 'checkbox' },
      DRAFT,
    ],
    empty: () => ({ title: '', price: 0, image: '', inStock: true, buyLink: '', variations: [], draft: false }),
  },
  {
    id: 'home', label: 'Homepage', singular: 'homepage', format: 'json', file: 'src/data/home.json', titleKey: 'hero.headline', creatable: false,
    fields: [
      { key: 'hero.headline', label: 'Headline', type: 'text', required: true, max: 120 },
      { key: 'hero.text', label: 'Intro text', type: 'textarea', max: 400 },
      { key: 'hero.image', label: 'Hero picture', type: 'image' },
      { key: 'hero.imageAlt', label: 'Describe the hero picture', type: 'text', max: 200 },
      { key: 'kickers.house', label: 'Line above the "At the Writers House" heading', type: 'text', max: 80 },
      { key: 'kickers.poets', label: 'Line above the "Poets & Haikuists" heading', type: 'text', max: 80 },
      { key: 'kickers.educators', label: 'Line above the "For Educators" heading', type: 'text', max: 80 },
      { key: 'kickers.support', label: 'Line above the "Support Our Work" heading', type: 'text', max: 80 },
      { key: 'kickers.supporters', label: 'Line above the "Our Supporters" heading', type: 'text', max: 80 },
      { key: 'featured.kind', label: 'Featured panel: short line above the title', type: 'text', max: 80, placeholder: 'Presenting our newest publication:' },
      { key: 'featured.title', label: 'Featured panel: title', type: 'text', required: true, max: 100 },
      { key: 'featured.text', label: 'Featured panel: description (leave a blank line between paragraphs)', type: 'textarea', max: 900 },
      { key: 'featured.image', label: 'Featured panel: picture', type: 'image' },
      { key: 'featured.imageAlt', label: 'Featured panel: describe the picture', type: 'text', max: 200 },
      { key: 'featured.link', label: 'Featured panel: button text', type: 'text', max: 40, placeholder: 'Learn more' },
      { key: 'featured.href', label: 'Featured panel: where the button goes', type: 'text', max: 300, placeholder: '/store/' },
      { key: 'donate.amounts', label: 'Give today amounts (dollars, separated by commas)', type: 'numbers', help: 'Qgiv offers its own amounts too. Keep these to three or four.' },
      ...SEO,
    ],
    empty: () => ({}),
  },
];

export const typeById = (id: string) => TYPES.find((t) => t.id === id);

// ---- reading and writing nested keys ("seo.title") ----
export function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj: any, path: string, value: unknown) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }
  o[keys[keys.length - 1]] = value;
}

// ---- events keep their date as one text value ("2026-06-28" or "2026-06-28T14:00"); the form shows date and time apart ----
const clock = (s: unknown) => (typeof s === 'string' && s.includes('T') ? s.slice(11, 16) : '');
const day = (s: unknown) => (typeof s === 'string' ? s.slice(0, 10) : '');

export function fromFile(type: DocType, data: Record<string, any>): Record<string, any> {
  if (type.id !== 'events') return structuredClone(data);
  return { ...structuredClone(data), startDate: day(data.start), startTime: clock(data.start), endDate: day(data.end), endTime: clock(data.end) };
}

export function toFile(type: DocType, form: Record<string, any>): Record<string, any> {
  const data = structuredClone(form);
  if (type.id === 'events') {
    const { startDate = '', startTime = '', endDate = '', endTime = '' } = data;
    data.start = startDate ? startDate + (startTime ? `T${startTime}` : '') : '';
    data.end = endDate ? endDate + (endTime ? `T${endTime}` : '') : (endTime && startDate ? `${startDate}T${endTime}` : '');
    data.allDay = !startTime;
    for (const k of ['startDate', 'startTime', 'endDate', 'endTime']) delete data[k];
  }
  if (type.id === 'posts' || type.id === 'pages' || type.id === 'home') {
    const seo = data.seo;
    if (seo && typeof seo === 'object') for (const k of Object.keys(seo)) if (seo[k] === '' || seo[k] == null) delete seo[k];
  }
  return data;
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
