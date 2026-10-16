/**
 * A safe, dependency-free, isomorphic expression engine — GitBook `@gitbook/expr`
 * parity for adaptive content and inline `{{ … }}` interpolation.
 *
 * WHY hand-written (no npm dep, no `eval`, no `new Function`): this evaluates
 * author-supplied strings against a per-visitor scope on the SERVER. A general
 * JS evaluator would be a remote-code-execution and prototype-pollution hole in
 * a multi-tenant product. So this is a tiny tree-walking interpreter over an
 * allowlisted value space that CANNOT call functions, cannot reach prototypes,
 * and never throws — a bad expression yields `undefined`/`false` and the caller
 * falls back to showing nothing (or the literal token). Being isomorphic, the
 * same rules apply in the editor preview and the reader.
 */

export type EvalScope = Record<string, unknown>;

/*
 * `evaluateTemplate` — the `… {{ expr }} …` half — moved to `./expr-template`
 * and is re-exported here. Callers interpolate a string and evaluate an
 * expression through the same module, which is the right shape for them: one
 * is written in terms of the other.
 */
export { evaluateTemplate, scopeFromClaims } from './expr-template.js';

export type ExprNode =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'null' }
  | { t: 'undef' }
  | { t: 'ident'; name: string }
  | { t: 'array'; items: ExprNode[] }
  | { t: 'object'; props: { key: string; value: ExprNode }[] }
  | { t: 'unary'; op: '-' | '!'; arg: ExprNode }
  | { t: 'binary'; op: string; left: ExprNode; right: ExprNode }
  | { t: 'logical'; op: '&&' | '||'; left: ExprNode; right: ExprNode }
  | { t: 'member'; obj: ExprNode; prop: string }
  | { t: 'index'; obj: ExprNode; index: ExprNode }
  | { t: 'cond'; test: ExprNode; cons: ExprNode; alt: ExprNode };

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Tok =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'ident'; v: string }
  | { k: 'punc'; v: string };

// Multi-char operators must be tried longest-first so `===` never tokenizes as
// `==` + `=` (there is no bare `=` in this language, but the ordering also keeps
// `<=`/`>=`/`!==` intact).
const PUNCTS = [
  '===',
  '!==',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '!',
  '?',
  ':',
  '.',
  ',',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
];

function tokenize(src: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i]!;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    // String literal — single or double quoted, with backslash escapes.
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let out = '';
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < n) {
          const e = src[j + 1]!;
          out += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e;
          j += 2;
          continue;
        }
        out += src[j];
        j++;
      }
      if (j >= n) return null; // unterminated string
      toks.push({ k: 'str', v: out });
      i = j + 1;
      continue;
    }
    // Number literal (integer or decimal). A leading `-` is handled by the
    // parser as unary minus, so numbers here are always unsigned.
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < n && ((src[j]! >= '0' && src[j]! <= '9') || src[j] === '.')) j++;
      const num = Number(src.slice(i, j));
      if (Number.isNaN(num)) return null;
      toks.push({ k: 'num', v: num });
      i = j;
      continue;
    }
    // Identifier / keyword. Hyphens are NOT part of identifiers (they are the
    // minus operator), so a hyphenated variable key is resolved by the template
    // layer's direct-lookup path, not by this parser.
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j]!)) j++;
      toks.push({ k: 'ident', v: src.slice(i, j) });
      i = j;
      continue;
    }
    // Punctuator.
    let matched: string | null = null;
    for (const p of PUNCTS) {
      if (src.startsWith(p, i)) {
        matched = p;
        break;
      }
    }
    if (!matched) return null; // unknown character
    toks.push({ k: 'punc', v: matched });
    i += matched.length;
  }
  return toks;
}

// ---------------------------------------------------------------------------
// Parser (recursive descent by precedence)
// ---------------------------------------------------------------------------

class Parser {
  private p = 0;
  constructor(private readonly toks: Tok[]) {}

  private peek(): Tok | undefined {
    return this.toks[this.p];
  }
  private isPunc(v: string): boolean {
    const t = this.peek();
    return !!t && t.k === 'punc' && t.v === v;
  }
  private eat(v: string): boolean {
    if (this.isPunc(v)) {
      this.p++;
      return true;
    }
    return false;
  }

  parse(): ExprNode | null {
    const node = this.ternary();
    if (!node) return null;
    if (this.p !== this.toks.length) return null; // trailing tokens = malformed
    return node;
  }

  private ternary(): ExprNode | null {
    const test = this.or();
    if (!test) return null;
    if (this.eat('?')) {
      const cons = this.ternary();
      if (!cons || !this.eat(':')) return null;
      const alt = this.ternary();
      if (!alt) return null;
      return { t: 'cond', test, cons, alt };
    }
    return test;
  }

