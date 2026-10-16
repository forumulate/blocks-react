import { lengthCss } from './vendor/responsive-css.js';

/**
 * The closed lists and bounds docs-schema re-checks a block's look against on
 * the way out — copied from `block-style.ts`, `block-look-style.ts`,
 * `block-growth.ts`, `section-blocks.ts` and `interactive-blocks.ts`, which
 * define them beside their zod schemas and so cannot be imported here.
 *
 * Copies drift; test/constants-parity.test.ts compares every one of these to
 * docs-schema's live export and fails on the first difference.
 */

export const COLOR_TOKENS = ['bg', 'surface', 'panel', 'ink', 'muted', 'brand', 'accent'] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
export type ColorValue = ColorToken | `#${string}`;

export const ANCHOR_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const CLASS_NAME_PATTERN = /^[a-z][a-z0-9-]{0,39}( [a-z][a-z0-9-]{0,39}){0,3}$/;
export const HOOK_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const BLOCK_MOTIONS = ['none', 'fade', 'rise', 'scale'] as const;
export const SECTION_SHADOWS = ['none', 'sm', 'md', 'lg'] as const;
export const SPACE_TOKENS = ['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const;
export type SpaceToken = (typeof SPACE_TOKENS)[number];
export type SpaceValue = number | SpaceToken;

export const TEXT_ALIGNS = ['start', 'center', 'end'] as const;
export const LIST_MARKERS = ['default', 'arrow', 'dash', 'emdash', 'none', 'arrow-end'] as const;
export const LINK_INKS = ['inherit'] as const;
export const STACK_ON = ['never', 'sm', 'md'] as const;
export const COLUMN_VALIGNS = ['start', 'center', 'end', 'baseline'] as const;
export const HIDE_ON = ['phone', 'tablet'] as const;
export const ICON_STYLES = ['inline', 'tile'] as const;
export const BADGE_VARIANTS = ['default', 'note', 'tip', 'caution', 'danger', 'success', 'brand'] as const;

export function lineHeightOk(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0.9 && v <= 2;
}
export function blockWeightOk(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 100 && v <= 900;
}
export function blockTrackingOk(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -0.2 && v <= 0.5;
}
/** A text size as CSS, or null: numbers are px (8–160), strings a length. */
export function textSizeCss(v: number | string): string | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 8 && v <= 160 ? `${v}px` : null;
  return lengthCss(v);
}
/** `60vh` (1–100) or `480px` (1–2000): it lands in a style attribute. */
export function validMinHeight(v: string): boolean {
  const m = /^(\d{1,4})(vh|px)$/.exec(v);
  if (!m) return false;
  const n = Number(m[1]);
  return n >= 1 && (m[2] === 'vh' ? n <= 100 : n <= 2000);
}

/** Which look keys each block takes. */
export const BLOCK_LOOK_KEYS: Readonly<Record<string, readonly string[]>> = {
  paragraph: ['textAlign', 'size', 'color', 'link', 'weight'],
  heading: [
    'textAlign',
    'variant',
    'size',
    'color',
    'weight',
    'tracking',
    'spaceBefore',
    'spaceAfter',
    'lineHeight',
    'icon',
    'iconStyle',
    'iconColor',
  ],
  bulletList: ['marker', 'rule', 'color', 'link', 'weight', 'itemGap', 'size', 'spaceBefore', 'spaceAfter'],
  orderedList: ['marker', 'rule', 'color', 'link', 'weight', 'itemGap', 'size', 'spaceBefore', 'spaceAfter'],
  columns: ['stackOn', 'valign', 'alternate', 'divider', 'gap', 'rowGap', 'spaceBefore', 'spaceAfter', 'spaceAround'],
  column: ['hideOn'],
  grid: ['cols'],
  gridItem: ['shadow', 'radius', 'border', 'gradient', 'gradientDark', 'textAlign', 'icon', 'iconStyle', 'accent'],
  table: ['collapseAfter', 'stickyHeader'],
};

// ---- growth hooks (block-growth.ts) ----------------------------------------
export const AB_VARIANTS = ['a', 'b', 'c', 'd'] as const;
export const GROWTH_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const BLOCK_ORDERS_SM = ['first', '1', '2', '3', '4', '5', '6', 'last'] as const;

// ---- hero and person (section-blocks.ts) -----------------------------------
export const HERO_LAYOUTS = ['center', 'split', 'below'] as const;
export const HERO_SIZES = ['md', 'lg', 'xl'] as const;
export const HERO_ACTION_STYLES = ['primary', 'secondary', 'link'] as const;
export const PERSON_LAYOUTS = ['card', 'row'] as const;
export const PERSON_PHOTO_SHAPES = ['circle', 'rounded', 'square'] as const;

// ---- interactive blocks (interactive-blocks.ts) ----------------------------
export const IX_GAPS = ['none', 'sm', 'md', 'lg'] as const;
export const AUTOPLAY_MIN_MS = 2000;
export const AUTOPLAY_MAX_MS = 30000;
export const AUTOPLAY_DEFAULT_MS = 5000;
export const PRICING_MAX_PERIODS = 4;

/** A figure panel's custom colour (types-editorial.ts). */
export const FIGURE_HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
