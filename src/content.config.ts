import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Search-engine settings for one page. Anything left empty falls back to the site defaults.
const seo = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  canonical: z.string().optional(),
  ogImage: z.string().optional(),
  robots: z.enum(['noindex']).optional(),
}).default({});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),                     // YYYY-MM-DD
    excerpt: z.string().default(''),
    image: z.string().default(''),
    draft: z.boolean().default(false),
    seo,
    oldUrl: z.string().optional(),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    start: z.string(),                    // YYYY-MM-DD, or YYYY-MM-DDTHH:MM when it has a start time
    end: z.string().default(''),
    allDay: z.boolean().default(false),
    venue: z.string().default(''),
    address: z.string().default(''),
    link: z.string().default(''),         // RSVP or more-info link
    cost: z.string().default(''),
    image: z.string().default(''),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    oldUrl: z.string().optional(),
  }),
});

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    title: z.string(),
    price: z.number(),
    image: z.string().default(''),
    inStock: z.boolean().default(true),
    buyLink: z.string().default(''),      // the checkout link for this item (Stripe, Snipcart, etc.)
    variations: z.array(z.object({ id: z.number().optional(), attributes: z.string() })).default([]),
    draft: z.boolean().default(false),
    oldUrl: z.string().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    eyebrow: z.string().default(''),
    lede: z.string().default(''),
    image: z.string().default(''),
    imageAlt: z.string().default(''),
    seo,
    embed: z.enum(['donate', 'newsletter', 'contact']).optional(),   // adds the donation form, newsletter signup or contact buttons below the text
    noindex: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, events, products, pages };
