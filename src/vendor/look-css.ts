import { lengthCss } from './responsive-css.js';
import type { COLOR_TOKENS, ColorValue } from '../look-tokens.js';

/**
 * The three value→CSS helpers the reader's CLIENT components call, in a module
 * with no zod in it.
 *
 * They lived beside the schemas that accept the values (`render-look.ts` pulls
 * in `block-style.ts`, `feed-length.ts` declares `z.union(...)` at top level),
 * and a top-level schema call cannot be tree-shaken — so the feed's "more"
 * button and the subscribe form shipped zod and the whole block-style
 * vocabulary to every blog and docs index page (perf audit PERF-02). Both of
 * those modules re-export from here, so every existing import still works.
 */

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** What each colour token paints with — the reader's own tokens, so a section
 *  in a `dark` scheme resolves `surface` to the DARK surface. */
const TOKEN_COLOR: Record<(typeof COLOR_TOKENS)[number], string> = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  panel: 'var(--panel)',
  ink: 'var(--ink)',
  muted: 'var(--muted)',
  brand: 'var(--reader-brand, var(--signal))',
  accent: 'var(--reader-accent, var(--accent))',
};

export function cssColorValue(v: ColorValue | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  if (v in TOKEN_COLOR) return TOKEN_COLOR[v as keyof typeof TOKEN_COLOR];
  return HEX.test(v) ? v : null;
}

/**
 * A length that lands in a style attribute — Package D's length
 * (the platform's responsive-value rule): a pixel count, or `12px`,
 * `1.5rem`, `2ch`, `40vh`/`dvh`, `33%`, a bare `0` in any spelling (showcase
 * B19: `"0"` was a 422 while `"0px"` passed), or `clamp()` / `min()` / `max()`
 * of those with one sum or difference per argument — a fluid size written
 * once. Bounded so a typo cannot make a 9,000-pixel card. Never negative here.
 */
export type CardLength = number | string;

export function cardLengthCss(v: CardLength | null | undefined): string | null {
  return lengthCss(v);
}

/**
 * A face: the theme's `heading`, `body` or `mono`, or a family by name
 * (`"Söhne"`, `"IBM Plex Serif"`) — letters, digits, spaces and dashes, so a
 * name cannot close the declaration it lands in.
 */
export const FONT_REFS = ['heading', 'body', 'mono'] as const;
export const FONT_FAMILY_PATTERN = /^[\p{L}\p{N} _-]{1,60}$/u;
export type FontRef = (typeof FONT_REFS)[number] | string;

/** The CSS `font-family` a face names. */
export function fontRefCss(v: FontRef | null | undefined): string | null {
  if (!v) return null;
  if (v === 'heading') return 'var(--font-display, var(--font-heading, inherit))';
  if (v === 'body') return 'var(--font-body, inherit)';
  // The full system stack (R3-024, R4-101): `ui-monospace` is Safari's alone,
  // so Chrome on a Mac fell straight through to Courier.
  if (v === 'mono')
    return 'var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace)';
  return FONT_FAMILY_PATTERN.test(v) ? `"${v}", var(--font-body, inherit)` : null;
}
