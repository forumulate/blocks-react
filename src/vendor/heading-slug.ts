import { foldAccents } from './accent-fold.js';

/**
 * A heading's anchor name, from its text — on its own, importable without the
 * renderer.
 *
 * It lived in `render.ts`, which is correct for the server and impossible for
 * the reader's "on this page" rail: importing that module pulls the whole
 * Markdown renderer — markdown-it, its entity tables, linkify-it and a schema
 * validation library, about 62 KB gzipped — into a client bundle, which is the
 * weight a customer measured and asked us to cut (F-22). So the rail kept a
 * byte-identical private copy instead, and a server id and a client id that
 * disagree break every anchor on the page (FR-16). Both of those are solved by
 * the function having its own file and its own export subpath: one rule, no
 * renderer.
 *
 * NOT `slugifyCapped` from the platform's shared package, and that is on purpose: this
 * is an ANCHOR, not an address we mint. Its SHAPE stays the rail's original
 * one — punctuation dropped rather than turned into a separator, `_` kept, 80
 * characters — so every ASCII heading keeps the id it has always had.
 *
 * What it does share is the ACCENT FOLD (the platform's accent-fold rule).
 * The old `[^\w\s-]` was ASCII-only, so an accented letter was not folded but
 * DELETED: "Caché con ETags" became `cach-con-etags`, "país, opción" became
 * `pas-opcin`, and a heading in Cyrillic or Japanese had no letters left at all
 * and fell to `section` (Numestri NUM-46). Folding first and keeping Unicode
 * letters and numbers gives `cache-con-etags`, `pais-opcion`, `日本語の見出し`.
 * Ids that move are still answered: {@link legacyHeadingSlug} names the old
 * one and the renderer emits it as a second anchor target.
 */
export function headingSlug(text: string): string {
  return (
    foldAccents(text)
      .toLowerCase()
      .trim()
      .replace(/[^\p{Letter}\p{Number}_\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80) || 'section'
  );
}

/**
 * The id `headingSlug` produced before the accent fix, for resolution only.
 *
 * Links already shared against an accented heading (`#cach-con-etags`) must
 * keep landing on it, so the renderer emits this as an extra, empty anchor
 * target inside the heading when — and only when — it differs from the new id
 * and still names something (an all-accent heading's old id was the bare
 * `section` fallback, which named every such heading at once and is not worth
 * preserving). Nothing mints it; it goes once old links have aged out.
 */
export function legacyHeadingSlug(text: string): string | null {
  const old = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return old && old !== '-' && old !== headingSlug(text) ? old : null;
}
