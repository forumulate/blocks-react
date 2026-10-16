import { Children, cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { fieldAttrs, type FieldPath } from './pointer.js';

export interface FieldProps {
  /** The entry the value belongs to (`entry.id` from the delivery API). */
  entryId: string | null | undefined;
  /** Where in the entry: `['pricing', 'tiers', { id: 'k3f9a' }, 'name']` or `'/pricing/tiers/@k3f9a/name'`. */
  path: FieldPath;
  /**
   * Emit the click-to-edit attribute. Pass your framework's preview flag
   * (Next: `(await draftMode()).isEnabled`). Off — the default — renders
   * exactly the markup without it.
   */
  preview?: boolean;
  /**
   * The element to render. Without it, a single element child receives the
   * attribute directly (no extra DOM); any other children are wrapped in a
   * `<span>`. Either way the element tree is the same with preview on or off,
   * so turning preview on never moves your layout.
   */
  as?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Marks the element that shows one field, so the studio can open that field
 * when an editor double-clicks it on your site (CMS spec 5, L3). In production
 * (`preview` off) it adds nothing.
 */
export function Field({ entryId, path, preview, as, className, children }: FieldProps) {
  const attrs = fieldAttrs(entryId, path, preview);
  if (as) return createElement(as, { className, ...attrs }, children);
  const only = Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  if (isValidElement(only) && typeof only.type === 'string' && !className) {
    return Object.keys(attrs).length ? cloneElement(only as ReactElement<Record<string, unknown>>, attrs) : only;
  }
  return createElement('span', { className, ...attrs }, children);
}
