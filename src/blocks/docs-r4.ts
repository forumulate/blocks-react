import type { HtmlAttrs } from '../h.js';
import type { LookStamp } from '../look.js';
import type { Attrs } from '../types.js';

/**
 * Round 4's per-block looks — docs-schema `render-docs-r4.ts`: what a card
 * row's, hint's, table's, tab group's or code block's own look attrs add to
 * its root (`data-*` hooks for the enum keys, `--x-block` properties for the
 * values). An unset attr adds nothing, so a block without them is the markup
 * it always was. Every value is validated again on the way out.
 */

// Closed lists from docs-schema `block-types-r4.ts` (constants-parity checks them).
export const CARD_BORDERS = ['card', 'tile', 'none'] as const;
export const CARD_ICON_ALIGNS = ['start', 'center'] as const;
export const CARD_TITLE_WEIGHTS = [400, 500, 600, 700] as const;
export const CARD_CTA_PLACEMENTS = ['below', 'end'] as const;
export const HINT_EDGES = ['bar', 'hook', 'none'] as const;
export const CODE_TAB_STYLES = ['underline', 'pill'] as const;
export const TABLE_WRAPS = ['auto', 'wrap', 'nowrap'] as const;
export const TABLE_MORE_STYLES = ['outline', 'solid'] as const;
export const TABLE_MORE_ALIGNS = ['start', 'center'] as const;
export const TABLE_MORE_FONTS = ['ui', 'mono'] as const;
export const TABLE_MORE_CASES = ['none', 'upper'] as const;

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const hex = (v: unknown): string | null => (typeof v === 'string' && HEX6.test(v) ? v : null);
const oneOf = <T extends string | number>(list: readonly T[], v: unknown): T | null =>
  (list as readonly unknown[]).includes(v) ? (v as T) : null;
const pxIn = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;

const empty = (): LookStamp => ({ data: {}, vars: [] });

/** The stamp as attributes, merging into a `style` the caller already has (`ownVars`). */
export function stampAttrs(s: LookStamp, ownVars: string[] = []): HtmlAttrs {
  const vars = [...ownVars, ...s.vars];
  return { ...s.data, style: vars.length ? vars.join(';') : null };
}

/** `cards`: border, icon placement and scale, type scale, fill, CTA. */
export function cardsLookStamp(a: Attrs | undefined | null): LookStamp {
  const out = empty();
  if (!a) return out;
  const { data, vars } = out;
  const border = oneOf(CARD_BORDERS, a.border);
  if (border) data['data-card-border'] = border;
  const align = oneOf(CARD_ICON_ALIGNS, a.iconAlign);
  if (align) data['data-card-icon-align'] = align;
  const cta = oneOf(CARD_CTA_PLACEMENTS, a.ctaPlacement);
  if (cta) data['data-card-cta'] = cta;
  const sized: [unknown, number, number, string, string][] = [
    [a.iconSize, 12, 64, 'icon-size', 'px'],
    [a.tileSize, 32, 96, 'tile-size', 'px'],
    [a.titleSize, 12, 24, 'title-size', 'px'],
    [a.descriptionSize, 12, 24, 'desc-size', 'px'],
  ];
  for (const [v, lo, hi, name, unit] of sized) {
    const n = pxIn(v, lo, hi);
    if (n === null) continue;
    data[`data-card-${name}`] = '';
    vars.push(`--card-${name}-block:${n}${unit}`);
  }
  const weight = oneOf(CARD_TITLE_WEIGHTS, a.titleWeight);
  if (weight) {
    data['data-card-title-weight'] = '';
    vars.push(`--card-title-weight-block:${weight}`);
  }
  const bg = hex(a.background);
  if (bg) {
    data['data-card-bg'] = '';
    vars.push(`--card-bg-block:${bg}`);
  }
  const bgDark = hex(a.backgroundDark);
  if (bgDark) {
    data['data-card-bg-dark'] = '';
    vars.push(`--card-bg-dark-block:${bgDark}`);
  }
  return out;
}

/** `hint`: one tone for bar, badge and wash; the title gap; the edge. */
export function hintLookStamp(a: Attrs | undefined | null): LookStamp {
  const out = empty();
  if (!a) return out;
  const tone = hex(a.tone);
  if (tone) {
    out.data['data-tone'] = '';
    out.vars.push(`--hint-block-tone:${tone}`);
  }
  const gap = pxIn(a.titleGap, 0, 24);
  if (gap !== null) {
    out.data['data-title-gap'] = '';
    out.vars.push(`--hint-title-gap:${gap}px`);
  }
  const edge = oneOf(HINT_EDGES, a.edge);
  if (edge) out.data['data-edge'] = edge;
  return out;
}

