import { lexCss, splitTopLevel, tokText, wellFormed, type CssTok } from './css-lex.js';

/**
 * The customer's CSS, confined to their block.
 *
 * Every style rule is rewritten so its subject can only be the block or
 * something inside it: `h2 { … }` styles their heading and not our console,
 * their navigation, or the next block down. This was one regex that prefixed a
 * selector only when it followed a `}`, which got the two things a real
 * stylesheet is made of wrong:
 *
 *  - the first rule inside `@media`/`@supports`/`@container`/`@layer` follows a
 *    `{`, so it went out UNSCOPED — a block's "phone tweak" restyled the page;
 *  - a `@keyframes` step follows a `}`, so `to` became `.fx-1 to` and every
 *    animation a customer wrote stopped at its first frame.
 *
 * So it is a parser now (./css-lex for the tokens). It walks nested at-rules:
 *
 *  - conditional groups (`@media @supports @container @layer @starting-style`)
 *    keep their prelude and have their contents scoped, however deep;
 *  - `@keyframes`, `@font-face`, `@property` and `@page` keep their bodies,
 *    and the three that define a page-wide NAME (an animation, a font family,
 *    a registered custom property) get that name prefixed with the scope and
 *    every reference inside the block rewritten to match — a block's
 *    `@keyframes spin` must not redefine the page's;
 *  - every other at-rule is dropped: statements (`@import` fetches, `@layer
 *    a, b;` reorders the page's layers, `@namespace`, `@charset`) and blocks we
 *    do not know (`@scope` picks its own root, which is the one thing a scope
 *    cannot allow).
 *
 * CSS nesting is flattened, because a nested `:has(&)` resolves to "any
 * ancestor of this element" — `<body>` included. Nested rules come out as
 * `:where(.scope, .scope *):is(<resolved selector>)`: whatever the selector
 * says, its subject must ALSO be the block or inside it.
 *
 * `:root`, `html` and `body` mean "the page" to somebody writing CSS; here they
 * mean this block, the only thing they own, alone or leading a selector. A
 * selector that starts with `+`/`~` (the block's own siblings) is refused.
 */
export function scopeCustomCss(css: string, scope: string): string {
  const toks = lexCss(css);
  const rules = parseList(toks, { i: 0 }, false);
  const names = collectNames(rules, scope);
  const out = new Scoper(scope, names);
  return out.list(rules, 0).join('\n');
}

type Raw =
  | { t: 'qual'; prelude: CssTok[]; body: CssTok[] }
  | { t: 'at'; name: string; prelude: CssTok[]; body: CssTok[] | null };

const GROUPS = new Set(['media', 'supports', 'container', 'layer', 'starting-style']);
const MAX_DEPTH = 24;

function skipWs(toks: CssTok[], c: { i: number }): void {
  while (toks[c.i]?.k === 'ws') c.i++;
}

/** The tokens inside the block that opens at `c.i`, which is left past its `}`. */
function readBlock(toks: CssTok[], c: { i: number }): CssTok[] {
  const start = ++c.i;
  let depth = 1;
  for (; c.i < toks.length; c.i++) {
    const k = toks[c.i]!.k;
    if (k === '{') depth++;
    else if (k === '}' && --depth === 0) return toks.slice(start, c.i++);
  }
  // Unclosed at the end of input: the browser closes it, and so do we.
  return toks.slice(start);
}

function parseList(toks: CssTok[], c: { i: number }, nested: boolean): Raw[] {
  const out: Raw[] = [];
  while (c.i < toks.length) {
    skipWs(toks, c);
    const t = toks[c.i];
    if (!t) break;
    if (t.k === '}') {
      c.i++;
      if (nested) break;
      continue;
    }
    if (t.k === ';') {
      c.i++;
      continue;
    }
    const start = c.i;
    while (c.i < toks.length && !['{', ';', '}'].includes(toks[c.i]!.k)) c.i++;
    const head = toks.slice(start, c.i);
    const end = toks[c.i];
    const body = end?.k === '{' ? readBlock(toks, c) : null;
    if (end?.k === ';') c.i++;
    if (t.k === 'at') out.push({ t: 'at', name: t.name, prelude: head.slice(1), body });
    else if (body) out.push({ t: 'qual', prelude: head, body });
  }
  return out;
}

/** `-webkit-keyframes` is `keyframes`. */
function bareName(name: string): string {
  return name.replace(/^-[a-z]+-(?=keyframes$)/, '');
}

interface Names {
  keyframes: Map<string, string>;
  fonts: Map<string, string>;
  props: Map<string, string>;
}

const IDENT = /^-?[A-Za-z_][\w-]*$/;

function unquote(s: string): string {
  return s.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
}

/** A name a customer defined, made safe to print back inside quotes or as an ident. */
function cleanName(s: string): string {
  return s.replace(/[^\w -]/g, '').trim();
}

