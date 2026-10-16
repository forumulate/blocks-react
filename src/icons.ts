import { hRaw, h, type HtmlAttrs } from './h.js';
import type { ReactElement } from 'react';
import { isSafeImageUrl, src as srcOf, type ImageProxy } from './url.js';

/**
 * Icons: our own glyphs (always available, small), and an `IconSet` hook for
 * the extended Lucide set (`@forumulate/blocks-react/icons`), which is ~35 KB
 * of path data a site that uses no extended icon should not ship.
 *
 * `BLOCK_ICON_PATHS` is docs-schema's table copied verbatim; the
 * constants-parity test fails the moment the two differ.
 */

/** Extra icons by name, as the inner markup of a 24-unit Lucide `<svg>`. */
export interface IconSet {
  svg(name: string): string | null;
}

export const BLOCK_ICON_PATHS: Readonly<Record<string, string>> = {
  book: '<path d="M2 3.2h4.2c1 0 1.8.7 1.8 1.6v8.2c0-.8-.8-1.4-1.8-1.4H2V3.2Z"/><path d="M14 3.2H9.8c-1 0-1.8.7-1.8 1.6v8.2c0-.8.8-1.4 1.8-1.4H14V3.2Z"/>',
  'book-arrow':
    '<path d="M2 3.2h4.2c1 0 1.8.7 1.8 1.6v8.2c0-.8-.8-1.4-1.8-1.4H2V3.2Z"/><path d="M8 13V4.8c0-.9.8-1.6 1.8-1.6H14v4"/><path d="M11 11.4h3.6M12.9 9.7l1.7 1.7-1.7 1.7"/>',
  code: '<path d="M6 4.5L2.5 8 6 11.5M10 4.5L13.5 8 10 11.5"/>',
  message: '<path d="M2.5 3h11v7.5H8.2L5 13.4V10.5H2.5V3Z"/>',
  calendar:
    '<rect x="2" y="3.4" width="12" height="10.6"/><path d="M2 6.6h12M5.4 2v2.6M10.6 2v2.6"/>',
  chart: '<path d="M2.5 3.6h8.4M2.5 8h11M2.5 12.4h5.6"/><path d="M2.5 2.2v12.6"/>',
  'pie-chart': '<circle cx="8" cy="8" r="6"/><path d="M8 8V2M8 8l5.2 3"/>',
  puzzle:
    '<path d="M6.4 2.4h3.2v1.4a1.3 1.3 0 1 0 2.6 0V2.4h1.4v3.2h-1.4a1.3 1.3 0 1 0 0 2.6h1.4v5.4H9.6v-1.4a1.3 1.3 0 1 0-2.6 0v1.4H2.4V8.2h1.4a1.3 1.3 0 1 0 0-2.6H2.4V2.4h4Z"/>',
  lock: '<rect x="3" y="7" width="10" height="7"/><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7"/>',
  shield: '<path d="M8 1.8 2.8 3.6v4.2c0 3.3 2.2 5.6 5.2 6.6 3-1 5.2-3.3 5.2-6.6V3.6z"/>',
  star: '<path d="m8 2 1.85 3.9 4.15.6-3 3 .71 4.3L8 11.75 4.29 13.8 5 9.5l-3-3 4.15-.6L8 2Z"/>',
  bell: '<path d="M4 11.4V7.2a4 4 0 0 1 8 0v4.2h1.4v1.2H2.6v-1.2H4Z"/><path d="M6.6 13.6a1.5 1.5 0 0 0 2.8 0"/>',
  search: '<circle cx="7" cy="7" r="4.25"/><path d="m10.2 10.2 3.3 3.3"/>',
  sparkle:
    '<path d="M6.4 2.2 7.5 5.4 10.7 6.5 7.5 7.6 6.4 10.8 5.3 7.6 2.1 6.5 5.3 5.4 6.4 2.2Z"/><path d="M11.6 9 12.2 10.8 14 11.4 12.2 12 11.6 13.8 11 12 9.2 11.4 11 10.8 11.6 9Z"/>',
  link: '<path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.1-2.1a2.6 2.6 0 0 0-3.7-3.7l-1 1"/><path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.6 8.7a2.6 2.6 0 0 0 3.7 3.7l1-1"/>',
  cog: '<circle cx="8" cy="8" r="2.6"/><path d="M8 1.6v1.8M8 12.6v1.8M14.4 8h-1.8M3.4 8H1.6M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3M12.5 12.5l-1.3-1.3M4.8 4.8 3.5 3.5"/>',
  clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.6 1.7"/>',
  heart:
    '<path d="M8 13.6 3.1 8.9a3.1 3.1 0 0 1 4.4-4.4L8 5l.5-.5a3.1 3.1 0 0 1 4.4 4.4L8 13.6Z"/>',
  image:
    '<rect x="2" y="3" width="12" height="10"/><circle cx="5.6" cy="6.4" r="1.1"/><path d="M2 11 6 7.6l3 2.6L11.2 8 14 10.4"/>',
  trophy:
    '<path d="M4.6 2.4h6.8v3.2a3.4 3.4 0 0 1-6.8 0V2.4Z"/><path d="M4.6 3.4H2.4v1.2a2.4 2.4 0 0 0 2.2 2.4M11.4 3.4h2.2v1.2a2.4 2.4 0 0 1-2.2 2.4"/><path d="M8 9v2.6M5.4 13.6h5.2"/>',
  medal: '<circle cx="8" cy="10.2" r="3.6"/><path d="M5.6 6.9 3.4 2.2h9.2L10.4 6.9"/>',
  crown: '<path d="M2.2 4.8 5 8l3-4.4L11 8l2.8-3.2 -1 7.4H3.2z"/>',
  headset:
    '<path d="M3 10V8a5 5 0 0 1 10 0v2"/><rect x="1.8" y="9.4" width="2.8" height="4"/><rect x="11.4" y="9.4" width="2.8" height="4"/><path d="M13 13.4c0 .9-1.2 1.4-2.6 1.4"/>',
  webhook:
    '<circle cx="4" cy="4" r="1.8"/><circle cx="12" cy="6.4" r="1.8"/><circle cx="7.2" cy="12.4" r="1.8"/><path d="M5.4 5.2 10.4 5.8M11.2 8.1 8.2 10.8M6 12 4.4 5.8"/>',
  ticket:
    '<path d="M2 4.4h12v2.2a1.4 1.4 0 0 0 0 2.8v2.2H2V9.4a1.4 1.4 0 0 0 0-2.8V4.4Z"/><path d="M8 5.6v1.2M8 9.2v1.2"/>',
  board: '<rect x="2" y="2.4" width="12" height="11.2"/><path d="M6 2.4v11.2M10 2.4v11.2"/>',
  tracker:
    '<rect x="2" y="2.4" width="12" height="11.2"/><path d="M4.6 5.6h6.8M4.6 8h6.8M4.6 10.4h4"/>',
  template: '<rect x="2.4" y="2.4" width="8" height="8"/><path d="M5.6 13.6h8v-8"/>',
  'check-circle': '<circle cx="8" cy="8" r="6"/><path d="M5 8.2 7.2 10.4 11 5.8"/>',
  warning: '<path d="M8 2.2 14.5 13.5h-13L8 2.2Z"/><path d="M8 6.2v3.4M8 11.4v.6"/>',
  translate:
    '<circle cx="8" cy="8" r="6"/><path d="M2 8h12"/><path d="M8 2c1.9 2 2.9 4 2.9 6S9.9 12 8 14C6.1 12 5.1 10 5.1 8S6.1 4 8 2Z"/>',
  share:
    '<circle cx="12" cy="3.8" r="1.9"/><circle cx="4" cy="8" r="1.9"/><circle cx="12" cy="12.2" r="1.9"/><path d="M5.7 7 10.3 4.8"/><path d="M5.7 9 10.3 11.2"/>',
  eye: '<path d="M1.6 8S4 4.2 8 4.2 14.4 8 14.4 8 12 11.8 8 11.8 1.6 8 1.6 8Z"/><circle cx="8" cy="8" r="1.9"/>',
  bookmark: '<path d="M4 2.4h8v11.2L8 10.6l-4 3V2.4Z"/>',
  hash: '<path d="M5.6 2.6 4.2 13.4M11.4 2.6 10 13.4M2.6 5.8h11M2.4 10.2h11"/>',
  'chat-app':
    '<path d="M2.2 2.8h8.4v6H5.6L3 11.2V8.8H2.2v-6Z"/><path d="M7.8 10.4h6v4.2h-2.4l-1.8 1.4v-1.4H7.8"/>',
  'team-chat':
    '<circle cx="5.6" cy="5.2" r="2.2"/><circle cx="11" cy="6" r="1.7"/><path d="M1.6 13.4c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8"/><path d="M11 9.8c1.9 0 3.4 1.4 3.4 3.6"/>',
  upload: '<path d="M8 11V2.6M4.8 5.8 8 2.6l3.2 3.2"/><path d="M2.5 10.5v3h11v-3"/>',
  pencil: '<path d="M11.2 2.6 13.4 4.8 5.6 12.6l-3 .8.8-3 7.8-7.8Z"/><path d="M9.9 3.9 12.1 6.1"/>',
  quote:
    '<path d="M3 9.5V7.2c0-1.6 1-2.9 2.6-3.4M3 9.5h2.8v3.2H3V9.5Z"/><path d="M9.4 9.5V7.2c0-1.6 1-2.9 2.6-3.4M9.4 9.5h2.8v3.2H9.4V9.5Z"/>',
  user: '<circle cx="8" cy="5.2" r="2.7"/><path d="M2.8 14c.5-2.9 2.6-4.6 5.2-4.6s4.7 1.7 5.2 4.6"/>',
};

