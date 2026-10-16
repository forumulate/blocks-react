import type { ComponentType } from 'react';
import { renderBlockRows, type BlockOverrideProps, type ContentOverrides } from './content-render.js';
import { pathSegments, type FieldPath } from './pointer.js';
import type { RenderOptions } from './options.js';
import type { BlockRow, BlockTypeDecl } from './schema.js';
import type { FormatOptions } from './format.js';

export interface BlocksProps extends FormatOptions {
  /** A `blocks` field value: `[{ id, blockType, variant?, ...fields }]`. */
  blocks: readonly BlockRow[] | null | undefined;
  /** Your component per block type: `{ hero: MyHero }`. It receives the row and our rendering as `children`. */
  overrides?: Partial<Record<string, ComponentType<BlockOverrideProps>>>;
  /** Overrides for the fields inside owner-defined blocks (by path or field type). */
  fieldOverrides?: Pick<ContentOverrides, 'fields' | 'types'>;
  /** Declarations of owner-defined block types, so their fields render by type. */
  blockTypes?: Record<string, BlockTypeDecl>;
  /** For click-to-edit: the entry these blocks belong to and the field's path in it. */
  entryId?: string | null;
  path?: FieldPath;
  preview?: boolean;
  /** Passed to the rich-text and built-in block renderers. */
  options?: RenderOptions;
}

/**
 * A CMS `blocks` field. Built-in block types (hero, pricing, testimonials,
 * stats, person, logo wall, cards, columns…) render exactly as the hosted
 * reader renders them; owner-defined types render field by field; any type
 * you list in `overrides` renders through your component.
 */
export function Blocks({ blocks, overrides, fieldOverrides, blockTypes, entryId, path, preview, options, ...format }: BlocksProps) {
  if (!Array.isArray(blocks)) return null;
  return (
    <>
      {renderBlockRows(blocks, pathSegments(path), {
        ...format,
        entryId: entryId ?? null,
        preview: preview === true,
        overrides: { blocks: overrides, ...fieldOverrides },
        schemas: {},
        blockTypes: blockTypes ?? {},
        depth: 0,
        options: options ?? {},
      })}
    </>
  );
}
