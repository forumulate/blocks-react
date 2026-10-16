import { createElement, type ComponentType, type ReactNode } from 'react';
import { h, list, withRoot } from './h.js';
import { mergeInto } from './look.js';
import { renderDoc, renderNodes } from './render.js';
import { RENDERERS } from './blocks/registry.js';
import { FmImage } from './FmImage.js';
import { isDeliveryMedia } from './media-image.js';
import { formatDate, formatDateTime, formatMoney, type FormatOptions } from './format.js';
import { childPath, fieldAttrs, type PathSegment } from './pointer.js';
import { href, safeUrl } from './url.js';
import {
  RESERVED_ROW_KEYS,
  blockFields,
  type BlockRow,
  type BlockTypeDecl,
  type ContentEntry,
  type ContentTypeSchema,
  type FieldDecl,
} from './schema.js';
import type { RenderOptions } from './options.js';
import type { BlockDoc, BlockNode } from './types.js';

/**
 * Rendering any content type from its schema (CMS spec 3.4): each field type
 * has a default renderer, and a site overrides any of it — per field path,
 * per block type, per field type, per content type, most specific first.
 *
 * Built-in block types are docs-schema blocks, so they render through the
 * same mirror of `renderToHtml` as rich text; owner-defined block types have
 * no bespoke markup and render field by field.
 */

export interface FieldOverrideProps {
  value: unknown;
  field: FieldDecl;
  path: PathSegment[];
  entryId: string | null;
  preview: boolean;
  /** `data-fm-field` in preview, `{}` otherwise — spread it on your element. */
  attrs: { 'data-fm-field'?: string };
  /** What this package would have rendered. */
  children: ReactNode;
}

export interface BlockOverrideProps {
  block: BlockRow;
  /** The block type's fields under its variant (empty when no schema declares it). */
  fields: FieldDecl[];
  path: PathSegment[];
  entryId: string | null;
  preview: boolean;
  attrs: { 'data-fm-field'?: string };
  children: ReactNode;
}

export interface EntryOverrideProps {
  entry: ContentEntry;
  schema: ContentTypeSchema | undefined;
  preview: boolean;
  children: ReactNode;
}

export interface ContentOverrides {
  /** By block type: `{ hero: MyHero }`. */
  blocks?: Partial<Record<string, ComponentType<BlockOverrideProps>>>;
  /** By field path, dot-joined keys from the entry root (row ids left out): `{ 'pricing.tiers': Tiers }`. */
  fields?: Partial<Record<string, ComponentType<FieldOverrideProps>>>;
  /** By field type: `{ richText: MyRichText }`. */
  types?: Partial<Record<string, ComponentType<FieldOverrideProps>>>;
  /** By content type, for a whole entry (a referenced author, say): `{ author: AuthorCard }`. */
  contentTypes?: Partial<Record<string, ComponentType<EntryOverrideProps>>>;
}

export interface ContentContext extends FormatOptions {
  entryId: string | null;
  preview: boolean;
  overrides: ContentOverrides;
  /** Schemas of other content types, for referenced entries. */
  schemas: Record<string, ContentTypeSchema>;
  blockTypes: Record<string, BlockTypeDecl>;
  /** How many more references deep to render. */
  depth: number;
  options: RenderOptions;
}

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const keyPath = (path: PathSegment[]) => path.filter((s): s is string => typeof s === 'string').join('.');

/** One field value, through its override or its type's default renderer. */
export function renderField(value: unknown, field: FieldDecl, path: PathSegment[], ctx: ContentContext): ReactNode {
  if (field.visibility === 'internal') return null;
  const attrs = fieldAttrs(ctx.entryId, path, ctx.preview);
  const Override = ctx.overrides.fields?.[keyPath(path)] ?? ctx.overrides.types?.[field.type];
  const fallback = isEmpty(value) ? null : defaultField(value, field, path, attrs, ctx);
  if (!Override) return fallback;
  return createElement(Override, {
    value,
    field,
    path,
    entryId: ctx.entryId,
    preview: ctx.preview,
    attrs,
    children: fallback,
  });
}

/** The fields of a group, an array row, a block or an entry, in declared order. */
export function renderFields(
  values: Record<string, unknown>,
  fields: readonly FieldDecl[],
  path: PathSegment[],
  ctx: ContentContext,
): ReactNode {
  return list(fields.map((f) => renderField(values[f.key], f, childPath(path, f.key), ctx)));
}

function cls(field: FieldDecl, extra = ''): string {
  return `fm-field fm-field--${field.type}${extra}`;
}

