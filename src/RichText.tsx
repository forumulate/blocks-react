import { renderDoc } from './render.js';
import type { RenderOptions } from './options.js';
import type { BlockDoc } from './types.js';

export interface RichTextProps extends RenderOptions {
  /** A `richText` field value: the block document (`{ type: 'doc', content: [...] }`). */
  doc: BlockDoc | null | undefined;
}

/**
 * A rich-text document, rendered to the same markup the hosted reader serves
 * (`renderToHtml`), so our reader stylesheet — or your own written against
 * it — styles it identically. Renders no wrapper element: place it inside
 * your own `<article>` or `<div className="prose">`.
 *
 * Pure: the same props always render the same elements (ids, footnote numbers
 * and the like are counted per render), and nothing touches `window`, so it is
 * safe in server components, SSR and static export.
 */
export function RichText({ doc, ...options }: RichTextProps) {
  return <>{renderDoc(doc, options)}</>;
}
