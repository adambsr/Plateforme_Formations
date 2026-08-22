import { describe, expect, it } from 'vitest';

import { isCalendarDate, tunisDateRange } from './tunis-date-range.js';

describe('Africa/Tunis dashboard calendar ranges', () => {
  it('uses inclusive local dates and UTC persisted boundaries', () => {
    const range = tunisDateRange('2026-01-01', '2026-01-31');
    expect(range.startAt.toISOString()).toBe('2025-12-31T23:00:00.000Z');
    expect(range.endAtExclusive.toISOString()).toBe('2026-01-31T23:00:00.000Z');
    expect(range.fullMonths).toEqual([{ year: 2026, month: 1 }]);
  });

  it('includes only calendar months fully contained in a partial range', () => {
    expect(tunisDateRange('2026-01-15', '2026-03-31').fullMonths).toEqual([
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ]);
    expect(tunisDateRange('2026-01-15', '2026-03-15').fullMonths).toEqual([
      { year: 2026, month: 2 },
    ]);
  });

  it('rejects invalid calendar dates', () => {
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(() => tunisDateRange('2026-03-02', '2026-03-01')).toThrow();
  });
});
