import { safeImageUrl, type ImageProxy } from './url.js';

/**
 * The delivery API's media object (CMS spec 3.9) and the pure helpers
 * `<FmImage>` is built from — usable on their own with `<picture>`,
 * `next/image` or any other image component.
 */
export interface DeliveryMedia {
  url: string;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  caption?: string | null;
  /** The point to keep in view when cropping, 0–1 from the top-left. */
  focal?: { x: number; y: number } | null;
  /** A tiny inline placeholder (a `data:` URL) shown while the picture loads. */
  blurDataURL?: string | null;
  /** Resized copies by width: `{ "640": url, "1280": url }`. */
  variants?: Record<string, string> | null;
}

/** Is this value shaped like a delivery media object? */
export function isDeliveryMedia(v: unknown): v is DeliveryMedia {
  return !!v && typeof v === 'object' && typeof (v as DeliveryMedia).url === 'string';
}

const address = (url: unknown, proxy?: ImageProxy): string => {
  const safe = safeImageUrl(url);
  return proxy && safe ? (proxy(safe) ?? safe) : safe;
};

/** The variants as `[width, url]`, narrowest first, unsafe or malformed entries dropped. */
export function variantList(media: DeliveryMedia, proxy?: ImageProxy): [number, string][] {
  const out: [number, string][] = [];
  for (const [w, url] of Object.entries(media.variants ?? {})) {
    const width = Number(w);
    const a = address(url, proxy);
    if (Number.isInteger(width) && width > 0 && a) out.push([width, a]);
  }
  return out.sort((x, y) => x[0] - y[0]);
}

/** `url 640w, url 1280w`, or undefined when there is nothing to choose between. */
export function srcSetOf(media: DeliveryMedia, proxy?: ImageProxy): string | undefined {
  const list = variantList(media, proxy);
  return list.length ? list.map(([w, u]) => `${u} ${w}w`).join(', ') : undefined;
}

/** The focal point as `object-position`, so a `cover` crop keeps the subject. */
export function objectPosition(focal: DeliveryMedia['focal']): string | undefined {
  if (!focal || typeof focal.x !== 'number' || typeof focal.y !== 'number') return undefined;
  const pct = (n: number) => `${Math.round(Math.min(1, Math.max(0, n)) * 1000) / 10}%`;
  return `${pct(focal.x)} ${pct(focal.y)}`;
}

/**
 * The narrowest variant at least `width` wide (the widest when none is), or
 * the original — what an image component's loader asks for.
 */
export function variantFor(media: DeliveryMedia, width: number, proxy?: ImageProxy): string {
  const list = variantList(media, proxy);
  const hit = list.find(([w]) => w >= width) ?? list[list.length - 1];
  return hit ? hit[1] : address(media.url, proxy);
}

/**
 * A `next/image` loader for this media object: Next asks for a width, we
 * answer with the closest copy the API already has (its widths are a closed
 * allow-list; an arbitrary `?w=` would be refused).
 */
export function fmImageLoader(media: DeliveryMedia, proxy?: ImageProxy): (p: { src: string; width: number }) => string {
  return ({ width }) => variantFor(media, width, proxy);
}

/**
 * Props for `next/image` (or any component with the same contract):
 * `<Image {...nextImageProps(media, { sizes: '100vw' })} />`.
 */
export function nextImageProps(
  media: DeliveryMedia,
  opts: { sizes?: string; alt?: string; priority?: boolean; imageProxy?: ImageProxy } = {},
) {
  const blur = media.blurDataURL ? safeImageUrl(media.blurDataURL) : '';
  return {
    src: address(media.url, opts.imageProxy),
    alt: opts.alt ?? media.alt ?? '',
    width: media.width ?? undefined,
    height: media.height ?? undefined,
    sizes: opts.sizes,
    priority: opts.priority,
    loader: fmImageLoader(media, opts.imageProxy),
    placeholder: blur ? ('blur' as const) : ('empty' as const),
    blurDataURL: blur || undefined,
    style: objectPosition(media.focal) ? { objectPosition: objectPosition(media.focal) } : undefined,
  };
}