  // Left-associative binary level driven by a set of accepted operators and the
  // next-higher-precedence parser. Keeps every tier (||, &&, equality, …) to one
  // short method instead of copy-pasted loops.
  private binaryLevel(
    ops: string[],
    next: () => ExprNode | null,
    logical = false,
  ): ExprNode | null {
    let left = next();
    if (!left) return null;
    for (;;) {
      const t = this.peek();
      if (!t || t.k !== 'punc' || !ops.includes(t.v)) break;
      const op = t.v;
      this.p++;
      const right = next();
      if (!right) return null;
      left = logical
        ? { t: 'logical', op: op as '&&' | '||', left, right }
        : { t: 'binary', op, left, right };
    }
    return left;
  }

  private or(): ExprNode | null {
    return this.binaryLevel(['||'], () => this.and(), true);
  }
  private and(): ExprNode | null {
    return this.binaryLevel(['&&'], () => this.equality(), true);
  }
  private equality(): ExprNode | null {
    return this.binaryLevel(['===', '!==', '==', '!='], () => this.relational());
  }
  private relational(): ExprNode | null {
    // `in` is a keyword operator at relational precedence.
    let left = this.additive();
    if (!left) return null;
    for (;;) {
      const t = this.peek();
      if (t && t.k === 'punc' && ['<', '<=', '>', '>='].includes(t.v)) {
        this.p++;
        const right = this.additive();
        if (!right) return null;
        left = { t: 'binary', op: t.v, left, right };
      } else if (t && t.k === 'ident' && t.v === 'in') {
        this.p++;
        const right = this.additive();
        if (!right) return null;
        left = { t: 'binary', op: 'in', left, right };
      } else break;
    }
    return left;
  }
  private additive(): ExprNode | null {
    return this.binaryLevel(['+', '-'], () => this.multiplicative());
  }
  private multiplicative(): ExprNode | null {
    return this.binaryLevel(['*', '/', '%'], () => this.unary());
  }

  private unary(): ExprNode | null {
    if (this.isPunc('-') || this.isPunc('!')) {
      const op = (this.peek() as { v: string }).v as '-' | '!';
      this.p++;
      const arg = this.unary();
      if (!arg) return null;
      return { t: 'unary', op, arg };
    }
    return this.postfix();
  }

  // Member `.a`, index `[expr]` — chained, left to right.
  private postfix(): ExprNode | null {
    let node = this.primary();
    if (!node) return null;
    for (;;) {
      if (this.eat('.')) {
        const t = this.peek();
        if (!t || t.k !== 'ident') return null;
        this.p++;
        node = { t: 'member', obj: node, prop: t.v };
      } else if (this.eat('[')) {
        const idx = this.ternary();
        if (!idx || !this.eat(']')) return null;
        node = { t: 'index', obj: node, index: idx };
      } else break;
    }
    return node;
  }

  private primary(): ExprNode | null {
    const t = this.peek();
    if (!t) return null;
    if (t.k === 'num') {
      this.p++;
      return { t: 'num', v: t.v };
    }
    if (t.k === 'str') {
      this.p++;
      return { t: 'str', v: t.v };
    }
    if (t.k === 'ident') {
      this.p++;
      if (t.v === 'true') return { t: 'bool', v: true };
      if (t.v === 'false') return { t: 'bool', v: false };
      if (t.v === 'null') return { t: 'null' };
      if (t.v === 'undefined') return { t: 'undef' };
      return { t: 'ident', name: t.v };
    }
    if (this.eat('(')) {
      const inner = this.ternary();
      if (!inner || !this.eat(')')) return null;
      return inner;
    }
    if (this.eat('[')) return this.arrayLiteral();
    if (this.eat('{')) return this.objectLiteral();
    return null;
  }

  private arrayLiteral(): ExprNode | null {
    const items: ExprNode[] = [];
    if (this.eat(']')) return { t: 'array', items };
    for (;;) {
      const el = this.ternary();
      if (!el) return null;
      items.push(el);
      if (this.eat(']')) break;
      if (!this.eat(',')) return null;
    }
    return { t: 'array', items };
  }

  private objectLiteral(): ExprNode | null {
    const props: { key: string; value: ExprNode }[] = [];
    if (this.eat('}')) return { t: 'object', props };
    for (;;) {
      const t = this.peek();
      let key: string | null = null;
      if (t && t.k === 'ident') key = t.v;
      else if (t && t.k === 'str') key = t.v;
      else if (t && t.k === 'num') key = String(t.v);
      if (key === null) return null;
      this.p++;
      if (!this.eat(':')) return null;
      const value = this.ternary();
      if (!value) return null;
      props.push({ key, value });
      if (this.eat('}')) break;
      if (!this.eat(',')) return null;
    }
    return { t: 'object', props };
  }
}

