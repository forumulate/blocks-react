import type { HtmlAttrs } from './h.js';
import type { RenderOptions } from './options.js';

/**
 * A picture's box, reserved before its bytes arrive — docs-schema `imageBox`
 * (render-context.ts). The intrinsic pixel size becomes `width`/`height` (the
 * stylesheet's `height: auto` turns the pair into an aspect ratio at whatever
 * width the column gives it), and the dominant colour paints behind it while
 * it loads. `known` is null when the caller cannot size pictures at all,
 * false when it asked and got nothing — an unsized image block is marked so
 * the reader stylesheet can hold a default box (an unsized screenshot once
 * pushed an article 280px after first paint).
 */
export interface ImageBox {
  attrs: HtmlAttrs;
  bg: string;
  known: boolean | null;
}

export function imageBox(url: unknown, opts: Pick<RenderOptions, 'imageSize'>): ImageBox {
  if (!opts.imageSize || !url) return { attrs: {}, bg: '', known: null };
  const s = opts.imageSize(url as string);
  if (!s || !(s.width > 0) || !(s.height > 0)) return { attrs: {}, bg: '', known: false };
  const bg = s.color && /^#[0-9a-f]{6}$/i.test(s.color) ? `background-color:${s.color}` : '';
  return { attrs: { width: Math.round(s.width), height: Math.round(s.height) }, bg, known: true };
}
