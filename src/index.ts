/**
 * @forumulate/blocks-react — Forumulate content in React, with the markup the
 * hosted reader serves. Every export is server-component safe (no hooks, no
 * context, no `window`) and makes no network request.
 */
export { RichText, type RichTextProps } from './RichText.js';
export { Blocks, type BlocksProps } from './Blocks.js';
export { Content, type ContentProps } from './Content.js';
export { Field, type FieldProps } from './Field.js';
export { FmImage, type FmImageProps } from './FmImage.js';
export { renderDoc, renderNodes } from './render.js';
export { fieldAttrs, toPointer, pathSegments, type FieldPath, type PathSegment } from './pointer.js';
export {
  fmImageLoader,
  nextImageProps,
  objectPosition,
  srcSetOf,
  variantFor,
  isDeliveryMedia,
  type DeliveryMedia,
} from './media-image.js';
export { formatDate, formatDateTime, formatMoney, type FormatOptions } from './format.js';
export {
  rowToNode,
  type BlockOverrideProps,
  type ContentOverrides,
  type EntryOverrideProps,
  type FieldOverrideProps,
} from './content-render.js';
export { SUPPORTED_TYPES, HOSTED_ONLY_TYPES } from './coverage.js';
export { blockFields } from './schema.js';
export type {
  BlockRow,
  BlockTypeDecl,
  ContentEntry,
  ContentTypeSchema,
  FieldDecl,
  FieldPatch,
} from './schema.js';
export type { RenderOptions, NodeOverrides, NodeOverrideProps } from './options.js';
export type { IconSet } from './icons.js';
export type { BlockDoc, BlockNode, InlineNode, Mark, Attrs, ImageSize, SectionSpec } from './types.js';
