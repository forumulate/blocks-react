import { RENDERERS } from './blocks/registry.js';

/**
 * Which docs-schema node types this package draws, and which it leaves to the
 * hosted reader — with the reason, so the boundary is a decision written
 * down rather than a gap. test/coverage.test.ts walks docs-schema's
 * `BLOCK_STRUCTURE` and fails on a type that is in neither list, so a block
 * added to the model cannot silently render nothing on customer sites.
 *
 * A hosted-only node renders nothing (as an unknown type does on the hosted
 * reader), calls `onUnsupported`, and can be drawn by the site through
 * `overrides`.
 */

/** Every node type `<RichText>` and `<Blocks>` render with the hosted markup. */
export const SUPPORTED_TYPES: readonly string[] = Object.keys(RENDERERS).sort();

/** Node types that need the hosted reader, and why. */
export const HOSTED_ONLY_TYPES: Readonly<Record<string, string>> = {
  layer: 'scroll-linked motion driven by the hosted reader script',
  story: 'scroll-linked sticky story driven by the hosted reader script',
  storyStep: 'part of a story',
  playground: 'a live code demo that runs in a hosted sandbox',
  officeMap: 'map tiles are third-party requests; draw your own map',
  form: 'posts to the hosted form engine with a live definition only the hosted reader holds',
  contactForm: 'a contact space’s live form (hosted data)',
  event: 'reads the hosted events calendar',
  eventRsvp: 'posts RSVPs to the hosted events service',
  systemStatus: 'a live status badge read from a hosted status page',
  openapi: 'the API reference needs the hosted spec context',
  walkthrough: 'the API walkthrough needs the hosted spec context',
  walkthroughStep: 'part of a walkthrough',
  reusableRef: 'a hosted snippet; delivery resolves shared blocks before they reach a site',
  extensionBlock: 'rendered by a signed server call to the extension',
  audience: 'resolved per visitor by the hosted reader',
  spaceFeed: 'a live feed of a hosted space',
  spaceCategories: 'a live list of a hosted forum’s categories',
  spaceBand: 'a live band of a hosted space',
  spaceLeaderboard: 'a live leaderboard of a hosted community',
  quiz: 'a course knowledge check: the hosted course page mounts it (renderToHtml draws nothing)',
};
