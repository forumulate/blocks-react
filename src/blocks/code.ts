import type { ReactNode } from 'react';
import { h, list, type HtmlAttrs } from '../h.js';
import type { RenderState } from '../state.js';
import type { Attrs, BlockNode } from '../types.js';
import { ansiNodes, type AnsiState } from './ansi.js';
import { codeGroup, codePreview, customCode } from './code-extra.js';
import { text } from './core.js';
import { codeLookStamp } from './docs-r4.js';
import type { BlockRenderer } from './types.js';

/**
 * A fenced code block — docs-schema `render-media.ts` `renderCodeBlock`.
 *
 * With no chrome attrs set this is the plain `<pre><code class="language-…">`
 * a code block has always been, so every existing document renders the same.
 * Any chrome attr switches to the `<figure class="cf-code-block">` shell: a
 * caption bar, a numbered gutter, per-line spans the reader CSS tints. When
 * lines are split into spans the `language-…` class moves from `<code>` to
 * each line span (a whole-block highlighter skips it; a line-aware one colours
 * the run and splits it back into lines). Each newer attr adds a `data-*` hook
 * to the figure and nothing when unset.
 */

/** Twoslash data as stored on a block (docs-schema `twoslash.ts`), computed at publish. */
interface TwoslashData {
  remove: number[];
  hovers: unknown[];
  queries: { l: number; t: string }[];
  errors: unknown[];
}

/** docs-schema `twoslashDisplayed`: the source minus the lines `remove` names (cut prefix, `// ^?`). */
function twoslashDisplayed(raw: string, data: TwoslashData | null | undefined): string {
  if (!data?.remove?.length) return raw;
  const gone = new Set(data.remove);
  return raw
    .split('\n')
    .filter((_, i) => !gone.has(i))
    .join('\n');
}

/**
 * docs-schema `parseHighlightRanges`: "2,5-7" or [2,5,6,7] → sorted unique
 * 1-based lines. Garbage-safe: a token that is not a positive integer or an
 * `a-b` range is ignored, so a fat-fingered spec highlights what parsed.
 */
export function parseHighlightRanges(spec: string | number[] | null | undefined): number[] {
  if (spec == null) return [];
  const lines = new Set<number>();
  const add = (n: number) => {
    if (Number.isInteger(n) && n > 0) lines.add(n);
  };
  if (Array.isArray(spec)) {
    for (const n of spec) add(n);
  } else {
    for (const part of spec.split(',')) {
      const token = part.trim();
      if (!token) continue;
      const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        let a = Number(range[1]);
        let b = Number(range[2]);
        if (a > b) [a, b] = [b, a];
        // A pathological range ("1-100000") is clamped so a typo can't spray a huge set.
        if (b - a > 10000) b = a + 10000;
        for (let i = a; i <= b; i++) add(i);
      } else if (/^\d+$/.test(token)) {
        add(Number(token));
      }
    }
  }
  return [...lines].sort((x, y) => x - y);
}

export interface CodeBlockRenderOptions {
  /** Inside a code group the title is the TAB, so the caption bar is not drawn. */
  inGroup?: boolean;
}