function collectNames(rules: Raw[], scope: string, names?: Names, depth = 0): Names {
  const n = names ?? { keyframes: new Map(), fonts: new Map(), props: new Map() };
  if (depth > MAX_DEPTH) return n;
  for (const r of rules) {
    if (r.t !== 'at' || !r.body) continue;
    const kind = bareName(r.name);
    if (GROUPS.has(kind)) collectNames(parseList(r.body, { i: 0 }, true), scope, n, depth + 1);
    else if (kind === 'keyframes') {
      const name = cleanName(unquote(tokText(r.prelude)));
      if (IDENT.test(name)) n.keyframes.set(name, `${scope}-${name}`);
    } else if (kind === 'property') {
      const name = tokText(r.prelude);
      if (/^--[\w-]+$/.test(name)) n.props.set(name, `--${scope}-${name.slice(2)}`);
    } else if (kind === 'font-face') {
      for (const decl of declarations(r.body)) {
        const m = /^font-family\s*:\s*([\s\S]+)$/i.exec(decl);
        const family = m ? cleanName(unquote(m[1]!)) : '';
        if (family) n.fonts.set(family.toLowerCase(), `${scope} ${family}`);
      }
    }
  }
  return n;
}

/** The `;`-separated declarations of a flat block, each well-formed or dropped. */
function declarations(body: CssTok[]): string[] {
  const out: string[] = [];
  let run: CssTok[] = [];
  const flush = (): void => {
    // A brace or an at-keyword in a declaration is a nested rule this block
    // does not take; the run goes, the rest of the block stays.
    const plain = run.every((t) => t.k !== '{' && t.k !== '}' && t.k !== 'at');
    const text = tokText(run);
    if (
      plain &&
      wellFormed(run) &&
      /^-{0,2}[\w-]+\s*:/.test(text) &&
      !UNSAFE.test(text) &&
      (text.startsWith('--') || topLevelColons(run) === 1)
    )
      out.push(text);
    run = [];
  };
  for (const t of body) {
    if (t.k === ';') flush();
    else run.push(t);
  }
  flush();
  return out;
}

/**
 * `color: redfont-family: x` is two declarations missing a `;`. A browser drops
 * it as an invalid value; a stricter reader of our output (postcss, the theme
 * tooling) refuses the whole sheet. A second bare colon outside a function is
 * never a value anybody meant, so the declaration goes.
 */
function topLevelColons(run: readonly CssTok[]): number {
  let depth = 0;
  let n = 0;
  for (const t of run) {
    if (t.k !== 'delim') continue;
    if (t.s === '(' || t.s === '[') depth++;
    else if (t.s === ')' || t.s === ']') depth--;
    else if (t.s === ':' && depth === 0) n++;
  }
  return n;
}

