import type { ReactNode } from 'react';
import { h, hRaw, list } from './h.js';
import { evaluateExpression } from './vendor/expr.js';
import { evaluateTemplate, scopeFromClaims } from './vendor/expr-template.js';
import { cssColorValue } from './vendor/look-css.js';
import { BADGE_VARIANTS } from './look-tokens.js';
import { iconSvg } from './icons.js';
import { href } from './url.js';
import type { RenderState } from './state.js';
import type { InlineNode, Mark } from './types.js';

/**
 * A run of text and the marks wrapped around it — docs-schema
 * `render-inline.ts` and the margin/end notes of `render-editorial.ts`.
 *
 * Mention chips and custom emoji are not here: they need the hosted reader's
 * resolved `refs`/`emoji` tables, which a customer's site does not have, and
 * without them the hosted renderer prints the same escaped text this does.
 */

export function renderInline(nodes: unknown, s: RenderState): ReactNode {
  if (!Array.isArray(nodes)) return null;
  return list(nodes.map((n) => storedInline(n, s)));
}

/** One inline node as STORED: a bare string is text; anything else that is not a node is nothing. */
function storedInline(n: unknown, s: RenderState): ReactNode {
  if (typeof n === 'string') return n;
  if (!n || typeof n !== 'object') return null;
  const node = n as InlineNode;
  if (node.type === 'variableRef' && typeof node.attrs?.key !== 'string') return null;
  if (node.type !== 'hardBreak' && node.type !== 'variableRef' && typeof node.text !== 'string') return null;
  return inlineNode(node, s);
}

const scopeOf = (s: RenderState) => scopeFromClaims({}, s.opts.variables ?? {});

function inlineNode(node: InlineNode, s: RenderState): ReactNode {
  if (node.type === 'hardBreak') return h('br');
  if (node.type === 'variableRef') {
    const key = node.attrs!.key as string;
    const direct = s.opts.variables?.[key];
    if (direct !== undefined) return direct;
    const v = evaluateExpression(key, scopeOf(s));
    return v == null ? `{{${key}}}` : String(v);
  }
  const raw = node.text as string;
  const marks = Array.isArray(node.marks) ? node.marks.filter((m) => m && typeof m === 'object') : [];
  // Inside code, a link, inline math or an icon label the text is literal source.
  const literal = marks.some(
    (m) => m.type === 'code' || m.type === 'link' || m.type === 'mathInline' || m.type === 'icon',
  );
  let out: ReactNode = !literal && raw.includes('{{') ? evaluateTemplate(raw, scopeOf(s)) : raw;
  for (const mark of marks) {
    out = editorialMark(out, mark, s) ?? wrapMark(out, mark, raw, s);
  }
  return out;
}

export function wrapMark(inner: ReactNode, mark: Mark, text: string, s: RenderState): ReactNode {
  const a = mark.attrs;
  switch (mark.type) {
    case 'mathInline':
      return h('span', { class: 'math math-inline', 'data-latex': text, 'data-inline': '' }, inner);
    case 'badge': {
      const v = a?.variant;
      const tone = v && (BADGE_VARIANTS as readonly string[]).includes(v) && v !== 'default';
      return h('span', { class: 'cf-badge', 'data-variant': tone ? v : null }, inner);
    }
    case 'icon': {
      // The glyph is drawn; the text is its accessible name.
      const value = String(a?.name ?? text).trim();
      const svg = iconSvg(value, s.opts.icons);
      const at = { class: 'cf-icon', role: 'img', 'aria-label': text };
      return svg ? hRaw('span', at, svg) : h('span', at, value);
    }
    case 'bold':
      return h('strong', null, inner);
    case 'italic':
      return h('em', null, inner);
    case 'code':
      // A chip of 24 characters or fewer never breaks; a longer one may.
      return h('code', { 'data-long': text.length > 24 ? '' : null }, inner);
    case 'strike':
      return h('s', null, inner);
    case 'underline':
      return h('u', null, inner);
    case 'highlight':
      return h('mark', null, inner);
    case 'link':
      return h('a', { href: href(a?.href) }, inner);
    case 'spoiler':
      return h(
        'span',
        {
          class: 'cf-spoiler',
          'data-spoiler': '',
          tabindex: '0',
          role: 'button',
          'aria-expanded': 'false',
          'aria-label': 'Spoiler, activate to reveal',
        },
        inner,
      );
    case 'footnote':
      return h(
        'sup',
        { class: 'cf-footnote', 'data-footnote': '', title: a?.note ?? '' },
        inner,
        h('span', { class: 'cf-footnote-note' }, a?.note ?? ''),
      );
    case 'annotation': {
      const note = a?.note ?? '';
      return h(
        'span',
        { class: 'cf-annotation', 'data-annotation': note, tabindex: '0', role: 'button', 'aria-label': 'Annotation' },
        inner,
        h('span', { class: 'cf-annotation-body' }, note),
      );
    }
    case 'textColor': {
      // A theme token is the reader's own ink; a hex is re-checked (it lands in style).
      const c = a?.color;
      if (typeof c !== 'string' || cssColorValue(c as never) === null) return inner;
      return h('span', { class: 'cf-ink', 'data-ink': c, style: c.startsWith('#') ? `color:${c}` : null }, inner);
    }
    case 'kbd':
      return h('kbd', null, inner);
    default:
      return inner;
  }
}

