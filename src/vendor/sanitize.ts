/**
 * What a customer's own markup is allowed to be.
 *
 * A block of hand-written HTML is the escape hatch that keeps a page builder
 * honest: no palette covers everything, and the alternative to this is a
 * feature request per embed. It is also the one place a customer's input is
 * rendered as markup on their readers' screens, so it is sanitised here, on the
 * way in AND on the way out, rather than trusted at either end.
 *
 * The rules are deliberately blunt: nothing that executes, nothing that
 * navigates somewhere unsafe, nothing that posts. Everything a marketing page
 * actually needs — layout, text, images, links, tables, SVG — survives.
 */

// Formatting tags the renderer emits from marks — `<kbd>`, `<mark>`, `<sup>`,
// `<u>`, `<s>` … — are deliberately NOT blocked either: they are inert, carry no
// attributes we gate, and a custom HTML block that hand-writes `<kbd>Ctrl</kbd>`
// should render exactly like the kbd mark does.
//
// `img` is deliberately NOT blocked: the renderer cooks a custom-emoji
// `:shortcode:` into <img class="emoji" src=…>, and custom HTML blocks embed
// images too. An <img> cannot execute script (an SVG loaded as an image is
// inert), and the src is gated by isDangerousAttr below, so it is safe to keep.
const BLOCKED_TAGS = [
  'script',
  'style',
  'link',
  'meta',
  'base',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'noscript',
  'template',
];

/** Attributes that execute, navigate somewhere unsafe, or reach out of the page. */
function isDangerousAttr(name: string, value: string): boolean {
  const attr = name.toLowerCase();
  if (attr.startsWith('on')) return true;
  if (attr === 'srcdoc') return true;
  if (['href', 'src', 'action', 'formaction', 'xlink:href', 'data'].includes(attr)) {
    /*
     * Stripping control chars is the point — attackers hide `java\0script:`.
     *
     * The pattern is a named const so the eslint exemption stays ATTACHED to
     * it: as an inline `.replace(/…/)` in a method chain, prettier moved the
     * regex onto its own line and left `eslint-disable-next-line` pointing at
     * `const url = value`, which re-broke the lint on a file nobody had edited.
     */
    // eslint-disable-next-line no-control-regex
    const CONTROL_CHARS = /[\s\u0000-\u001f]/g;
    const url = value.trim().toLowerCase().replace(CONTROL_CHARS, '');
    return (
      url.startsWith('javascript:') ||
      url.startsWith('data:text/html') ||
      url.startsWith('vbscript:')
    );
  }
  return false;
}

/**
 * Strip what must never render, and leave the rest alone.
 *
 * An allow-list of tags would make the escape hatch useless — the point of it
 * is the markup we did not think of. The rule is "nothing executes", enforced
 * by removing every way to execute.
 */
export function sanitizeCustomHtml(html: string): string {
  let out = html;
  for (const tag of BLOCKED_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }
  out = out.replace(
    /\s([a-zA-Z_:][-\w:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g,
    (match, name: string, _quoted: string, dq: string, sq: string, bare: string) => {
      const value = dq ?? sq ?? bare ?? '';
      return isDangerousAttr(name, value) ? '' : match;
    },
  );
  // A bare `javascript:` that survived because it carried no quotes at all.
  out = out.replace(/javascript\s*:/gi, '');
  return out;
}

/*
 * The customer's CSS, confined to their block — a real parser now, in
 * ./css-scope, because a regex could not see inside `@media` (see there).
 * Re-exported from here, where every caller has always imported it.
 */
export { scopeCustomCss } from './css-scope.js';
