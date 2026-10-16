import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { h, hRaw, type HtmlAttrs } from '../h.js';
import { AUTOPLAY_DEFAULT_MS, AUTOPLAY_MAX_MS, AUTOPLAY_MIN_MS, IX_GAPS } from '../look-tokens.js';
import type { Attrs } from '../types.js';
import type { R } from './types.js';

/**
 * The pieces the interactive renderers share: the carousel and marquee SHELLS
 * (a testimonial carousel and a logo marquee are the same markup as the blocks
 * of those names), the icons, and the re-checks every stored number gets on
 * the way out — docs-schema `render-ix-shared.ts`. Its own module so
 * ./interactive and ./showcase can both use it without importing each other.
 */

// `none` is `0px`, never a bare `0`: the carousel's slide width is
// `calc(100% - (n - 1) * var(--car-gap))`, and a unitless 0 there makes the
// whole calc invalid, collapsing every slide into one row.
export const GAP_REM: Readonly<Record<string, string>> = { none: '0px', sm: '0.5rem', md: '1rem', lg: '1.75rem' };

export const MARQUEE_SECONDS: Readonly<Record<string, number>> = { slow: 60, normal: 35, fast: 18 };

export function gapValue(g: unknown, fallback = 'md'): string {
  return GAP_REM[typeof g === 'string' && g && (IX_GAPS as readonly string[]).includes(g) ? g : fallback]!;
}

/** An integer inside [min, max], or the fallback — a stored value is re-checked here. */
export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

