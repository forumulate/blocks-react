import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Blocks, Content, Field, FmImage, RichText, fieldAttrs, toPointer, pathSegments } from '../src/index.js';
import { authorSchema, pageEntry, pageSchema } from './fixtures-content.js';

/**
 * Click-to-edit attributes exist in preview sessions only (CMS spec 5, L3):
 * production HTML never carries `data-fm-field`.
 */
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('data-fm-field only in preview', () => {
  const schemas = { author: authorSchema };

  it('production: no attribute anywhere in a full entry', () => {
    const out = html(<Content entry={pageEntry} schema={pageSchema} schemas={schemas} />);
    expect(out.length).toBeGreaterThan(1000);
    expect(out).not.toContain('data-fm-field');
    // Same with preview explicitly off and every component used directly.
    const all = html(
      <>
        <Content entry={pageEntry} schema={pageSchema} schemas={schemas} preview={false} />
        <Blocks blocks={pageEntry.fields.layout as never} entryId="e1" path="/layout" />
        <Field entryId="e1" path={['title']}>
          <h1>Pricing</h1>
        </Field>
        <Field entryId="e1" path="/title" as="div">
          words
        </Field>
        <FmImage media={{ url: '/a.png' }} {...fieldAttrs('e1', ['cover'], false)} />
        <RichText doc={pageEntry.fields.body as never} />
      </>,
    );
    expect(all).not.toContain('data-fm-field');
  });

  it('preview: every field, row and block carries its pointer', () => {
    const out = html(<Content entry={pageEntry} schema={pageSchema} schemas={schemas} preview />);
    for (const ptr of [
      'e1:/title',
      'e1:/body',
      'e1:/cover',
      'e1:/pricing/heading',
      'e1:/pricing/tiers/@r1',
      'e1:/pricing/tiers/@r2/name',
      'e1:/layout/@b1',
      'e1:/layout/@b2/heading',
      'e1:/layout/@b3/video',
      'a1:/name',
    ]) {
      expect(out).toContain(`data-fm-field="${ptr}"`);
    }
    // An internal field is never rendered, in preview or not.
    expect(out).not.toContain('never shown');
  });

  it('<Field> adds the attribute to its element without changing the tree', () => {
    const off = html(
      <Field entryId="e1" path={['pricing', 'tiers', { id: 'k3' }, 'name']}>
        <span className="n">Pro</span>
      </Field>,
    );
    const on = html(
      <Field entryId="e1" path={['pricing', 'tiers', { id: 'k3' }, 'name']} preview>
        <span className="n">Pro</span>
      </Field>,
    );
    expect(off).toBe('<span class="n">Pro</span>');
    expect(on).toBe('<span class="n" data-fm-field="e1:/pricing/tiers/@k3/name">Pro</span>');
    expect(html(<Field entryId="e1" path="title" preview>text</Field>)).toBe('<span data-fm-field="e1:/title">text</span>');
    expect(html(<Field entryId="e1" path="title">text</Field>)).toBe('<span>text</span>');
    expect(html(<Field entryId={null} path="title" preview as="p">x</Field>)).toBe('<p>x</p>');
  });

  it('pointers escape keys and round-trip', () => {
    expect(toPointer(['a/b', 'c~d', { id: 'x1' }])).toBe('/a~1b/c~0d/@x1');
    expect(pathSegments('/a~1b/c~0d/@x1')).toEqual(['a/b', 'c~d', { id: 'x1' }]);
    expect(toPointer('title')).toBe('/title');
  });
});
