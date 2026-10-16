import { h, type HtmlAttrs } from './h.js';
import type { ReactElement } from 'react';
import { cssColorValue } from './vendor/look-css.js';
import { lengthCss, responsiveFilled, type ResponsiveLength } from './vendor/responsive-css.js';
import { SPACE_TOKENS, validMinHeight, type SpaceValue } from './look-tokens.js';
import { mediaSrc, safeImageUrl, type ImageProxy } from './url.js';
import type { Attrs } from './types.js';

/**
 * A section's look (background, scheme, padding, border…) and the spacing and
 * gradient values other blocks borrow — docs-schema `render-section-look.ts`.
 *
 * Every value is validated again on the way out: these strings land in
 * `style` and `data-*`, and stored documents predate some of the rules.
 */

const SPACE_REM: Record<(typeof SPACE_TOKENS)[number], number> = { none: 0, xs: 0.5, sm: 1, md: 2, lg: 4, xl: 6 };

export function cssSpace(v: SpaceValue | null | undefined): string | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 400 ? `${v}px` : null;
  if (typeof v === 'string' && v in SPACE_REM) {
    const rem = SPACE_REM[v as keyof typeof SPACE_REM];
    return rem === 0 ? '0px' : `calc(${rem}rem * var(--reader-space-section, 1))`;
  }
  return null;
}

export const RADIUS: Record<string, string> = { none: '0px', sm: '6px', md: '12px', lg: '20px', full: '9999px' };

/** An address as a CSS `url("…")`, with the characters that could end it percent-encoded. */
export function cssUrl(url: string): string {
  return `url("${url.replace(/["'()\\\s<>]/g, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)}")`;
}

function imageAddress(value: unknown, proxy?: ImageProxy): string | null {
  const safe = safeImageUrl(value);
  if (!safe) return null;
  return proxy?.(safe) ?? safe;
}

/** `--x-lg/md/sm` declarations for a responsive length, each step filled from the one above. */
export function stepVars(name: string, v: ResponsiveLength | null | undefined): string[] {
  if (v === null || v === undefined) return [];
  const filled = responsiveFilled(v);
  const out: string[] = [];
  for (const k of ['lg', 'md', 'sm'] as const) {
    const step = filled[k];
    const css = step === undefined ? null : lengthCss(step);
    if (css) out.push(`--${name}-${k}:${css}`);
  }
  return out;
}

function sectionMinHeightVars(v: ResponsiveLength | null | undefined): string[] {
  if (v === null || v === undefined) return [];
  if (typeof v === 'string' && validMinHeight(v)) return [`--sec-min-h:${v}`];
  return stepVars('sec-min-h', v);
}

/** A row's gap per screen size: `--cols-gap-lg/md/sm`. */
export function gapSteps(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  const filled = responsiveFilled(v as SpaceValue);
  const out: string[] = [];
  for (const k of ['lg', 'md', 'sm'] as const) {
    const css = filled[k] === undefined ? null : cssSpace(filled[k]);
    if (css) out.push(`--cols-gap-${k}:${css}`);
  }
  return out;
}

function overlayLayer(img: Attrs | null | undefined): string | null {
  const overlay = img?.overlay;
  const overlayColor = overlay ? cssColorValue(overlay.color) : null;
  const opacity = typeof overlay?.opacity === 'number' ? Math.min(1, Math.max(0, overlay.opacity)) : 0;
  if (!overlayColor || opacity <= 0) return null;
  const wash = `color-mix(in srgb, ${overlayColor} ${Math.round(opacity * 100)}%, transparent)`;
  return `linear-gradient(${wash}, ${wash})`;
}

