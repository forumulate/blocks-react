import type { HtmlAttrs } from '../h.js';
import type { LookStamp } from '../look.js';
import { cssSpace } from '../section-look.js';
import { responsiveFilled } from '../vendor/responsive-css.js';
import type { SpaceValue } from '../look-tokens.js';

/**
 * Round 5's per-block looks — docs-schema `render-docs-r5.ts`, beside
 * ./docs-r4 whose stamp shape these follow (`data-*` hooks for enum keys,
 * `--x-block` properties for values), so a block attr wins over the theme's
 * value wherever both are set. Every value is validated again here and an
 * unset attr adds nothing.
 */

// Closed lists from docs-schema `block-types-r5.ts` (constants-parity checks them).
export const TABS_STYLES = ['underline', 'pill'] as const;
export const PROMPT_LABEL_CASES = ['upper', 'none'] as const;
export const PROMPT_COLLAPSE_STYLES = ['footer', 'pill'] as const;

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const hex = (v: unknown): string | null => (typeof v === 'string' && HEX6.test(v) ? v : null);
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  (list as readonly unknown[]).includes(v) ? (v as T) : null;
const pxIn = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;

/** Two stamps as one — the round-4 look and this round's on the same root. */
export function mergeStamps(a: LookStamp, b: LookStamp): LookStamp {
  return { data: { ...a.data, ...b.data }, vars: [...a.vars, ...b.vars] };
}

/**
 * A gap as custom properties: one value as `--<name>`, or `{lg, md, sm}` as
 * `--<name>-lg/-md/-sm` (each step filled from the one above) with a
 * `data-<hook>-steps` the stylesheet picks one from per width — the row of
 * columns' shape, so one grammar spaces both.
 */
export function gapStamp(v: unknown, name: string, hook: string): LookStamp {
  if (v === null || v === undefined) return { data: {}, vars: [] };
  if (typeof v === 'object') {
    const filled = responsiveFilled(v as never) as Partial<Record<'lg' | 'md' | 'sm', SpaceValue>>;
    const vars: string[] = [];
    for (const k of ['lg', 'md', 'sm'] as const) {
      const css = filled[k] === undefined ? null : cssSpace(filled[k]);
      if (css) vars.push(`--${name}-${k}:${css}`);
    }
    return vars.length ? { data: { [`data-${hook}`]: '', [`data-${hook}-steps`]: '' }, vars } : { data: {}, vars };
  }
  const css = cssSpace(v as SpaceValue);
  return css ? { data: { [`data-${hook}`]: '' }, vars: [`--${name}:${css}`] } : { data: {}, vars: [] };
}

/** `cards`: min width, gaps, the panel's rule and band. */
export function cardsR5Stamp(a: Record<string, unknown> | undefined | null): LookStamp {
  if (!a) return { data: {}, vars: [] };
  const data: HtmlAttrs = {};
  const vars: string[] = [];
  const min = pxIn(a.minWidth, 160, 480);
  if (min !== null) {
    data['data-card-min'] = '';
    vars.push(`--card-min-block:${min}px`);
  }
  for (const [v, name] of [
    [a.gap, 'cards-gap'],
    [a.rowGap, 'cards-row-gap'],
  ] as const) {
    const g = gapStamp(v, name, name);
    Object.assign(data, g.data);
    vars.push(...g.vars);
  }
  if (typeof a.divider === 'boolean') data['data-card-divider'] = String(a.divider);
  const band = pxIn(a.iconBand, 0, 120);
  if (band !== null) {
    data['data-card-band'] = '';
    vars.push(`--card-band-block:${band}px`);
  }
  return { data, vars };
}

/** `tabs`: the strip's own look. */
export function tabsR5Attrs(a: Record<string, unknown> | undefined | null): HtmlAttrs {
  const style = oneOf(TABS_STYLES, a?.style);
  return style ? { 'data-tabs-style': style } : {};
}

/** What a prompt's round-5 look resolves to. */
export interface PromptR5 {
  data: HtmlAttrs;
  vars: string[];
  /** "Open in …" links kept in the row on a desktop; null = all of them. */
  desktop: number | null;
  collapsePill: boolean;
}

/**
 * `prompt`: label case, surface colours, fold look, desktop row. The hosted
 * reader falls back to the theme's `docs.blocks.prompt` for each key; a
 * customer site has no theme defaults, so only the block's own attrs count.
 */
export function promptR5(a: Record<string, unknown>): PromptR5 {
  const data: HtmlAttrs = {};
  const vars: string[] = [];
  const kase = oneOf(PROMPT_LABEL_CASES, a.labelCase);
  if (kase) data['data-label-case'] = kase;
  for (const [v, name] of [
    [a.background, 'bg'],
    [a.backgroundDark, 'bg-dark'],
  ] as const) {
    const h = hex(v);
    if (!h) continue;
    data[`data-prompt-${name}`] = '';
    vars.push(`--prompt-${name}-block:${h}`);
  }
  const fold = oneOf(PROMPT_COLLAPSE_STYLES, a.collapseStyle);
  if (fold === 'pill') data['data-collapse-style'] = 'pill';
  const desktop = pxIn(a.openInDesktop, 0, 6);
  if (desktop !== null) data['data-desktop-targets'] = String(desktop);
  return { data, vars, desktop, collapsePill: fold === 'pill' };
}
