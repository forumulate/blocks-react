/**
 * Just enough of CSS Syntax Level 3 tokenisation to know where a block ENDS.
 *
 * `scopeCustomCss` (./css-scope) rewrites a customer's stylesheet so every rule
 * in it lands inside their block. That is only as good as its agreement with
 * the browser about which `}` closes which rule: the first version was one
 * regex, and a `}` inside a string, a comment or an unquoted `url(…)` decided
 * where a rule ended for us while the browser carried on — so text we had
 * treated as a declaration became, to the browser, a top-level rule we never
 * scoped. The structural tokens are exactly the ones a browser would see:
 *
 *  - a quote opens a string that ends at its partner, an unescaped newline (a
 *    "bad string") or the end of input;
 *  - `/* … *\/` is a comment, unterminated to the end of input;
 *  - `\` escapes the next character (or up to six hex digits);
 *  - `url(` NOT followed by a quote is a single url token up to `)`, whatever
 *    it contains — including `{`, `}` and quotes — and an escaped `u\72l(` is
 *    the same token.
 *
 * Everything else is a delimiter, whitespace or a word. Two more decisions make
 * the OUTPUT unambiguous rather than merely matching: `<` never survives (it is
 * dropped outside strings and escaped as `\3c ` inside them, so the CSS cannot
 * close the `<style>` element it is printed into), and braces inside a string
 * are written as `\7b `/`\7d ` — so the only raw braces in what we emit are the
 * ones the scoper puts there itself.
 */

export type CssTok =
  | { k: 'ws'; s: ' ' }
  | { k: '{' | '}' | ';'; s: string }
  | { k: 'at'; s: string; name: string }
  | { k: 'word'; s: string; value: string }
  | { k: 'str' | 'url' | 'delim'; s: string; bad?: boolean };

const NEWLINE = /[\n\r\f]/;
const WS = /[ \t\n\r\f]/;
const HEX = /[0-9a-fA-F]/;

function isWordStart(c: string | undefined): boolean {
  return c !== undefined && (/[A-Za-z0-9_-]/.test(c) || c.charCodeAt(0) >= 0x80);
}

function validEscape(src: string, i: number): boolean {
  return src[i] === '\\' && i + 1 < src.length && !NEWLINE.test(src[i + 1]!);
}

/** One escape at `i` (a `\`): its raw text and the character it stands for. */
function readEscape(src: string, i: number): { raw: string; ch: string; end: number } {
  let j = i + 1;
  if (HEX.test(src[j] ?? '')) {
    let hex = '';
    while (hex.length < 6 && HEX.test(src[j] ?? '')) hex += src[j++];
    if (WS.test(src[j] ?? '')) j++;
    const cp = parseInt(hex, 16);
    const ch =
      cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? '�' : String.fromCodePoint(cp);
    return { raw: src.slice(i, j), ch, end: j };
  }
  const cp = src.codePointAt(j) ?? 0xfffd;
  const ch = String.fromCodePoint(cp);
  return { raw: src.slice(i, j + ch.length), ch, end: j + ch.length };
}

/** A run of word characters and escapes, raw and unescaped. */
function readWord(src: string, i: number): { raw: string; value: string; end: number } {
  let raw = '';
  let value = '';
  let j = i;
  while (j < src.length) {
    if (validEscape(src, j)) {
      const e = readEscape(src, j);
      raw += e.raw;
      value += e.ch;
      j = e.end;
    } else if (isWordStart(src[j])) {
      raw += src[j];
      value += src[j];
      j++;
    } else break;
  }
  return { raw, value, end: j };
}

/** Rewrite the characters that must never be raw in our output. */
function neutral(ch: string): string {
  if (ch === '{') return '\\7b ';
  if (ch === '}') return '\\7d ';
  if (ch === '<') return '\\3c ';
  return ch;
}

function readString(src: string, i: number): { tok: CssTok; end: number } {
  const quote = src[i]!;
  let out = quote;
  let j = i + 1;
  while (j < src.length) {
    const c = src[j]!;
    if (c === quote) return { tok: { k: 'str', s: out + quote }, end: j + 1 };
    // A raw newline ends a "bad string" — the browser drops the declaration
    // it sits in, and so do we.
    if (NEWLINE.test(c)) return { tok: { k: 'str', s: out, bad: true }, end: j };
    if (c === '\\') {
      if (j + 1 >= src.length) break;
      // `\` + newline is a line continuation inside a string; anything else is
      // an escape. Either way the next character is not structure.
      const e = readEscape(src, j);
      out += NEWLINE.test(src[j + 1]!) ? src.slice(j, j + 2) : e.raw;
      j = NEWLINE.test(src[j + 1]!) ? j + 2 : e.end;
      continue;
    }
    out += neutral(c);
    j++;
  }
  return { tok: { k: 'str', s: out, bad: true }, end: src.length };
}