/** A gradient as a CSS `<image>`, or null. */
export function gradientLayer(g: Attrs | null | undefined): string | null {
  if (!g || !Array.isArray(g.stops) || g.stops.length < 2 || g.stops.length > 4) return null;
  const stops = (g.stops as Attrs[])
    .map((s) => {
      const c = cssColorValue(s?.color);
      if (!c) return null;
      const at = typeof s.at === 'number' && s.at >= 0 && s.at <= 100 ? ` ${s.at}%` : '';
      return `${c}${at}`;
    })
    .filter((s): s is string => s !== null);
  if (stops.length < 2) return null;
  const angle = typeof g.angle === 'number' && g.angle >= 0 && g.angle <= 360 ? g.angle : 180;
  return g.type === 'radial'
    ? `radial-gradient(circle, ${stops.join(', ')})`
    : `linear-gradient(${angle}deg, ${stops.join(', ')})`;
}

const POSITIONS = new Set([
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top left',
  'top right',
  'bottom left',
  'bottom right',
]);

export interface SectionLookModel {
  vars: string[];
  data: HtmlAttrs;
  painted: boolean;
  video: string | null;
  poster: string | null;
}

export function sectionLookModel(a: Attrs, proxy?: ImageProxy): SectionLookModel {
  const vars: string[] = [];
  const data: HtmlAttrs = {};
  const bgLayers: string[] = [];
  const bg: Attrs = a.background ?? {};

  const color = cssColorValue(bg.color);
  if (color) vars.push(`--sec-bg-color:${color}`);
  const image = bg.image ? imageAddress(bg.image.src, proxy) : null;
  const wash = image ? overlayLayer(bg.image) : null;
  if (wash) bgLayers.push(wash);
  const gradient = gradientLayer(bg.gradient);
  if (gradient) bgLayers.push(gradient);
  const video = bg.video ? mediaSrc(bg.video.src, proxy) : null;
  const poster = bg.video?.poster ? imageAddress(bg.video.poster, proxy) : null;
  const picture = image ?? (video ? poster : null);
  if (picture) bgLayers.push(cssUrl(picture));
  if (bgLayers.length) vars.push(`--sec-bg-image:${bgLayers.join(', ')}`);

  const colorDark = cssColorValue(bg.colorDark);
  if (colorDark) vars.push(`--sec-bg-color-dark:${colorDark}`);
  const imageDark = bg.imageDark ? imageAddress(bg.imageDark.src, proxy) : null;
  const gradientDark = gradientLayer(bg.gradientDark);
  if (imageDark || gradientDark) {
    const darkImg = imageDark ?? image;
    const darkLayers = [
      darkImg ? overlayLayer(imageDark ? bg.imageDark : bg.image) : null,
      gradientDark ?? gradient,
      darkImg ? cssUrl(darkImg) : null,
    ].filter((l): l is string => !!l);
    if (darkLayers.length) vars.push(`--sec-bg-image-dark:${darkLayers.join(', ')}`);
  }
  const dark = Boolean(colorDark || imageDark || gradientDark);
  if (dark) data['data-bg-dark'] = '';
  if (image) {
    const size = bg.image?.size;
    if (size === 'contain' || size === 'auto') vars.push(`--sec-bg-size:${size}`);
    const pos = bg.image?.position;
    if (pos && POSITIONS.has(pos) && pos !== 'center') vars.push(`--sec-bg-position:${pos}`);
    const att = bg.image?.attachment;
    if (att === 'fixed' || att === 'parallax') data['data-bg-attach'] = att;
  }

  const scheme = a.scheme === 'light' || a.scheme === 'dark' ? a.scheme : null;
  if (scheme) data['data-scheme'] = scheme;
  const pattern = a.pattern === 'dots' || a.pattern === 'grid' ? a.pattern : null;
  if (pattern) {
    data['data-pattern'] = pattern;
    const pc = a.patternColor;
    if (pc && typeof pc === 'object') {
      const from = cssColorValue(pc.from);
      const to = cssColorValue(pc.to);
      const angle =
        typeof pc.angle === 'number' && Number.isInteger(pc.angle) && pc.angle >= 0 && pc.angle <= 360
          ? pc.angle
          : 90;
      if (from && to) {
        data['data-pattern-gradient'] = '';
        vars.push(`--sec-pattern-from:${from}`, `--sec-pattern-to:${to}`, `--sec-pattern-angle:${angle}deg`);
      }
    } else {
      const ink = cssColorValue(pc);
      if (ink) vars.push(`--sec-pattern-color:${ink}`);
    }
    if (a.patternFade === 'radial' || a.patternFade === 'bottom') data['data-pattern-fade'] = a.patternFade;
  }
  const painted = Boolean(color || bgLayers.length || video || scheme || dark || pattern);
  if (painted) data['data-has-bg'] = '';

  const pad: Attrs = a.padding ?? {};
  for (const [key, name] of [
    ['top', '--sec-pt'],
    ['bottom', '--sec-pb'],
    ['x', '--sec-px'],
  ] as const) {
    const v = cssSpace(pad[key]);
    if (v) vars.push(`${name}:${v}`);
  }
  vars.push(...sectionMinHeightVars(a.minHeight));
  const align = (v: unknown): string | null => (v === 'start' || v === 'center' || v === 'end' ? v : null);
  const contentAlign = align(a.contentAlign);
  if (contentAlign) data['data-align'] = contentAlign;
  const valign = align(a.verticalAlign);
  if (valign) data['data-valign'] = valign;

  const r = a.radius;
  const radius =
    typeof r === 'number' && Number.isInteger(r) && r >= 0 && r <= 64
      ? `${r}px`
      : typeof r === 'string'
        ? (RADIUS[r] ?? null)
        : null;
  if (radius) vars.push(`--sec-radius:${radius}`);

  const b = a.border;
  if (b && typeof b.width === 'number' && Number.isInteger(b.width) && b.width > 0 && b.width <= 8) {
    const style = b.style === 'dashed' || b.style === 'dotted' ? b.style : 'solid';
    vars.push(`--sec-border:${b.width}px ${style} ${cssColorValue(b.color) ?? 'var(--line-strong)'}`);
    const sides = b.sides;
    if (sides === 'y' || sides === 'x' || sides === 'top' || sides === 'bottom') data['data-border-sides'] = sides;
  }
  if (a.shadow === 'sm' || a.shadow === 'md' || a.shadow === 'lg') data['data-shadow'] = a.shadow;
  if (a.fullBleed === true) data['data-bleed'] = '';
  const gap = a.gap === 'page' ? 'var(--fp-flow-gap, 2rem)' : cssSpace(a.gap);
  if (gap) {
    data['data-gap'] = '';
    vars.push(`--sec-gap:${gap}`);
  }
  return { vars, data, painted, video, poster };
}

/** A section's own attributes and its background layer (appended as its last child). */
export function sectionLook(a: Attrs, proxy?: ImageProxy): { attrs: HtmlAttrs; layer: ReactElement | null } {
  const { vars, data, painted, video, poster } = sectionLookModel(a, proxy);
  if (!vars.length && !Object.keys(data).length && !video) return { attrs: {}, layer: null };
  const attrs: HtmlAttrs = { 'data-look': '', ...data };
  if (vars.length) attrs.style = vars.join(';');
  const layer =
    painted || video
      ? h('div', { class: 'doc-section-bg', 'aria-hidden': 'true' }, video ? backgroundVideo(video, poster) : null)
      : null;
  return { attrs, layer };
}

/** Muted, looping, inline; never SENT to a reader who asked for reduced motion (the `<source media>`). */
function backgroundVideo(src: string, poster: string | null): ReactElement {
  return h(
    'video',
    {
      class: 'doc-section-video',
      muted: true,
      autoplay: true,
      loop: true,
      playsinline: true,
      disablepictureinpicture: true,
      preload: 'metadata',
      tabindex: '-1',
      poster,
    },
    h('source', { src, media: '(prefers-reduced-motion: no-preference)' }),
  );
}
