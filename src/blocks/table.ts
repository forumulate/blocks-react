import { h, withRoot } from '../h.js';
import { mergeInto } from '../look.js';
import type { BlockNode } from '../types.js';
import { stampAttrs, tableLookStamp } from './docs-r4.js';
import type { BlockRenderer } from './types.js';

/**
 * The table blocks — docs-schema `render-table.ts`: table, row, cell, header.
 */

/** The alignments a cell may carry (docs-schema `block-types.ts` CELL_ALIGNS). */
export const CELL_ALIGNS = ['left', 'center', 'right'] as const;

/**
 * A cell's `style`, for a column the author aligned. The block model gained
 * `align` so a GFM `:---:` survives the round trip, and a property the reader
 * does not honour is the same loss seen from the page — so the markup carries
 * it too. Written as stored, like the hosted renderer.
 */
function alignStyle(align: unknown): string | null {
  return align ? `text-align:${String(align)}` : null;
}

/** A row whose every cell is a header cell. */
function isHeaderRow(row: BlockNode): boolean {
  if (row.type !== 'tableRow' || !row.content?.length) return false;
  return row.content.every(
    (c) => c.type === 'tableHeader' || (c.type === 'tableCell' && c.attrs?.header === true),
  );
}

const table: BlockRenderer = (node, r) => {
  // Wrapped so a wide table scrolls inside its own box on a phone instead of
  // pushing the whole page past the viewport (.table-wrap).
  //
  // The leading run of all-header rows is the `<thead>`: with every row in
  // `<tbody>` the header tint never applied and the zebra counted the header.
  const rows = node.content ?? [];
  let head = 0;
  while (head < rows.length && isHeaderRow(rows[head]!)) head++;
  const a = node.attrs;
  const collapse =
    typeof a?.collapseAfter === 'number' && rows.length - head > a.collapseAfter ? (a.collapseAfter as number) : null;
  // Body rows past `collapseAfter` carry `data-over`, hidden until "Show more";
  // the hydrator opens the wrap. (Hosted rewrites a leading `<tr`, so only a
  // row that rendered as a `<tr>` is marked.)
  const body = rows.slice(head).map((row, i) => {
    const out = r.blocks([row]);
    return collapse !== null && i >= collapse
      ? withRoot(out, (root) => (root.type === 'tr' ? mergeInto(root, { 'data-over': '' }) : root))
      : out;
  });
  const thead = head ? h('thead', null, r.blocks(rows.slice(0, head))) : null;
  // The table's own wrapping, "Show more" look and code ink per column, after
  // the older hooks — a table without them is the markup it always was.
  return h(
    'div',
    {
      class: 'table-wrap',
      'data-collapse': collapse !== null ? collapse : null,
      'data-sticky': a?.stickyHeader && head ? '' : null,
      ...stampAttrs(tableLookStamp(a)),
    },
    h('table', null, thead, h('tbody', null, ...body)),
    collapse !== null
      ? h('button', { type: 'button', class: 'table-more', 'data-table-more': '' }, 'Show more')
      : null,
  );
};

export const TABLE: Record<string, BlockRenderer> = {
  table,
  tableRow: (node, r) => h('tr', null, r.blocks(node.content)),
  tableCell: (node, r) =>
    h(node.attrs?.header ? 'th' : 'td', { style: alignStyle(node.attrs?.align) }, r.blocks(node.content)),
  tableHeader: (node, r) => h('th', { style: alignStyle(node.attrs?.align) }, r.blocks(node.content)),
};
