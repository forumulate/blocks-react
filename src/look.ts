import { cloneElement, type ReactElement, type ReactNode } from 'react';
import { props, styleObject, withRoot, type HtmlAttrs } from './h.js';
import { cssColorValue } from './vendor/look-css.js';
import { responsiveFilled } from './vendor/responsive-css.js';
import {
  AB_VARIANTS,
  ANCHOR_PATTERN,
  BLOCK_LOOK_KEYS,
  BLOCK_MOTIONS,
  BLOCK_ORDERS_SM,
  CLASS_NAME_PATTERN,
  COLUMN_VALIGNS,
  GROWTH_NAME_PATTERN,
  HIDE_ON,
  HOOK_PATTERN,
  LINK_INKS,
  LIST_MARKERS,
  SECTION_SHADOWS,
  STACK_ON,
  TEXT_ALIGNS,
  blockTrackingOk,
  blockWeightOk,
  lineHeightOk,
  textSizeCss,
} from './look-tokens.js';
import { RADIUS, cssSpace, gapSteps, gradientLayer, stepVars } from './section-look.js';
import type { Attrs } from './types.js';

/**
 * The attributes any block can wear on its root — an author's anchor, owner
 * classes, a styling hook, an audience, an entrance, growth hooks — and the
 * look keys some blocks take (alignment, marker, gap…). docs-schema
 * `render-look.ts` + `block-growth.ts`.
 *
 * The string renderer writes these into the first tag of a block's HTML
 * (`stampHooks`); here they are merged into the block's root element, by the
 * same rules: an anchor REPLACES the root's own id, classes are appended to
 * its own, look variables are appended to its style.
 */

export interface GrowthStamp {
  goal: string | null;
  experiment: string | null;
  variant: string | null;
  weight: number | null;
  orderSm: string | null;
}

