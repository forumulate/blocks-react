import { h, type HtmlAttrs } from '../h.js';
import { FIGURE_HEX } from '../look-tokens.js';
import { imageBox } from '../media.js';
import { safeImageUrl, src } from '../url.js';
import type { Attrs } from '../types.js';
import { text } from './core.js';
import { lightboxLink } from './interactive.js';
import type { BlockRenderer } from './types.js';

/**
 * The image block — docs-schema `render-image.ts`, with the figure look of
 * `render-editorial.ts` (`breakoutOf`, `figureLook`). Without a caption or a
 * figure look the output is the bare `<img>` it has always been, so no
 * existing page's CSS moves.
 */

/** Whether this picture is a breakout (`wide`/`full`) rather than a share or a length. */
export function breakoutOf(attrs: Attrs): 'wide' | 'full' | null {
  return attrs.width === 'wide' || attrs.width === 'full' ? attrs.width : null;
}

/**
 * The figure attributes a picture's editorial attrs add, or null when it has
 * none — in which case the caller emits exactly the markup it always did.
 */
export function figureLook(attrs: Attrs): HtmlAttrs | null {
  const out: HtmlAttrs = {};
  const breakout = breakoutOf(attrs);
  if (breakout) out['data-width'] = breakout;
  const bg = attrs.background;
  if (bg && bg !== 'none') {
    if (FIGURE_HEX.test(bg)) {
      out['data-bg'] = 'custom';
      out.style = `--fig-bg:${bg}`;
    } else out['data-bg'] = text(bg);
  }
  if (attrs.pad && attrs.pad !== 'none') out['data-pad'] = text(attrs.pad);
  return Object.keys(out).length ? out : null;
}

const image: BlockRenderer = (node, r) => {
  const s = r.s;
  const a: Attrs = node.attrs!;
  const align = a.align ? text(a.align) : null;
  // A number is a share of the column, a string a length the author gave. A
  // breakout is sized by the stylesheet on the figure, not on the picture.
  const w = breakoutOf(a) ? null : a.width;
  const widthDecl = typeof w === 'number' ? `width:${w}%` : typeof w === 'string' && w ? `width:${w}` : '';
  // The box, reserved before the bytes arrive (see ../media).
  const box = imageBox(a.src, s.opts);
  const decls = [widthDecl, box.bg].filter(Boolean).join(';');
  /*
   * Responsive and lazy, only where the caller asked (`imageSrcset`): offered
   * at the resizer's widths, and every picture after the body's FIRST is lazy
   * — the first may be the page's largest paint, the rest are below it.
   */
  const hints: HtmlAttrs = {};
  if (s.opts.imageSrcset) {
    const safeSrc = safeImageUrl(a.src, '');
    const set = safeSrc ? s.opts.imageSrcset(safeSrc) : null;
    if (set) {
      hints.srcset = set;
      hints.sizes = '(max-width: 768px) 100vw, 768px';
    }
    if (s.imagesRendered++ > 0) hints.loading = 'lazy';
    hints.decoding = 'async';
  }
  const dark = a.srcDark;
  // A refused address is `src=""` on the hosted page; React drops an empty
  // `src` anyway (and warns), so it is passed as null — the same no-picture.
  const light = h('img', {
    class: dark ? 'img-light' : null,
    src: src(a.src, s.opts.imageProxy) || null,
    alt: a.alt ? text(a.alt) : '',
    'data-align': align,
    ...box.attrs,
    'data-img-unsized': box.known === false ? '' : null,
    style: decls || null,
    ...hints,
  });
  // A dark-mode picture: both are printed, the stylesheet shows one. One root
  // (the studio addresses a block by its first tag); the span is `display: contents`.
  const pic = dark
    ? h(
        'span',
        { class: 'img-dual' },
        light,
        h('img', {
          class: 'img-dark',
          src: src(dark, s.opts.imageProxy) || null,
          'data-align': align,
          ...imageBox(dark, s.opts).attrs,
          style: widthDecl || null,
          loading: 'lazy',
          decoding: 'async',
          alt: '',
          'aria-hidden': 'true',
        }),
      )
    : light;
  const img = a.lightbox === true ? lightboxLink(pic, a, s) : pic;
  // A breakout or a panel is a property of the FIGURE, so either one makes a
  // figure even with no caption.
  const caption = a.caption?.trim();
  const look = figureLook(a);
  if (!caption && !look) return img;
  return h(
    'figure',
    { class: 'doc-figure', 'data-align': align, ...look },
    img,
    caption ? h('figcaption', null, caption) : null,
  );
};

export const IMAGE: Record<string, BlockRenderer> = { image };
