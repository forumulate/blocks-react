import type { ContentEntry, ContentTypeSchema } from '../src/schema.js';

/** A landing-page content type using every field type, and an entry filling all of it. */
export const pageSchema: ContentTypeSchema = {
  key: 'page',
  fields: [
    { key: 'title', type: 'text' },
    { key: 'summary', type: 'textarea' },
    { key: 'slug', type: 'slug' },
    { key: 'body', type: 'richText' },
    { key: 'cover', type: 'media' },
    { key: 'legacyImage', type: 'image' },
    { key: 'cta', type: 'link' },
    { key: 'site', type: 'url' },
    { key: 'published', type: 'date' },
    { key: 'updatedAt', type: 'datetime' },
    { key: 'price', type: 'money' },
    { key: 'tags', type: 'multiselect' },
    { key: 'kind', type: 'select' },
    { key: 'count', type: 'number' },
    { key: 'snippet', type: 'code' },
    { key: 'brochure', type: 'file' },
    { key: 'meta', type: 'json' },
    { key: 'accent', type: 'color' },
    { key: 'seo', type: 'seo' },
    { key: 'fullName', type: 'computed' },
    { key: 'secret', type: 'text', visibility: 'internal' },
    { key: 'author', type: 'reference' },
    {
      key: 'pricing',
      type: 'group',
      fields: [
        { key: 'heading', type: 'text' },
        { key: 'tiers', type: 'array', fields: [{ key: 'name', type: 'text' }, { key: 'price', type: 'money' }] },
      ],
    },
    { key: 'layout', type: 'blocks', allowed: ['hero', 'feature'] },
  ],
  blockTypes: {
    feature: {
      fields: [
        { key: 'heading', type: 'text' },
        { key: 'body', type: 'richText' },
        { key: 'image', type: 'media' },
      ],
      variants: [{ key: 'video', fields: { add: [{ key: 'video', type: 'url' }], omit: ['image'] } }],
    },
  },
};

export const authorSchema: ContentTypeSchema = {
  key: 'author',
  fields: [
    { key: 'name', type: 'text' },
    { key: 'photo', type: 'media' },
  ],
};

const rich = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

export const pageEntry: ContentEntry = {
  id: 'e1',
  type: 'page',
  fields: {
    title: 'Pricing',
    summary: 'Line one\nLine two',
    slug: 'pricing',
    body: rich('Body copy'),
    cover: {
      url: 'https://cdn.test/c.jpg',
      width: 1600,
      height: 900,
      alt: 'Cover',
      caption: 'A caption',
      focal: { x: 0.25, y: 0.75 },
      blurDataURL: 'data:image/png;base64,AAAA',
      variants: { '1280': 'https://cdn.test/c-1280.jpg', '640': 'https://cdn.test/c-640.jpg' },
    },
    legacyImage: '/api/assets/legacy.png',
    cta: { type: 'url', url: 'https://acme.test/start', label: 'Start', newTab: true },
    site: 'https://acme.test',
    published: '2026-10-15',
    updatedAt: '2026-10-15T23:30:00Z',
    price: { min: 70000, max: 90000, currency: 'EUR', period: 'year' },
    tags: ['a', 'b'],
    kind: 'landing',
    count: 3,
    snippet: { language: 'ts', code: 'const x = 1;' },
    brochure: { url: '/api/assets/b.pdf', name: 'Brochure.pdf' },
    meta: { any: 'thing' },
    accent: '#ff0000',
    seo: { title: 'SEO' },
    fullName: 'Ada Lovelace',
    secret: 'never shown',
    author: { id: 'a1', type: 'author', fields: { name: 'Ada', photo: { url: '/api/assets/ada.jpg', width: 64, height: 64 } } },
    pricing: {
      heading: 'Plans',
      tiers: [
        { id: 'r1', name: 'Free', price: 0 },
        { id: 'r2', name: 'Pro', price: { amount: 49, currency: 'USD' } },
      ],
    },
    layout: [
      { id: 'b1', blockType: 'hero', title: 'Ship faster', sub: 'With less', layout: 'split' },
      { id: 'b2', blockType: 'feature', heading: 'Fast', body: rich('Very'), image: { url: '/api/assets/f.png' } },
      { id: 'b3', blockType: 'feature', variant: 'video', heading: 'Watch', video: 'https://acme.test/v', image: { url: '/x.png' } },
      { id: 'b4', blockType: 'mystery', heading: 'No schema', body: rich('inferred') },
    ],
  },
};
