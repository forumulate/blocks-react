import type { ReactNode } from 'react';
import { h, list } from '../h.js';
import { cssColorValue } from '../vendor/look-css.js';
import { lengthCss, responsiveFilled } from '../vendor/responsive-css.js';
import { SPACE_TOKENS } from '../look-tokens.js';
import { NO_HOOKS, blockLookStamp, stampHooks } from '../look.js';
import { sectionLook } from '../section-look.js';
import { href, isSafeUrl } from '../url.js';
import type { Attrs, BlockNode } from '../types.js';
import { blockIconLead, inlineText, text } from './core.js';
import type { BlockRenderer } from './types.js';

/**
 * The layout blocks: a row of columns, a layout grid and its cells, a named
 * section slot, and the spacer — docs-schema `render.ts`, `render-editorial.ts`
 * (`renderColumns`) and `spacer-block.ts`.
 */

const columns: BlockRenderer = (node, r) => {
  const b = node.attrs?.breakout;
  const row = h(
    'div',
    { class: 'columns', 'data-breakout': b === 'wide' || b === 'full' ? b : null },
    r.blocks(node.content),
  );
  const caption = node.attrs?.caption;
  if (typeof caption !== 'string' || !caption.trim()) return row;
  // One caption for the whole row: the figure is the block's root (its hooks
  // land there), and the row's own look is stamped on the row itself.
  return h(
    'figure',
    { class: 'columns-figure' },
    stampHooks(row, null, NO_HOOKS, blockLookStamp(node)),
    h('figcaption', null, caption),
  );
};

const column: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs ?? {};
  // A share of the row as GROWTH from a zero basis, so the gutter never wraps it.
  const width = typeof a.width === 'number' ? a.width : null;
  return h(
    'div',
    {
      class: 'column',
      style: width !== null ? `flex:${width} 1 0;min-width:0` : null,
      'data-width': width,
      'data-role': a.role === 'aside' ? 'aside' : null,
      'data-sticky': a.sticky ? '' : null,
      'data-fit': a.fit === 'content' ? 'content' : null,
      'data-align': a.align === 'end' ? 'end' : null,
    },
    r.blocks(node.content),
  );
};

const grid: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs ?? {};
  const cols = Math.min(12, Math.max(1, a.cols ?? 12));
  return h(
    'div',
    {
      class: 'doc-grid',
      'data-cols': cols,
      style: `--doc-grid-cols:${cols}`,
      'data-gap': a.gap && a.gap !== 'md' ? a.gap : null,
    },
    r.blocks(node.content),
  );
};

/** Plain words of the first heading under `nodes` — the name a stretched link reads out. */
function firstHeadingText(nodes: readonly BlockNode[] | undefined): string {
  for (const n of nodes ?? []) {
    if (n.type === 'heading') return inlineText(n.content).trim();
    const inner = firstHeadingText(n.content);
    if (inner) return inner;
  }
  return '';
}

const gridItem: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs ?? {};
  // `border` is `true` (the theme's hairline) or a colour for it.
  const borderColor = typeof a.border === 'string' ? cssColorValue(a.border as never) : null;
  const colSpan = Math.min(12, Math.max(1, a.colSpan ?? 6));
  const col = a.colStart ? `${a.colStart} / span ${colSpan}` : `span ${colSpan}`;
  const row = a.rowStart
    ? `${a.rowStart}${a.rowSpan ? ` / span ${a.rowSpan}` : ''}`
    : a.rowSpan
      ? `span ${a.rowSpan}`
      : '';
  const vars =
    (a.mdSpan ? `;--md-span:${a.mdSpan}` : '') +
    (a.smSpan ? `;--sm-span:${a.smSpan}` : '') +
    (borderColor ? `;--cell-border:${borderColor}` : '');
  // A linked cell: one stretched link over the card, named by its first heading.
  let link: ReactNode = null;
  if (a.href && isSafeUrl(a.href)) {
    const name = firstHeadingText(node.content);
    link = h('a', { class: 'grid-item-link', href: href(a.href), 'aria-label': name || null });
  }
  return h(
    'div',
    {
      class: 'doc-grid-item',
      style: `grid-column:${col}${row ? `;grid-row:${row}` : ''};min-width:0${vars}`,
      'data-bg': a.bg && a.bg !== 'none' ? a.bg : null,
      'data-pad': a.pad && a.pad !== 'none' ? a.pad : null,
      'data-align': a.align && a.align !== 'top' ? a.align : null,
      'data-border': a.border === true || borderColor ? '' : null,
      'data-md-span': a.mdSpan || null,
      'data-sm-span': a.smSpan || null,
      'data-linked': link ? '' : null,
    },
    blockIconLead(a, r.s, 'cell'),
    r.blocks(node.content),
    link,
  );
};

