import type { ReactElement, ReactNode } from 'react';
import { h, list } from '../h.js';

/**
 * The tabs shell — docs-schema `render-tabs.ts`, shared by the tabs block and
 * the code group: a real ARIA tablist paired to its panels by index. The first
 * panel shows with no script; the rest are `hidden="until-found"` (their words
 * stay findable and indexable). The hosted hydrator switches panels; on a
 * customer site the same markup works with any tabs script, and is readable
 * without one.
 */

export interface TabsShellOptions {
  className?: string;
  navClass?: string;
  syncKey?: string;
}

/** docs-schema `hashScope`: a short, stable id from a string (FNV-1a, base 36). */
export function hashScope(input: string): string {
  let x = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    x ^= input.charCodeAt(i);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return x.toString(36);
}

export function tabsShell(items: { title: string; body: ReactNode }[], opts: TabsShellOptions = {}): ReactElement {
  const gid = `cf-tabs-${hashScope(items.map((t) => t.title).join('\u0000'))}`;
  const nav = items.map((t, i) => {
    const on = i === 0;
    return h(
      'li',
      {
        class: `tabs-nav-item${on ? ' is-active' : ''}`,
        role: 'tab',
        id: `${gid}-tab-${i}`,
        'aria-controls': `${gid}-panel-${i}`,
        'aria-selected': String(on),
        tabindex: on ? '0' : '-1',
        'data-tab-index': i,
        'data-tab-title': t.title,
      },
      t.title,
    );
  });
  const panels = items.map((t, i) => {
    const on = i === 0;
    return h(
      'div',
      {
        class: `tab${on ? ' is-active' : ''}`,
        role: 'tabpanel',
        id: `${gid}-panel-${i}`,
        'aria-labelledby': `${gid}-tab-${i}`,
        'data-tab-index': i,
        'data-title': t.title,
        hidden: on ? null : 'until-found',
      },
      t.body,
    );
  });
  return h(
    'div',
    {
      class: opts.className ? `tabs ${opts.className}` : 'tabs',
      'data-tabs': '',
      id: gid,
      'data-sync-key': opts.syncKey || null,
    },
    h('ul', { class: opts.navClass ? `tabs-nav ${opts.navClass}` : 'tabs-nav', role: 'tablist' }, list(nav)),
    list(panels),
  );
}
