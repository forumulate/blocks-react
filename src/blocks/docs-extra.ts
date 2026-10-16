import type { ReactNode } from 'react';
import { h, list, withRoot } from '../h.js';
import { mergeInto } from '../look.js';
import { headingSlug } from '../vendor/heading-slug.js';
import type { Attrs, BlockNode } from '../types.js';
import { text } from './core.js';
import { hashScope } from './tabs-shell.js';
import type { BlockRenderer } from './types.js';

/**
 * The wave-D docs blocks — docs-schema `render-docs-extra.ts` (field, example,
 * file tree, swatch, buttons, collapsible group) and `render-expandable.ts`.
 * Every author string is escaped (by React); every attribute is an enum or a
 * validated value (a swatch's hex is checked again before it reaches a style).
 */

/** A swatch colour docs-schema accepts (`render-docs-extra.ts`). */
export const SWATCH_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * The words an untitled "solution" expandable says. The hosted page prints
 * them in the lesson's language (`ctx.lesson`, a hosted course); outside a
 * lesson that is English, which is all a customer site can be.
 */
export const REVEAL_SOLUTION_EN = 'Reveal the solution';

/** `field`: a parameter row — name, type, chips — then its description and children. */
const field: BlockRenderer = (node, r) => {
  const a = node.attrs!;
  const id = r.uniqueId(`f-${headingSlug(text(a.name)) || 'field'}`);
  const chips = [
    a.required ? h('span', { class: 'doc-field-chip doc-field-required' }, 'Required') : null,
    a.deprecated ? h('span', { class: 'doc-field-chip doc-field-deprecated' }, 'Deprecated') : null,
    ...(a.badges ?? []).map((b: unknown) => h('span', { class: 'doc-field-chip' }, text(b))),
  ];
  const head = h(
    'div',
    { class: 'doc-field-head' },
    h('code', { class: 'doc-field-name' }, a.name),
    a.type ? h('span', { class: 'doc-field-type' }, text(a.type)) : null,
    a.location ? h('span', { class: 'doc-field-loc' }, text(a.location)) : null,
    list(chips),
    a.default ? h('span', { class: 'doc-field-default' }, 'Default: ', h('code', null, text(a.default))) : null,
  );
  const kids: BlockNode[] = node.content ?? [];
  const nested = kids.filter((c) => c.type === 'field');
  const desc = kids.filter((c) => c.type !== 'field');
  // The nested fields render BEFORE the description (the hosted order), so
  // they claim their ids first.
  const children = nested.length
    ? h('details', { class: 'doc-field-children' }, h('summary', null, 'Show child attributes'), r.blocks(nested))
    : null;
  const body = desc.length ? h('div', { class: 'doc-field-body' }, r.blocks(desc)) : null;
  return h(
    'div',
    { class: 'doc-field', id, 'data-location': a.location ? String(a.location) : null },
    head,
    body,
    children,
  );
};

/** The plain words of an inline run, and whether any of it is bold. */
function runText(nodes: BlockNode[] | undefined): { words: string; bold: boolean } {
  let words = '';
  let bold = false;
  for (const n of nodes ?? []) {
    if (n.type !== 'text') continue;
    words += n.text;
    if (n.marks?.some((m) => m.type === 'bold')) bold = true;
  }
  return { words, bold };
}