/** `table`: wrapping, the "Show more" look, code ink per column. */
export function tableLookStamp(a: Attrs | undefined | null): LookStamp {
  const out = empty();
  if (!a) return out;
  const { data, vars } = out;
  // `auto` is written too: it is how one table opts back out of a theme's `wrap`.
  const wrap = oneOf(TABLE_WRAPS, a.wrap);
  if (wrap) data['data-wrap'] = wrap;
  const m = a.more;
  if (m && typeof m === 'object') {
    const style = oneOf(TABLE_MORE_STYLES, m.style);
    if (style) data['data-more-style'] = style;
    const align = oneOf(TABLE_MORE_ALIGNS, m.align);
    if (align) data['data-more-align'] = align;
    if (typeof m.fade === 'boolean') data['data-more-fade'] = String(m.fade);
    const font = oneOf(TABLE_MORE_FONTS, m.font);
    if (font) data['data-more-font'] = font;
    const kase = oneOf(TABLE_MORE_CASES, m.case);
    if (kase) data['data-more-case'] = kase;
    const paints: [unknown, string][] = [
      [m.background, 'bg'],
      [m.backgroundDark, 'bg-dark'],
      [m.ink, 'ink'],
      [m.inkDark, 'ink-dark'],
    ];
    for (const [v, name] of paints) {
      const h = hex(v);
      if (!h) continue;
      data[`data-more-${name}`] = '';
      vars.push(`--table-more-${name}-block:${h}`);
    }
  }
  // One hook per column that has an ink, so a column the block leaves alone keeps the theme's.
  for (const [inks, suffix] of [
    [a.codeInk, ''],
    [a.codeInkDark, '-dark'],
  ] as const) {
    (Array.isArray(inks) ? inks.slice(0, 6) : []).forEach((v: unknown, i: number) => {
      const h = hex(v);
      if (!h) return;
      data[`data-code-ink${suffix}-${i + 1}`] = '';
      vars.push(`--table-code-ink${suffix}-${i + 1}:${h}`);
    });
  }
  return out;
}

/** `tabs`: the active tab's ink and underline, and the strip as pills. */
export function tabsLookStamp(a: Attrs | undefined | null): LookStamp {
  const out = empty();
  if (!a) return out;
  const style = oneOf(CODE_TAB_STYLES, a.tabStyle);
  if (style) out.data['data-tab-style'] = style;
  const act = a.active;
  if (act && typeof act === 'object') {
    const ink = hex(act.color);
    if (ink) {
      out.data['data-active-ink'] = '';
      out.vars.push(`--tabs-active-ink-block:${ink}`);
    }
    const inkDark = hex(act.colorDark);
    if (inkDark) {
      out.data['data-active-ink-dark'] = '';
      out.vars.push(`--tabs-active-ink-dark-block:${inkDark}`);
    }
    if (typeof act.underline === 'boolean') out.data['data-active-underline'] = String(act.underline);
  }
  return out;
}

/** The two faces a code title may take, as the stacks the reader uses. */
const TITLE_FACE: Record<string, string> = {
  ui: 'var(--font-body,ui-sans-serif,system-ui,sans-serif)',
  mono: 'var(--font-mono,ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace)',
};

/**
 * A code block's or code group's own look: the frame, the language chip (a
 * custom property too — the hydrator reads `--cf-show-language` by
 * inheritance), the title's face and file glyph, and a group's strip style.
 */
export function codeLookStamp(a: Attrs | undefined | null): LookStamp {
  const out = empty();
  if (!a) return out;
  const look = oneOf(['bordered', 'flat', 'inset'] as const, a.look);
  if (look) out.data['data-code-look'] = look;
  const show = a.showLanguage;
  if (show === true || show === false || show === 'auto') {
    out.data['data-show-language'] = String(show);
    out.vars.push(`--cf-show-language:${show}`);
  }
  const face = oneOf(['ui', 'mono'] as const, a.titleFont);
  if (face) {
    out.data['data-title-font'] = face;
    out.vars.push(`--code-title-font-block:${TITLE_FACE[face]}`);
  }
  if (typeof a.titleIcon === 'boolean') out.data['data-title-icon'] = String(a.titleIcon);
  const tab = oneOf(CODE_TAB_STYLES, a.tabStyle);
  if (tab) out.data['data-tab-style'] = tab;
  return out;
}

/** Whether a stamp adds anything at all. */
export function stampEmpty(s: LookStamp): boolean {
  return !Object.keys(s.data).length && !s.vars.length;
}
