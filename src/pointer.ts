/**
 * Field paths and the click-to-edit attribute.
 *
 * A path addresses a value inside an entry's fields: keys for fields, and
 * `{id}` for a row of an `array` or `blocks` field — by its stable row id,
 * never by index, because an index goes stale the moment someone reorders
 * during live preview. Its wire form is a JSON pointer where a row segment is
 * `@<id>`: `/layout/@k3f9a/heading` (CMS spec 3.2).
 */

export type PathSegment = string | { id: string };
export type FieldPath = readonly PathSegment[] | string;

/** RFC 6901 escaping for a key segment (`~` → `~0`, `/` → `~1`). */
const escapeKey = (k: string) => k.replace(/~/g, '~0').replace(/\//g, '~1');

/** A path in its pointer form; a string is taken as already being one. */
export function toPointer(path: FieldPath): string {
  if (typeof path === 'string') return path.startsWith('/') || path === '' ? path : `/${path}`;
  return path.map((seg) => (typeof seg === 'string' ? `/${escapeKey(seg)}` : `/@${seg.id}`)).join('');
}

/** A path as segments; a pointer string is parsed (`@id` → `{id}`). */
export function pathSegments(path: FieldPath | undefined): PathSegment[] {
  if (!path) return [];
  if (typeof path !== 'string') return [...path];
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => (s.startsWith('@') ? { id: s.slice(1) } : s.replace(/~1/g, '/').replace(/~0/g, '~')));
}

/** A path one level deeper. */
export function childPath(path: readonly PathSegment[], seg: PathSegment): PathSegment[] {
  return [...path, seg];
}

/**
 * The attribute the studio's click-to-edit bridge looks for —
 * `data-fm-field="<entryId>:<pointer>"` — or nothing.
 *
 * Nothing unless `preview` is on: the attribute names the entry and the field,
 * which production HTML has no reason to carry (and a test asserts it never
 * does). Spread the result onto any element:
 * `<h1 {...fieldAttrs(entry.id, ['title'], preview)}>`.
 */
export function fieldAttrs(
  entryId: string | null | undefined,
  path: FieldPath,
  preview: boolean | undefined,
): { 'data-fm-field'?: string } {
  if (preview !== true || !entryId) return {};
  return { 'data-fm-field': `${entryId}:${toPointer(path)}` };
}
