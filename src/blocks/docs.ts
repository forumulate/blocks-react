import type { ReactElement, ReactNode } from 'react';
import { h, hRaw, list, type HtmlAttrs } from '../h.js';
import { iconSvg } from '../icons.js';
import { href, src } from '../url.js';
import { cssColorValue } from '../vendor/look-css.js';
import { headingSlug } from '../vendor/heading-slug.js';
import { responsiveFilled } from '../vendor/responsive-css.js';
import type { RenderState } from '../state.js';
import type { Attrs, BlockNode } from '../types.js';
import { text } from './core.js';
import { cardsLookStamp, hintLookStamp, stampAttrs } from './docs-r4.js';
import { cardsR5Stamp, mergeStamps } from './docs-r5.js';
import { tabs } from './docs-tabs.js';
import type { BlockRenderer, R } from './types.js';

/**
 * The docs blocks — docs-schema `render-docs-blocks.ts`: hint, tabs, cards,
 * stepper and button. Prompt is in ./prompt, the wave-D blocks (field,
 * example, file tree, swatch, buttons, collapsible group) in ./docs-extra.
 *
 * Every attribute the docs wave added prints only when set: an unset block is
 * the markup it always was.
 */

/**
 * `blockIconHtml`: a glyph NAME drawn as our (or the extended set's) `<svg>`,
 * anything else (an emoji, an arrow) as text — never markup. The caller wraps
 * it; `value.trim()` throws on a non-string exactly as the hosted helper does.
 */
export function blockIcon(
  tag: string,
  attrs: HtmlAttrs,
  value: string,
  s: RenderState,
): ReactElement {
  const v = value.trim();
  const svg = iconSvg(v, s.opts.icons);
  return svg ? hRaw(tag, attrs, svg) : h(tag, attrs, v);
}

/** `iconSpan`: an author's glyph in a decorative span, or nothing when unset. */
export function iconSpan(cls: string, icon: string | null | undefined, s: RenderState): ReactNode {
  return icon?.trim() ? blockIcon('span', { class: cls, 'aria-hidden': 'true' }, icon, s) : null;
}

const hint: BlockRenderer = (node, r) => {
  // `kind` keeps the author's word for the theme to paint; the title and icon lead the body.
  const a = node.attrs!;
  const icon = iconSpan('hint-icon', a.icon, r.s);
  const title = a.title ? h('p', { class: 'hint-title' }, text(a.title)) : null;
  return h(
    'div',
    {
      class: `hint hint-${a.style}`,
      'data-kind': a.kind ? text(a.kind) : null,
      'data-icon': icon ? '' : null,
      // This callout's own tone / title gap / edge (./docs-r4).
      ...stampAttrs(hintLookStamp(a)),
    },
    icon,
    title,
    r.blocks(node.content),
  );
};

/** Panels are normally drawn by `tabs`; this is the fallback for a lone tab. */
const tab: BlockRenderer = (node, r) =>
  h('div', { class: 'tab', 'data-title': text(node.attrs!.title) }, r.blocks(node.content));

const cards: BlockRenderer = (node, r) => {
  // Columns per screen size, each step filled from the one above; the look
  // variant. Unset: the auto-fill grid it always was.
  const a = node.attrs;
  const steps = (a?.columns ? responsiveFilled(a.columns) : {}) as Partial<Record<'lg' | 'md' | 'sm', unknown>>;
  const vars = (['lg', 'md', 'sm'] as const)
    .filter((k) => typeof steps[k] === 'number' && (steps[k] as number) >= 1 && (steps[k] as number) <= 6)
    .map((k) => `--cards-${k}:${steps[k]}`);
  // This grid's own card look, min width, gaps, rule and band, in one style.
  const own = mergeStamps(cardsLookStamp(a), cardsR5Stamp(a));
  const allVars = [...vars, ...own.vars];
  return h(
    'div',
    {
      class: 'cards',
      'data-cols': vars.length ? '' : null,
      style: allVars.length ? allVars.join(';') : null,
      'data-variant': a?.variant && a.variant !== 'default' ? String(a.variant) : null,
      ...own.data,
    },
    r.blocks(node.content),
  );
};

/** A picture's intrinsic size as `width`/`height` (`imageBox`), so its band is reserved before it loads. */
function imageBox(url: unknown, s: RenderState): HtmlAttrs {
  if (!s.opts.imageSize || !url) return {};
  const size = s.opts.imageSize(url as string);
  if (!size || !(size.width > 0) || !(size.height > 0)) return {};
  return { width: String(Math.round(size.width)), height: String(Math.round(size.height)) };
}

