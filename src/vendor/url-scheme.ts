/*
 * The URL scheme reader, apart from `url-fields.ts` on purpose: that module
 * builds zod schemas, and the reader's client code (image rebasing on every
 * forum thread and docs page) needs only this function. Reached through the
 * barrel, browser bundles carried zod for one regex (js-budget). This file
 * must import nothing — it is published as the `./url-scheme` subpath.
 */

/**
 * The scheme a browser would read out of this value, or null when there is
 * none (a relative URL, an anchor, a protocol-relative URL, an empty string).
 *
 * Whitespace and control characters are stripped first, because that is what a
 * browser does: `java\nscript:alert(1)` and `  JaVaScRiPt:alert(1)` both
 * navigate. HTML entities need no handling — the renderers escape `&`, so
 * `&#106;avascript:` reaches the DOM as text.
 *
 * Scheme-less is safe by construction: a `:` can only start a scheme at the
 * very front of the value, and the scheme grammar has no `/`, `#` or `?`, so
 * `/a/b:c`, `#x:y` and `?q=a:b` are correctly read as scheme-less.
 */
export function urlScheme(value: string): string | null {
  // eslint-disable-next-line no-control-regex -- stripping control chars is the point (attackers hide java\u0000script:)
  const stripped = value.replace(/[\s\u0000- \u007f]/g, '').toLowerCase();
  const m = /^([a-z][a-z0-9+.-]*):/.exec(stripped);
  return m ? m[1]! : null;
}

/**
 * Inert `data:` images, allowed for image-bearing fields only.
 *
 * `data:image/svg+xml` is deliberately absent: an SVG is a script container,
 * and a `data:` SVG inherits the embedding origin in some navigation contexts.
 */
export const SAFE_DATA_IMAGE =
  /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)[;,]/;

/** Is this value safe to follow as a link? (scheme-less counts as safe) */