/** An unquoted `url(…)`, from just after the `(`. Bad if it would be a bad-url. */
function readUrl(src: string, i: number): { tok: CssTok; end: number } {
  let j = i;
  while (WS.test(src[j] ?? '')) j++;
  let body = '';
  let bad = false;
  while (j < src.length && src[j] !== ')') {
    const c = src[j]!;
    if (validEscape(src, j)) {
      const e = readEscape(src, j);
      body += e.raw;
      j = e.end;
      continue;
    }
    if (WS.test(c)) {
      let k = j;
      while (WS.test(src[k] ?? '')) k++;
      if (src[k] !== ')') bad = true;
      j = k;
      continue;
    }
    if (c === '"' || c === "'" || c === '(' || c === '\\' || c === '{' || c === '}' || c === '<')
      bad = true;
    if (c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f) bad = true;
    body += c;
    j++;
  }
  if (j >= src.length) bad = true;
  return { tok: { k: 'url', s: `url(${body})`, bad }, end: Math.min(j + 1, src.length) };
}

export function lexCss(src: string): CssTok[] {
  const toks: CssTok[] = [];
  const ws = (): void => {
    if (toks[toks.length - 1]?.k !== 'ws') toks.push({ k: 'ws', s: ' ' });
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      i = close === -1 ? src.length : close + 2;
      ws();
    } else if (WS.test(c)) {
      while (WS.test(src[i] ?? '')) i++;
      ws();
    } else if (c === '"' || c === "'") {
      const r = readString(src, i);
      toks.push(r.tok);
      i = r.end;
    } else if (c === '{' || c === '}' || c === ';') {
      toks.push({ k: c, s: c });
      i++;
    } else if (c === '<') {
      i++;
    } else if (c === '@' && (isWordStart(src[i + 1]) || validEscape(src, i + 1))) {
      const w = readWord(src, i + 1);
      toks.push({ k: 'at', s: `@${w.raw}`, name: w.value.toLowerCase() });
      i = w.end;
    } else if (isWordStart(c) || validEscape(src, i)) {
      const w = readWord(src, i);
      // `#url(` is a hash token and `5url(` a dimension: neither is a url.
      const glued = src[i - 1] === '#' || /[0-9]/.test(w.value[0] ?? '');
      if (!glued && w.value.toLowerCase() === 'url' && src[w.end] === '(') {
        let k = w.end + 1;
        while (WS.test(src[k] ?? '')) k++;
        if (src[k] !== '"' && src[k] !== "'") {
          const r = readUrl(src, w.end + 1);
          toks.push(r.tok);
          i = r.end;
          continue;
        }
      }
      toks.push({ k: 'word', s: w.raw, value: w.value });
      i = w.end;
    } else if (c === '\\') {
      // A backslash before a newline is not an escape: a lone delimiter.
      toks.push({ k: 'delim', s: '\\' });
      i++;
    } else {
      const cp = src.codePointAt(i) ?? 0xfffd;
      const ch = String.fromCodePoint(cp);
      toks.push({ k: 'delim', s: ch });
      i += ch.length;
    }
  }
  return toks;
}

/** Tokens back to text — whitespace collapsed, ends trimmed. */
export function tokText(toks: readonly CssTok[]): string {
  return toks
    .map((t) => t.s)
    .join('')
    .trim();
}

/**
 * Whether a run of tokens is safe to emit: nothing the browser would read as a
 * bad string or bad url, and `()`/`[]` that balance — an unbalanced paren makes
 * the browser swallow the `}` we put after it.
 */
export function wellFormed(toks: readonly CssTok[]): boolean {
  const stack: string[] = [];
  for (const t of toks) {
    if ('bad' in t && t.bad) return false;
    // An at-keyword in the middle of a selector or a value makes the browser
    // drop the rule; we drop it first, so no other reader of the output (a
    // stricter parser, the next scoper) can take it for the start of one.
    if (t.k === 'at' || t.k === '{' || t.k === '}' || t.k === ';') return false;
    if (t.k !== 'delim') continue;
    if (t.s === '(' || t.s === '[') stack.push(t.s === '(' ? ')' : ']');
    else if (t.s === ')' || t.s === ']') {
      if (stack.pop() !== t.s) return false;
    }
  }
  return stack.length === 0;
}

/** Split at top-level commas (not inside `()`/`[]`). */
export function splitTopLevel(toks: readonly CssTok[]): CssTok[][] {
  const parts: CssTok[][] = [[]];
  let depth = 0;
  for (const t of toks) {
    if (t.k === 'delim' && (t.s === '(' || t.s === '[')) depth++;
    if (t.k === 'delim' && (t.s === ')' || t.s === ']')) depth = Math.max(0, depth - 1);
    if (depth === 0 && t.k === 'delim' && t.s === ',') parts.push([]);
    else parts[parts.length - 1]!.push(t);
  }
  return parts;
}
