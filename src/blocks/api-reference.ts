import { h, list } from '../h.js';
import type { BlockRenderer } from './types.js';

/**
 * The two API-reference blocks — docs-schema `api-reference-blocks.ts`: a
 * RATE LIMIT card and an ERROR CODES table whose every row is a deep link
 * (`#error-<code>`), the address a support reply points at.
 *
 * Both are static: everything they draw is in the block's own attrs, so a
 * customer site renders them exactly as the hosted reader does. Every value is
 * validated again here, with the hosted renderer's own rules.
 */

// Closed list from docs-schema `RATE_WINDOWS`; the word is the window's name.
export const RATE_WINDOWS = ['second', 'minute', 'hour', 'day'] as const;
// docs-schema's error-code rule: the same characters the id may carry.
export const ERROR_CODE = /^[A-Za-z0-9_.:-]{1,60}$/;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const count = (n: number) => n.toLocaleString('en-US');

/** `rateLimit`: the figure, its scope and burst, the headers that report it, a note. */
const rateLimit: BlockRenderer = (node) => {
  const a = node.attrs;
  if (!a || !Number.isInteger(a.limit) || !(RATE_WINDOWS as readonly unknown[]).includes(a.window)) return null;
  const meta = [str(a.scope), a.burst ? `burst ${count(a.burst)}` : ''].filter(Boolean);
  const headers: unknown[] = Array.isArray(a.headers) ? a.headers : [];
  return h(
    'aside',
    { class: 'api-rate-limit', 'data-fx-rate-limit': '', 'data-window': a.window },
    h(
      'p',
      { class: 'api-rl-figure' },
      h('strong', null, `${count(a.limit)} requests / ${a.window}`),
      meta.length ? ' ' : null,
      meta.length ? h('span', { class: 'api-rl-meta' }, meta.join(' · ')) : null,
    ),
    headers.length
      ? h('ul', { class: 'api-rl-headers' }, list(headers.map((x) => h('li', null, h('code', null, String(x))))))
      : null,
    str(a.note) ? h('p', { class: 'api-rl-note' }, str(a.note)) : null,
  );
};

/** `errorCodes`: one row per code, each its own anchor. */
const errorCodes: BlockRenderer = (node) => {
  const rows = ((node.attrs?.rows ?? []) as { code?: unknown; status?: unknown; description?: unknown }[]).filter(
    (r): r is { code: string; status?: number; description?: string } =>
      !!r && typeof r.code === 'string' && ERROR_CODE.test(r.code),
  );
  if (!rows.length) return null;
  const title = str(node.attrs?.title);
  return h(
    'div',
    { class: 'api-error-codes table-wrap', 'data-fx-error-codes': '' },
    title ? h('p', { class: 'api-ec-title' }, h('strong', null, title)) : null,
    h(
      'table',
      null,
      h('thead', null, h('tr', null, h('th', null, 'Code'), h('th', null, 'Status'), h('th', null, 'Description'))),
      h(
        'tbody',
        null,
        list(
          rows.map((r) =>
            h(
              'tr',
              { id: `error-${r.code}` },
              h('td', null, h('a', { class: 'api-ec-code', href: `#error-${r.code}` }, h('code', null, r.code))),
              h('td', null, r.status ? String(r.status) : ''),
              h('td', null, r.description ?? ''),
            ),
          ),
        ),
      ),
    ),
  );
};

export const API_REFERENCE: Record<string, BlockRenderer> = { rateLimit, errorCodes };
