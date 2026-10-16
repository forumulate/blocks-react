/* ---------------------------------------------------------------------------
 * RESPONSIVE VALUES — one value, or one per screen size.
 *
 * Every replica in the showcase rebuild that needed a phone size (a card
 * title, a hero's height, an h1) wrote it as an `elementStyles` rule with
 * `media: "phone"` against a selector we never promised, because the key it
 * was tuning took ONE value. This is the shape every size-like key takes
 * instead, so "28px on a phone, 44px on a desktop" is the key's own value:
 *
 *     "size": 44                         one value at every width
 *     "size": {"lg": 44, "sm": 28}       desktop 44, phone 28, tablet 44
 *     "size": {"lg": "3rem", "md": "2.5rem", "sm": "clamp(1.5rem, 6vw, 2rem)"}
 *
 * DESKTOP-FIRST, on the breakpoints the reader already uses
 * (`ELEMENT_STYLE_BREAKPOINTS`, the `mobile` block): `lg` is the base and holds
 * at every width nothing smaller overrides; `md` takes over at 1024px and
 * below; `sm` at 640px and below. A step left out falls through to the next
 * larger one that is set — `{"lg": 44, "sm": 28}` is 44 on a tablet — and a
 * value with no `lg` leaves the desktop at whatever the key's own default is,
 * so `{"sm": 28}` changes phones and nothing else.
 *
 * THE CONTRACT (WAVE3 §2, owned by Package D — feeds, post anatomy and chrome
 * code against exactly this):
 *  - `Responsive<T> = T | {sm?: T, md?: T, lg?: T}`;
 *  - a length may be a px number, a unit string, unitless `0`, or `clamp()`,
 *    `min()` or `max()` of those (one `a + b` / `a - b` per argument, which is
 *    the shape every fluid formula takes);
 *  - the CSS helpers at the bottom emit the `@media` rules (for a stylesheet)
 *    or the `--name-lg/-md/-sm` custom properties (for a style attribute).
 *
 * The breakpoint object is STRICT: `{"phone": 28}` is a 422 naming `phone`,
 * not a value that silently means nothing. The strict theme pipe cannot walk
 * into a union (see unknown-keys.ts), so the object refuses for itself.
 * ------------------------------------------------------------------------- */

/*
 * This file is the zod-free half: the shape's types, the length grammar and the
 * CSS emitters. The schemas that accept these values are in ./responsive-value,
 * which re-exports everything here. Split because the reader's client
 * components call the emitters, and a module with a top-level `z.union(...)`
 * cannot be tree-shaken — importing `responsiveStyleVars` put all of zod on
 * every blog post and docs index (perf audit PERF-02). Import from
 * the platform's responsive-css module in browser code.
 */

/** The steps, smallest first — the order a reader of the JSON expects. */
export const RESPONSIVE_KEYS = ['sm', 'md', 'lg'] as const;
export type ResponsiveKey = (typeof RESPONSIVE_KEYS)[number];

/** The max-width (px) at and below which each step takes over. `lg` is the base. */
export const RESPONSIVE_MAX_WIDTH: Readonly<Record<Exclude<ResponsiveKey, 'lg'>, number>> = {
  md: 1024,
  sm: 640,
};

/** One value at every width, or one per step. */
export type Responsive<T> = T | { sm?: T; md?: T; lg?: T };

/** A `{sm, md, lg}` object, as opposed to a bare value. Arrays and null are not. */
export function isResponsiveObject<T>(
  v: Responsive<T> | null | undefined,
): v is { sm?: T; md?: T; lg?: T } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every((k) => (RESPONSIVE_KEYS as readonly string[]).includes(k));
}

/**
 * The value at each step that SETS one: a bare value is `{lg}`. Steps left
 * out are absent here (not filled) — the stylesheet's cascade does the
 * falling-through; {@link responsiveFilled} is the filled form for a style
 * attribute, which has no cascade of its own.
 */
export function responsiveSteps<T>(
  v: Responsive<T> | null | undefined,
): Partial<Record<ResponsiveKey, T>> {
  if (v === null || v === undefined) return {};
  if (isResponsiveObject(v)) {
    const out: Partial<Record<ResponsiveKey, T>> = {};
    for (const k of RESPONSIVE_KEYS) if (v[k] !== undefined && v[k] !== null) out[k] = v[k];
    return out;
  }
  return { lg: v as T };
}

/** Each step's EFFECTIVE value: `md` falls back to `lg`, `sm` to `md`. */
export function responsiveFilled<T>(
  v: Responsive<T> | null | undefined,
): Partial<Record<ResponsiveKey, T>> {
  const s = responsiveSteps(v);
  const out: Partial<Record<ResponsiveKey, T>> = {};
  if (s.lg !== undefined) out.lg = s.lg;
  const md = s.md ?? s.lg;
  if (md !== undefined) out.md = md;
  const sm = s.sm ?? md;
  if (sm !== undefined) out.sm = sm;
  return out;
}