/** What the theme sanitiser strips too: old IE script hooks, never a style. */
const UNSAFE = /expression\s*\(|javascript:|behavior\s*:|-moz-binding/i;

class Scoper {
  private readonly root: string;
  private readonly guard: string;

  constructor(
    private readonly scope: string,
    private readonly names: Names,
  ) {
    this.root = `.${scope}`;
    this.guard = `:where(.${scope}, .${scope} *)`;
  }

  /** A list of rules at the top level or inside a conditional group. */
  list(rules: Raw[], depth: number): string[] {
    if (depth > MAX_DEPTH) return [];
    const out: string[] = [];
    for (const r of rules) {
      if (r.t === 'qual') {
        const sels = this.topSelectors(r.prelude);
        if (sels.length) out.push(...this.styleBody(r.body, sels, depth));
        continue;
      }
      if (!r.body) continue;
      const kind = bareName(r.name);
      if (GROUPS.has(kind)) {
        const inner = this.list(parseList(r.body, { i: 0 }, true), depth + 1);
        const prelude = this.prelude(r.prelude);
        if (inner.length && prelude !== null) out.push(group(`@${r.name}`, prelude, inner));
      } else if (kind === 'keyframes') out.push(...this.keyframes(r));
      else if (kind === 'font-face') out.push(...this.flat('@font-face', '', r.body));
      else if (kind === 'property') {
        const name = this.names.props.get(tokText(r.prelude));
        if (name) out.push(...this.flat('@property', name, r.body));
      } else if (kind === 'page') {
        const prelude = tokText(r.prelude);
        if (/^[\w\s:-]*$/.test(prelude)) out.push(...this.flat('@page', prelude, r.body));
      }
    }
    return out;
  }

  /** An at-rule prelude we keep, or null when it is not one we can print safely. */
  private prelude(toks: CssTok[]): string | null {
    return wellFormed(toks) ? tokText(toks) : null;
  }

  private flat(at: string, prelude: string, body: CssTok[]): string[] {
    const decls = declarations(body).map((d) => this.rename(d));
    return decls.length ? [`${at}${prelude ? ` ${prelude}` : ''} { ${decls.join('; ')} }`] : [];
  }

  private keyframes(r: Extract<Raw, { t: 'at' }>): string[] {
    const name = this.names.keyframes.get(cleanName(unquote(tokText(r.prelude))));
    if (!name || !r.body) return [];
    const steps: string[] = [];
    for (const step of parseList(r.body, { i: 0 }, true)) {
      if (step.t !== 'qual') continue;
      const sel = tokText(step.prelude);
      // `from`, `to`, `50%`, `entry 10%`, and lists of them — nothing else.
      if (!/^[a-z0-9.%\s,-]+$/i.test(sel)) continue;
      const decls = declarations(step.body).map((d) => this.rename(d));
      steps.push(`${sel} { ${decls.join('; ')} }`);
    }
    return steps.length ? [group(`@${r.name}`, name, steps)] : [];
  }

  /** The selectors of a rule at the top level (or in a group), scoped. */
  private topSelectors(prelude: CssTok[]): string[] {
    const out: string[] = [];
    for (const part of splitTopLevel(prelude)) {
      if (!wellFormed(part)) return [];
      const sel = tokText(part);
      if (!sel) return [];
      const scoped = this.scopeOne(sel);
      if (scoped) out.push(scoped);
    }
    return out;
  }

  private scopeOne(sel: string): string | null {
    if (sel.includes('&')) return `${this.guard}:is(${sel.replace(/&/g, this.root)})`;
    let rest = sel;
    let stripped = false;
    for (;;) {
      const m = /^(:root|html|body)(?=$|[\s>+~])\s*/i.exec(rest);
      if (!m) break;
      rest = rest.slice(m[0].length);
      stripped = true;
    }
    if (/^[+~]/.test(rest)) return null;
    if (!rest) return stripped ? this.root : null;
    return `${this.root} ${rest}`;
  }

  /** A style rule's body: its declarations, then its nested rules flattened. */
  private styleBody(body: CssTok[], sels: string[], depth: number): string[] {
    if (depth > MAX_DEPTH) return [];
    const decls: string[] = [];
    const nested: string[] = [];
    let run: CssTok[] = [];
    const c = { i: 0 };
    for (; c.i < body.length;) {
      const t = body[c.i]!;
      if (t.k === ';') {
        decls.push(...declarations(run));
        run = [];
        c.i++;
      } else if (t.k === '{') {
        const head = run;
        run = [];
        const inner = readBlock(body, c);
        nested.push(...this.nestedRule(head, inner, sels, depth));
      } else {
        run.push(t);
        c.i++;
      }
    }
    decls.push(...declarations(run));
    const own = decls.map((d) => this.rename(d));
    return [...(own.length ? [`${sels.join(', ')} { ${own.join('; ')} }`] : []), ...nested];
  }

  private nestedRule(head: CssTok[], body: CssTok[], parent: string[], depth: number): string[] {
    const lead = head.find((t) => t.k !== 'ws');
    if (lead?.k === 'at') {
      // A group nested in a rule applies to that rule: `.card { @media … { padding: 0 } }`.
      if (!GROUPS.has(lead.name)) return [];
      const prelude = this.prelude(head.slice(head.indexOf(lead) + 1));
      const inner = this.styleBody(body, parent, depth + 1);
      return prelude !== null && inner.length ? [group(`@${lead.name}`, prelude, inner)] : [];
    }
    const of = `:is(${parent.join(', ')})`;
    const sels: string[] = [];
    for (const part of splitTopLevel(head)) {
      if (!wellFormed(part)) return [];
      const sel = tokText(part);
      if (!sel) return [];
      const resolved = sel.includes('&') ? sel.replace(/&/g, of) : `${of} ${sel}`;
      sels.push(`${this.guard}:is(${resolved})`);
    }
    return sels.length ? this.styleBody(body, sels, depth + 1) : [];
  }

  /** Point the block's own references at the names it defined. */
  private rename(decl: string): string {
    let d = decl;
    const { keyframes, fonts, props } = this.names;
    for (const [from, to] of props) d = d.replace(wordRe(from), to);
    const prop = /^([\w-]+)\s*:/.exec(d)?.[1]?.toLowerCase() ?? '';
    if (keyframes.size && /^(-[a-z]+-)?animation(-name)?$/.test(prop))
      for (const [from, to] of keyframes) d = d.replace(wordRe(from), to);
    if (fonts.size && (prop === 'font-family' || prop === 'font')) {
      const colon = d.indexOf(':');
      const value = d
        .slice(colon + 1)
        .split(',')
        .map((part) => {
          const lead = /^\s*/.exec(part)![0];
          const bare = cleanName(unquote(part)).toLowerCase();
          // `font` shorthand: the family is the LAST words of the first part.
          for (const [from, to] of fonts) {
            if (bare === from) return `${lead}"${to}"`;
            if (prop === 'font' && bare.endsWith(` ${from}`) && !/["']/.test(part))
              return part.replace(new RegExp(`${escapeRe(from)}\\s*$`, 'i'), `"${to}"`);
          }
          return part;
        })
        .join(',');
      d = d.slice(0, colon + 1) + value;
    }
    return d;
  }
}

function group(at: string, prelude: string, inner: string[]): string {
  return `${at}${prelude ? ` ${prelude}` : ''} {\n${inner.join('\n')}\n}`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `name` as a whole CSS identifier, not a piece of a longer one. */
function wordRe(name: string): RegExp {
  return new RegExp(`(?<![\\w-])${escapeRe(name)}(?![\\w-])`, 'g');
}
