import { describe, expect, it } from 'vitest';
import { both, doc } from './parity.js';

/** Visual parity for the sources and corrections blocks. */

const cases: Record<string, unknown[]> = {
  sources: [
    {
      type: 'sources',
      attrs: {
        items: [
          {
            publisher: 'Nike News',
            title: 'Air Max Day',
            url: 'https://news.example.com/a',
            date: '2026-03-20',
            note: 'via press release',
          },
          { title: 'No publisher <b>', url: 'https://news.example.com/b' },
          { title: 'Hostile', url: 'javascript:alert(1)', date: '2026-03-20T10:00:00Z' },
          { title: '', url: 'https://half.example.com' },
        ],
      },
    },
  ],
  'sources styled, own heading, marked': [
    {
      type: 'sources',
      attrs: {
        style: 'compact',
        heading: 'Reading',
        markDead: true,
        items: [{ title: 'A', url: 'https://a.example.com' }],
      },
    },
  ],
  'sources heading hidden': [
    {
      type: 'sources',
      attrs: {
        heading: '',
        markDead: false,
        items: [{ title: 'A', url: 'https://a.example.com' }],
      },
    },
  ],
  'sources empty': [{ type: 'sources', attrs: { items: [] } }],
  corrections: [
    {
      type: 'corrections',
      attrs: {
        items: [
          {
            date: '2026-11-01',
            note: 'Release moved from Nov 7 to Nov 14.',
            diff: '- Nov 7\n+ Nov 14',
          },
          { date: '2026-11-05T09:30:00Z', note: 'Added the EU retailers.' },
          { date: 'garbled', note: 'A date that does not parse.' },
          { date: '', note: '   ' },
        ],
      },
    },
  ],
  'corrections banner, heading hidden': [
    {
      type: 'corrections',
      attrs: { style: 'banner', heading: '', items: [{ date: '2026-11-01', note: 'Fixed.' }] },
    },
  ],
};

describe('visual parity: newsroom', () => {
  for (const [name, content] of Object.entries(cases)) {
    it(name, () => {
      const { hosted, react } = both(doc(...content));
      expect(react).toBe(hosted);
    });
  }
});
