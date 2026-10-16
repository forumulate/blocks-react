import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FmImage, fmImageLoader, nextImageProps, objectPosition, srcSetOf, variantFor } from '../src/index.js';

const media = {
  url: 'https://cdn.test/a.jpg',
  width: 2000,
  height: 1000,
  alt: 'A field',
  focal: { x: 0.3, y: 0.6 },
  blurDataURL: 'data:image/png;base64,AAAA',
  variants: { '1600': 'https://cdn.test/a-1600.jpg', '640': 'https://cdn.test/a-640.jpg', bad: 'x', '320': 'javascript:x' },
};

describe('<FmImage>', () => {
  it('responsive, sized, focal-cropped, lazy, with a blur placeholder', () => {
    const out = renderToStaticMarkup(<FmImage media={media} sizes="(max-width: 600px) 100vw, 50vw" fit="cover" className="hero" />);
    expect(out).toBe(
      '<img class="hero" src="https://cdn.test/a.jpg" srcSet="https://cdn.test/a-640.jpg 640w, https://cdn.test/a-1600.jpg 1600w" sizes="(max-width: 600px) 100vw, 50vw" width="2000" height="1000" alt="A field" loading="lazy" decoding="async" style="object-fit:cover;object-position:30% 60%;background-image:url(&quot;data:image/png;base64,AAAA&quot;);background-size:cover;background-position:30% 60%"/>',
    );
  });

  it('priority loads eagerly; placeholder can be turned off; alt override wins', () => {
    const out = renderToStaticMarkup(<FmImage media={media} priority placeholder="none" alt="" />);
    expect(out).toContain('loading="eager"');
    expect(out).toContain('fetchPriority="high"');
    expect(out).toContain('alt=""');
    expect(out).not.toContain('background-image');
  });

  it('renders nothing for no media or an unsafe address', () => {
    expect(renderToStaticMarkup(<FmImage media={null} />)).toBe('');
    expect(renderToStaticMarkup(<FmImage media={{ url: 'javascript:alert(1)' }} />)).toBe('');
  });

  it('a bare media object is a plain lazy img with no srcset', () => {
    expect(renderToStaticMarkup(<FmImage media={{ url: '/api/assets/x' }} />)).toBe('<img src="/api/assets/x" alt="" loading="lazy" decoding="async"/>');
  });

  it('proxy rewrites every address', () => {
    const out = renderToStaticMarkup(<FmImage media={media} imageProxy={(u) => `https://img.test/?u=${encodeURIComponent(u)}`} placeholder="none" />);
    expect(out).toContain('src="https://img.test/?u=https%3A%2F%2Fcdn.test%2Fa.jpg"');
    expect(out).toContain('https://img.test/?u=https%3A%2F%2Fcdn.test%2Fa-640.jpg 640w');
  });

  it('as: hands next/image-shaped props to your component', () => {
    const Img = (p: Record<string, unknown>) => <span data-props={JSON.stringify({ ...p, loader: typeof p.loader })} />;
    const out = renderToStaticMarkup(<FmImage media={media} as={Img} sizes="50vw" />);
    expect(out).toContain('&quot;placeholder&quot;:&quot;blur&quot;');
    expect(out).toContain('&quot;loader&quot;:&quot;function&quot;');
    expect(out).toContain('&quot;width&quot;:2000');
  });
});

describe('media helpers', () => {
  it('srcset skips malformed and unsafe variants', () => {
    expect(srcSetOf(media)).toBe('https://cdn.test/a-640.jpg 640w, https://cdn.test/a-1600.jpg 1600w');
    expect(srcSetOf({ url: '/x' })).toBeUndefined();
  });
  it('variantFor and the loader pick the narrowest copy wide enough', () => {
    expect(variantFor(media, 500)).toBe('https://cdn.test/a-640.jpg');
    expect(variantFor(media, 1000)).toBe('https://cdn.test/a-1600.jpg');
    expect(variantFor(media, 4000)).toBe('https://cdn.test/a-1600.jpg');
    expect(variantFor({ url: '/x' }, 100)).toBe('/x');
    expect(fmImageLoader(media)({ src: 'ignored', width: 700 })).toBe('https://cdn.test/a-1600.jpg');
  });
  it('focal point clamps to 0–100%', () => {
    expect(objectPosition({ x: -1, y: 2 })).toBe('0% 100%');
    expect(objectPosition(null)).toBeUndefined();
  });
  it('nextImageProps', () => {
    const p = nextImageProps(media, { sizes: '100vw' });
    expect(p).toMatchObject({ src: 'https://cdn.test/a.jpg', alt: 'A field', width: 2000, height: 1000, placeholder: 'blur', style: { objectPosition: '30% 60%' } });
  });
});
