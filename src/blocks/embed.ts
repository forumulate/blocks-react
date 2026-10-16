import { h } from '../h.js';
import { href } from '../url.js';
import { embedFrame } from '../vendor/embeds.js';
import { text } from './core.js';
import type { BlockRenderer } from './types.js';

/**
 * An `embed` block — docs-schema `render-embed.ts`: a sandboxed, lazy,
 * referrer-trimmed frame when the URL is a known provider or an origin the
 * owner declared (`frameOrigins`), and a plain link otherwise. The link is not
 * a failure state — a page that cannot frame something still has to say where
 * it is. Which URLs frame, and with which sandbox flags, is ./vendor/embeds
 * (docs-schema `embeds.ts`, byte for byte).
 */
const embed: BlockRenderer = (node, r) => {
  const url: unknown = node.attrs!.url;
  const f = embedFrame(url as string, r.s.opts.frameOrigins ?? []);
  if (!f) {
    return h('div', { class: 'embed' }, h('a', { href: href(url), rel: 'noopener' }, text(url)));
  }
  return h(
    'div',
    { class: 'embed embed-frame', 'data-embed-provider': f.provider },
    h('iframe', {
      src: f.src,
      sandbox: f.sandbox,
      loading: 'lazy',
      allow: f.allow,
      allowfullscreen: true,
      referrerpolicy: f.referrerPolicy,
      title: f.title,
    }),
  );
};

export const EMBED: Record<string, BlockRenderer> = { embed };
