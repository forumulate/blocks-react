import { createElement, type ReactNode } from 'react';
import { list, withRoot } from './h.js';
import { endNotes, renderInline } from './inline.js';
import { blockLookStamp, mergeInto, readHooks, stampHooks } from './look.js';
import { newState, uniqueId, type RenderState } from './state.js';
import { RENDERERS } from './blocks/registry.js';
import type { R } from './blocks/types.js';
import type { RenderOptions } from './options.js';
import type { BlockDoc, BlockNode } from './types.js';

/**
 * The block switch: a document becomes React elements one block at a time —
 * docs-schema `renderToHtml`, `renderBlock` and `renderBlockUnsafe`.
 *
 * Each family of blocks lives in ./blocks; this file is the dispatch, the
 * per-block guard and the hooks every block wears.
 */

/** Comparable form of a heading/title: case, punctuation and space-insensitive. */
function titleKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, ' ')
    .replace(/[.:;,!?'"`‘’“”]+/g, '')
    .trim();
}

/** A leading heading that only repeats the title the surface already printed. */
function repeatsTitle(node: BlockNode, title: string | undefined): boolean {
  if (!title || node.type !== 'heading') return false;
  const text = (node.content ?? []).map((n) => (n.type === 'text' ? n.text : '')).join('');
  return titleKey(text) !== '' && titleKey(text) === titleKey(title);
}

function makeR(s: RenderState): R {
  const r: R = {
    s,
    blocks: (nodes) => (Array.isArray(nodes) ? list(nodes.map((n) => renderBlock(n as BlockNode, r))) : null),
    inline: (nodes) => renderInline(nodes, s),
    uniqueId: (raw) => uniqueId(s, raw),
  };
  return r;
}

/**
 * One block, and never an exception out of it. What a site renders is stored
 * JSON, which is not always what the schema allows; one malformed block renders
 * as nothing and the rest of the page renders.
 */
export function renderBlock(node: BlockNode, r: R): ReactNode {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return null;
  const Override = r.s.opts.overrides?.[node.type];
  if (Override) {
    return createElement(Override, {
      node,
      children: Array.isArray(node.content) ? r.blocks(node.content) : null,
      options: r.s.opts,
    });
  }
  try {
    return renderBlockUnsafe(node, r);
  } catch {
    return null;
  }
}

/** One block wearing its hooks; the anchor is claimed BEFORE the children render. */
function renderBlockUnsafe(node: BlockNode, r: R): ReactNode {
  const render = RENDERERS[node.type];
  if (!render) {
    r.s.opts.onUnsupported?.(node);
    return null;
  }
  const hooks = readHooks(node.attrs);
  const id = hooks.anchor ? r.uniqueId(hooks.anchor) : null;
  const out = render(node, r, id);
  return stampHooks(out, id, hooks, blockLookStamp(node));
}

/**
 * A whole document. Each top-level block carries its index and type
 * (`data-block-i`/`data-block-t`), as on the hosted page — what lets the studio
 * point from a rendered block back into the document.
 */
export function renderDoc(doc: BlockDoc | null | undefined, opts: RenderOptions = {}): ReactNode {
  const s = newState(opts);
  if (!doc || !Array.isArray(doc.content)) return null;
  const r = makeR(s);
  const body = doc.content.map((n, i) => {
    if (!n || typeof n !== 'object') return null;
    if (i === 0 && repeatsTitle(n, opts.dedupeTitle)) return null;
    const out = renderBlock(n, r);
    return withRoot(out, (root) => mergeInto(root, { 'data-block-i': i, 'data-block-t': String(n.type) }));
  });
  // Footnotes placed at the END are collected while the body renders.
  return list([...body, endNotes(s)]);
}

/** A list of blocks with no document around it (a CMS block's richText field, a column). */
export function renderNodes(nodes: readonly BlockNode[] | null | undefined, opts: RenderOptions = {}): ReactNode {
  const s = newState(opts);
  const r = makeR(s);
  return list([r.blocks(nodes), endNotes(s)]);
}
