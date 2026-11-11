import { describe, expect, it } from 'vitest';
import { addDays, minTransactionDate, todayWib } from './dates';

describe('WIB dates', () => {
  it('uses Asia/Jakarta for "today" (UTC 20:00 = WIB next day 03:00)', () => {
    expect(todayWib(new Date('2026-11-12T20:00:00Z'))).toBe('2026-11-13');
  });
  it('min transaction date is 7 days back', () => {
    expect(minTransactionDate(new Date('2026-11-12T05:00:00Z'))).toBe('2026-11-05');
  });
  it('addDays crosses months', () => {
    expect(addDays('2026-12-01', -1)).toBe('2026-11-30');
  });
});
