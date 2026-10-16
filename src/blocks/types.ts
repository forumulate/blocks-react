import type { ReactNode } from 'react';
import type { RenderState } from '../state.js';
import type { BlockNode } from '../types.js';

/**
 * What the block switch lends each block renderer: the render's state, its
 * children renderer and its id ledger — docs-schema's `renderBlocks` and
 * `uniqueId`, passed the same way so the mirror reads like the original.
 */
export interface R {
  s: RenderState;
  /** A list of child blocks, each through the full switch (hooks, overrides, guards). */
  blocks(nodes: unknown): ReactNode;
  /** An inline run. */
  inline(nodes: unknown): ReactNode;
  /** A page-unique id from a base (headings, anchors, pricing, carousels share one ledger). */
  uniqueId(raw: string): string;
}

/**
 * One block type's renderer. `anchorId` is the author's anchor, already made
 * unique, for the few blocks that use it as their own id (a heading, a section).
 */
export type BlockRenderer = (node: BlockNode, r: R, anchorId: string | null) => ReactNode;
