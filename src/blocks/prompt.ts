import type { ReactNode } from 'react';
import { h, hRaw, list, type HtmlAttrs } from '../h.js';
import { richIcon } from '../icons.js';
import type { Attrs, BlockNode } from '../types.js';
import { text } from './core.js';
import { iconSpan } from './docs.js';
import { promptR5 } from './docs-r5.js';
import type { BlockRenderer, R } from './types.js';

/**
 * The prompt block — docs-schema `render-prompt.ts` and `render-prompt-r4.ts`:
 * a copyable AI prompt whose "Open in …" links work with no JS. Several
 * providers so a reader uses their own assistant; `targets` narrows them,
 * `actions` adds a copy button. Every attribute prints only when set.
 *
 * Each look key on the hosted page resolves block attr → the theme's
 * `docs.blocks.prompt` → nothing. A customer site has no theme defaults, so
 * here it is block attr → nothing (what the hosted page prints with none).
 */

// Closed lists from docs-schema (constants-parity checks them).
/** `render-context.ts`: id, label, URL prefix the prompt is appended to. */
export const PROMPT_PROVIDERS: readonly (readonly [string, string, string])[] = [
  ['chatgpt', 'ChatGPT', 'https://chatgpt.com/?q='],
  ['claude', 'Claude', 'https://claude.ai/new?q='],
  ['codex', 'Codex', 'https://chatgpt.com/codex?prompt='],
  ['cursor', 'Cursor', 'cursor://anysphere.cursor-deeplink/prompt?text='],
];
/** `block-types.ts`. */
export const PROMPT_VARIANTS = ['card', 'compact', 'pill'] as const;
/** `block-types-r4.ts`. */
export const PROMPT_LAYOUTS = ['inline', 'stacked'] as const;
export const PROMPT_PRIMARY = ['copy', 'open'] as const;
export const PROMPT_HEADERS = ['label', 'tabs'] as const;
export const PROMPT_COPY_STYLES = ['button', 'icon'] as const;

/** The copy control as a glyph alone (the web app's IconCopy). */
const COPY_GLYPH =
  '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">' +
  '<rect x="5.5" y="5.5" width="8" height="8" rx="1.2"/><path d="M10.5 5.5V3.2c0-.4-.3-.7-.7-.7H3.2c-.4 0-.7.3-.7.7v6.6c0 .4.3.7.7.7h2.3"/></svg>';

/** The "More" menu's chevron — the menu is a native `<details>`, so it works with no JS. */
const MORE_GLYPH =
  '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>';

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;

/** `promptLook` (round 4): the layout, the filled action, the copy as a glyph. */
function promptLook(a: Attrs, variant: string): { layout: string; copyStyle: string; data: HtmlAttrs } {
  // A pill is one line already: a stacked pill would be a card.
  const layout = variant === 'pill' ? 'inline' : (oneOf(PROMPT_LAYOUTS, a.layout) ?? 'inline');
  const copyStyle = oneOf(PROMPT_COPY_STYLES, a.copyStyle) ?? 'button';
  const primary = oneOf(PROMPT_PRIMARY, a.primary);
  // The tab strip only exists around a prompt inside `tabs`; elsewhere the hook is inert.
  const header = oneOf(PROMPT_HEADERS, a.header);
  const own = a.phoneTargets;
  const phone = typeof own === 'number' && Number.isInteger(own) && own >= 1 && own <= 6 ? own : null;
  return {
    layout,
    copyStyle,
    data: {
      'data-layout': layout === 'stacked' ? 'stacked' : null,
      'data-primary': primary,
      'data-header': header === 'tabs' ? 'tabs' : null,
      'data-copy-style': copyStyle === 'icon' ? 'icon' : null,
      'data-phone-targets': phone !== null ? String(phone) : null,
    },
  };
}

/**
 * A prompt's text as prose (`textStyle: prose`). The hosted page parses it as
 * markdown (`markdownToDoc`: inline marks, lists) — a parser this package does
 * not carry. Here it is the words alone, a paragraph per blank-line-separated
 * run, a line break inside one read as a space (as markdown reads it): the same
 * markup for plain text, and every word kept for anything richer.
 */
function proseBlocks(words: string): BlockNode[] {
  const paras = words
    .split(/\n[ \t]*\n/)
    .map((para) =>
      para
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
    .map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] }));
  // Markdown reads blank text as one empty paragraph, so the hosted body is
  // `<p></p>`, not empty: the body keeps its height either way.
  return paras.length ? paras : [{ type: 'paragraph' }];
}

/** The variant this prompt draws: its own, else the card. */
function variantOf(a: Attrs): 'card' | 'compact' | 'pill' {
  const pick = a.variant ?? 'card';
  return (PROMPT_VARIANTS as readonly string[]).includes(pick) ? pick : 'card';
}