/** The desktop value — what a surface with no media queries (an email, an OG card) uses. */
export function responsiveBase<T>(v: Responsive<T> | null | undefined): T | undefined {
  const s = responsiveSteps(v);
  return s.lg ?? s.md ?? s.sm;
}

// ---- lengths ---------------------------------------------------------------

/** A length as the API takes it: px as a number, or a CSS length string. */
export type CssLength = number | string;

/**
 * The units a length may use, each with a ceiling so a typo cannot make a
 * 9,000-pixel heading. The same table `card.surface.padding` used, plus `ch`
 * (a measure) and the small/dynamic viewport units a hero wants on a phone.
 */
const UNIT_MAX: Record<string, number> = {
  px: 4000,
  rem: 250,
  em: 250,
  ch: 400,
  vh: 200,
  svh: 200,
  dvh: 200,
  vw: 100,
  svw: 100,
  dvw: 100,
  '%': 100,
};
const UNIT_RE = Object.keys(UNIT_MAX)
  .sort((a, b) => b.length - a.length)
  .join('|');
const TERM = new RegExp(`^(-)?(\\d{1,4}(?:\\.\\d{1,4})?)(${UNIT_RE})$`);

export interface LengthOptions {
  /** Allow a negative length (a margin pulling up). Default false. */
  negative?: boolean;
}

/** One plain length term — `12px`, `-1.5rem`, `0` — as CSS, or null. */
function termCss(raw: string, opts: LengthOptions): string | null {
  const t = raw.trim();
  if (/^-?0+(?:\.0+)?$/.test(t)) return '0';
  const m = TERM.exec(t);
  if (!m) return null;
  if (m[1] && !opts.negative) return null;
  if (Number(m[2]) > UNIT_MAX[m[3]!]!) return null;
  return `${m[1] ?? ''}${m[2]}${m[3]}`;
}

/** One argument of clamp/min/max: a term, or `term + term` / `term - term`. */
function argCss(raw: string): string | null {
  const t = raw.trim();
  const one = termCss(t, { negative: true });
  if (one) return one;
  // `a + b` / `a - b`, spaces optional — the operator is the sign that FOLLOWS
  // a complete first term, so `2vw-4px` is a difference and `-4px` a term.
  const m = new RegExp(`^(-?[\\d.]+(?:${UNIT_RE})?)\\s*([+-])\\s*(-?[\\d.]+(?:${UNIT_RE})?)$`).exec(
    t,
  );
  if (!m) return null;
  const a = termCss(m[1]!, { negative: true });
  const b = termCss(m[3]!, { negative: true });
  return a && b ? `${a} ${m[2]} ${b}` : null;
}

/**
 * A length as CSS, or null when it is not one we will emit.
 *
 * Numbers are px (0–4000). Strings are a unit length, unitless `0`, or
 * `clamp(a, b, c)` / `min(a, b, …)` / `max(a, b, …)` whose arguments are
 * lengths or one sum/difference of two — `clamp(2rem, 1.2rem + 3vw, 4rem)`.
 * Nothing else reaches a stylesheet: no `;`, no `var()`, no `url(`.
 */
export function lengthCss(
  v: CssLength | null | undefined,
  opts: LengthOptions = {},
): string | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v > 4000 || v < (opts.negative ? -4000 : 0)) return null;
    return v === 0 ? '0' : `${Math.round(v * 100) / 100}px`;
  }
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  if (s.length === 0 || s.length > 120) return null;
  const fn = /^(clamp|min|max)\((.*)\)$/i.exec(s);
  if (!fn) return termCss(s, opts);
  const name = fn[1]!.toLowerCase();
  const args = fn[2]!.split(',');
  if (name === 'clamp' ? args.length !== 3 : args.length < 2 || args.length > 4) return null;
  const out = args.map(argCss);
  return out.every(Boolean) ? `${name}(${out.join(', ')})` : null;
}

export type ResponsiveLength = Responsive<CssLength>;

// ---- CSS emitters -----------------------------------------------------------

const MEDIA = (px: number) => `@media (max-width: ${px}px)`;

/**
 * Declarations per step → CSS: the `lg` block bare, `md` and `sm` in their
 * max-width queries, in that order (a media query adds no specificity, so the
 * later rule is the one that wins at equal weight).
 *
 * `decls` maps a property (or custom property) to a responsive value;
 * `toCss` turns one step's value into the CSS value, or null to skip it.
 */
