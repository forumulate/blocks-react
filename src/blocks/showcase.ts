import { createElement, type ReactNode } from 'react';
import { h, hRaw, list } from '../h.js';
import { PRICING_MAX_PERIODS } from '../look-tokens.js';
import { href, src } from '../url.js';
import type { RenderState } from '../state.js';
import type { Attrs } from '../types.js';
import { text } from './core.js';
import { ICONS, carouselShell, clampInt, iconElement, marqueeShell } from './ix-shared.js';
import type { BlockRenderer } from './types.js';

/**
 * The DATA blocks — docs-schema `render-showcase.ts`: pricing, testimonials,
 * the logo wall and stats. None needs script to say what it says: the pricing
 * toggle is radio inputs and CSS (`:has(:checked)`) — a browser without `:has`
 * shows every period's price, longer but never wrong — and stats print their
 * FINAL number; the count-up is decoration the enhancer adds over it.
 */

/** What a check and a cross say to a screen reader (render-showcase `STATE_WORDS`). */
export const STATE_WORDS = { yes: 'Included', no: 'Not included' } as const;

// ---- pricing ---------------------------------------------------------------

/** "49" → "49", 12500 → "12,500", 9.5 → "9.50" when the other prices have cents. */
export function formatAmount(n: number, decimals?: number): string {
  const d = decimals ?? (Number.isInteger(n) ? 0 : 2);
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function price(p: unknown, currency: string, suffix: string): ReactNode {
  if (typeof p === 'number' && Number.isFinite(p)) {
    return list([
      h('span', { class: 'doc-pricing-amount' }, `${text(currency)}${formatAmount(p)}`),
      suffix ? h('span', { class: 'doc-pricing-suffix' }, text(suffix)) : null,
    ]);
  }
  if (typeof p === 'string' && p.trim()) return h('span', { class: 'doc-pricing-amount' }, p.trim());
  return h('span', { class: 'doc-pricing-amount', 'aria-label': 'Not offered' }, '—');
}

/** One price per period, each tagged with its period so the CSS shows one. */
function prices(plan: Attrs, a: Attrs, n: number, tag: 'p' | 'span'): ReactNode {
  const currency = a.currency ?? '';
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const period = a.periods[i]!;
    out.push(h(tag, { class: 'doc-pricing-price', 'data-period': i }, price(plan.prices[i], currency, period.suffix ?? '')));
  }
  return list(out);
}

function featureMark(f: Attrs | undefined): { state: string; node: ReactNode } {
  const state = f ? (f.state ?? 'yes') : 'no';
  if (state === 'text' && f?.value) return { state, node: h('span', { class: 'doc-pricing-value' }, text(f.value)) };
  const yes = state !== 'no';
  return {
    state: yes ? 'yes' : 'no',
    node: list([
      iconElement(yes ? 'check' : 'cross'),
      h('span', { class: 'sr-only' }, yes ? STATE_WORDS.yes : STATE_WORDS.no),
    ]),
  };
}

function cta(plan: Attrs): ReactNode {
  if (!plan.cta?.label) return null;
  const style = plan.highlighted ? 'primary' : 'secondary';
  return h('a', { class: `doc-btn doc-btn-${style} doc-pricing-cta`, href: href(plan.cta.href) }, text(plan.cta.label));
}

function badge(plan: Attrs): ReactNode {
  if (!plan.highlighted && !plan.badge) return null;
  return h('span', { class: 'doc-pricing-badge' }, plan.badge?.trim() || 'Popular');
}

/**
 * The period toggle: a fieldset of native radios — a real radio group to a
 * keyboard (arrow keys) and a screen reader, working with script off. The
 * plans read the checked one with `:has()`.
 */
function periodToggle(id: string, a: Attrs, n: number, def: number): ReactNode {
  if (n < 2) return null;
  const opts = a.periods.slice(0, n).map((p: Attrs, i: number) =>
    h(
      'label',
      { class: 'doc-pricing-option' },
      // `defaultChecked`: a static choice React prints as `checked=""` without asking for onChange.
      createElement('input', {
        type: 'radio',
        className: 'doc-pricing-radio',
        name: `${id}-period`,
        value: String(i),
        'data-i': i,
        defaultChecked: i === def,
      }),
      h('span', null, text(p.label)),
    ),
  );
  return h(
    'fieldset',
    { class: 'doc-pricing-toggle' },
    h('legend', { class: 'sr-only' }, 'Billing period'),
    ...opts,
  );
}

/**
 * The comparison table: one row per feature (in the order they first appear
 * across the plans), one column per plan. The header row is sticky; on a
 * phone the table scrolls sideways inside its own box.
 */
