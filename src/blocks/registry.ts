import { CORE } from './core.js';
import { LAYOUT } from './layout.js';
import { CODE } from './code.js';
import { TABLE } from './table.js';
import { VIDEO } from './video.js';
import { EMBED } from './embed.js';
import { HERO } from './hero.js';
import { IMAGE } from './image.js';
import { INTERACTIVE } from './interactive.js';
import { SHOWCASE } from './showcase.js';
import { DOCS } from './docs.js';
import { DOCS_EXTRA } from './docs-extra.js';
import { PROMPT } from './prompt.js';
import { UPDATES } from './updates.js';
import type { BlockRenderer } from './types.js';

/**
 * Every block type this package draws, by type. A type that is not here is
 * hosted-only (see ../coverage.ts) and renders nothing unless the site
 * overrides it.
 */
export const RENDERERS: Readonly<Record<string, BlockRenderer>> = {
  ...CORE,
  ...LAYOUT,
  ...CODE,
  ...TABLE,
  ...VIDEO,
  ...EMBED,
  ...IMAGE,
  ...INTERACTIVE,
  ...SHOWCASE,
  ...HERO,
  ...DOCS,
  ...DOCS_EXTRA,
  ...PROMPT,
  ...UPDATES,
};
