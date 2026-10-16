import { createElement, type ReactNode } from 'react';
import { h, hRaw } from '../h.js';
import { headingSlug, legacyHeadingSlug } from '../vendor/heading-slug.js';
import { paragraphWithNotes } from '../inline.js';
import { richIcon } from '../icons.js';
import { ICON_STYLES } from '../look-tokens.js';
import { href, safeUrl } from '../url.js';
import type { RenderState } from '../state.js';
import type { Attrs, BlockNode } from '../types.js';
import type { BlockRenderer } from './types.js';

/**
 * The prose blocks: paragraph, heading, lists, checklist, quotation, rule,
 * math, diagram source, file link — the cases of docs-schema `render.ts`'s
 * block switch and `render-editorial.ts`'s quotation.
 */

/** The words of an inline run, for a heading's anchor name. */
export function inlineText(nodes: readonly unknown[] | undefined): string {
  if (!Array.isArray(nodes)) return '';
  let out = '';
  for (const n of nodes) {
    const node = n as { text?: string; content?: readonly unknown[] };
    if (typeof node?.text === 'string') out += node.text;
    else if (node?.content) out += inlineText(node.content);
  }
  return out;
}

/** The link glyph beside a heading — the same SVG as the hosted reader, named by the heading. */
const ANCHOR_GLYPH =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
  'stroke-width="1.25" stroke-linecap="square" aria-hidden="true">' +
  '<path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.1-2.1a2.6 2.6 0 0 0-3.7-3.7l-1 1"/>' +
  '<path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.6 8.7a2.6 2.6 0 0 0 3.7 3.7l1-1"/></svg>';

/**
 * The pre-accent-fix id of a heading as an empty target inside it, so a link
 * shared before the fix still lands; never one that something else answers to.
 */
function legacyTarget(text: string, id: string, s: RenderState): ReactNode {
  const old = legacyHeadingSlug(text);
  if (!old || old === id || s.takenIds.has(old)) return null;
  s.takenIds.add(old);
  return h('span', { id: old, class: 'cf-anchor-alias', 'aria-hidden': 'true' });
}

/** A heading's or grid cell's icon (`blockIconLead`): inline or a tinted tile. */
export function blockIconLead(attrs: Attrs | undefined, s: RenderState, where: 'heading' | 'cell'): ReactNode {
  if (!attrs?.icon) return null;
  const style = (ICON_STYLES as readonly string[]).includes(attrs.iconStyle ?? '') ? attrs.iconStyle : 'inline';
  const tint = where === 'heading' ? attrs.iconColor : attrs.accent;
  const tinted = typeof tint === 'string' && /^#[0-9a-fA-F]{6}$/.test(tint);
  return richIcon(attrs.icon, `blk-icon blk-icon--${where}`, {
    proxy: s.opts.imageProxy,
    icons: s.opts.icons,
    extra: {
      'data-icon-style': style,
      'data-tint': tinted ? '' : null,
      style: tinted ? `--blk-icon-tint:${tint}` : null,
    },
  });
}

const heading: BlockRenderer = (node, r, anchorId) => {
  const s = r.s;
  const words = inlineText(node.content);
  const id = anchorId ?? r.uniqueId(headingSlug(words));
  const level = node.attrs!.level;
  const alias = anchorId ? null : legacyTarget(words, id, s);
  const icon = blockIconLead(node.attrs, s, 'heading');
  // The hero mark goes on the first heading of a page that hides its title, once.
  const hero = s.heroPending;
  s.heroPending = false;
  const anchor = s.anchorsOn
    ? hRaw('a', { class: 'heading-anchor', href: `#${id}`, 'aria-labelledby': id }, ANCHOR_GLYPH)
    : null;
  return h(
    `h${level}`,
    { id, 'data-hero-heading': hero ? '' : null, 'data-icon': icon ? '' : null },
    alias,
    icon,
    r.inline(node.content),
    anchor,
  );
};

const blockquote: BlockRenderer = (node, r) => {
  const a = node.attrs;
  const v = a?.variant;
  const cite = typeof a?.cite === 'string' ? a.cite.trim() : '';
  // A linked cite (a quote of another post) links back to where it was said.
  const link = cite ? safeUrl(a?.citeHref) : '';
  const n = a?.size;
  const sized = typeof n === 'number' && Number.isInteger(n) && n >= 14 && n <= 96;
  return h(
    'blockquote',
    {
      'data-variant': v === 'pull' || v === 'default' ? v : null,
      'data-align': a?.align === 'center' || a?.align === 'start' ? a.align : null,
      'data-quote-size': sized ? '' : null,
      style: sized ? `--quote-size:${n}px` : null,
      'data-quote-post': link && /#post-\d+$/.test(link) ? '' : null,
    },
    r.blocks(node.content),
    cite ? h('footer', { class: 'cf-quote-cite' }, '— ', link ? h('a', { href: link }, cite) : cite) : null,
  );
};

const checked = (node: BlockNode) => Boolean(node.attrs?.checked);

/**
 * A required string attr. The string renderer escapes it, which THROWS on a
 * missing value, and its block guard turns that into "this block renders
 * nothing" — so a missing value throws here too, into the same guard.
 */
export function text(v: unknown): string {
  if (typeof v !== 'string') throw new TypeError('expected a string attr');
  return v;
}

export const CORE: Record<string, BlockRenderer> = {
  // A margin note's block copy follows `</p>` (render-editorial).
  paragraph: (node, r) => paragraphWithNotes(() => r.inline(node.content), r.s),
  heading,
  bulletList: (node, r) => h('ul', null, r.blocks(node.content)),
  checklist: (node, r) => h('ul', { class: 'cf-checklist', 'data-checklist': '' }, r.blocks(node.content)),
  checklistItem: (node, r) =>
    h(
      'li',
      { class: 'cf-checklist-item', 'data-checked': checked(node) ? 'true' : 'false' },
      // `defaultChecked`: a static box React prints as `checked=""` without asking for onChange.
      createElement('input', { type: 'checkbox', defaultChecked: checked(node), disabled: true }),
      r.blocks(node.content),
    ),
  orderedList: (node, r) => h('ol', null, r.blocks(node.content)),
  listItem: (node, r) => h('li', null, r.blocks(node.content)),
  blockquote,
  // The reader hydrates `.mermaid` client-side; the source stays readable with JS off.
  mermaid: (node) => h('pre', { class: 'mermaid', 'data-mermaid': '' }, text(node.attrs?.code)),
  drawing: (node) =>
    h(
      'div',
      { class: 'drawing', 'data-scene': text(node.attrs?.scene) },
      h('span', { class: 'drawing-placeholder' }, 'Drawing'),
    ),
  horizontalRule: () => h('hr'),
  // KaTeX/MathJax renders these client-side from the data attribute.
  math: (node) => h('div', { class: 'math', 'data-latex': text(node.attrs?.latex) }, text(node.attrs?.latex)),
  file: (node) =>
    h('a', { class: 'file', href: href(node.attrs?.url), download: true }, text(node.attrs?.name ?? node.attrs?.url)),
};
