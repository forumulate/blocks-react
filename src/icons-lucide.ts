import { LUCIDE_ICON_PATHS } from './vendor/icon-set-lucide.js';
import type { IconSet } from './icons.js';

/**
 * The extended icon set the hosted reader draws (Lucide, ISC), as an opt-in
 * subpath: `<RichText doc={d} icons={lucideIcons} />`. Kept out of the main
 * entry so a site that never uses an extended icon never ships its paths.
 */
export const lucideIcons: IconSet = {
  svg(name: string): string | null {
    if (!Object.prototype.hasOwnProperty.call(LUCIDE_ICON_PATHS, name)) return null;
    return (
      '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      LUCIDE_ICON_PATHS[name] +
      '</svg>'
    );
  },
};