function renderPrompt(node: BlockNode, r: R): ReactNode {
  const s = r.s;
  const a = node.attrs!;
  const variant = variantOf(a);
  const pill = variant === 'pill';
  const label = text(a.label ?? 'Prompt');
  const words = text(a.text ?? '');
  const q = encodeURIComponent(words);
  // `targets` holds provider ids AND logos; each list reads its own kind.
  const targets: unknown[] = Array.isArray(a.targets) ? a.targets : [];
  const ids = targets.filter((t) => typeof t === 'string') as string[];
  const logos = targets.filter(
    (t): t is Attrs => !!t && typeof t === 'object' && typeof (t as Attrs).icon === 'string',
  );
  // A pill is one line: copy is its action unless the author asked for links.
  const actions = a.actions?.length ? a.actions : pill ? ['copy'] : ['open'];
  const providers = ids.length ? PROMPT_PROVIDERS.filter(([id]) => ids.includes(id)) : PROMPT_PROVIDERS;
  const openLinks = actions.includes('open') ? providers : [];
  const links = (cls: string) =>
    list(
      openLinks.map(([id, plabel, prefix]) =>
        h(
          'a',
          { class: cls, 'data-provider': id, href: prefix + q, target: '_blank', rel: 'noopener' },
          `Open in ${plabel} ↗`,
        ),
      ),
    );
  const hasLinks = openLinks.length > 0;
  const r4 = promptLook(a, variant);
  const r5 = promptR5(a);
  const copy = !actions.includes('copy')
    ? null
    : pill || r4.copyStyle === 'icon'
      ? hRaw(
          'button',
          {
            type: 'button',
            class: 'prompt-copy prompt-copy--icon',
            'data-prompt-copy': '',
            'aria-label': 'Copy prompt',
            title: 'Copy prompt',
          },
          COPY_GLYPH,
        )
      : h('button', { type: 'button', class: 'prompt-copy', 'data-prompt-copy': '' }, 'Copy prompt');
  // A glyph before the label (the hosted theme's default glyph does not exist here).
  const glyph = typeof a.icon === 'string' && a.icon.trim() ? a.icon : undefined;
  const icon = iconSpan('prompt-icon', glyph, s);
  const logo = logos.length
    ? h(
        'span',
        { class: 'prompt-logos' },
        list(
          logos.map((l) =>
            richIcon(l.icon, 'prompt-logo', { proxy: s.opts.imageProxy, icons: s.opts.icons, label: l.label }),
          ),
        ),
      )
    : null;
  const collapse = !pill && typeof a.collapse === 'number' && a.collapse >= 1 && a.collapse <= 40 ? a.collapse : null;
  const open: HtmlAttrs = {
    class: 'forumulate-prompt',
    'data-prompt': words,
    'data-variant': variant !== 'card' ? variant : null,
    'data-wrap': a.wrap ? '' : null,
    'data-align': a.align === 'center' ? 'center' : null,
    'data-text-style': a.textStyle === 'prose' ? 'prose' : null,
    'data-collapse': collapse ? '' : null,
    ...r4.data,
    ...r5.data,
    style: r5.vars.length ? r5.vars.join(';') : null,
  };
  // The "Open in …" links past the desktop limit, folded into a native "More"
  // menu drawn HERE so the row is its final width on first paint. Every link is
  // listed; the stylesheet hides the first `limit`.
  const limit = r5.desktop;
  const deskMenu =
    pill || limit === null || openLinks.length <= limit || !hasLinks
      ? null
      : h(
          'details',
          { class: 'prompt-menu prompt-menu--desk', 'data-popover': '' },
          hRaw(
            'summary',
            { class: 'prompt-menu-btn', 'data-prompt-more-targets': '' },
            `<span>More</span>${MORE_GLYPH}`,
          ),
          h('div', { class: 'prompt-menu-list' }, links('prompt-menu-item')),
        );
  if (pill) {
    // Logos first, the text on ONE line (ellipsis), the copy glyph last.
    return h(
      'div',
      open,
      logo,
      icon,
      a.label ? h('span', { class: 'prompt-label' }, label) : null,
      a.showText === false ? null : h('span', { class: 'prompt-pill-text' }, words),
      hasLinks ? h('span', { class: 'prompt-providers' }, links('prompt-open')) : null,
      copy,
    );
  }
  const lines = collapse ? `--prompt-lines:${collapse}` : null;
  const body =
    a.showText === false
      ? null
      : a.textStyle === 'prose'
        ? h('div', { class: 'prompt-body prompt-prose', style: lines }, r.blocks(proseBlocks(words)))
        : h('pre', { class: 'prompt-body', style: lines }, h('code', null, words));
  // The fold's button, wired (and translated) by the hosted hydrator.
  const more =
    collapse && body
      ? h(
          'button',
          {
            type: 'button',
            class: `prompt-more${r5.collapsePill ? ' prompt-more--pill' : ''}`,
            'data-prompt-more': '',
            'aria-expanded': 'false',
          },
          'Show more',
        )
      : null;
  // The pill-style fold floats over the fade, so it shares a box with the body.
  const folded = more && r5.collapsePill ? [h('div', { class: 'prompt-fold' }, body, more)] : [body, more];
  const providersRow = h('div', { class: 'prompt-providers' }, links('prompt-open'));
  const labelSpan = h('span', { class: 'prompt-label' }, label);
  // `stacked`: the head names the prompt, the actions row sits under the text.
  if (r4.layout === 'stacked')
    return h(
      'div',
      open,
      h('div', { class: 'prompt-head' }, logo, icon, labelSpan),
      ...folded,
      h('div', { class: 'prompt-actions' }, copy, providersRow, deskMenu),
    );
  return h('div', open, h('div', { class: 'prompt-head' }, logo, icon, labelSpan, copy, providersRow, deskMenu), ...folded);
}

export const PROMPT: Record<string, BlockRenderer> = { prompt: (node, r) => renderPrompt(node, r) };
