/**
 * The block model as this package reads it: the TipTap/ProseMirror JSON that
 * the platform's block model defines and the delivery API serves.
 *
 * Deliberately LOOSE. docs-schema's own types are a discriminated union built
 * beside its zod schemas, and importing them would publish a dependency on a
 * private package (and its validator) in our `.d.ts`. More to the point, what
 * reaches a customer's site is stored JSON, which is not always what today's
 * schema says — every renderer here re-checks each value on the way out, the
 * same way `renderToHtml` does, and an unexpected shape renders as nothing.
 */

/** Any attribute bag. Values are re-checked by whoever reads them. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- stored JSON, checked at each read
export type Attrs = Record<string, any>;

export interface Mark {
  type: string;
  attrs?: Attrs;
}

export interface InlineNode {
  type: string;
  text?: string;
  marks?: Mark[];
  attrs?: Attrs;
}

export interface BlockNode {
  type: string;
  attrs?: Attrs;
  content?: BlockNode[];
  text?: string;
  marks?: Mark[];
}

export interface BlockDoc {
  type?: 'doc';
  content: BlockNode[];
}

/** A picture's intrinsic pixel size and optional placeholder colour (`#rrggbb`). */
export interface ImageSize {
  width: number;
  height: number;
  color?: string | null;
}

/** A section slot's declared label and how it prints (docs-schema `RenderContext.sections`). */
export interface SectionSpec {
  key: string;
  label: string;
  render?: 'labelled' | 'lede' | 'plain';
}
