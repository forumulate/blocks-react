import { h } from '../h.js';
import { href } from '../url.js';
import type { BlockNode } from '../types.js';
import type { BlockRenderer } from './types.js';

/**
 * The sources and corrections blocks — docs-schema `render-newsroom.ts`.
 * Both are the document's own data, so a customer site draws them exactly as
 * the hosted reader does. The dead-link marks are hosted data (the scheduled
 * check's results) and are not drawn here; the product card is hosted-only
 * (../coverage.ts).
 *
 * English words, as the hosted renderer prints with no page language — the
 * parity test holds the two to the same markup.
 */

type SourceItem = {
  title: string;
  url: string;
  publisher?: string | null;
  date?: string | null;
  note?: string | null;
};
type CorrectionItem = { date: string; note: string; diff?: string | null };

/** docs-schema `newsroomDate`: the page's language (English here), in UTC. */
function newsroomDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const full = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso;
  const d = new Date(full);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

const EXT_REL = 'nofollow noopener';

function sources(node: BlockNode) {
  const a = (node.attrs ?? {}) as {
    items?: SourceItem[];
    style?: string | null;
    heading?: string | null;
    markDead?: boolean | null;
  };
  // docs-schema `drawnSources`: a half-written row is not drawn.
  const items = (a.items ?? []).filter((i) => i?.url && i.title?.trim());
  if (!items.length) return null;
  const heading =
    a.heading === '' ? null : h('p', { class: 'doc-sources-heading' }, a.heading || 'Sources');
  return h(
    'section',
    {
      class: 'doc-sources',
      'data-sources': '',
      'data-style': a.style || null,
      'data-mark-dead': a.markDead === true ? 'on' : a.markDead === false ? 'off' : null,
    },
    heading,
    h(
      'ol',
      { class: 'doc-sources-list' },
      ...items.map((i) =>
        h(
          'li',
          { class: 'doc-source' },
          i.publisher ? h('span', { class: 'doc-source-publisher' }, i.publisher) : null,
          i.publisher ? ' ' : null,
          h(
            'cite',
            { class: 'doc-source-title' },
            h('a', { class: 'doc-source-link', href: href(i.url), rel: EXT_REL }, i.title),
          ),
          i.date ? ' ' : null,
          i.date
            ? h('time', { class: 'doc-source-date', datetime: i.date }, newsroomDate(i.date))
            : null,
          i.note ? ' ' : null,
          i.note ? h('span', { class: 'doc-source-note' }, i.note) : null,
        ),
      ),
    ),
  );
}

function corrections(node: BlockNode) {
  const a = (node.attrs ?? {}) as {
    items?: CorrectionItem[];
    style?: string | null;
    heading?: string | null;
  };
  // docs-schema `drawnCorrections`: a correction without a note is not drawn.
  const items = [...(a.items ?? []).filter((i) => i?.note?.trim())].sort((x, y) =>
    (y.date ?? '').localeCompare(x.date ?? ''),
  );
  if (!items.length) return null;
  const heading =
    a.heading === '' ? null : h('p', { class: 'doc-corrections-heading' }, a.heading || 'Updates');
  return h(
    'aside',
    { class: 'doc-corrections', 'data-corrections': '', 'data-style': a.style || null },
    heading,
    h(
      'ol',
      { class: 'doc-corrections-list' },
      ...items.map((i) =>
        h(
          'li',
          { class: 'doc-correction' },
          h('span', { class: 'doc-correction-label' }, 'Updated'),
          ' ',
          h('time', { datetime: i.date }, newsroomDate(i.date)),
          h('span', { class: 'doc-correction-sep' }, ': '),
          h('span', { class: 'doc-correction-note' }, i.note),
          i.diff
            ? h(
                'details',
                { class: 'doc-correction-diff' },
                h('summary', null, 'What changed'),
                h('pre', null, i.diff),
              )
            : null,
        ),
      ),
    ),
  );
}

export const NEWSROOM: Record<string, BlockRenderer> = {
  sources: (node) => sources(node),
  corrections: (node) => corrections(node),
};