const svg = (body: string, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

/** The hosted reader's control glyphs, verbatim (constants-parity compares them). */
export const ICONS = {
  prev: svg('<path d="M10 3 5 8l5 5"/>'),
  next: svg('<path d="M6 3l5 5-5 5"/>'),
  pause: svg('<path d="M5.5 3.5v9M10.5 3.5v9"/>'),
  close: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
  check: svg('<path d="M3 8.5 6.5 12 13 4.5"/>'),
  cross: svg('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
  star: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 1.5l1.95 4.1 4.5.55-3.3 3.1.85 4.45L8 11.5l-4 2.2.85-4.45-3.3-3.1 4.5-.55z"/></svg>',
};
export type IconName = keyof typeof ICONS;

/**
 * An icon as its own `<svg>` element, for the places the hosted markup puts
 * the glyph beside other content rather than inside a tag of its own (a
 * pricing check). The string is split into the root's attributes (React
 * names: `stroke-width` → `strokeWidth`) and its inner markup, which is ours.
 */
export function iconElement(name: IconName): ReactElement {
  const m = /^<svg ([^>]*)>([\s\S]*)<\/svg>$/.exec(ICONS[name])!;
  const attrs: HtmlAttrs = {};
  for (const [, k, v] of m[1]!.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    const key = /^(aria|data)-/.test(k!) ? k! : k!.replace(/-([a-z])/g, (_s, c: string) => c.toUpperCase());
    attrs[key] = v!;
  }
  return hRaw('svg', attrs, m[2]!);
}

export interface CarouselShell {
  id: string;
  /** The region's accessible name. */
  label: string;
  slides: { node: ReactNode; label?: string | null }[];
  attrs: Attrs;
  /** Extra classes on the root (a testimonial carousel). */
  extraClass?: string;
}

/**
 * The carousel's markup, shared by the `carousel` block and the testimonials
 * block's carousel layout.
 *
 * The ARIA carousel pattern: a `region` named and described as a carousel,
 * each slide a `group` "n of N". The track is a polite live region so arrow
 * users hear the new slide — and `off` while autoplay runs, or it would talk
 * over everything on a timer; the enhancer flips it when autoplay stops.
 */
export function carouselShell(sh: CarouselShell, r: R): ReactElement {
  const a = sh.attrs;
  const total = sh.slides.length;
  const autoplay = a.autoplay === true;
  const interval = clampInt(a.interval, AUTOPLAY_MIN_MS, AUTOPLAY_MAX_MS, AUTOPLAY_DEFAULT_MS);
  const per = clampInt(a.perView, 1, 6, 1);
  const perMd = clampInt(a.perViewMd, 1, 4, Math.min(per, 2));
  const perSm = clampInt(a.perViewSm, 1, 3, 1);
  const style = `--car-per:${per};--car-per-md:${perMd};--car-per-sm:${perSm};--car-gap:${gapValue(a.gap)}`;
  const slideIds = sh.slides.map((_, i) => r.uniqueId(`${sh.id}-slide-${i + 1}`));
  const slides = sh.slides.map((sl, i) =>
    h(
      'div',
      {
        class: 'doc-carousel-slide',
        id: slideIds[i],
        role: 'group',
        'aria-roledescription': 'slide',
        'aria-label': `${i + 1} of ${total}${sl.label ? `: ${sl.label}` : ''}`,
        'data-fx-carousel-slide': '',
      },
      sl.node,
    ),
  );
  const dots =
    a.dots === false || total < 2
      ? null
      : h(
          'div',
          { class: 'doc-carousel-dots', role: 'group', 'aria-label': 'Choose a slide' },
          ...slideIds.map((sid, i) =>
            h('a', {
              class: 'doc-carousel-dot',
              href: `#${sid}`,
              'aria-label': `Slide ${i + 1}`,
              'aria-current': i === 0 ? 'true' : null,
            }),
          ),
        );
  // Arrows and pause do nothing without script, so they stay `hidden` until
  // the enhancer wires them — a no-JS reader is not offered dead buttons.
  const arrow = (dir: 'prev' | 'next', label: string) =>
    hRaw(
      'button',
      {
        type: 'button',
        class: `doc-carousel-arrow doc-carousel-${dir}`,
        [`data-carousel-${dir}`]: '',
        'aria-controls': `${sh.id}-track`,
        'aria-label': label,
        hidden: true,
      },
      ICONS[dir],
    );
  const arrows = a.arrows === false || total < 2 ? [null, null] : [arrow('prev', 'Previous slide'), arrow('next', 'Next slide')];
  const play = autoplay
    ? hRaw(
        'button',
        { type: 'button', class: 'doc-carousel-play', 'data-carousel-play': '', 'aria-label': 'Pause slides', hidden: true },
        ICONS.pause,
      )
    : null;
  const nav = dots || arrows[0] || play ? h('div', { class: 'doc-carousel-nav' }, play, arrows[0], dots, arrows[1]) : null;
  return h(
    'div',
    {
      class: `doc-carousel${sh.extraClass ? ` ${sh.extraClass}` : ''}`,
      id: sh.id,
      'data-ifx': 'carousel',
      'data-fx-carousel': '',
      role: 'region',
      'aria-roledescription': 'carousel',
      'aria-label': sh.label,
      'data-autoplay': autoplay ? interval : null,
      'data-loop': a.loop === true ? '' : null,
      'data-arrows': a.arrows === false ? 'off' : null,
      style,
    },
    h(
      'div',
      { class: 'doc-carousel-track', id: `${sh.id}-track`, tabindex: '0', 'aria-live': autoplay ? 'off' : 'polite' },
      ...slides,
    ),
    nav,
  );
}

/**
 * The same subtree with every `id` removed — the marquee's second copy, so
 * the page never holds two elements of one id. (The string renderer strips
 * ` id="…"` with a regex; this walks the elements.) Arrays are re-spread as
 * arguments so their existing keys stand and React asks for no new ones.
 */
export function withoutIds(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(withoutIds);
  if (!isValidElement(node)) return node;
  const p = node.props as { id?: unknown; children?: ReactNode };
  const next: Record<string, unknown> = {};
  if (typeof node.type === 'string' && p.id !== undefined) next.id = undefined;
  if (p.children === undefined) return cloneElement(node, next);
  const kids = Array.isArray(p.children) ? p.children.map(withoutIds) : [withoutIds(p.children)];
  return cloneElement(node, next, ...kids);
}

/**
 * An endless sideways scroll, in CSS alone: the content twice in a row, the
 * row translated by half its width, forever. The second copy is `aria-hidden`
 * and `inert` (a screen reader and the tab order meet each item once) and has
 * its ids stripped. Under reduced motion the stylesheet stops the animation,
 * wraps the first copy and hides the second.
 */
export function marqueeShell(
  group: ReactNode,
  a: Attrs,
  opts: { tag?: 'div' | 'ul'; extraClass?: string; hook?: boolean } = {},
): ReactElement {
  const tag = opts.tag ?? 'div';
  const seconds = MARQUEE_SECONDS[a.speed ?? 'normal'] ?? 35;
  return h(
    'div',
    {
      class: `doc-marquee${opts.extraClass ? ` ${opts.extraClass}` : ''}`,
      'data-fx-marquee': opts.hook === false ? null : '',
      'data-dir': a.direction === 'right' ? 'right' : 'left',
      'data-pause': a.pauseOnHover === false ? null : '',
      'data-fade': a.fade === false ? null : '',
      style: `--mq-duration:${seconds}s;--mq-gap:${gapValue(a.gap, 'lg')}`,
    },
    h(
      'div',
      { class: 'doc-marquee-track' },
      h(tag, { class: 'doc-marquee-group' }, group),
      h(tag, { class: 'doc-marquee-group', 'aria-hidden': 'true', inert: '' }, withoutIds(group)),
    ),
  );
}