export function codeBlock(node: BlockNode, s: RenderState, opts: CodeBlockRenderOptions = {}): ReactNode {
  const a: Attrs | undefined = node.attrs;
  // Twoslash: the cut prefix and `// ^?` lines are not shown, and the block
  // always takes the line path so each answer hangs under its own line.
  const ts: TwoslashData | null = a?.twoslash === true && a.twoslashData ? a.twoslashData : null;
  const raw = twoslashDisplayed((node.content ?? []).map((t) => t.text).join(''), ts);
  const lang = a?.language;
  // `ansi` is terminal output, coloured here — never a grammar.
  const ansi = typeof lang === 'string' && lang.toLowerCase() === 'ansi';
  const langClass = lang && !ansi ? `language-${text(lang)}` : '';
  const title = !opts.inGroup && typeof a?.title === 'string' ? a.title.trim() : '';
  const lnStart: number = typeof a?.lineNumbers === 'number' ? a.lineNumbers : 1;
  const numbered = a?.lineNumbers === true || typeof a?.lineNumbers === 'number';
  const r = {
    hl: parseHighlightRanges(a?.highlight),
    ins: parseHighlightRanges(a?.ins),
    del: parseHighlightRanges(a?.del),
    focus: parseHighlightRanges(a?.focus),
    collapse: parseHighlightRanges(a?.collapse),
  };
  const split =
    !!ts || numbered || r.hl.length > 0 || r.ins.length > 0 || r.del.length > 0 || r.focus.length > 0 || r.collapse.length > 0;

  // The figure's data hooks for the newer attrs.
  const data: HtmlAttrs = {};
  const style: string[] = [];
  if (a?.diffMarkers === true && (r.ins.length || r.del.length)) data['data-diff'] = '';
  if (r.focus.length) data['data-focus'] = '';
  const mark = ((a?.mark ?? []) as unknown[]).filter((m) => typeof m === 'string' && m.length > 0);
  if (mark.length) data['data-mark'] = JSON.stringify(mark);
  if (typeof a?.maxLines === 'number') {
    data['data-max-lines'] = String(a.maxLines);
    style.push(`--cf-max-lines:${a.maxLines}`);
  }
  if (typeof a?.wrap === 'boolean') data['data-wrap'] = String(a.wrap);
  if (a?.frame) data['data-frame'] = text(a.frame);
  if (ansi) data['data-ansi'] = '';
  if (ts && (ts.hovers.length || ts.errors.length)) data['data-twoslash'] = JSON.stringify({ h: ts.hovers, e: ts.errors });
  if (numbered && lnStart > 1) {
    const lines = raw.split('\n').length;
    style.push(`--cf-ln-w:${String(lnStart + lines - 1).length + 1}ch`);
  }
  const preview = codePreview(node, s);
  if (preview) data['data-preview'] = '';
  // The preview and its source as ONE card.
  if (preview && a?.preview && a.preview !== true && a.preview.attach === 'code') data['data-preview-attach'] = 'code';
  // This block's own frame, chip, title face and glyph — set, they move it
  // onto the figure path like every attr above.
  const own = codeLookStamp(a);
  Object.assign(data, own.data);
  style.push(...own.vars);
  const hasHooks = Object.keys(data).length > 0 || style.length > 0;
  const hooks: HtmlAttrs = { ...data, style: style.length ? style.join(';') : null };
  const terminal = a?.frame === 'terminal';
  const code = (): ReactNode => (ansi ? list(ansiNodes(raw)) : raw);

  // A ONE-line block outside a group is stamped here, not by a hydrator: one
  // added later drew every one-line command tall, then shrank it after load and
  // pulled the page up (a CLS regression). The first paint is the final layout.
  const oneLine = !opts.inGroup && !split && !raw.replace(/\n+$/, '').includes('\n');

  // Fast path: nothing new beyond the one-line hook.
  if (!title && !split && !hasHooks && !terminal && !ansi) {
    return h('pre', { 'data-one-line': oneLine ? '' : null }, h('code', { class: langClass || null }, raw));
  }

  // A terminal always has its bar; an editor frame draws the title as a tab.
  const caption = title
    ? h('figcaption', { class: 'cf-code-caption' }, a?.frame === 'editor' ? h('span', null, title) : title)
    : terminal
      ? h('figcaption', { class: 'cf-code-caption', 'aria-hidden': 'true' })
      : null;

  if (!split) {
    // Title only: wrap the untouched block so a whole-block highlighter and
    // copy button keep working exactly as they do everywhere else.
    const cls = langClass || (ansi ? 'cf-ansi' : null);
    return h(
      'figure',
      { class: 'cf-code-block', ...hooks },
      caption,
      preview,
      h('pre', { 'data-one-line': !caption && oneLine ? '' : null }, h('code', { class: cls }, code())),
    );
  }

  // Split path: one span per line so the gutter and highlight tint are pure CSS.
  const hlSet = new Set(r.hl);
  const insSet = new Set(r.ins);
  const delSet = new Set(r.del);
  const focusSet = new Set(r.focus);
  const foldSet = new Set(r.collapse);
  // Split the ORIGINAL text, so a trailing newline is not a phantom final line.
  const lines = raw.split('\n');
  const queryOf = new Map<number, string>();
  for (const q of ts?.queries ?? []) queryOf.set(q.l, queryOf.has(q.l) ? `${queryOf.get(q.l)}  ${q.t}` : q.t);
  const lineClass = ['cf-cl', langClass].filter(Boolean).join(' ');
  const ansiState: AnsiState = {};
  const row = (line: string, i: number): ReactNode => {
    const n = i + 1; // block-relative: what the range attrs count
    const cls = [
      lineClass,
      hlSet.has(n) ? 'cf-cl-hl' : '',
      insSet.has(n) ? 'cf-cl-ins' : '',
      delSet.has(n) ? 'cf-cl-del' : '',
      focusSet.has(n) ? 'cf-cl-focus' : '',
    ]
      .filter(Boolean)
      .join(' ');
    // A blank line still occupies a row: an EMPTY block-level span has no
    // height, so the gutter skipped its number. A zero-width space holds it
    // (a copy button should strip U+200B back out).
    const body = ansi ? list(ansiNodes(line, ansiState)) : line;
    // A `// ^?` answer rides on its line as data, drawn by CSS, so copying the
    // lines' text never copies it.
    const q = queryOf.get(i);
    return h(
      'span',
      { class: cls, 'data-ln': lnStart + i, 'data-ts-query': q ? text(q) : null },
      line === '' ? '​' : body,
    );
  };
  const rows: ReactNode[] = [];
  for (let i = 0; i < lines.length; ) {
    if (!foldSet.has(i + 1)) {
      rows.push(row(lines[i]!, i));
      i++;
      continue;
    }
    // A run of collapsed lines folds behind one summary; with JS off <details>
    // still opens, and a hydrator may relabel it in the reader's language.
    let j = i;
    const fold: ReactNode[] = [];
    while (j < lines.length && foldSet.has(j + 1)) {
      fold.push(row(lines[j]!, j));
      j++;
    }
    const k = j - i;
    rows.push(
      h(
        'details',
        { class: 'cf-cl-fold' },
        h('summary', { class: 'cf-cl-fold-sum', 'data-n': k }, `${k} collapsed line${k === 1 ? '' : 's'}`),
        list(fold),
      ),
    );
    i = j;
  }
  const figClasses = ['cf-code-block', 'cf-code-block--split', numbered ? 'cf-code-numbered' : '']
    .filter(Boolean)
    .join(' ');
  return h(
    'figure',
    { class: figClasses, 'data-highlight': r.hl.length ? r.hl.join(',') : null, ...hooks },
    caption,
    preview,
    h('pre', { class: 'cf-code-split' }, h('code', null, list(rows))),
  );
}

export const CODE: Record<string, BlockRenderer> = {
  codeBlock: (node, r) => codeBlock(node, r.s),
  codeGroup: (node, r) => codeGroup(node, r.s, codeBlock),
  customCode: (node, r) => customCode(node, r.s),
};
