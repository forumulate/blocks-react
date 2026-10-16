import { renderEntry, type ContentOverrides } from './content-render.js';
import type { RenderOptions } from './options.js';
import type { ContentEntry, ContentTypeSchema } from './schema.js';
import type { FormatOptions } from './format.js';

export interface ContentProps extends FormatOptions {
  /** An entry from the delivery API (`{ id, type, fields }`). */
  entry: ContentEntry | null | undefined;
  /** Its content type's declaration. Without one, field types are read off the values. */
  schema?: ContentTypeSchema;
  /** Declarations of other content types, for rendering referenced entries. */
  schemas?: Record<string, ContentTypeSchema>;
  /** Override anything: `{ blocks: {hero: MyHero}, fields: {'pricing.tiers': Tiers}, types: {richText: MyRichText}, contentTypes: {author: AuthorCard} }`. */
  overrides?: ContentOverrides;
  /** How many levels of references to render (default 2). */
  depth?: number;
  /** Click-to-edit attributes on every field — your framework's preview flag. Off in production. */
  preview?: boolean;
  /** Passed to the rich-text and built-in block renderers. */
  options?: RenderOptions;
}

/**
 * Any entry of any content type, rendered from its schema (CMS spec 3.4): a
 * new type or a new page needs no new code. Every field type has a default
 * renderer and every level can be overridden — field path, block type, field
 * type, content type, most specific first. With `preview` on, every field
 * carries the click-to-edit attribute, so visual editing needs no annotation.
 */
export function Content({ entry, schema, schemas, overrides, depth, preview, options, ...format }: ContentProps) {
  if (!entry || typeof entry.id !== 'string') return null;
  return (
    <>
      {renderEntry(entry, schema ?? schemas?.[entry.type ?? ''], {
        ...format,
        entryId: entry.id,
        preview: preview === true,
        overrides: overrides ?? {},
        schemas: schemas ?? {},
        blockTypes: {},
        depth: depth ?? 2,
        options: options ?? {},
      })}
    </>
  );
}
