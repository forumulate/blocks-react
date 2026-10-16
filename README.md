# @forumulate/blocks-react

Render [Forumulate](https://forumulate.com) content in React with the same markup the hosted
reader serves: rich text, CMS blocks fields, whole entries and media. Works in React Server
Components, SSR and static export (no hooks, no context, no `window`), makes no network
requests of its own, and has no runtime dependencies beyond React 18+.

```sh
npm install @forumulate/blocks-react
```

## Rich text

```tsx
import { RichText } from '@forumulate/blocks-react';

<article className="prose">
  <RichText doc={entry.fields.body} />
</article>;
```

`<RichText>` renders no wrapper element of its own. It takes the hosted renderer's options
under the same names: `imageProxy`, `imageSize`, `imageSrcset`, `headingAnchors`, `idPrefix`
(give it one per document when a page shows two), `footnotes` (`popover` | `margin` | `end`),
`variables`, `sections`, `heroHeading`, `dedupeTitle` and `frameOrigins`.

## A blocks field

```tsx
import { Blocks } from '@forumulate/blocks-react';

<Blocks blocks={entry.fields.layout} overrides={{ hero: MyHero }} />;
```

Each row is `{ id, blockType, variant?, ...fields }`. The built-in block types (hero,
pricing, testimonials, stats, person, logo wall, cards, columns and the rest) render exactly
as the hosted reader renders them. Block types you defined yourself render field by field;
pass `blockTypes` (their declarations) so each field renders by its type. Any type listed in
`overrides` renders through your component, which receives `block`, `fields`, `path`,
`preview`, `attrs` (the click-to-edit attribute) and our rendering as `children`.

## Any entry, from its schema

```tsx
import { Content } from '@forumulate/blocks-react';

<Content
  entry={entry}
  schema={schema.types.page}
  schemas={schema.types}
  overrides={{
    blocks: { hero: MyHero },
    fields: { 'pricing.tiers': Tiers },
    types: { richText: MyRichText },
    contentTypes: { author: AuthorCard },
  }}
/>;
```

Every field type has a default renderer: text as text, `richText` as `<RichText>`, `media` as
`<FmImage>` (a `<figure>` when it has a caption), `link` and `url` as `<a>`, `blocks` as
`<Blocks>`, `group` and `array` as their sub-fields, `reference` as the referenced entry
(down to `depth`, default 2), `date`/`datetime` as `<time>`, `money` as a formatted amount,
`code` as `<pre><code>`, `computed` as its value. `json`, `color`, `seo` and `boolean` are data
and render nothing by default. Fields marked `internal` never render. Overrides apply to
the most specific match first: field path, then block type, then field type, then content
type. Dates and amounts are formatted for `locale` (default `en`) and `timeZone` (default
`UTC`), so server and browser always print the same string.

## Click-to-edit in preview

```tsx
const { isEnabled } = await draftMode(); // Next.js
<Content entry={entry} schema={schema} preview={isEnabled} />;
```

With `preview` on, every field, array row and block carries
`data-fm-field="<entryId>:<path>"` (for example `e1:/layout/@k3f9a/heading`), which the
Forumulate studio uses to open that field when an editor double-clicks it on your site. With
`preview` off, the default, the attribute is never printed. For your own markup:

```tsx
import { Field, fieldAttrs } from '@forumulate/blocks-react';

<Field entryId={entry.id} path={['pricing', 'tiers', { id: tier.id }, 'name']} preview={isEnabled}>
  <h3>{tier.name}</h3>
</Field>
<h1 {...fieldAttrs(entry.id, ['title'], isEnabled)}>{entry.fields.title}</h1>
```

## Images

```tsx
import { FmImage, nextImageProps } from '@forumulate/blocks-react';
import Image from 'next/image';

<FmImage media={entry.fields.cover} sizes="(max-width: 768px) 100vw, 50vw" priority />
<FmImage media={entry.fields.cover} as={Image} sizes="100vw" />
<Image {...nextImageProps(entry.fields.cover, { sizes: '100vw' })} />
```

`<FmImage>` takes the delivery media object (`{url, width, height, alt, focal, blurDataURL,
variants}`). It builds a `srcset` from the resized copies the API already has, reserves the
box from the stored size, crops around the focal point (`fit="cover"`), shows the blurred
placeholder while loading, and is lazy unless `priority`. `fmImageLoader(media)` is a
`next/image` loader that always asks for a width the API serves.

## Extended icons

Headings, grid cells and inline icons can name our own glyphs (always included) or the
extended Lucide set. The extended set is about 35 KB of path data, so it is opt-in:

```tsx
import { lucideIcons } from '@forumulate/blocks-react/icons';
<RichText doc={doc} icons={lucideIcons} />;
```

Without it, an extended icon name renders nothing (never the word).

## What it does not draw

A few blocks only make sense on the hosted reader: live forms and RSVPs, the API
reference, live status badges, scroll-driven motion, maps, community feeds, extension
blocks, per-visitor audience blocks and course knowledge checks. They are listed with reasons in
`HOSTED_ONLY_TYPES`. Such a block renders nothing (as an unknown type does on the hosted
reader) and calls `onUnsupported(node)`, and you can draw it yourself with
`overrides={{ form: MyForm }}`.

One difference React imposes: an inactive tab panel is printed `hidden` rather than
`hidden="until-found"` (React 19 prints `hidden` as a boolean). It looks the same; only the
browser's find-in-page will not open the tab.

A prompt with `textStyle: prose` keeps every word, a paragraph per blank-line run, but
not its inline markdown (bold, code, lists): the hosted page parses it with a markdown
parser this package does not carry, to stay small.

## Styling

The markup uses the hosted reader's class names (`doc-hero`, `doc-pricing`, `cf-code-block`,
`tabs`…), so you can either style them yourself or start from the reader's stylesheet. The
CMS renderers add `fm-entry`, `fm-block fm-block--<type>`, `fm-field fm-field--<type>` with
`data-field="<key>"`, and `fm-row` for array rows.

## License

MIT

---

## About this repository

This repository is a public mirror, refreshed on each Forumulate release
(one commit per release). Pull requests are welcome; accepted changes are
applied upstream and arrive here with the next release.

- API reference: https://forumulate.com/reference
- Guides: https://forumulate.com/guides
- Community and support: https://forumulate.com/community
- Source: https://github.com/forumulate/blocks-react
