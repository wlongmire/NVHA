// The groups on the Latest Posts page. A post picks one in its "Category" setting; the page shows the newest three of each,
// then lists every post below with search.
export const CATEGORIES = [
  { name: 'Learn Haiku', blurb: 'Guides, lessons and ideas for writing and reading haiku.' },
  { name: 'Nick Virgilio & Camden', blurb: 'The life, work and city behind the haiku.' },
  { name: 'Programs & Events', blurb: 'Workshops, readings, walks and contests at the Writers House.' },
] as const;
export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name) as [string, ...string[]];
