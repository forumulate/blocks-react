import type { ReactNode } from 'react';
import { h, list } from '../h.js';
import { HERO_ACTION_STYLES, HERO_LAYOUTS, HERO_SIZES, PERSON_LAYOUTS, PERSON_PHOTO_SHAPES } from '../look-tokens.js';
import { imageBox } from '../media.js';
import { href, mediaSrc, src } from '../url.js';
import type { RenderState } from '../state.js';
import type { Attrs } from '../types.js';
import { text } from './core.js';
import type { BlockRenderer } from './types.js';

/**
 * The hero and the person card — docs-schema `render-section-blocks.ts`.
 * Complete with no script: the layout is a data attribute the reader
 * stylesheet keys on, a picture carries its stored size so it reserves its
 * box before it loads, and a video is the same muted, looping, inline element
 * a section background is — never SENT to a reader who asked for reduced
 * motion (the `<source media>` below). An enum outside its list falls back to
 * the default; a URL goes through the reader's address rules.
 */

const oneOf = <T extends string>(values: readonly T[], v: unknown, fallback: T): T =>
  typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : fallback;

function heroMedia(a: Attrs, s: RenderState): ReactNode {
  const m = a.media;
  if (!m) return null;
  const proxy = s.opts.imageProxy;
  if (m.kind === 'video') {
    const video = mediaSrc(m.src, proxy);
    if (!video) return null;
    const poster = m.poster ? src(m.poster, proxy) : '';
    const label = m.alt?.trim();
    return h(
      'figure',
      { class: 'doc-hero-media', 'data-kind': 'video' },
      h(
        'video',
        {
          muted: true,
          autoplay: true,
          loop: true,
          playsinline: true,
          disablepictureinpicture: true,
          preload: 'metadata',
          tabindex: '-1',
          poster: poster || null,
          'aria-label': label || null,
          'aria-hidden': label ? null : 'true',
        },
        h('source', { src: video, media: '(prefers-reduced-motion: no-preference)' }),
      ),
    );
  }
  const picture = src(m.src, proxy);
  if (!picture) return null;
  const box = imageBox(m.src, s.opts);
  return h(
    'figure',
    { class: 'doc-hero-media', 'data-kind': 'image' },
    h('img', {
      src: picture,
      alt: text(m.alt?.trim() ?? ''),
      ...box.attrs,
      style: box.bg || null,
      decoding: 'async',
      fetchpriority: 'high',
    }),
  );
}

/**
 * A hero: eyebrow, headline, sentence, buttons, a quiet note, and a picture or
 * a video arranged `center`, `split` or `below`. A hero with no headline is a
 * hero mid-edit and renders as nothing.
 */
const hero: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs!;
  const title = a.title?.trim();
  if (!title) return null;
  const layout = oneOf(HERO_LAYOUTS, a.layout, 'center');
  const size = oneOf(HERO_SIZES, a.size, 'lg');
  const level = a.level === 2 ? 2 : 1;
  const actions = (a.actions ?? [])
    .filter((x: Attrs) => x && x.label?.trim())
    .slice(0, 3)
    .map((x: Attrs, i: number) => {
      const style = oneOf(HERO_ACTION_STYLES, x.style, i === 0 ? 'primary' : 'secondary');
      return h(
        'a',
        { class: `doc-btn doc-btn-${style}`, href: href(x.href) },
        h('span', { class: 'doc-btn-label' }, x.label.trim()),
      );
    });
  const media = heroMedia(a, r.s);
  return h(
    'div',
    {
      class: 'doc-hero',
      'data-fx-hero': '',
      'data-layout': layout,
      'data-size': size,
      'data-media-side': a.mediaSide === 'start' ? 'start' : null,
      'data-has-media': media ? '' : null,
    },
    h(
      'div',
      { class: 'doc-hero-copy' },
      a.eyebrow?.trim() ? h('p', { class: 'doc-hero-eyebrow' }, a.eyebrow.trim()) : null,
      h(`h${level}`, { class: 'doc-hero-title' }, title),
      a.sub?.trim() ? h('p', { class: 'doc-hero-sub' }, a.sub.trim()) : null,
      actions.length ? h('div', { class: 'doc-btns doc-hero-actions' }, list(actions)) : null,
      a.note?.trim() ? h('p', { class: 'doc-hero-note' }, a.note.trim()) : null,
    ),
    media,
  );
};

/** Up to two initials, for a person with no photo. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * A person: photo (or their initials on a tinted disc), name, role, a line or
 * two, and their links. The photo's box is fixed by the stylesheet, so a slow
 * picture never moves the words. The name is not a heading: a team grid of
 * twelve would otherwise put twelve names into the page's outline.
 */
const person: BlockRenderer = (node, r) => {
  const a: Attrs = node.attrs!;
  const name = a.name?.trim();
  if (!name) return null;
  const layout = oneOf(PERSON_LAYOUTS, a.layout, 'card');
  const shape = oneOf(PERSON_PHOTO_SHAPES, a.photoShape, 'circle');
  const photoSrc = a.photo ? src(a.photo, r.s.opts.imageProxy) : '';
  const photo = photoSrc
    ? h('img', {
        class: 'doc-person-photo',
        src: photoSrc,
        alt: a.photoAlt?.trim() || name,
        loading: 'lazy',
        decoding: 'async',
      })
    : h('span', { class: 'doc-person-photo doc-person-initials', 'aria-hidden': 'true' }, initials(name));
  const links = (a.links ?? [])
    .filter((l: Attrs) => l && l.label?.trim())
    .map((l: Attrs) => h('li', null, h('a', { href: href(l.href) }, l.label.trim())));
  return h(
    'div',
    { class: 'doc-person', 'data-fx-person': '', 'data-layout': layout, 'data-shape': shape },
    photo,
    h(
      'div',
      { class: 'doc-person-body' },
      h('p', { class: 'doc-person-name' }, name),
      a.role?.trim() ? h('p', { class: 'doc-person-role' }, a.role.trim()) : null,
      a.bio?.trim() ? h('p', { class: 'doc-person-bio' }, a.bio.trim()) : null,
      links.length ? h('ul', { class: 'doc-person-links' }, list(links)) : null,
    ),
  );
};

export const HERO: Record<string, BlockRenderer> = { hero, person };
