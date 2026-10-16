/**
 * The content model as `<Content>` and `<Blocks>` read it: a content type's
 * field declarations and its block types, in the form the studio stores and
 * `forumulate content pull` writes (CMS spec 3.2, 3.3). Loose for the same
 * reason as ./types: it is data from an API, re-checked at each read.
 */

export interface FieldDecl {
  key: string;
  /** `text`, `richText`, `media`, `blocks`, `array`, `group`, `reference`, `link`, … (spec 3.2). */
  type: string;
  label?: string;
  /** Sub-fields of a `group` or an `array` row. */
  fields?: FieldDecl[];
  /** Block types a `blocks` field accepts. */
  allowed?: string[];
  /** A `reference`/`relation` may hold many. */
  hasMany?: boolean;
  /** `internal` values are never delivered; `preview` ones only to preview sessions. */
  visibility?: 'public' | 'preview' | 'internal';
  [extra: string]: unknown;
}

/** A variant's field patch: the same add/omit algebra as the shape. */
export interface FieldPatch {
  add?: FieldDecl[];
  omit?: string[];
  order?: string[];
}

export interface BlockTypeDecl {
  label?: string;
  fields?: FieldDecl[];
  variants?: { key: string; label?: string; fields?: FieldPatch }[];
}

export interface ContentTypeSchema {
  /** The content type's key (`post`, `page`, …). */
  key?: string;
  label?: string;
  fields: FieldDecl[];
  /** Block types usable in this type's `blocks` fields. */
  blockTypes?: Record<string, BlockTypeDecl>;
}

/** A delivered entry: its id, type and field values. */
export interface ContentEntry {
  id: string;
  /** The content type key. */
  type?: string;
  fields: Record<string, unknown>;
  [extra: string]: unknown;
}

/** A `blocks` field row (spec 3.3): `{id, blockType, variant?, ...fields}`. */
export interface BlockRow {
  id?: string;
  blockType: string;
  variant?: string | null;
  [field: string]: unknown;
}

/** The keys a block row reserves for itself; never a field. */
export const RESERVED_ROW_KEYS = ['id', 'blockType', 'variant'] as const;

/** A block type's fields under one variant: the base, patched by the variant (omit, add, order). */
export function blockFields(decl: BlockTypeDecl | undefined, variant: string | null | undefined): FieldDecl[] {
  const base = decl?.fields ?? [];
  const patch = variant ? decl?.variants?.find((v) => v.key === variant)?.fields : undefined;
  if (!patch) return base;
  const omit = new Set(patch.omit ?? []);
  const added = patch.add ?? [];
  const addedKeys = new Set(added.map((f) => f.key));
  let fields = [...base.filter((f) => !omit.has(f.key) && !addedKeys.has(f.key)), ...added];
  if (patch.order?.length) {
    const rank = new Map(patch.order.map((k, i) => [k, i]));
    fields = [...fields].sort((a, b) => (rank.get(a.key) ?? Infinity) - (rank.get(b.key) ?? Infinity));
  }
  return fields;
}
