import { createElement, type ReactNode } from 'react';
import { h, hRaw } from '../h.js';
import { imageBox } from '../media.js';
import { src } from '../url.js';
import type { RenderState } from '../state.js';
import type { Attrs, BlockNode } from '../types.js';
import { text } from './core.js';
import { ICONS, carouselShell, clampInt, gapValue, marqueeShell } from './ix-shared.js';
import type { BlockRenderer } from './types.js';

/**
 * The interactive containers — docs-schema `render-interactive.ts`: carousel,
 * gallery (and the image lightbox), marquee, modal and before/after. Each is
 * meaningful with NO JavaScript and enhanced by the reader's interactive
 * module where it runs (`[data-ifx]`): a carousel is a scroll-snap row whose
 * dots are in-page links, a lightbox image a link to the full picture, a
 * modal an invoker button, a marquee pure CSS, a before/after the split at its
 * starting point. The motion and map blocks (layer, story, playground,
 * officeMap) are hosted-only.
 */

/** Gallery crop ratios (render-interactive `ASPECTS`). */
export const ASPECTS: Readonly<Record<string, string>> = {
  square: '1 / 1',
  '4:3': '4 / 3',
  '3:2': '3 / 2',
  '16:9': '16 / 9',
};

/** Modal sizes (interactive-blocks `MODAL_SIZES`). */
export const MODAL_SIZES = ['sm', 'md', 'lg', 'full'] as const;

const carousel: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs ?? {};
  // Slides render before the carousel claims its id, as on the hosted page.
  const slides = node
    .content!.filter((c) => c.type === 'carouselSlide')
    .map((sl) => ({ node: r.blocks(sl.content), label: sl.attrs?.label ?? null }));
  if (!slides.length) return null;
  return carouselShell({ id: r.uniqueId('carousel'), label: a.label?.trim() || 'Carousel', slides, attrs: a }, r);
};

/**
 * A picture that opens full-screen: the `<img>` inside a link to the picture
 * itself, so with no script the click still shows it at full size. The
 * enhancer reads `href` and `data-caption`, and groups one gallery's links by
 * `data-lightbox`.
 */
export function lightboxLink(img: ReactNode, a: Attrs, s: RenderState, group?: string): ReactNode {
  const href = src(a.src, s.opts.imageProxy);
  if (!href) return img;
  const caption = a.caption?.trim();
  return h(
    'a',
    {
      class: 'doc-lightbox',
      href,
      'data-ifx': 'lightbox',
      'data-lightbox': group || null,
      'data-caption': caption || null,
      'aria-haspopup': 'dialog',
      'aria-label': a.alt?.trim() ? null : 'Open the image full screen',
    },
    img,
  );
}

const gallery: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs ?? {};
  const s = r.s;
  const images = (node.content as BlockNode[]).filter((c) => c.type === 'image');
  if (!images.length) return null;
  const id = r.uniqueId('gallery');
  const lightbox = a.lightbox !== false;
  const cols = clampInt(a.columns, 2, 6, 3);
  const aspect = a.aspect && ASPECTS[a.aspect] ? ASPECTS[a.aspect]! : null;
  const items = images.map((im) => {
    const ia: Attrs = im.attrs!;
    // Sized so the grid row is right before the picture lands; `aspect` crops in CSS regardless.
    const box = imageBox(ia.src, s.opts);
    const img = h('img', {
      src: src(ia.src, s.opts.imageProxy) || null,
      alt: text(ia.alt ?? ''),
      ...box.attrs,
      style: box.bg || null,
      loading: 'lazy',
      decoding: 'async',
    });
    const caption = ia.caption?.trim();
    return h(
      'figure',
      { class: 'doc-gallery-item' },
      lightbox ? lightboxLink(img, ia, s, id) : img,
      caption ? h('figcaption', null, caption) : null,
    );
  });
  return h(
    'div',
    {
      class: 'doc-gallery',
      id,
      'data-fx-gallery': '',
      'data-aspect': aspect ? '' : null,
      style: `--gal-cols:${cols};--gal-gap:${gapValue(a.gap)}${aspect ? `;--gal-aspect:${aspect}` : ''}`,
    },
    ...items,
  );
};

const marquee: BlockRenderer = (node, r) => {
  const inner = r.blocks(node.content);
  return inner ? marqueeShell(inner, node.attrs ?? {}) : null;
};

