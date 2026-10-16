import type { ReactNode } from 'react';
import { h, hRaw } from '../h.js';
import type { RenderState } from '../state.js';
import type { Attrs, BlockNode } from '../types.js';
import { codeLanguageLabel } from '../vendor/code-language.js';
import { routeCssImages, routeHtmlImages } from '../vendor/custom-code-images.js';
import { sanitizeCustomHtml, scopeCustomCss } from '../vendor/sanitize.js';
import { text } from './core.js';
import { codeLookStamp, stampAttrs } from './docs-r4.js';
import { hashScope, tabsShell } from './tabs-shell.js';

/**
 * The code-family renders that are not a single block — docs-schema
 * `render-code.ts`: the code group, the HTML preview a code block can carry —
 * and the `customCode` block (`render.ts`), which shares the preview's
 * sanitiser path.
 *
 * WHY raw HTML is safe here: the customer's markup goes through
 * ./vendor/sanitize — the SAME sanitiser, byte for byte, the hosted page runs
 * on the way out (nothing executes, nothing navigates somewhere unsafe), its
 * CSS through the same scoper, its pictures through the same image rule. The
 * hosted reader trusts exactly this output; injecting it with
 * `dangerouslySetInnerHTML` inside the same wrapper trusts nothing more.
 */

export type RenderChild = (node: BlockNode, s: RenderState, opts: { inGroup: boolean }) => ReactNode;

/**
 * A code group: the children as tabs in ONE code header. The tabs markup is the
 * tabs block's own, so any tab wiring (keyboard, same-title sync, `syncKey`)
 * works unchanged, and with JS off the first sample shows.
 */
export function codeGroup(node: BlockNode, s: RenderState, renderChild: RenderChild): ReactNode {
  // The group's `lineNumbers` numbers every sample that does not say. `false`
  // counts as not saying: the editor stores it as every block's default.
  const groupLines = node.attrs?.lineNumbers;
  const kids = (node.content ?? [])
    .filter((c) => c?.type === 'codeBlock')
    .map((c) =>
      groupLines !== undefined && groupLines !== null && (c.attrs?.lineNumbers ?? false) === false
        ? { ...c, attrs: { ...(c.attrs ?? {}), lineNumbers: groupLines } }
        : c,
    );
  if (kids.length === 0) return null;
  const items = kids.map((child, i) => {
    const t = typeof child.attrs?.title === 'string' ? child.attrs.title.trim() : '';
    return {
      title: t || codeLanguageLabel(child.attrs?.language) || `Tab ${i + 1}`,
      body: renderChild(child, s, { inGroup: true }),
    };
  });
  const a = node.attrs;
  const variant = a?.picker === 'dropdown' ? 'dropdown' : 'tabs';
  const title = typeof a?.title === 'string' ? a.title.trim() : '';
  const syncKey = typeof a?.syncKey === 'string' && /^[a-z0-9-]{1,40}$/i.test(a.syncKey) ? a.syncKey : undefined;
  // The group's own frame, chip, title face and strip.
  return h(
    'figure',
    { class: 'cf-code-group', 'data-variant': variant, 'data-title': title ? '' : null, ...stampAttrs(codeLookStamp(a)) },
    title ? h('figcaption', { class: 'cf-code-group-title' }, title) : null,
    tabsShell(items, { className: 'cf-code-group-tabs', navClass: 'cf-code-group-nav', syncKey }),
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The scoped `<style>` for a customer's CSS, as markup (see the file comment). */
function styleHtml(css: unknown, scope: string, s: RenderState): string {
  return css ? `<style>${routeCssImages(scopeCustomCss(css as string, scope), s.opts.imageProxy)}</style>` : '';
}

/**
 * An HTML sample drawn above its own source, inside the same frame. Exactly
 * the custom-code path: sanitised markup, the sample's CSS scoped to it, its
 * pictures routed through the image rule. Only for `language: html`.
 */
export function codePreview(node: BlockNode, s: RenderState): ReactNode {
  const p = node.attrs?.preview;
  const lang = (node.attrs?.language ?? '').toLowerCase();
  if (!p || lang !== 'html') return null;
  const html = (node.content ?? []).map((t) => t.text).join('');
  const o: Attrs = p === true ? {} : p;
  const scope = `fx-${hashScope(`preview:${html}${o.css ?? ''}`)}`;
  const vars = [
    o.background && HEX.test(o.background) ? `--cf-pv-bg:${o.background}` : '',
    o.backgroundDark && HEX.test(o.backgroundDark) ? `--cf-pv-bg-dark:${o.backgroundDark}` : '',
    typeof o.minHeight === 'number' ? `--cf-pv-min:${Math.min(800, Math.max(40, o.minHeight))}px` : '',
  ].filter(Boolean);
  return hRaw(
    'div',
    {
      class: `cf-code-preview custom-code ${scope}`,
      'data-pattern': o.pattern && o.pattern !== 'none' ? text(o.pattern) : null,
      'data-align': o.align ? text(o.align) : null,
      style: vars.length ? vars.join(';') : null,
    },
    styleHtml(o.css, scope, s) + routeHtmlImages(sanitizeCustomHtml(html), s.opts.imageProxy),
  );
}

/**
 * A customer's own markup, sanitised on the way out as well as on the way in —
 * the document may predate a rule, or come from an API caller that skipped the
 * editor. Its pictures obey the same address rule as an image block's.
 */
export function customCode(node: BlockNode, s: RenderState): ReactNode {
  const a = node.attrs!;
  const html = text(a.html);
  const scope = `fx-${hashScope(html + (a.css ?? ''))}`;
  return hRaw(
    'div',
    { class: `custom-code ${scope}` },
    styleHtml(a.css, scope, s) + routeHtmlImages(sanitizeCustomHtml(html), s.opts.imageProxy),
  );
}
