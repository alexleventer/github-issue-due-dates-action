import { parseUpcomingLabels, pickUpcomingLabel } from '../src/utils/labels';

describe('parseUpcomingLabels', () => {
  const fallback = [{ days: 7, label: 'Due in 1 week' }];

  it('returns fallback when input is empty', () => {
    expect(parseUpcomingLabels('', fallback)).toBe(fallback);
    expect(parseUpcomingLabels('   ', fallback)).toBe(fallback);
  });

  it('parses a YAML list and sorts ascending', () => {
    const input = [
      '- days: 28',
      '  label: "Due in 4 weeks"',
      '- days: 7',
      '  label: "Due in 1 week"',
      '- days: 14',
      '  label: "Due in 2 weeks"',
    ].join('\n');
    expect(parseUpcomingLabels(input, fallback)).toEqual([
      { days: 7, label: 'Due in 1 week' },
      { days: 14, label: 'Due in 2 weeks' },
      { days: 28, label: 'Due in 4 weeks' },
    ]);
  });

  it('rejects non-array input', () => {
    expect(() => parseUpcomingLabels('days: 7', fallback)).toThrow(/YAML list/);
  });

  it('rejects missing or bad fields', () => {
    expect(() => parseUpcomingLabels('- days: 0\n  label: x', fallback)).toThrow(/positive/);
    expect(() => parseUpcomingLabels('- days: 7\n  label: ""', fallback)).toThrow(/non-empty/);
  });
});

describe('pickUpcomingLabel', () => {
  const labels = [
    { days: 7, label: 'Due in 1 week' },
    { days: 14, label: 'Due in 2 weeks' },
  ];

  it('returns the smallest matching bucket', () => {
    expect(pickUpcomingLabel(3, labels)).toBe('Due in 1 week');
    expect(pickUpcomingLabel(10, labels)).toBe('Due in 2 weeks');
  });

  it('returns null for overdue', () => {
    expect(pickUpcomingLabel(0, labels)).toBeNull();
    expect(pickUpcomingLabel(-5, labels)).toBeNull();
  });

  it('returns null when outside all buckets', () => {
    expect(pickUpcomingLabel(30, labels)).toBeNull();
  });
});
