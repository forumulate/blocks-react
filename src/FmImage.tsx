import { createElement, type CSSProperties, type ImgHTMLAttributes } from 'react';
import { safeImageUrl, type ImageProxy } from './url.js';
import { nextImageProps, objectPosition, srcSetOf, type DeliveryMedia } from './media-image.js';

export interface FmImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height'> {
  /** The media object from the delivery API (`{url, width, height, alt, focal, blurDataURL, variants}`). */
  media: DeliveryMedia | null | undefined;
  /** The `sizes` hint for the srcset — how wide the picture is laid out. Default `100vw`. */
  sizes?: string;
  /** Above the fold: load eagerly at high priority instead of lazily. */
  priority?: boolean;
  /** `cover` crops around the focal point; `contain` letterboxes. Unset leaves `object-fit` to your CSS. */
  fit?: 'cover' | 'contain';
  /** Draw the blurred placeholder behind the picture while it loads (default: when the media has one). */
  placeholder?: 'blur' | 'none';
  /** Rewrite each address (a CDN in front of ours). */
  imageProxy?: ImageProxy;
  /**
   * Render with your own image component instead of `<img>` — e.g. `as={Image}`
   * from `next/image`, which then receives `src`, `width`, `height`, `alt`,
   * `sizes`, `loader`, `placeholder` and `blurDataURL`.
   */
  as?: React.ElementType;
}

/**
 * A picture from a media field: responsive (`srcset` from the API's resized
 * copies), its box reserved from the stored size (no layout shift), cropped
 * around the editor's focal point, with the blurred placeholder while it loads.
 * Every address is the media's own — no third-party requests — and an unsafe
 * one renders nothing.
 */
export function FmImage({
  media,
  sizes = '100vw',
  priority,
  fit,
  placeholder,
  imageProxy,
  as,
  alt,
  style,
  ...rest
}: FmImageProps) {
  if (!media) return null;
  const src = safeImageUrl(media.url);
  if (!src) return null;
  const focal = objectPosition(media.focal);
  if (as) {
    const p = nextImageProps(media, { sizes, alt, priority, imageProxy });
    return createElement(as, { ...rest, ...p, style: { ...p.style, ...(fit ? { objectFit: fit } : null), ...style } });
  }
  const blur = placeholder !== 'none' && media.blurDataURL ? safeImageUrl(media.blurDataURL) : '';
  const css: CSSProperties = {
    ...(fit ? { objectFit: fit } : null),
    ...(focal ? { objectPosition: focal } : null),
    ...(blur
      ? { backgroundImage: `url("${blur}")`, backgroundSize: 'cover', backgroundPosition: focal ?? 'center' }
      : null),
    ...style,
  };
  return createElement('img', {
    ...rest,
    src: imageProxy ? (imageProxy(src) ?? src) : src,
    srcSet: srcSetOf(media, imageProxy),
    sizes: srcSetOf(media, imageProxy) ? sizes : undefined,
    width: media.width ?? undefined,
    height: media.height ?? undefined,
    alt: alt ?? media.alt ?? '',
    loading: priority ? 'eager' : 'lazy',
    decoding: 'async',
    fetchPriority: priority ? 'high' : undefined,
    style: Object.keys(css).length ? css : undefined,
  });
}