/** A paragraph a reader would not see: only whitespace and line breaks (an untouched slot). */
function isBlankParagraph(n: BlockNode): boolean {
  return (
    n?.type === 'paragraph' &&
    (n.content ?? []).every(
      (c) => c?.type === 'hardBreak' || (typeof c?.text === 'string' && /^\s*$/.test(c.text) && !c.marks?.length),
    )
  );
}

const section: BlockRenderer = (node, r, anchorId) => {
  const s = r.s;
  const key = text(node.attrs!.key);
  // Claimed before the slot's blocks render, so a heading inside it cannot take the same id.
  const slotId = s.idPrefix + key;
  if (!anchorId) s.takenIds.add(slotId);
  const spec = s.opts.sections?.find((x) => x.key === node.attrs!.key);
  const mode = spec?.render ?? (spec ? 'labelled' : 'plain');
  const width = node.attrs?.width;
  const look = sectionLook(node.attrs ?? {}, s.opts.imageProxy);
  const kids = Array.isArray(node.content) ? node.content : [];
  const parts = kids.map((c) => r.blocks([c]));
  // A LABELLED slot the author left empty publishes nothing (no heading over
  // nothing): every child rendered nothing or is a blank paragraph.
  if (mode === 'labelled' && kids.every((c, i) => parts[i] === null || isBlankParagraph(c))) return null;
  const body = list(parts);
  return h(
    'section',
    {
      id: anchorId ?? slotId,
      'data-section': key,
      'data-width': width && width !== 'boxed' ? width : null,
      ...look.attrs,
      class: `doc-section doc-section--${mode}`,
    },
    mode === 'labelled' && spec ? h('h2', { class: 'doc-section-title' }, spec.label) : null,
    body,
    look.layer,
  );
};

const SPACER_REM: Record<string, number> = { none: 0, xs: 0.5, sm: 1, md: 2, lg: 4, xl: 6 };

function spacerHeightCss(v: unknown): string | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 800 ? `${v}px` : null;
  if (typeof v === 'string' && (SPACE_TOKENS as readonly string[]).includes(v)) {
    const rem = SPACER_REM[v]!;
    return rem === 0 ? '0px' : `calc(${rem}rem * var(--reader-space-section, 1))`;
  }
  return typeof v === 'string' ? lengthCss(v) : null;
}

/** An empty, hidden box whose steps the stylesheet picks per screen size. */
const spacer: BlockRenderer = (node) => {
  const steps = responsiveFilled(node.attrs?.height ?? undefined);
  const set: string[] = [];
  const vars: string[] = [];
  const none: string[] = [];
  for (const k of ['lg', 'md', 'sm'] as const) {
    const step = steps[k];
    const css = step === undefined ? null : spacerHeightCss(step);
    if (css) {
      set.push(k);
      vars.push(`--spacer-${k}:${css}`);
      if (/^0(px)?$/.test(css)) none.push(k);
    }
  }
  return h('div', {
    class: 'doc-spacer',
    'aria-hidden': 'true',
    'data-h': set.length ? set.join(' ') : null,
    style: set.length ? vars.join(';') : null,
    'data-none': none.length ? none.join(' ') : null,
  });
};

export const LAYOUT: Record<string, BlockRenderer> = { columns, column, grid, gridItem, section, spacer };