export function responsiveCss<T>(
  selector: string,
  decls: Record<string, Responsive<T> | null | undefined>,
  toCss: (v: T) => string | null,
): string {
  const by: Record<ResponsiveKey, string[]> = { lg: [], md: [], sm: [] };
  for (const [prop, value] of Object.entries(decls)) {
    const steps = responsiveSteps(value);
    for (const k of RESPONSIVE_KEYS) {
      const step = steps[k];
      if (step === undefined) continue;
      const css = toCss(step);
      if (css !== null && css !== '') by[k].push(`${prop}:${css}`);
    }
  }
  let out = by.lg.length ? `${selector}{${by.lg.join(';')}}` : '';
  if (by.md.length) out += `${MEDIA(RESPONSIVE_MAX_WIDTH.md)}{${selector}{${by.md.join(';')}}}`;
  if (by.sm.length) out += `${MEDIA(RESPONSIVE_MAX_WIDTH.sm)}{${selector}{${by.sm.join(';')}}}`;
  return out;
}

/** One responsive custom property on `selector`, as a stylesheet. */
export function responsiveVarCss<T>(
  selector: string,
  name: `--${string}`,
  value: Responsive<T> | null | undefined,
  toCss: (v: T) => string | null,
): string {
  return responsiveCss(selector, { [name]: value }, toCss);
}

/**
 * For a STYLE ATTRIBUTE, which cannot hold a media query: the three
 * custom properties `--<name>-lg`, `--<name>-md`, `--<name>-sm`, each step
 * already filled from the one above it. Pair it with
 * {@link responsiveVarRules} once in a stylesheet, then read `var(--<name>)`.
 *
 * Inline, the plain `--<name>` would beat any stylesheet rule — that is why
 * the steps are separate names and the stylesheet picks between them.
 */
export function responsiveStyleVars<T>(
  name: string,
  value: Responsive<T> | null | undefined,
  toCss: (v: T) => string | null,
): Record<string, string> {
  const filled = responsiveFilled(value);
  const out: Record<string, string> = {};
  for (const k of RESPONSIVE_KEYS) {
    const step = filled[k];
    if (step === undefined) continue;
    const css = toCss(step);
    if (css !== null && css !== '') out[`--${name}-${k}`] = css;
  }
  return out;
}

/**
 * The stylesheet half of {@link responsiveStyleVars}: `--<name>` resolves to
 * the step for the current width. A step that is not set leaves `--<name>`
 * invalid, so `var(--<name>, <default>)` at the point of use falls back to
 * the default — exactly the "unset is today's" rule.
 */
export function responsiveVarRules(selector: string, names: readonly string[]): string {
  const at = (k: ResponsiveKey) => names.map((n) => `--${n}:var(--${n}-${k})`).join(';');
  if (names.length === 0) return '';
  return (
    `${selector}{${at('lg')}}` +
    `${MEDIA(RESPONSIVE_MAX_WIDTH.md)}{${selector}{${at('md')}}}` +
    `${MEDIA(RESPONSIVE_MAX_WIDTH.sm)}{${selector}{${at('sm')}}}`
  );
}

// ---- text form ---------------------------------------------------------------

/**
 * A responsive value as ONE line of text, for a console box or a markdown
 * attribute: `28px`, or `lg:44px, sm:28px` (largest first). Null when a step
 * has no spelling.
 */
export function responsiveToText<T>(
  v: Responsive<T> | null | undefined,
  leaf: (x: T) => string | null,
  sep = ', ',
): string | null {
  if (v === null || v === undefined) return null;
  if (!isResponsiveObject(v)) return leaf(v as T);
  const steps = responsiveSteps(v);
  const parts: string[] = [];
  for (const k of ['lg', 'md', 'sm'] as const) {
    if (steps[k] === undefined) continue;
    const text = leaf(steps[k] as T);
    if (text === null) return null;
    parts.push(`${k}:${text}`);
  }
  return parts.length ? parts.join(sep) : null;
}

/** The inverse of {@link responsiveToText}: null when any part does not parse. */
export function responsiveFromText<T>(
  raw: string,
  leaf: (s: string) => T | null,
): Responsive<T> | null {
  const text = raw.trim();
  if (!text) return null;
  if (!/^(?:sm|md|lg)\s*:/.test(text)) return leaf(text);
  const out: { sm?: T; md?: T; lg?: T } = {};
  // Split on the commas BETWEEN steps — not the ones inside a clamp().
  for (const part of text.split(/,\s*(?=(?:sm|md|lg)\s*:)/)) {
    const m = /^(sm|md|lg)\s*:\s*(.+)$/.exec(part.trim());
    if (!m || out[m[1] as ResponsiveKey] !== undefined) return null;
    const value = leaf(m[2]!.trim());
    if (value === null) return null;
    out[m[1] as ResponsiveKey] = value;
  }
  return Object.keys(out).length ? out : null;
}

/** A length typed as text: a bare number is px, anything else must be a length. */
export function lengthFromText(raw: string): CssLength | null {
  const t = raw.trim();
  if (/^\d{1,4}(?:\.\d+)?$/.test(t)) return lengthCss(Number(t)) === null ? null : Number(t);
  return lengthCss(t) === null ? null : t;
}