function defaultField(
  value: unknown,
  field: FieldDecl,
  path: PathSegment[],
  attrs: { 'data-fm-field'?: string },
  ctx: ContentContext,
): ReactNode {
  const base = { class: cls(field), 'data-field': field.key, ...attrs };
  switch (field.type) {
    case 'text':
    case 'slug':
    case 'email':
    case 'select':
    case 'number':
    case 'computed':
      return typeof value === 'object' ? null : h('div', base, String(value));
    case 'textarea':
      return typeof value === 'string'
        ? h('div', base, list(value.split('\n').flatMap((line, i) => (i ? [h('br'), line] : [line]))))
        : null;
    case 'multiselect':
      return Array.isArray(value) ? h('ul', base, list(value.map((v) => h('li', null, String(v))))) : null;
    case 'url':
      return typeof value === 'string' ? h('a', { ...base, href: href(value) }, value) : null;
    case 'date':
    case 'datetime': {
      const shown = field.type === 'date' ? formatDate(value, ctx) : formatDateTime(value, ctx);
      return shown ? h('time', { ...base, datetime: String(value) }, shown) : null;
    }
    case 'money': {
      const shown = formatMoney(value, ctx);
      return shown ? h('div', base, shown) : null;
    }
    case 'richText': {
      const doc = value as BlockDoc;
      return Array.isArray(doc?.content) ? h('div', base, renderDoc(doc, ctx.options)) : null;
    }
    case 'media':
    case 'image': {
      // `image` (the older type) holds a bare URL; `media` the delivery object.
      const media = typeof value === 'string' ? { url: value } : value;
      if (!isDeliveryMedia(media)) return null;
      // With a caption the figure is the field's element; the picture inside it is plain.
      const img = createElement(FmImage, {
        media,
        imageProxy: ctx.options.imageProxy,
        ...(media.caption ? {} : { className: cls(field), 'data-field': field.key, ...attrs }),
      } as never);
      return media.caption ? h('figure', base, img, h('figcaption', null, media.caption)) : img;
    }
    case 'file': {
      const f = value as { url?: string; name?: string };
      return f?.url ? h('a', { ...base, href: href(f.url), download: true }, f.name ?? f.url) : null;
    }
    case 'link':
      return renderLink(value, base);
    case 'code': {
      const c = value as { language?: string; code?: string };
      if (typeof c?.code !== 'string') return null;
      return h('pre', base, h('code', { class: c.language ? `language-${c.language}` : null }, c.code));
    }
    case 'group':
      return value && typeof value === 'object'
        ? h('div', base, renderFields(value as Record<string, unknown>, field.fields ?? [], path, ctx))
        : null;
    case 'array':
      return Array.isArray(value)
        ? h(
            'ul',
            base,
            list(
              value.map((row: Record<string, unknown>, i) => {
                const rowPath = childPath(path, typeof row?.id === 'string' ? { id: row.id } : String(i));
                return h(
                  'li',
                  { class: 'fm-row', ...fieldAttrs(ctx.entryId, rowPath, ctx.preview) },
                  renderFields(row ?? {}, field.fields ?? [], rowPath, ctx),
                );
              }),
            ),
          )
        : null;
    case 'blocks':
      return Array.isArray(value) ? h('div', base, renderBlockRows(value as BlockRow[], path, ctx)) : null;
    case 'reference':
    case 'relation': {
      const refs = (Array.isArray(value) ? value : [value]).filter(isEntry);
      if (!refs.length || ctx.depth <= 0) return null;
      const inner = { ...ctx, depth: ctx.depth - 1 };
      return h('div', base, list(refs.map((e) => renderEntry(e, ctx.schemas[e.type ?? ''], inner))));
    }
    case 'form':
      // Our form block posts to the hosted form engine; a site overrides `form` to draw one.
      return value && typeof value === 'object'
        ? renderNodes([{ type: 'form', attrs: value as BlockNode['attrs'] }], ctx.options)
        : null;
    // Data, not display: a site reads these itself (seo via the framework's head helper).
    case 'json':
    case 'color':
    case 'seo':
    case 'boolean':
    case 'place':
    case 'hours':
    default:
      return null;
  }
}

function renderLink(value: unknown, base: Record<string, string | null | undefined>): ReactNode {
  const l = value as {
    type?: string;
    url?: string;
    label?: string;
    newTab?: boolean;
    reference?: { path?: string; url?: string; title?: string } | null;
  };
  if (!l || typeof l !== 'object') return null;
  const target = l.type === 'reference' ? (l.reference?.path ?? l.reference?.url) : l.url;
  if (typeof target !== 'string' || !safeUrl(target)) return null;
  const label = l.label ?? l.reference?.title ?? target;
  return h(
    'a',
    { ...base, href: href(target), target: l.newTab ? '_blank' : null, rel: l.newTab ? 'noopener noreferrer' : null },
    label,
  );
}

