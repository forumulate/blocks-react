import type { ReactNode } from 'react';
import { h } from '../h.js';
import type { BlockNode } from '../types.js';
import type { BlockRenderer, R } from './types.js';

/**
 * The in-page changelog (`updates` / `update`) — docs-schema
 * `render-updates.ts`. No JS on the hosted page either: every entry is visible
 * and the tag chips are plain `?tag=` links, so a customer site gets the same
 * working list without our hydrator.
 */

/** docs-schema `UPDATE_MONTHS` (render-context.ts); constants-parity would not see it, the parity test does. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** UTC on purpose (as hosted): a server west of UTC must not print the day before. */
function formatUpdateDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** The only form of a tag that reaches an attribute or the `?tag=` query. */
function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function updateAnchor(date: string, taken: Set<string>): string {
  const base = `update-${slugifyTag(date) || 'entry'}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

type Inline = { type: string; text?: string; content?: Inline[] };
const words = (nodes: Inline[] | undefined): string =>
  (nodes ?? []).map((n) => (typeof n.text === 'string' ? n.text : words(n.content))).join('');

/** First heading (else first sentence of the first paragraph), and the first paragraph. */
function updateSummary(node: BlockNode): { title: string; summary: string } {
  const kids = (node.content ?? []) as unknown as Inline[];
  const heading = kids.find((k) => k.type === 'heading');
  const para = kids.find((k) => k.type === 'paragraph');
  const summary = words(para?.content).trim();
  const title = words(heading?.content).trim() || (/^(.*?[.!?])(\s|$)/.exec(summary)?.[1] ?? summary).trim();
  return { title: title || String(node.attrs!.date), summary };
}

const tagsOf = (node: BlockNode): string[] => (node.attrs!.tags as string[] | undefined) ?? [];

function updateRow(node: BlockNode, taken: Set<string>): ReactNode {
  const date = (node.attrs!.date as string | undefined) ?? '';
  const id = updateAnchor(date, taken);
  const slugs = tagsOf(node).map(slugifyTag).filter(Boolean);
  const { title, summary } = updateSummary(node);
  return h(
    'article',
    { class: 'cf-update', id, 'data-update-tags': slugs.join(' '), 'data-update-date': date },
    h('time', { class: 'cf-update-date', datetime: date }, formatUpdateDate(date)),
    h('a', { class: 'cf-update-title', href: `#${id}` }, title),
    summary && summary !== title ? h('p', { class: 'cf-update-sum' }, summary) : null,
  );
}

function updateFull(node: BlockNode, r: R): ReactNode {
  const tags = tagsOf(node);
  const date = (node.attrs!.date as string | undefined) ?? '';
  const slugs = tags.map(slugifyTag).filter(Boolean);
  const chips = tags.length
    ? h(
        'div',
        { class: 'cf-update-tags' },
        ...(tags.map((t) => h('span', { class: 'cf-update-tag', 'data-tag': slugifyTag(t) }, t))),
      )
    : null;
  return h(
    'article',
    { class: 'cf-update', 'data-update-tags': slugs.join(' '), 'data-update-date': date },
    h('div', { class: 'cf-update-date' }, formatUpdateDate(date)),
    chips,
    h('div', { class: 'cf-update-body' }, r.blocks(node.content)),
  );
}

const updates: BlockRenderer = (node, r) => {
  const f = node.attrs?.format;
  const format = f === 'short' || f === 'list' ? f : 'full';
  const entries = node.content!.filter((c) => c.type === 'update');

  // Union of tags in first-seen order, one chip per slug ("Bug Fix" = "bug fix").
  const seen = new Map<string, string>();
  for (const e of entries) {
    for (const tag of tagsOf(e)) {
      const slug = slugifyTag(tag);
      if (slug && !seen.has(slug)) seen.set(slug, tag);
    }
  }
  const filter =
    seen.size > 0
      ? h(
          'div',
          { class: 'cf-updates-filter', role: 'group', 'aria-label': 'Filter updates by tag' },
          ...([
            h('a', { class: 'cf-updates-chip is-active', 'data-tag': '', href: '?' }, 'All'),
            ...[...seen.entries()].map(([slug, label]) =>
              h('a', { class: 'cf-updates-chip', 'data-tag': slug, href: `?tag=${encodeURIComponent(slug)}` }, label),
            ),
          ]),
        )
      : null;

  const ids = new Set<string>();
  const list = h(
    'div',
    { class: 'cf-updates-list' },
    ...(entries.map((e) => (format === 'list' ? updateRow(e, ids) : updateFull(e, r)))),
  );
  return h('div', { class: 'cf-updates', 'data-updates': '', 'data-format': format }, filter, list);
};

/** A lone `update` outside its `updates` — the hosted fallback, as a stray `tab` is. */
const update: BlockRenderer = (node, r) => updateFull(node, r);

export const UPDATES: Record<string, BlockRenderer> = { updates, update };
