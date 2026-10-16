import { SAFE_DATA_IMAGE, urlScheme } from './vendor/url-scheme.js';

/**
 * The address rules every link and picture goes through — docs-schema's
 * `url-attr.ts`, minus its zod refinements (test/constants-parity checks the
 * two agree on a table of hostile and ordinary values).
 *
 * React escapes attribute values but has no opinion about `javascript:`, and
 * the block JSON a site renders is stored data: a document written before the
 * schema refused a scheme is still out there. So an unsafe link becomes a dead
 * `#` and an unsafe picture no picture, exactly as on the hosted reader.
 */

const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'sms', 'ftp', 'ftps']);

export function isSafeUrl(value: string): boolean {
  const scheme = urlScheme(value);
  return scheme === null || SAFE_SCHEMES.has(scheme);
}

export function isSafeImageUrl(value: string): boolean {
  if (isSafeUrl(value)) return true;
  // eslint-disable-next-line no-control-regex -- what a browser strips before parsing
  return SAFE_DATA_IMAGE.test(value.replace(/[\s\u0000- \u007f]/g, '').toLowerCase());
}

/** docs-schema's name for it (url-attr.ts), so ./vendor/custom-code-images stays a verbatim copy. */
export const isSafeImageUrlAttr = isSafeImageUrl;

export function safeUrl(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return isSafeUrl(value) ? value : fallback;
}

export function safeImageUrl(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return isSafeImageUrl(value) ? value : fallback;
}

/** A video address: a library path or an https URL without credentials. */
export function isSafeMediaUrl(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 2048) return false;
  if (v.startsWith('/')) return !v.startsWith('//') && !/[\s"'<>\\]/.test(v);
  try {
    const url = new URL(v);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function safeMediaUrl(value: unknown): string {
  return typeof value === 'string' && isSafeMediaUrl(value) ? value.trim() : '';
}

/** `hrefAttr`: a link target, `#` when unsafe. */
export function href(value: unknown, fallback = '#'): string {
  return safeUrl(value, fallback);
}

export type ImageProxy = (url: string) => string | null;

/** `srcAttr`: a picture's address on this site, through the caller's proxy when it has one. */
export function src(value: unknown, proxy?: ImageProxy, fallback = ''): string {
  const safe = safeImageUrl(value, fallback);
  return proxy && safe ? (proxy(safe) ?? safe) : safe;
}

/** `mediaAddress`: a video; library paths take the proxy, https streams are left alone. */
export function mediaSrc(value: unknown, proxy?: ImageProxy): string | null {
  const safe = safeMediaUrl(value);
  if (!safe) return null;
  return safe.startsWith('/') ? (proxy?.(safe) ?? safe) : safe;
}