/** Parse a single expression into an AST; returns null on any error (never throws). */
export function parseExpression(src: string): ExprNode | null {
  if (typeof src !== 'string' || src.trim() === '') return null;
  try {
    const toks = tokenize(src);
    if (!toks || toks.length === 0) return null;
    return new Parser(toks).parse();
  } catch {
    // Defensive: the parser is written not to throw, but a caller must never see
    // one leak out of the expression layer.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

// Properties that would let an expression climb out of the scope onto a
// prototype (and, historically, mutate `Object.prototype` cross-request). They
// always resolve to undefined, on every object, at member and index access.
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Read one property WITHOUT touching the prototype chain. */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj == null) return undefined;
  if (BLOCKED_KEYS.has(key)) return undefined;
  if (Array.isArray(obj) || (typeof obj === 'object' && obj !== null)) {
    return Object.prototype.hasOwnProperty.call(obj, key)
      ? (obj as Record<string, unknown>)[key]
      : undefined;
  }
  // A couple of always-safe reads on primitives so `foo.length` works without
  // exposing prototype methods.
  if (typeof obj === 'string') {
    if (key === 'length') return obj.length;
    const idx = Number(key);
    if (Number.isInteger(idx) && idx >= 0 && idx < obj.length) return obj[idx];
  }
  return undefined;
}

/** JS-style truthiness (empty array/object are truthy, matching JS/GitBook). */
export function truthy(v: unknown): boolean {
  return !(
    v === false ||
    v === 0 ||
    v === '' ||
    v == null ||
    (typeof v === 'number' && Number.isNaN(v))
  );
}

/**
 * Evaluate a parsed node. Exported for `expr-template`, which parses once and
 * evaluates once rather than re-parsing the body it has already scanned out.
 */
export function evalNode(node: ExprNode, scope: EvalScope): unknown {
  switch (node.t) {
    case 'num':
    case 'str':
    case 'bool':
      return node.v;
    case 'null':
      return null;
    case 'undef':
      return undefined;
    case 'ident':
      return safeGet(scope, node.name);
    case 'array':
      return node.items.map((it) => evalNode(it, scope));
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const { key, value } of node.props) {
        if (BLOCKED_KEYS.has(key)) continue; // never let a literal seed a bad key
        out[key] = evalNode(value, scope);
      }
      return out;
    }
    case 'member':
      return safeGet(evalNode(node.obj, scope), node.prop);
    case 'index': {
      const key = evalNode(node.index, scope);
      return safeGet(evalNode(node.obj, scope), String(key));
    }
    case 'unary': {
      const a = evalNode(node.arg, scope);
      return node.op === '!' ? !truthy(a) : -Number(a);
    }
    case 'logical': {
      const l = evalNode(node.left, scope);
      if (node.op === '&&') return truthy(l) ? evalNode(node.right, scope) : l;
      return truthy(l) ? l : evalNode(node.right, scope);
    }
    case 'cond':
      return truthy(evalNode(node.test, scope))
        ? evalNode(node.cons, scope)
        : evalNode(node.alt, scope);
    case 'binary':
      return evalBinary(node.op, evalNode(node.left, scope), evalNode(node.right, scope));
  }
}

function evalBinary(op: string, l: unknown, r: unknown): unknown {
  switch (op) {
    case '+':
      // JS `+`: string concat if either side is a string, else numeric.
      return typeof l === 'string' || typeof r === 'string'
        ? String(l) + String(r)
        : Number(l) + Number(r);
    case '-':
      return Number(l) - Number(r);
    case '*':
      return Number(l) * Number(r);
    case '/':
      return Number(l) / Number(r);
    case '%':
      return Number(l) % Number(r);
    case '==':
      // Loose on purpose: this evaluates the template language's `==`, which
      // an author expects to treat `"3"` and `3` as equal.
      return l == r;
    case '!=':
      return l != r;
    case '===':
      return l === r;
    case '!==':
      return l !== r;
    case '<':
      return (l as number) < (r as number);
    case '<=':
      return (l as number) <= (r as number);
    case '>':
      return (l as number) > (r as number);
    case '>=':
      return (l as number) >= (r as number);
    case 'in':
      // GitBook-style "contains": element of an array, substring of a string, or
      // own key of an object.
      if (Array.isArray(r)) return r.includes(l);
      if (typeof r === 'string') return r.includes(String(l));
      if (r && typeof r === 'object') return Object.prototype.hasOwnProperty.call(r, String(l));
      return false;
    default:
      return undefined;
  }
}

/** Parse + evaluate; returns `undefined` on any parse or evaluation error. */
export function evaluateExpression(src: string, scope: EvalScope): unknown {
  const ast = parseExpression(src);
  if (!ast) return undefined;
  try {
    return evalNode(ast, scope);
  } catch {
    return undefined;
  }
}

/** Truthiness of an expression's result (false on any error). */
export function evaluateBoolean(src: string, scope: EvalScope): boolean {
  return truthy(evaluateExpression(src, scope));
}
