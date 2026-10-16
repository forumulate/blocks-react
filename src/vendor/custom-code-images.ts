import { isSafeImageUrlAttr } from '../url.js';

/**
 * The images inside a customer's own markup, routed through the render's image
 * hook (`RenderContext.imageProxy`).
 *
 * WHY a custom-code block needs this when it is "their HTML": an owner who
 * picks a picture from the library and pastes its address into a hand-written
 * `<img>` or a `background: url(…)` gets `/api/assets/{id}` — the same
 * root-relative path an image block holds. On a customer domain that mounts the
 * space under a path (`acme.com/docs`) that resolves at `acme.com/api/…`, their
 * server, so the image block beside it rendered and the custom block did not.
 * Fixing image blocks and card covers while leaving this one open is the "fixed
 * in four places, open in the fifth" defect this hook exists to end.
 *
 * Runs AFTER the sanitiser, on markup that can no longer execute; the hook only
 * ever sees values that are safe image sources, and a value it declines (null)
 * is left byte-for-byte as the author wrote it.
 */
export type ImageHook = (url: string) => string | null;

/** One URL through the hook, or null when it is not ours to change. */
function route(raw: string, hook: ImageHook): string | null {
  // Attribute values arrive HTML-encoded; the hook speaks plain URLs.
  const value = raw.trim().replace(/&amp;/g, '&');
  if (!value || !isSafeImageUrlAttr(value)) return null;
  const out = hook(value);
  return out && out !== value ? out : null;
}

/**
 * A CSS `url(…)` the hook rewrote, quoted. A result carrying a character that
 * could end the `url()` or the `<style>` element is refused rather than escaped:
 * the hook only ever mints paths and signed base64url segments, so such a value
 * would be a bug, and the author's own URL is the safe thing to keep.
 */
const CSS_UNSAFE = /["'()\\<>\s]/;

export function routeCssImages(css: string, hook: ImageHook | undefined): string {
  if (!hook) return css;
  return css.replace(
    /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi,
    (match: string, _q: string, url: string) => {
      const out = route(url, hook);
      return out && !CSS_UNSAFE.test(out) ? `url("${out}")` : match;
    },
  );
}

/** An attribute value as it goes back into a double-quoted attribute. */
function attrValue(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** `srcset`: comma-separated `url descriptor` candidates, each routed. */
function routeSrcset(value: string, hook: ImageHook): string | null {
  let changed = false;
  const out = value
    .replace(/&amp;/g, '&')
    .split(',')
    .map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/);
      const routed = url ? route(url, hook) : null;
      if (!routed) return candidate.trim();
      changed = true;
      return [routed, ...descriptor].join(' ');
    })
    .join(', ');
  return changed ? out : null;
}

const IMAGE_ATTRS = new Set(['src', 'srcset', 'poster', 'style']);

/**
 * The image attributes of every tag: `src` (img, source, video), `srcset`, a
 * video's `poster`, and the `url()`s in an inline `style`.
 * Everything else — including every `href`, which is navigation, not a picture
 * — is left alone.
 */
export function routeHtmlImages(html: string, hook: ImageHook | undefined): string {
  if (!hook) return html;
  return html.replace(
    /<([a-zA-Z][\w-]*)\b([^>]*)>/g,
    (tag: string, name: string, attrs: string) => {
      if (!attrs) return tag;
      const next = attrs.replace(
        /(\s)([a-zA-Z_:][-\w:.]*)(\s*=\s*)("([^"]*)"|'([^']*)'|([^\s>"']+))/g,
        (
          m: string,
          sp: string,
          attr: string,
          eq: string,
          _v: string,
          dq?: string,
          sq?: string,
          bare?: string,
        ) => {
          const key = attr.toLowerCase();
          if (!IMAGE_ATTRS.has(key)) return m;
          const value = dq ?? sq ?? bare ?? '';
          let out: string | null;
          if (key === 'style') {
            const decoded = value.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
            const css = routeCssImages(decoded, hook);
            out = css === decoded ? null : css;
          } else if (key === 'srcset') out = routeSrcset(value, hook);
          else out = route(value, hook);
          return out === null ? m : `${sp}${attr}${eq}"${attrValue(out)}"`;
        },
      );
      return `<${name}${next}>`;
    },
  );
}
