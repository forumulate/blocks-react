import { Children, cloneElement, type ReactElement, type ReactNode } from 'react';
import { withRoot, type HtmlAttrs } from '../h.js';
import { mergeInto } from '../look.js';
import type { Attrs, BlockNode } from '../types.js';
import { text } from './core.js';
import { stampAttrs, tabsLookStamp } from './docs-r4.js';
import { tabsR5Attrs } from './docs-r5.js';
import { tabsShell } from './tabs-shell.js';
import type { BlockRenderer } from './types.js';

/**
 * The tabs BLOCK — docs-schema `render-tabs-block.ts`. The shell markup is
 * ./tabs-shell, shared with the code group.
 */

type El = ReactElement<Record<string, unknown>>;

/**
 * The tab group as a code group, when every panel is exactly ONE code block —
 * the npm / pnpm / yarn tabs every install page has. Drawn as tabs, each panel
 * was a framed code block with its own header under a second strip (two
 * stacked bars); as a code group the titles ARE the code header's tabs.
 *
 * The tab's title wins over the code block's own (a filename): it is what the
 * author named the choice. `syncKey` and the pill strip carry over. Null when
 * the group does not qualify — `asCodeGroup: false`, a vertical strip, or any
 * panel that is not one code block.
 */
function asCodeGroup(node: BlockNode, tabs: BlockNode[]): BlockNode | null {
  const a = node.attrs;
  if (a?.asCodeGroup === false || a?.orientation === 'vertical' || tabs.length === 0) return null;
  if (tabs.length > 12) return null; // a code group holds at most twelve samples
  const kids: BlockNode[] = [];
  for (const t of tabs) {
    const only = t.content?.length === 1 ? t.content[0] : null;
    if (!only || only.type !== 'codeBlock') return null;
    kids.push({ ...only, attrs: { ...(only.attrs ?? {}), title: t.attrs!.title } });
  }
  const ga: Attrs = {
    ...(a?.syncKey ? { syncKey: a.syncKey } : {}),
    ...(a?.tabStyle ? { tabStyle: a.tabStyle } : {}),
  };
  return { type: 'codeGroup', ...(Object.keys(ga).length ? { attrs: ga } : {}), content: kids };
}

/** The first `role="tablist"` (the outer strip, before any nested group's) says it is vertical. */
function verticalStrip(root: El): ReactElement {
  const kids = Children.toArray(root.props.children as ReactNode);
  if (!kids.length) return root;
  const strip = withRoot(kids[0], (ul) => mergeInto(ul, { 'aria-orientation': 'vertical' }));
  return cloneElement(root, undefined, strip, ...kids.slice(1));
}

export const tabs: BlockRenderer = (node, r) => {
  const panes = node.content!.filter((c) => c.type === 'tab');
  const group = asCodeGroup(node, panes);
  // The active tab's ink and underline; the pill strip rides on the group's attrs.
  const own = tabsLookStamp(node.attrs);
  if (group) {
    // Through the block switch, as the hosted switch draws any code group
    // (no hooks of its own to stamp: the synthetic node has none).
    const out = r.blocks([group]);
    const act = tabsLookStamp({ active: node.attrs?.active });
    if (!Object.keys(act.data).length) return out;
    return withRoot(out, (root) =>
      root.type === 'figure' && root.props.className === 'cf-code-group' ? mergeInto(root, stampAttrs(act)) : root,
    );
  }
  const a = node.attrs;
  // Each tab's title is read before its panel renders, and checked (escaped,
  // on the hosted page) only once every panel has rendered.
  const items = panes.map((t) => ({ title: t.attrs!.title, body: r.blocks(t.content) }));
  for (const it of items) text(it.title);
  const root = tabsShell(items, a?.syncKey ? { syncKey: text(a.syncKey) } : {}) as El;
  // `variant` is BlockLook's heading `variant`, intersected into every block's attrs.
  const extra: HtmlAttrs = {
    'data-overflow': a?.overflow ? String(a.overflow) : null,
    'data-orientation': a?.orientation ? String(a.orientation) : null,
    'data-variant': a?.variant === 'card' ? 'card' : null,
    ...tabsR5Attrs(a),
    ...stampAttrs(own),
  };
  const out = mergeInto(root, extra) as El;
  return a?.orientation === 'vertical' ? verticalStrip(out) : out;
};