// ---- margin and end notes (render-editorial.ts) ------------------------------

function sidenote(inner: ReactNode, note: string, s: RenderState): ReactNode {
  s.sideNo += 1;
  const n = s.sideNo;
  const num = (): ReactNode[] => [h('sup', { class: 'cf-sidenote-num' }, String(n)), ` ${note}`];
  // Inside a paragraph a block copy follows `</p>`, so the sentence is not broken in two.
  if (s.paraNotes) {
    s.paraNotes.push(
      h('aside', { class: 'cf-sidenote-after', role: 'note', 'data-sidenote-note': n }, ...num()),
    );
  }
  return list([
    h('span', { class: 'cf-sidenote-ref', 'data-sidenote': n }, inner, h('sup', { class: 'cf-sidenote-num' }, String(n))),
    h(
      'span',
      { class: 'cf-sidenote', 'data-sidenote-after': s.paraNotes ? '' : null, role: 'note', 'data-sidenote-note': n },
      ...num(),
    ),
  ]);
}

/** The marks whose markup depends on the render (a number, a placement); null for every other. */
function editorialMark(inner: ReactNode, mark: Mark, s: RenderState): ReactNode | null {
  const note: string = mark.attrs?.note ?? '';
  if (mark.type === 'sidenote') return sidenote(inner, note, s);
  if (mark.type !== 'footnote') return null;
  if (s.opts.footnotes === 'margin') return sidenote(inner, note, s);
  if (s.opts.footnotes === 'end') {
    s.endNotes.push(note);
    const n = s.endNotes.length;
    const p = s.idPrefix;
    return list([
      inner,
      h('sup', { class: 'cf-fn-ref' }, h('a', { href: `#${p}fn-${n}`, id: `${p}fnref-${n}` }, String(n))),
    ]);
  }
  return null;
}

/** The collected notes as one list after the body, when the placement is `end`. */
export function endNotes(s: RenderState): ReactNode {
  if (s.opts.footnotes !== 'end' || s.endNotes.length === 0) return null;
  const p = s.idPrefix;
  return h(
    'section',
    { class: 'cf-footnotes', 'data-footnotes-end': '' },
    h(
      'ol',
      null,
      list(
        s.endNotes.map((note, i) =>
          h(
            'li',
            { id: `${p}fn-${i + 1}` },
            `${note} `,
            h('a', { href: `#${p}fnref-${i + 1}`, class: 'cf-fn-back', 'aria-label': 'Back to text' }, '↩'),
          ),
        ),
      ),
    ),
  );
}

/** A paragraph and the block copies of the margin notes it held (bug W4-53). */
export function paragraphWithNotes(inline: () => ReactNode, s: RenderState): ReactNode {
  const outer = s.paraNotes;
  const notes: ReactNode[] = [];
  s.paraNotes = notes;
  let body: ReactNode;
  try {
    body = inline();
  } finally {
    s.paraNotes = outer;
  }
  return notes.length ? list([h('p', null, body), ...notes]) : h('p', null, body);
}
