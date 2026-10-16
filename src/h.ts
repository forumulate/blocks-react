import {
  Children,
  Fragment,
  cloneElement,
  createElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

/**
 * `h(tag, attrs, ...children)`: an element from HTML attribute names.
 *
 * The renderers here are a line-by-line mirror of docs-schema's string
 * renderers, and those speak HTML — `class`, `tabindex`, `style="a:b;c:d"`,
 * `data-x=""`. Writing the mirror in those same names keeps each branch
 * readable against its original (and the parity test honest); this one
 * function is where HTML names become React props.
 *
 * Attribute values: a string or number is printed; `true` is a bare boolean
 * attribute; `null`/`undefined`/`false` omit it.
 */
export type HtmlAttrs = Record<string, string | number | boolean | null | undefined>;

/** HTML names React spells differently. Everything else passes through as written. */
const PROP_NAME: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  srcset: 'srcSet',
  playsinline: 'playsInline',
  autoplay: 'autoPlay',
  disablepictureinpicture: 'disablePictureInPicture',
  fetchpriority: 'fetchPriority',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  crossorigin: 'crossOrigin',
  referrerpolicy: 'referrerPolicy',
  allowfullscreen: 'allowFullScreen',
  frameborder: 'frameBorder',
  datetime: 'dateTime',
  enctype: 'encType',
  novalidate: 'noValidate',
  accesskey: 'accessKey',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  inputmode: 'inputMode',
  enterkeyhint: 'enterKeyHint',
};

/**
 * Attributes React treats as DOM booleans: they need `true`, and React prints
 * them as `name=""`. (`data-*` and `aria-*` are strings and stay strings.)
 */
const BOOLEAN = new Set([
  'checked',
  'disabled',
  'hidden',
  'muted',
  'autoPlay',
  'loop',
  'controls',
  'playsInline',
  'disablePictureInPicture',
  'inert',
  'open',
  'readOnly',
  'required',
  'selected',
  'multiple',
  'download',
  'allowFullScreen',
  'noValidate',
  'defer',
  'async',
]);

/**
 * A declaration list split on its top-level `;` — not one inside `url("…")`
 * or a string, because a `data:image/png;base64,…` background is a legal
 * picture and a naive split cut it in half.
 */
export function declarations(css: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ';' && depth === 0) {
      out.push(css.slice(start, i));
      start = i + 1;
    }
  }
  out.push(css.slice(start));
  return out;
}

/** `a:b;c:d` → a React style object. Custom properties keep their name. */
export function styleObject(css: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of declarations(css)) {
    const i = decl.indexOf(':');
    if (i <= 0) continue;
    const name = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!name) continue;
    out[name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_s, c: string) => c.toUpperCase())] =
      value;
  }
  return out as CSSProperties;
}

/** React props from HTML attributes (see the file comment). */
export function props(attrs: HtmlAttrs | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!attrs) return out;
  for (const [raw, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (raw === 'style') {
      if (typeof v === 'string' && v) out.style = styleObject(v);
      continue;
    }
    const name = PROP_NAME[raw] ?? raw;
    if (BOOLEAN.has(name)) {
      // `hidden="until-found"` is the one boolean with a meaningful value.
      out[name] = typeof v === 'string' && v !== '' ? v : true;
      continue;
    }
    out[name] = v === true ? '' : v;
  }
  return out;
}

/** Children with keys, so a list never trips React's key warning. */
export function keyed(nodes: ReactNode[]): ReactNode[] {
  return nodes.map((n, i) => (n === null || n === undefined || n === '' ? null : createElement(Fragment, { key: i }, n)));
}

export function h(tag: string, attrs?: HtmlAttrs | null, ...children: ReactNode[]): ReactElement {
  const p = props(attrs);
  if (children.length === 0) return createElement(tag, p);
  // One child goes in as-is; several are keyed (they come from maps and joins).
  return children.length === 1
    ? createElement(tag, p, children[0])
    : createElement(tag, p, ...keyed(children));
}

/**
 * An element whose inner markup is a string WE wrote — an icon's `<svg>` from
 * the tables in ./icons, never owner input. Owner text always goes through
 * React's escaping as a child.
 */
export function hRaw(tag: string, attrs: HtmlAttrs | null, html: string): ReactElement {
  return createElement(tag, { ...props(attrs), dangerouslySetInnerHTML: { __html: html } });
}

/** A list of rendered blocks as one child, keyed. */
export function list(nodes: ReactNode[]): ReactNode {
  const kept = nodes.filter((n) => n !== null && n !== undefined && n !== '' && n !== false);
  if (kept.length === 0) return null;
  return keyed(kept);
}

/**
 * The first host element of a rendered block: the root `stampHooks` writes
 * onto. A block may render a list (a paragraph and its margin notes); the
 * first element is still its root, exactly like the first tag of the string.
 */
export function firstElement(node: ReactNode): ReactElement | null {
  if (isValidElement(node)) {
    if (node.type === Fragment) {
      const kids = Children.toArray((node.props as { children?: ReactNode }).children);
      return kids.length ? firstElement(kids[0]) : null;
    }
    return typeof node.type === 'string' ? node : null;
  }
  if (Array.isArray(node)) return node.length ? firstElement(node[0]) : null;
  return null;
}

/** Replace the root element of `node` (see `firstElement`) with `next(root)`. */
export function withRoot(
  node: ReactNode,
  next: (root: ReactElement<Record<string, unknown>>) => ReactElement,
): ReactNode {
  if (isValidElement(node)) {
    if (node.type === Fragment) {
      const kids = Children.toArray((node.props as { children?: ReactNode }).children);
      if (!kids.length) return node;
      return cloneElement(node, undefined, withRoot(kids[0], next), ...kids.slice(1));
    }
    return typeof node.type === 'string'
      ? next(node as ReactElement<Record<string, unknown>>)
      : node;
  }
  if (Array.isArray(node) && node.length) {
    return [withRoot(node[0], next), ...node.slice(1)];
  }
  return node;
}