const card: BlockRenderer = (node, r) => {
  const s = r.s;
  const a = node.attrs!;
  const proxy = s.opts.imageProxy;
  // A glyph NAME draws our glyph, anything else stays text; a picture (`iconUrl`) beats the glyph.
  const icon = a.iconUrl
    ? h('img', { class: 'card-icon card-icon-img', src: src(a.iconUrl, proxy), alt: '', 'aria-hidden': 'true' })
    : a.icon?.trim()
      ? blockIcon('span', { class: 'card-icon', 'aria-hidden': 'true' }, a.icon, s)
      : null;
  const kicker = a.kicker ? h('div', { class: 'card-kicker' }, text(a.kicker)) : null;
  const badge = a.badge ? h('span', { class: 'card-badge' }, text(a.badge)) : null;
  const title = h('div', { class: 'card-title' }, text(a.title), badge);
  const cta = a.cta ? h('div', { class: 'card-cta' }, `${text(a.cta)} →`) : null;
  const cover = a.coverUrl
    ? h('img', { class: 'card-cover', src: src(a.coverUrl, proxy), ...imageBox(a.coverUrl, s), alt: '' })
    : null;
  const desc = a.description ? h('div', { class: 'card-desc' }, text(a.description)) : null;
  const tint = a.color ? cssColorValue(a.color) : null;
  const look: HtmlAttrs = {
    'data-icon-style': a.iconStyle && a.iconStyle !== 'plain' ? String(a.iconStyle) : null,
    style: tint ? `--card-tint:${tint}` : null,
  };
  return a.href
    ? h('a', { class: 'card', href: href(a.href), ...look }, cover, icon, kicker, title, desc, cta)
    : h('div', { class: 'card', ...look }, cover, icon, kicker, title, desc, cta);
};

const stepper: BlockRenderer = (node, r) => {
  const a = node.attrs;
  // The steps still go through the block switch (their hooks), told their
  // stepper's settings through the render state — the render is synchronous,
  // and a nested stepper restores its parent's.
  const outer = r.s.stepper;
  r.s.stepper = a;
  try {
    return h(
      'ol',
      {
        class: 'stepper',
        'data-heading-level': a?.headingLevel ? String(a.headingLevel) : null,
        style: a?.titleSize ? `--step-title-size:${a.titleSize}px` : null,
        'data-collapsible': a?.collapsible ? '' : null,
      },
      r.blocks(node.content),
    );
  } finally {
    r.s.stepper = outer;
  }
};

/** One step, as its stepper asks for it. */
function renderStep(node: BlockNode, r: R, parent: Attrs | undefined): ReactNode {
  const s = r.s;
  const a: Attrs = node.attrs ?? {};
  const level = parent?.headingLevel;
  const title = a.title
    ? level
      ? h(`h${level}`, { id: r.uniqueId(headingSlug(text(a.title))), class: 'step-title' }, a.title)
      : h('div', { class: 'step-title' }, text(a.title))
    : null;
  const badges = a.badges?.length
    ? h('span', { class: 'step-badges' }, list(a.badges.map((b: unknown) => h('span', { class: 'step-badge' }, text(b)))))
    : null;
  const icon = iconSpan('step-icon', a.icon, s);
  const kids: BlockNode[] = node.content ?? [];
  // `aside`: the last block sits in a column beside the title.
  const asideKid = a.aside && kids.length > 1 ? kids[kids.length - 1]! : null;
  // Rendered even when the step turns out collapsible (and rendered again
  // below): the hosted renderer builds it first, so ids inside are claimed twice.
  const body = asideKid
    ? [
        h('div', { class: 'step-main' }, icon, title, badges, r.blocks(kids.slice(0, -1))),
        h('div', { class: 'step-aside' }, r.blocks([asideKid])),
      ]
    : [icon, title, badges, r.blocks(kids)];
  const data: HtmlAttrs = { 'data-icon': icon ? '' : null, 'data-aside': asideKid ? '' : null };
  if (parent?.collapsible && a.title) {
    return h(
      'li',
      { class: 'step', ...data },
      h('details', { open: true }, h('summary', null, icon, title, badges), r.blocks(kids)),
    );
  }
  return h('li', { class: 'step', ...data }, ...body);
}

const button: BlockRenderer = (node, r) => {
  // A call-to-action. A link (default) is an `<a>` that works with no JS; an
  // action is a `<button>` the hosted hydrator wires to Ask-AI/search/a tab group.
  const a = node.attrs!;
  const label = text(a.label ?? '');
  const style = a.style === 'secondary' || a.style === 'link' || a.style === 'pill' ? a.style : 'primary';
  const cls = `doc-btn doc-btn-${style}`;
  // `width: full` stretches it; unset is its label's width.
  const width = a.width === 'full' ? 'full' : null;
  const icon = a.icon ? blockIcon('span', { class: 'doc-btn-icon', 'aria-hidden': 'true' }, a.icon, r.s) : null;
  const inner = [icon, h('span', { class: 'doc-btn-label' }, label)];
  const action = a.action;
  // `match` marks the current tab of a pill row against the page being read —
  // a hosted-only fact (`currentPath`), so it never applies here.
  if (!action || action === 'link') return h('a', { class: cls, href: href(a.href), 'data-width': width }, ...inner);
  return h(
    'button',
    {
      type: 'button',
      class: cls,
      'data-action': text(action),
      'data-query': a.query != null ? text(a.query) : null,
      'data-target-slug': a.targetSlug != null ? text(a.targetSlug) : null,
      'data-href': a.href != null ? href(a.href, '') : null,
      'data-width': width,
    },
    ...inner,
  );
};

export const DOCS: Record<string, BlockRenderer> = {
  hint,
  tab,
  tabs,
  cards,
  card,
  stepper,
  step: (node, r) => renderStep(node, r, r.s.stepper),
  button,
};
