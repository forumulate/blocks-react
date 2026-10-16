/**
 * Display formats for date, time and money values.
 *
 * Deterministic on purpose: the same value renders the same string on the
 * server and in the browser, whatever either machine's timezone or locale —
 * otherwise a server-rendered "Oct 15" hydrates as "Oct 14" west of UTC and
 * React reports a mismatch. So the zone is explicit (UTC unless the caller
 * names one) and the locale is the caller's, never the machine's.
 */

export interface FormatOptions {
  /** BCP-47 locale for dates and amounts. Default `en`. */
  locale?: string;
  /** IANA zone for `datetime` values. Default `UTC`. A calendar `date` is always shown as written. */
  timeZone?: string;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar day (`2026-10-15`) — a date, not an instant, so no zone can move it. */
export function formatDate(value: unknown, o: FormatOptions = {}): string | null {
  if (typeof value !== 'string' || !value) return null;
  const m = DATE_ONLY.exec(value);
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(o.locale ?? 'en', { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
  } catch {
    return value;
  }
}

/** An instant (`2026-10-15T09:30:00Z`), in the named zone. */
export function formatDateTime(value: unknown, o: FormatOptions = {}): string | null {
  if (typeof value !== 'string' || !value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(o.locale ?? 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: o.timeZone ?? 'UTC',
    }).format(d);
  } catch {
    return value;
  }
}

function amount(n: number, currency: string | undefined, locale: string): string {
  try {
    return currency
      ? new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
        }).format(n)
      : new Intl.NumberFormat(locale).format(n);
  } catch {
    // An unknown currency code: the number, then the code as written.
    return `${new Intl.NumberFormat(locale).format(n)}${currency ? ` ${currency}` : ''}`;
  }
}

/**
 * A `money` value: a plain amount, `{amount, currency}`, or the band
 * `{min, max, currency, period}` (a salary range) — "€70,000–€90,000 / year".
 */
export function formatMoney(value: unknown, o: FormatOptions = {}): string | null {
  const locale = o.locale ?? 'en';
  if (typeof value === 'number' && Number.isFinite(value)) return amount(value, undefined, locale);
  if (!value || typeof value !== 'object') return null;
  const v = value as { amount?: unknown; min?: unknown; max?: unknown; currency?: unknown; period?: unknown };
  const currency = typeof v.currency === 'string' && v.currency ? v.currency : undefined;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const single = num(v.amount);
  const min = num(v.min);
  const max = num(v.max);
  let out: string;
  if (single !== null) out = amount(single, currency, locale);
  else if (min !== null && max !== null && min !== max)
    out = `${amount(min, currency, locale)}–${amount(max, currency, locale)}`;
  else if (min !== null || max !== null) out = amount((min ?? max)!, currency, locale);
  else return null;
  return typeof v.period === 'string' && v.period ? `${out} / ${v.period}` : out;
}
