import type { ComponentType, ReactNode } from 'react';
import type { ImageProxy } from './url.js';
import type { BlockNode, ImageSize, SectionSpec } from './types.js';
import type { IconSet } from './icons.js';

/**
 * What a render needs to know — the subset of docs-schema's `RenderContext`
 * that means something on a customer's site, under the same names, so the
 * parity test can hand both renderers one object.
 *
 * Everything is optional, and an unset option renders exactly what
 * `renderToHtml` renders with that key unset.
 */
export interface RenderOptions {
  /**
   * Rewrite each picture's address (a CDN, an image proxy, an absolute origin
   * for a library path). `null` from the function keeps the author's URL.
   */
  imageProxy?: ImageProxy;
  /** A picture's intrinsic size, so its box is reserved before it loads (no layout shift). */
  imageSize?: (url: string) => ImageSize | null;
  /** A `srcset` for a body picture; also turns on `loading="lazy"` after the first. */
  imageSrcset?: (url: string) => string | null;
  /** `false` keeps heading ids and drops the visible `#` link beside each one. */
  headingAnchors?: boolean;
  /** Prefixed to every id this render mints — for two documents on one page. */
  idPrefix?: string;
  /** Where a footnote's note shows: a popover (default), the margin, or a list at the end. */
  footnotes?: 'popover' | 'margin' | 'end';
  /** `{{key}}` values for variable references and inline templates. */
  variables?: Record<string, string>;
  /** Declared section slots, for a labelled slot's heading. */
  sections?: readonly SectionSpec[];
  /** Mark the first heading as the page's hero heading (a page that hides its title). */
  heroHeading?: boolean;
  /** The page title, so a leading heading that only repeats it is dropped. */
  dedupeTitle?: string;
  /**
   * Icons beyond our own glyphs. `import { lucideIcons } from
   * '@forumulate/blocks-react/icons'` draws the extended set the hosted reader
   * draws; without it an extended icon name renders nothing (never the word).
   */
  icons?: IconSet;
  /**
   * Your own component for a node type — `{ hero: MyHero, pricing: MyPricing }`.
   * It replaces our markup for that type entirely and receives the node, its
   * rendered children (for container nodes) and the render options.
   */
  overrides?: NodeOverrides;
  /**
   * Called for a node type this package does not draw (a hosted-only block —
   * see `HOSTED_ONLY_TYPES`) and no override covers. Such a node renders
   * nothing, as an unknown type does on the hosted reader.
   */
  onUnsupported?: (node: BlockNode) => void;
  /** Exact https origins you trust to be framed: an `embed` of one renders as a sandboxed frame, not a link. */
  frameOrigins?: readonly string[];
}

export interface NodeOverrideProps {
  node: BlockNode;
  /** The node's children, already rendered (null for a leaf). */
  children: ReactNode;
  options: RenderOptions;
}

export type NodeOverrides = Partial<Record<string, ComponentType<NodeOverrideProps>>>;
