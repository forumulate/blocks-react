import { evalNode, parseExpression, safeGet, type EvalScope } from './expr.js';

/**
 * String interpolation: `… {{ expr }} …`.
 *
 * Split from the expression language it is written in terms of — a tokenizer,
 * a parser and an evaluator are one concern, and scanning a string for braces
 * while respecting quotes and nesting is another. The legacy bare-key path is
 * here too: `{{some-variable}}` bypasses the parser entirely, because a hyphen
 * is legal in a variable name and is subtraction in an expression.
 */
// A legacy bare key / dotted path (what today's `{{key}}` and variable
// interpolation accept). Hyphens are allowed here because variable names may
// contain them — such a token bypasses the expression parser entirely.
const BARE_KEY_RE = /^[A-Za-z0-9_$.-]+$/;

/**
 * Resolve a legacy `{{key}}` token the way the old renderer did, so nothing
 * regresses:
 *  1. an EXACT top-level key (covers hyphenated names and names containing dots),
 *  2. otherwise a dotted-path walk (`visitor.claims.plan`),
 *  3. otherwise undefined (caller keeps the literal token).
 */
function resolveBareKey(body: string, scope: EvalScope): unknown {
  const exact = safeGet(scope, body);
  if (exact !== undefined) return exact;
  if (body.includes('.')) {
    let cur: unknown = scope;
    for (const seg of body.split('.')) {
      cur = safeGet(cur, seg);
      if (cur === undefined) return undefined;
    }
    return cur;
  }
  return undefined;
}

function stringify(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return '';
    }
  }
  return String(v);
}

/**
 * Split a template into runs, tracking string literals and nested `{}` so an
 * object literal inside an expression (`{{ {a:1}.a }}`) does not confuse the
 * closing `}}`. Each `{{ … }}` run carries its raw source for lossless fallback.
 */
function scanTemplate(src: string): { text?: string; expr?: string }[] {
  const out: { text?: string; expr?: string }[] = [];
  let i = 0;
  const n = src.length;
  let lit = '';
  while (i < n) {
    if (src[i] === '{' && src[i + 1] === '{') {
      // Find the matching `}}`, respecting nested braces and quotes.
      let j = i + 2;
      let depth = 0;
      let quote: string | null = null;
      let closed = -1;
      while (j < n) {
        const ch = src[j]!;
        if (quote) {
          if (ch === '\\') j += 2;
          else {
            if (ch === quote) quote = null;
            j++;
          }
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          j++;
          continue;
        }
        if (ch === '{') {
          depth++;
          j++;
          continue;
        }
        if (ch === '}') {
          if (depth > 0) {
            depth--;
            j++;
            continue;
          }
          if (src[j + 1] === '}') {
            closed = j;
            break;
          }
          j++;
          continue;
        }
        j++;
      }
      if (closed === -1) {
        // No close — the rest is literal text.
        lit += src.slice(i);
        i = n;
        break;
      }
      if (lit) {
        out.push({ text: lit });
        lit = '';
      }
      out.push({ expr: src.slice(i, closed + 2) }); // raw incl. braces
      i = closed + 2;
      continue;
    }
    lit += src[i];
    i++;
  }
  if (lit) out.push({ text: lit });
  return out;
}

/**
 * Replace every `{{ … }}` run with its evaluated string value:
 *  - literal text is passed through verbatim;
 *  - a run that does not parse falls back to its literal `{{…}}` source
 *    (back-compat with today's variable renderer);
 *  - a legacy bare key / dotted path that resolves to nothing also stays literal
 *    (an unknown `{{plan}}` shows the token, exactly as before);
 *  - any other expression that yields undefined/null becomes the empty string.
 * Escaping is the caller's job — the render layer HTML-escapes the result.
 */
export function evaluateTemplate(src: string, scope: EvalScope): string {
  if (typeof src !== 'string' || !src.includes('{{')) return src;
  const parts = scanTemplate(src);
  let out = '';
  for (const part of parts) {
    if (part.text !== undefined) {
      out += part.text;
      continue;
    }
    const raw = part.expr!;
    const body = raw.slice(2, -2).trim();
    if (BARE_KEY_RE.test(body)) {
      const v = resolveBareKey(body, scope);
      out += v === undefined ? raw : stringify(v);
      continue;
    }
    const ast = parseExpression(body);
    if (!ast) {
      out += raw; // malformed → literal, so authors see their mistake
      continue;
    }
    let value: unknown;
    try {
      value = evalNode(ast, scope);
    } catch {
      value = undefined;
    }
    out += stringify(value);
  }
  return out;
}

/**
 * Build the evaluation scope from a visitor's flat claims and the space/page
 * variable map, mirroring GitBook: structured accessors (`visitor.claims.x`,
 * `space.vars.y`, `page.vars.y`) PLUS the same values spread at the top level so
 * bare identifiers (`{{ plan }}`, `{{ product }}`) keep working. Claims win over
 * vars on a top-level name collision (personalization is the more specific
 * signal).
 */
export function scopeFromClaims(
  claims: Record<string, string> = {},
  vars: Record<string, string> = {},
): EvalScope {
  return {
    ...vars,
    ...claims,
    visitor: { claims: { ...claims } },
    space: { vars: { ...vars } },
    page: { vars: { ...vars } },
  };
}