function pricingTable(a: Attrs, plans: Attrs[], n: number): ReactNode {
  const rows: string[] = [];
  const seen = new Set<string>();
  for (const p of plans)
    for (const f of p.features)
      if (!seen.has(f.text)) {
        seen.add(f.text);
        rows.push(f.text);
      }
  const cols = plans.map((plan) =>
    h(
      'th',
      { scope: 'col', 'data-highlighted': plan.highlighted ? '' : null },
      badge(plan),
      h('span', { class: 'doc-pricing-name' }, text(plan.name)),
      h('span', { class: 'doc-pricing-prices' }, prices(plan, a, n, 'span')),
      cta(plan),
    ),
  );
  const body = rows.map((rowText) =>
    h(
      'tr',
      null,
      h('th', { scope: 'row' }, text(rowText)),
      ...plans.map((plan) => {
        const m = featureMark(plan.features.find((f: Attrs) => f.text === rowText));
        return h('td', { 'data-state': m.state }, m.node);
      }),
    ),
  );
  return h(
    'div',
    { class: 'doc-pricing-table-wrap' },
    h(
      'table',
      { class: 'doc-pricing-table' },
      h('caption', { class: 'sr-only' }, 'Plan comparison'),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, 'Feature')), ...cols)),
      h('tbody', null, list(body)),
    ),
  );
}

const pricing: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs!;
  const plans: Attrs[] = a.plans ?? [];
  if (!plans.length || !a.periods?.length) return null;
  const id = r.uniqueId('pricing');
  const n = Math.min(a.periods.length, PRICING_MAX_PERIODS);
  const def = clampInt(a.defaultPeriod, 0, n - 1, 0);
  const layout = a.layout === 'table' ? 'table' : 'cards';
  const rootAttrs = {
    class: `doc-pricing doc-pricing--${layout}`,
    id,
    'data-fx-pricing': '',
    'data-periods': n,
    style: `--pr-cols:${plans.length}`,
  };
  const toggle = periodToggle(id, a, n, def);
  if (layout === 'table') return h('div', rootAttrs, toggle, pricingTable(a, plans, n));
  const cards = plans.map((plan) => {
    const features = plan.features.map((f: Attrs) => {
      const m = featureMark(f);
      const isText = m.state === 'text';
      return h('li', { 'data-state': m.state }, isText ? null : m.node, h('span', null, text(f.text)), isText ? m.node : null);
    });
    return h(
      'article',
      { class: 'doc-pricing-plan', 'data-fx-pricing-plan': '', 'data-highlighted': plan.highlighted ? '' : null },
      badge(plan),
      h('p', { class: 'doc-pricing-name', role: 'heading', 'aria-level': '3' }, text(plan.name)),
      plan.description ? h('p', { class: 'doc-pricing-desc' }, text(plan.description)) : null,
      h('div', { class: 'doc-pricing-prices' }, prices(plan, a, n, 'p')),
      plan.priceNote ? h('p', { class: 'doc-pricing-note' }, text(plan.priceNote)) : null,
      cta(plan),
      features.length ? h('ul', { class: 'doc-pricing-features' }, list(features)) : null,
    );
  });
  return h('div', rootAttrs, toggle, h('div', { class: 'doc-pricing-plans' }, list(cards)));
};

// ---- testimonials ----------------------------------------------------------

function rating(n: unknown): ReactNode {
  const v = clampInt(n, 0, 5, 0);
  if (!v) return null;
  const stars: ReactNode[] = [];
  for (let i = 1; i <= 5; i++)
    stars.push(hRaw('span', { class: 'doc-testimonial-star', 'data-on': i <= v ? '' : null }, ICONS.star));
  return h('div', { class: 'doc-testimonial-rating', role: 'img', 'aria-label': `Rated ${v} out of 5` }, ...stars);
}

function testimonial(t: Attrs, s: RenderState): ReactNode {
  const proxy = s.opts.imageProxy;
  const avatar = t.avatar
    ? h('img', { class: 'doc-testimonial-avatar', src: src(t.avatar, proxy) || null, alt: '', loading: 'lazy', decoding: 'async' })
    : null;
  const logo = t.logo
    ? h('img', {
        class: 'doc-testimonial-logo',
        src: src(t.logo, proxy) || null,
        alt: text(t.role ?? ''),
        loading: 'lazy',
        decoding: 'async',
      })
    : null;
  const name = text(t.author);
  const author = t.href
    ? h('a', { class: 'doc-testimonial-author', href: href(t.href) }, name)
    : h('cite', { class: 'doc-testimonial-author' }, name);
  return h(
    'figure',
    { class: 'doc-testimonial', 'data-fx-testimonial': '' },
    rating(t.rating),
    h('blockquote', { class: 'doc-testimonial-quote' }, h('p', null, text(t.quote))),
    h(
      'figcaption',
      { class: 'doc-testimonial-by' },
      avatar,
      h('span', { class: 'doc-testimonial-who' }, author, t.role ? h('span', { class: 'doc-testimonial-role' }, text(t.role)) : null),
      logo,
    ),
  );
}

