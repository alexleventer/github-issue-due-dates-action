import { daysUntilDue } from '../src/utils/dateUtils';

describe('daysUntilDue', () => {
  const now = new Date('2026-04-20T12:00:00Z');

  it('returns positive days for a future date', () => {
    expect(daysUntilDue('2026-04-27', now)).toBe(7);
  });

  it('returns 0 for today', () => {
    expect(daysUntilDue('2026-04-20', now)).toBe(0);
  });

  it('returns negative days for a past date', () => {
    expect(daysUntilDue('2026-04-13', now)).toBe(-7);
  });

  it('ignores current time-of-day when comparing', () => {
    const late = new Date('2026-04-20T23:59:00Z');
    expect(daysUntilDue('2026-04-21', late)).toBe(1);
  });

  it('throws on invalid dates', () => {
    expect(() => daysUntilDue('not-a-date', now)).toThrow(/Invalid due date/);
  });
});