export interface Hooks {
  anchor: string | null;
  classes: string[];
  hook: string | null;
  audience: 'signedIn' | 'signedOut' | null;
  motion: string | null;
  motionDelay: number | null;
  growth: GrowthStamp;
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;

const isName = (v: unknown): v is string => typeof v === 'string' && GROWTH_NAME_PATTERN.test(v);

function readGrowth(a: Attrs): GrowthStamp {
  const arm = isName(a.experiment) && oneOf(AB_VARIANTS, a.abVariant) !== null;
  const w = a.abWeight;
  return {
    goal: isName(a.goal) ? a.goal : null,
    experiment: arm ? a.experiment : null,
    variant: arm ? a.abVariant : null,
    weight: arm && typeof w === 'number' && Number.isInteger(w) && w >= 1 && w <= 100 ? w : null,
    orderSm: oneOf(BLOCK_ORDERS_SM, a.orderSm),
  };
}

export function readHooks(attrs: Attrs | null | undefined): Hooks {
  const a = attrs ?? {};
  const anchor = typeof a.anchor === 'string' && ANCHOR_PATTERN.test(a.anchor) ? a.anchor : null;
  const classes =
    typeof a.className === 'string' && CLASS_NAME_PATTERN.test(a.className)
      ? a.className.split(' ').map((c: string) => `u-${c}`)
      : [];
  const hook = typeof a.hook === 'string' && HOOK_PATTERN.test(a.hook) ? a.hook : null;
  const audience = a.audience === 'signedIn' || a.audience === 'signedOut' ? a.audience : null;
  const motion = oneOf(BLOCK_MOTIONS, a.motion);
  const d = a.motionDelay;
  const motionDelay =
    motion && motion !== 'none' && typeof d === 'number' && d > 0 && d <= 1000 && d % 100 === 0 ? d : null;
  return { anchor, classes, hook, audience, motion, motionDelay, growth: readGrowth(a) };
}

export const NO_HOOKS: Hooks = {
  anchor: null,
  classes: [],
  hook: null,
  audience: null,
  motion: null,
  motionDelay: null,
  growth: { goal: null, experiment: null, variant: null, weight: null, orderSm: null },
};

/** What a block's look adds to its root: data attributes and `--var:value` declarations. */
export interface LookStamp {
  data: HtmlAttrs;
  vars: string[];
}
export const NO_LOOK: LookStamp = { data: {}, vars: [] };

const GAP_HOOKS = {
  gap: ['data-gap', '--cols-gap'],
  rowGap: ['data-row-gap', '--cols-row-gap'],
  itemGap: ['data-item-gap', '--bl-item-gap'],
} as const;

/** `blockLookStamp`: the look keys this block's type takes, as what the reader CSS keys on. */
export function blockLookStamp(node: { type: string; attrs?: unknown }): LookStamp {
  const keys = BLOCK_LOOK_KEYS[node.type];
  if (!keys || !node.attrs || typeof node.attrs !== 'object') return NO_LOOK;
  const a = node.attrs as Attrs;
  const data: HtmlAttrs = {};
  const vars: string[] = [];
  const put = (name: string, value: string) => {
    if (!(name in data)) data[name] = value;
  };
  for (const key of keys) {
    const v = a[key];
    switch (key) {
      case 'textAlign': {
        const t = oneOf(TEXT_ALIGNS, v);
        if (t) put('data-text-align', t);
        break;
      }
      case 'variant':
        if (v === 'eyebrow' || v === 'code') put('data-variant', v);
        break;
      case 'rule': {
        const c = v === true ? '' : cssColorValue(v);
        if (c !== null) {
          put('data-rule', '');
          if (c) vars.push(`--list-rule:${c}`);
        }
        break;
      }
      case 'gradient':
      case 'gradientDark': {
        const g = gradientLayer(v);
        if (g) {
          put('data-gradient', '');
          vars.push(`${key === 'gradient' ? '--cell-bg-image' : '--cell-bg-image-dark'}:${g}`);
        }
        break;
      }
      case 'marker': {
        const mk = oneOf(LIST_MARKERS, v);
        if (mk && mk !== 'default') put('data-marker', mk);
        break;
      }
      case 'link':
        if (oneOf(LINK_INKS, v)) put('data-link', 'inherit');
        break;
      case 'stackOn': {
        const st = oneOf(STACK_ON, v);
        if (st && st !== 'sm') put('data-stack-on', st);
        break;
      }
      case 'valign': {
        const va = oneOf(COLUMN_VALIGNS, v);
        if (va) put('data-valign', va);
        break;
      }
      case 'alternate':
        if (v === true) put('data-alternate', '');
        break;
      case 'hideOn': {
        const hide = Array.isArray(v) ? HIDE_ON.filter((x) => v.includes(x)) : [];
        if (hide.length) put('data-hide-on', hide.join(' '));
        break;
      }
      case 'shadow': {
        const sh = oneOf(SECTION_SHADOWS, v);
        if (sh && sh !== 'none') put('data-shadow', sh);
        break;
      }
      case 'size': {
        const steps = responsiveFilled(v as number | string);
        const set: string[] = [];
        for (const k of ['lg', 'md', 'sm'] as const) {
          const step = steps[k];
          const css = step === undefined ? null : textSizeCss(step);
          if (css) {
            vars.push(`--blk-fs-${k}:${css}`);
            set.push(k);
          }
        }
        if (set.length) put('data-size', set.join(' '));
        break;
      }
      case 'color': {
        const c = cssColorValue(v);
        if (c) {
          put('data-ink', '');
          vars.push(`--blk-ink:${c}`);
        }
        break;
      }
      case 'weight':
        if (blockWeightOk(v)) {
          put('data-weight', '');
          vars.push(`--blk-fw:${v}`);
        }
        break;
      case 'lineHeight':
        if (lineHeightOk(v)) {
          put('data-line-height', '');
          vars.push(`line-height:${v}`);
        }
        break;
      case 'tracking':
        if (blockTrackingOk(v)) {
          put('data-tracking', '');
          vars.push(`--blk-ls:${v}em`);
        }
        break;
      case 'divider': {
        const c = v === true ? '' : cssColorValue(v);
        if (c !== null) {
          put('data-divider', '');
          if (c) vars.push(`--cols-div:${c}`);
        }
        break;
      }
      case 'gap':
      case 'rowGap':
      case 'itemGap': {
        if (key === 'gap' && v && typeof v === 'object') {
          const steps = gapSteps(v);
          if (steps.length) {
            put('data-gap', '');
            put('data-gap-steps', '');
            vars.push(...steps);
          }
          break;
        }
        const sp = cssSpace(v);
        if (sp) {
          const [name, cssVar] = GAP_HOOKS[key];
          put(name, '');
          vars.push(`${cssVar}:${sp}`);
        }
        break;
      }
      case 'spaceBefore':
      case 'spaceAfter': {
        const side = key === 'spaceBefore' ? 'before' : 'after';
        const sv = stepVars(`cols-space-${side}`, v ?? a.spaceAround);
        if (sv.length) {
          put(`data-space-${side}`, '');
          vars.push(...sv);
        }
        break;
      }
      case 'radius': {
        const r =
          typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 64
            ? `${v}px`
            : typeof v === 'string'
              ? (RADIUS[v] ?? null)
              : null;
        if (r) {
          put('data-radius', '');
          vars.push(`--cell-radius:${r}`);
        }
        break;
      }
    }
  }
  return Object.keys(data).length || vars.length ? { data, vars } : NO_LOOK;
}

function growthAttrs(g: GrowthStamp): HtmlAttrs {
  const out: HtmlAttrs = {};
  if (g.goal) out['data-goal'] = g.goal;
  if (g.experiment && g.variant) {
    out['data-ab'] = g.experiment;
    out['data-ab-v'] = g.variant;
    if (g.weight) out['data-ab-w'] = g.weight;
  }
  if (g.orderSm) out['data-order-sm'] = g.orderSm;
  return out;
}

/**
 * Merge HTML attributes into an element: `id` replaces, `class` appends,
 * `style` declarations append, anything else is added unless the element
 * already has it (in an HTML string the FIRST of two same-named attributes
 * wins, so the root's own value stays).
 */
export function mergeInto(el: ReactElement<Record<string, unknown>>, attrs: HtmlAttrs): ReactElement {
  const own = el.props;
  const next: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'id') next.id = value;
    else if (name === 'class') {
      const cls = own.className;
      next.className = typeof cls === 'string' && cls ? `${cls} ${value}` : value;
    } else if (name === 'style') {
      next.style = { ...(own.style as object | undefined), ...styleObject(String(value)) };
    } else {
      const [prop, v] = Object.entries(props({ [name]: value }))[0] ?? [];
      if (prop && !(prop in own)) next[prop] = v;
    }
  }
  return cloneElement(el, next);
}

/** `stampHooks`: a block's hooks and look on the root of what it rendered. */
export function stampHooks(node: ReactNode, id: string | null, hk: Hooks, look: LookStamp = NO_LOOK): ReactNode {
  const attrs: HtmlAttrs = {};
  if (id) attrs.id = id;
  if (hk.classes.length) attrs.class = hk.classes.join(' ');
  if (hk.hook) attrs['data-fx-block'] = hk.hook;
  if (hk.audience) attrs['data-audience'] = hk.audience;
  if (hk.motion) attrs['data-motion'] = hk.motion;
  if (hk.motionDelay) attrs['data-motion-delay'] = hk.motionDelay;
  Object.assign(attrs, growthAttrs(hk.growth), look.data);
  if (look.vars.length) attrs.style = look.vars.join(';');
  if (!Object.keys(attrs).length) return node;
  return withRoot(node, (root) => mergeInto(root, attrs));
}