const testimonials: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs!;
  const items: Attrs[] = a.items ?? [];
  if (!items.length) return null;
  const layout = a.layout === 'carousel' || a.layout === 'single' ? a.layout : 'grid';
  const cols = clampInt(a.columns, 1, 4, layout === 'single' ? 1 : Math.min(3, items.length));
  if (layout === 'carousel') {
    const shell = carouselShell(
      {
        id: r.uniqueId('testimonials'),
        label: 'Testimonials',
        slides: items.map((t) => ({ node: testimonial(t, r.s), label: t.author })),
        attrs: {
          autoplay: a.autoplay,
          interval: a.interval,
          loop: true,
          perView: cols,
          perViewMd: Math.min(cols, 2),
          perViewSm: 1,
        },
      },
      r,
    );
    return h('div', { class: 'doc-testimonials doc-testimonials--carousel', 'data-fx-testimonials': '' }, shell);
  }
  return h(
    'div',
    { class: `doc-testimonials doc-testimonials--${layout}`, 'data-fx-testimonials': '', style: `--tm-cols:${cols}` },
    list(items.map((t) => testimonial(t, r.s))),
  );
};

// ---- logo wall -------------------------------------------------------------

const logoWall: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs!;
  const proxy = r.s.opts.imageProxy;
  const logos: Attrs[] = (a.logos ?? []).filter((l: Attrs) => src(l.src, proxy));
  if (!logos.length) return null;
  const items = list(
    logos.map((l) => {
      const img = h('img', { src: src(l.src, proxy), alt: text(l.alt), loading: 'lazy', decoding: 'async' });
      return h('li', { class: 'doc-logo' }, l.href ? h('a', { href: href(l.href) }, img) : img);
    }),
  );
  const size = a.size === 'sm' || a.size === 'lg' ? a.size : 'md';
  const cols = clampInt(a.columns, 2, 8, Math.min(6, logos.length));
  const title = a.title?.trim() ? h('p', { class: 'doc-logos-title' }, a.title.trim()) : null;
  const body = a.marquee
    ? marqueeShell(items, { speed: a.speed, pauseOnHover: true, fade: true }, { tag: 'ul', extraClass: 'doc-logos-marquee', hook: false })
    : h('ul', { class: 'doc-logos-list' }, items);
  return h(
    'div',
    {
      class: 'doc-logos',
      'data-fx-logo-wall': '',
      'data-grayscale': a.grayscale ? '' : null,
      'data-size': size,
      style: `--logo-cols:${cols}`,
    },
    title,
    body,
  );
};

// ---- stats -----------------------------------------------------------------

/**
 * Numbers with their labels. The FINAL figure is in the markup — a crawler, a
 * no-script reader and a screen reader all get "12,500", never a 0 waiting on
 * a script. With `animate` (the default) the visible digits are decoration
 * the enhancer counts up, so the spoken figure is a separate `sr-only` copy.
 */
const stats: BlockRenderer = (node) => {
  const a: Attrs = node.attrs!;
  const items: Attrs[] = a.items ?? [];
  if (!items.length) return null;
  const animate = a.animate !== false;
  const layout = a.layout === 'grid' || a.layout === 'cards' ? a.layout : 'row';
  const cols = clampInt(a.columns, 2, 6, Math.min(4, items.length));
  const out = items.map((st) => {
    const d = clampInt(st.decimals, 0, 3, 0);
    const shown = formatAmount(st.value, d);
    const pre = st.prefix ? h('span', { class: 'doc-stat-affix' }, text(st.prefix)) : null;
    const suf = st.suffix ? h('span', { class: 'doc-stat-affix' }, text(st.suffix)) : null;
    const num = animate
      ? list([
          h('span', { class: 'doc-stat-num', 'data-value': `${st.value}`, 'data-decimals': d, 'aria-hidden': 'true' }, shown),
          h('span', { class: 'sr-only' }, text(`${st.prefix ?? ''}${shown}${st.suffix ?? ''}`)),
        ])
      : h('span', { class: 'doc-stat-num' }, shown);
    const value = animate
      ? h(
          'p',
          { class: 'doc-stat-value' },
          h('span', { 'aria-hidden': 'true' }, pre),
          num,
          h('span', { 'aria-hidden': 'true' }, suf),
        )
      : h('p', { class: 'doc-stat-value' }, pre, num, suf);
    return h(
      'div',
      { class: 'doc-stat', 'data-fx-stat': '' },
      value,
      h('p', { class: 'doc-stat-label' }, text(st.label)),
      st.description ? h('p', { class: 'doc-stat-desc' }, text(st.description)) : null,
    );
  });
  return h(
    'div',
    {
      class: `doc-stats doc-stats--${layout}`,
      'data-fx-stats': '',
      'data-ifx': animate ? 'stats' : null,
      style: `--st-cols:${cols}`,
    },
    list(out),
  );
};

export const SHOWCASE: Record<string, BlockRenderer> = { pricing, testimonials, logoWall, stats };