/**
 * A button that opens a dialog of ordinary blocks. `commandfor`/`command` are
 * invoker commands: a browser that has them opens the `<dialog>` modally with
 * no script; the enhancer covers the rest. The close button sits in a
 * `method="dialog"` form, which closes it with no script anywhere. The title
 * is not a heading on purpose: a closed dialog is not a place on the page,
 * and the on-this-page rail lists headings.
 */
const modal: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs!;
  const inner = r.blocks(node.content);
  const id = r.uniqueId('dialog');
  const style = a.style === 'secondary' || a.style === 'link' ? a.style : 'primary';
  const size = a.size && (MODAL_SIZES as readonly string[]).includes(a.size) ? a.size : 'md';
  const title = a.title?.trim();
  return h(
    'div',
    { class: 'doc-modal', 'data-ifx': 'modal', 'data-fx-modal': '' },
    h(
      'button',
      {
        type: 'button',
        class: `doc-btn doc-btn-${style} doc-modal-open`,
        commandfor: id,
        command: 'show-modal',
        'aria-haspopup': 'dialog',
        'data-modal-open': id,
      },
      text(a.label || 'Open'),
    ),
    h(
      'dialog',
      {
        class: 'doc-modal-dialog',
        id,
        'data-size': size,
        'aria-labelledby': title ? `${id}-title` : null,
        'aria-label': title ? null : text(a.label || 'Dialog'),
      },
      h(
        'div',
        { class: 'doc-modal-head' },
        title ? h('p', { class: 'doc-modal-title', id: `${id}-title` }, title) : null,
        h(
          'form',
          { method: 'dialog', class: 'doc-modal-close-form' },
          hRaw('button', { type: 'submit', class: 'doc-modal-close', 'aria-label': 'Close' }, ICONS.close),
        ),
      ),
      h('div', { class: 'doc-modal-body' }, inner),
    ),
  );
};

/**
 * Two pictures, one over the other, the "before" clipped to `--cmp` from the
 * left. With no script the figure shows the split at its starting point; the
 * enhancer reveals the native range input laid over the frame (drag, or the
 * arrow keys, Home and End, spoken as "40% before").
 */
const imageCompare: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs!;
  const proxy = r.s.opts.imageProxy;
  const before = src(a.before, proxy);
  const after = src(a.after, proxy);
  if (!before || !after) return null;
  const start = typeof a.start === 'number' && a.start >= 0 && a.start <= 100 ? a.start : 50;
  const bl: string = a.beforeLabel?.trim() || 'Before';
  const al: string = a.afterLabel?.trim() || 'After';
  const caption = a.caption?.trim();
  return h(
    'figure',
    { class: 'doc-compare', 'data-ifx': 'compare', 'data-fx-compare': '', style: `--cmp:${start}%` },
    h(
      'div',
      { class: 'doc-compare-frame' },
      h('img', { class: 'doc-compare-after', src: after, alt: text(a.afterAlt ?? al), loading: 'lazy', decoding: 'async' }),
      h(
        'div',
        { class: 'doc-compare-before' },
        h('img', { src: before, alt: text(a.beforeAlt ?? bl), loading: 'lazy', decoding: 'async' }),
      ),
      h('span', { class: 'doc-compare-label doc-compare-label-before', 'aria-hidden': 'true' }, bl),
      h('span', { class: 'doc-compare-label doc-compare-label-after', 'aria-hidden': 'true' }, al),
      h('span', { class: 'doc-compare-handle', 'aria-hidden': 'true' }),
      // `defaultValue`: a static starting point React prints as `value` without asking for onChange.
      createElement('input', {
        type: 'range',
        className: 'doc-compare-range',
        min: '0',
        max: '100',
        step: '1',
        defaultValue: start,
        'aria-label': `${bl} and ${al} divider`,
        'aria-valuetext': `${start}% ${bl.toLowerCase()}`,
        hidden: true,
      }),
    ),
    caption ? h('figcaption', null, caption) : null,
  );
};

export const INTERACTIVE: Record<string, BlockRenderer> = {
  carousel,
  // A slide outside its carousel (a stored document may hold one): its blocks, as plain content.
  carouselSlide: (node, r) => h('div', { class: 'doc-carousel-slide-lone' }, r.blocks(node.content)),
  gallery,
  marquee,
  modal,
  imageCompare,
};
