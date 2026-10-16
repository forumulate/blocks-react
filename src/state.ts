import type { ReactNode } from 'react';
import type { Attrs } from './types.js';
import type { RenderOptions } from './options.js';

/**
 * Everything one render counts as it goes: the ids handed out, footnote and
 * margin-note numbers, how many pictures came before, whether the hero
 * heading is still to come.
 *
 * docs-schema keeps these as module-level variables reset by `renderToHtml`
 * (its render is one synchronous call). Here they are one object made fresh
 * per `<RichText>` render and threaded through, so a render is a pure
 * function of its props: StrictMode's double render, concurrent rendering
 * and two documents on one page all see the same numbers.
 */
export interface RenderState {
  opts: RenderOptions;
  takenIds: Set<string>;
  anchorsOn: boolean;
  idPrefix: string;
  sideNo: number;
  endNotes: string[];
  /** The margin notes met inside the paragraph being rendered, or null outside one. */
  paraNotes: ReactNode[] | null;
  imagesRendered: number;
  heroPending: boolean;
  /** The attrs of the stepper whose steps are rendering now (a step reads its heading level from it). */
  stepper: Attrs | undefined;
}

export function newState(opts: RenderOptions): RenderState {
  return {
    opts,
    takenIds: new Set(),
    anchorsOn: opts.headingAnchors !== false,
    idPrefix: opts.idPrefix ?? '',
    sideNo: 0,
    endNotes: [],
    paraNotes: null,
    imagesRendered: 0,
    heroPending: opts.heroHeading === true,
    stepper: undefined,
  };
}

/** A page-unique id from a base: `base`, then `base-2`, `base-3`… (the same ledger headings use). */
export function uniqueId(s: RenderState, raw: string): string {
  const base = s.idPrefix + raw;
  if (!s.takenIds.has(base)) {
    s.takenIds.add(base);
    return base;
  }
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!s.takenIds.has(candidate)) {
      s.takenIds.add(candidate);
      return candidate;
    }
  }
}