export function blockIconSvg(name: string): string {
  return (
    '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.25" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">' +
    BLOCK_ICON_PATHS[name] +
    '</svg>'
  );
}

const isOwnGlyph = (v: string): boolean => Object.prototype.hasOwnProperty.call(BLOCK_ICON_PATHS, v);

/** A bare word — the shape of a NAME, as opposed to an emoji, a symbol or a URL. */
const ICON_WORD = /^[A-Za-z][A-Za-z0-9_-]+$/;

/** Our glyph or an extended one as `<svg>` markup, or null for anything else. */
export function iconSvg(value: string, icons?: IconSet): string | null {
  const v = value.trim();
  if (isOwnGlyph(v)) return blockIconSvg(v);
  return icons?.svg(v) ?? null;
}

/**
 * docs-schema's `isBlockIconValue`: a bare word must name an icon (the hosted
 * reader refuses to print a word); anything else (an emoji) is a text glyph.
 */
export function isBlockIconValue(value: string, icons?: IconSet): boolean {
  const v = value.trim();
  if (!v) return true;
  return ICON_WORD.test(v) ? iconSvg(v, icons) !== null : true;
}

export function looksLikeIconAddress(v: string): boolean {
  return /^(https?:|data:|\/)/i.test(v.trim());
}

export function isRichIconValue(value: string, icons?: IconSet): boolean {
  const v = value.trim();
  if (!v) return false;
  if (looksLikeIconAddress(v)) return isSafeImageUrl(v);
  return v.length <= 16 && isBlockIconValue(v, icons);
}

/**
 * `richIconHtml`: a picture for an address, our glyph for a name, and a text
 * glyph (an emoji) as a CSS-drawn `data-glyph` — never as text, because a
 * heading's text is what an outline and a screen reader read.
 */
export function richIcon(
  value: unknown,
  cls: string,
  opts: { proxy?: ImageProxy; icons?: IconSet; label?: string; extra?: HtmlAttrs },
): ReactElement | null {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v || !isRichIconValue(v, opts.icons)) return null;
  const a11y: HtmlAttrs = opts.label
    ? { role: 'img', 'aria-label': opts.label, title: opts.label }
    : { 'aria-hidden': 'true' };
  if (looksLikeIconAddress(v)) {
    const address = srcOf(v, opts.proxy);
    if (!address) return null;
    return h(
      'span',
      { class: cls, ...opts.extra, ...a11y },
      h('img', { src: address, alt: '', loading: 'lazy', decoding: 'async' }),
    );
  }
  const svg = iconSvg(v, opts.icons);
  return svg
    ? hRaw('span', { class: cls, ...opts.extra, ...a11y }, svg)
    : h('span', { class: cls, ...opts.extra, 'data-glyph': v, ...a11y });
}
