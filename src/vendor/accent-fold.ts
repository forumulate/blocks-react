/**
 * The ONE accent fold: `é` → `e`, `ñ` → `n`, `ド` stays `ド`.
 *
 * Compose first, fold away only the Latin/Greek/Cyrillic combining marks
 * (U+0300–U+036F), then RECOMPOSE. A bare `.normalize('NFKD')` leaves the mark
 * behind to become a separator (`Crème` → `cre-me`); stripping marks without
 * recomposing splits `ド` into `ト` + a dangling dakuten. See `slugify` in
 * ./slug for the history.
 *
 * Its own module, with no imports, because it has two kinds of caller: the
 * address rule (`slugify`, which lives beside zod schemas) and the heading
 * ANCHOR rule (the platform's heading-slug rule), which the reader's
 * "On this page" rail imports into a client bundle that must not pay for zod.
 * Two copies of the fold is how the anchors kept `cach-con-etags` after the
 * addresses were fixed (Numestri NUM-46).
 */
export function foldAccents(input: string): string {
  return (
    input
      .normalize('NFC')
      .normalize('NFD')
      // Combining Diacritical Marks only. NOT U+3099 (Japanese dakuten), which
      // is part of the letter rather than an accent on it.
      .replace(/[̀-ͯ]/g, '')
      .normalize('NFC')
  );
}