/** One list of a file tree, recursively: a folder ends `/` or holds a list. */
function treeList(node: BlockNode, depth: number): ReactNode {
  if (node.type !== 'bulletList' || depth > 12) return null;
  const items = node
    .content!.filter((li) => li.type === 'listItem')
    .map((li) => {
      const kids = li.content!;
      const para = kids.find((k) => k.type === 'paragraph');
      const sub = kids.find((k) => k.type === 'bulletList');
      const { words, bold } = runText(para?.content);
      const m = /^(.*?)(?:\s+(?:#|-)\s+(.*))?$/.exec(words.trim());
      const raw = (m?.[1] ?? words).trim();
      const note = m?.[2] ? h('span', { class: 'tree-note' }, m[2]) : null;
      const folder = !!sub || raw.endsWith('/');
      const name = raw.replace(/\/$/, '');
      const placeholder = name === '…' || name === '...';
      const label = h('span', { class: `tree-name${bold ? ' is-hl' : ''}${placeholder ? ' is-more' : ''}` }, name);
      if (folder)
        return h(
          'li',
          { role: 'treeitem' },
          h(
            'details',
            { open: true },
            h('summary', null, h('span', { class: 'tree-ico tree-folder', 'aria-hidden': 'true' }), label, note),
            sub ? treeList(sub, depth + 1) : null,
          ),
        );
      return h(
        'li',
        { role: 'treeitem' },
        placeholder ? null : h('span', { class: 'tree-ico tree-file', 'aria-hidden': 'true' }),
        label,
        note,
      );
    });
  return h('ul', { role: depth === 0 ? null : 'group' }, list(items));
}

const example: BlockRenderer = (node, r) => {
  // Inline where written; a hosted docs page lifts the top-level ones into its rail.
  const a = node.attrs!;
  const head = a.title ?? (a.kind === 'response' ? 'Response' : 'Request');
  return h(
    'div',
    { class: 'doc-example', 'data-kind': a.kind === 'response' ? 'response' : 'request' },
    h('div', { class: 'doc-example-head' }, text(head)),
    r.blocks(node.content),
  );
};

const fileTree: BlockRenderer = (node) => {
  const found = node.content!.find((c) => c.type === 'bulletList');
  return h('div', { class: 'doc-tree', role: 'tree' }, found ? treeList(found, 0) : null);
};

const swatch: BlockRenderer = (node) => {
  const colors = (node.attrs!.colors ?? []).filter((c: Attrs) => SWATCH_HEX.test(c.value));
  const layout = node.attrs!.layout === 'row' ? 'row' : 'grid';
  return h(
    'div',
    { class: 'doc-swatches', 'data-layout': layout },
    list(
      colors.map((c: Attrs) =>
        h(
          'figure',
          { class: 'doc-swatch' },
          h('span', { class: 'doc-swatch-chip', style: `background:${c.value}` }),
          h(
            'figcaption',
            null,
            h('span', { class: 'doc-swatch-name' }, text(c.name)),
            h('code', null, c.value),
            c.note ? h('span', { class: 'doc-swatch-note' }, text(c.note)) : null,
          ),
        ),
      ),
    ),
  );
};

const buttons: BlockRenderer = (node, r) => {
  const align = node.attrs?.align;
  return h(
    'div',
    { class: 'doc-btns', 'data-align': align && align !== 'start' ? String(align) : null },
    r.blocks(node.content),
  );
};

const expandableGroup: BlockRenderer = (node, r) => {
  // `exclusive` is the browser's own one-open accordion (`<details name>`), so it needs no script.
  const a = node.attrs;
  const titles = node.content!.map((c) => (c.type === 'expandable' ? c.attrs!.title : '')).join('\u0000');
  const name = a?.exclusive ? `eg-${hashScope(titles)}` : null;
  const items = node.content!.map((c) => {
    const out = r.blocks([c]);
    return name ? withRoot(out, (root) => (root.type === 'details' ? mergeInto(root, { name }) : root)) : out;
  });
  return h('div', { class: 'doc-expgroup', 'data-style': a?.style ? String(a.style) : null }, list(items));
};

/**
 * `expandable`: a native `<details>`, so it opens and closes with no JS.
 * `data-expandable` marks every collapsible this block draws, so a stylesheet
 * can style THESE and not the other `<details>` a page holds; `data-style` /
 * `data-icon` are the block's own choice and beat the theme's.
 */
const expandable: BlockRenderer = (node, r) => {
  const { style, icon } = node.attrs!;
  const iconAttr = icon ? text(icon) : null;
  if (style === 'spoiler') {
    // A spoiler BLOCK: the reveal needs no script and a screen reader
    // announces it as collapsed. An untitled one says "Spoiler" (the hosted
    // hydrator translates the word, `data-spoiler-label`); never open.
    const title = node.attrs!.title.trim();
    return h(
      'details',
      { 'data-expandable': '', 'data-style': 'spoiler', 'data-spoiler-block': '', 'data-icon': iconAttr },
      h('summary', { 'data-spoiler-label': title ? null : '' }, title || 'Spoiler'),
      h('div', { class: 'cf-spoiler-body' }, r.blocks(node.content)),
    );
  }
  if (style === 'solution') {
    // The answer to an exercise, folded under a labelled bar. Untitled, it says
    // so (`data-lw`, rewritten by the hosted hydrator in a lesson's language).
    const title = node.attrs!.title.trim();
    return h(
      'details',
      { 'data-expandable': '', 'data-style': 'solution', 'data-icon': iconAttr },
      h(
        'summary',
        { 'data-lw': title ? null : 'revealSolution', 'data-lw-lang': title ? null : 'en' },
        title || REVEAL_SOLUTION_EN,
      ),
      h('div', { class: 'cf-solution-body' }, r.blocks(node.content)),
    );
  }
  return h(
    'details',
    {
      'data-expandable': '',
      'data-style': style ? text(style) : null,
      'data-icon': iconAttr,
      open: node.attrs!.defaultOpen ? true : null,
    },
    h('summary', null, text(node.attrs!.title)),
    r.blocks(node.content),
  );
};

export const DOCS_EXTRA: Record<string, BlockRenderer> = {
  field,
  example,
  fileTree,
  swatch,
  buttons,
  expandableGroup,
  expandable,
};
