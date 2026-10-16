import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMoney } from '../src/format.js';

describe('deterministic formats', () => {
  it('a calendar date never moves with the zone', () => {
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatDate('2026-01-01', { locale: 'de' })).toBe('01.01.2026');
    expect(formatDate('not a date')).toBe('not a date');
    expect(formatDate(42)).toBeNull();
  });
  it('an instant is shown in the named zone (UTC by default)', () => {
    expect(formatDateTime('2026-10-15T23:30:00Z')).toBe('Oct 15, 2026, 11:30 PM');
    expect(formatDateTime('2026-10-15T23:30:00Z', { timeZone: 'Asia/Tokyo' })).toBe('Oct 16, 2026, 8:30 AM');
    expect(formatDateTime('2026-10-15T23:30:00Z', { timeZone: 'Not/AZone' })).toBe('2026-10-15T23:30:00Z');
  });
  it('money: amounts, bands, periods, unknown currencies', () => {
    expect(formatMoney(1200)).toBe('1,200');
    expect(formatMoney({ amount: 9.5, currency: 'USD' })).toBe('$9.50');
    expect(formatMoney({ min: 70000, max: 90000, currency: 'GBP', period: 'year' })).toBe('£70,000–£90,000 / year');
    expect(formatMoney({ min: 5, max: 5, currency: 'EUR' })).toBe('€5');
    expect(formatMoney({ amount: 3, currency: 'ZZZ1' })).toBe('3 ZZZ1');
    expect(formatMoney({})).toBeNull();
    expect(formatMoney('12')).toBeNull();
  });
});