function isEntry(v: unknown): v is ContentEntry {
  return !!v && typeof v === 'object' && typeof (v as ContentEntry).id === 'string' && !!(v as ContentEntry).fields;
}

/** A `blocks` field's rows (also `<Blocks>`). */
export function renderBlockRows(rows: readonly BlockRow[], path: PathSegment[], ctx: ContentContext): ReactNode {
  return list(rows.map((row, i) => renderBlockRow(row, childPath(path, typeof row?.id === 'string' ? { id: row.id } : String(i)), ctx)));
}

/** A built-in block row as the docs-schema node it is: its fields are the node's attrs. */
export function rowToNode(row: BlockRow): BlockNode {
  const attrs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'content' || (RESERVED_ROW_KEYS as readonly string[]).includes(k)) continue;
    attrs[k] = v;
  }
  if (row.variant && attrs.variant === undefined) attrs.variant = row.variant;
  return { type: row.blockType, attrs, ...(Array.isArray(row.content) ? { content: row.content as BlockNode[] } : {}) };
}

function renderBlockRow(row: BlockRow, path: PathSegment[], ctx: ContentContext): ReactNode {
  if (!row || typeof row !== 'object' || typeof row.blockType !== 'string') return null;
  const attrs = fieldAttrs(ctx.entryId, path, ctx.preview);
  const decl = ctx.blockTypes[row.blockType];
  const fields = blockFields(decl, row.variant);
  let out: ReactNode;
  // A block type the library DECLARES is the owner's, drawn field by field,
  // even when its key is also a built-in's: the website template's `hero` has
  // `heading`, the built-in hero reads `title`, and handing one to the other
  // drew every hero as nothing (and left no field to double-click in preview).
  if (!decl && RENDERERS[row.blockType]) {
    // A built-in: the hosted markup, with the row's address on its root in preview.
    out = renderNodes([rowToNode(row)], ctx.options);
    if (attrs['data-fm-field']) out = withRoot(out, (root) => mergeInto(root, attrs));
  } else {
    out = h(
      'section',
      {
        class: `fm-block fm-block--${row.blockType}`,
        'data-block-type': row.blockType,
        'data-variant': row.variant || null,
        ...attrs,
      },
      renderFields(row, fields.length ? fields : inferFields(row), path, ctx),
    );
  }
  const Override = ctx.overrides.blocks?.[row.blockType];
  if (!Override) return out;
  return createElement(Override, { block: row, fields, path, entryId: ctx.entryId, preview: ctx.preview, attrs, children: out });
}

/**
 * A block type no schema describes: its field types read off the values, so
 * a site handed blocks without their schema still shows their words.
 */
export function inferFields(values: Record<string, unknown>): FieldDecl[] {
  const out: FieldDecl[] = [];
  for (const [key, v] of Object.entries(values)) {
    if ((RESERVED_ROW_KEYS as readonly string[]).includes(key) || key.startsWith('_')) continue;
    const type =
      typeof v === 'string' || typeof v === 'number'
        ? 'text'
        : Array.isArray((v as BlockDoc)?.content)
          ? 'richText'
          : isDeliveryMedia(v)
            ? 'media'
            : Array.isArray(v) && v.every((r) => r && typeof r === 'object' && typeof (r as BlockRow).blockType === 'string')
              ? 'blocks'
              : null;
    if (type) {
      out.push({ key, type });
      continue;
    }
    // A group (an imported Payload `hero`, say): its words are a level down.
    // Skipping objects dropped a whole imported page's heading.
    if (v && typeof v === 'object' && !Array.isArray(v) && !isEntry(v)) {
      const fields = inferFields(v as Record<string, unknown>);
      if (fields.length) out.push({ key, type: 'group', fields });
    }
  }
  return out;
}

/** A whole entry: its content-type override, or an article of its fields. */
export function renderEntry(entry: ContentEntry, schema: ContentTypeSchema | undefined, ctx: ContentContext): ReactNode {
  const inner: ContentContext = {
    ...ctx,
    entryId: entry.id,
    blockTypes: { ...ctx.blockTypes, ...schema?.blockTypes },
  };
  const values = entry.fields ?? {};
  const body = h(
    'article',
    { class: 'fm-entry', 'data-content-type': entry.type ?? schema?.key ?? null },
    renderFields(values, schema?.fields ?? inferFields(values), [], inner),
  );
  const Override = ctx.overrides.contentTypes?.[entry.type ?? schema?.key ?? ''];
  return Override ? createElement(Override, { entry, schema, preview: ctx.preview, children: body }) : body;
}
