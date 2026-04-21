import { alreadyCommented, planIssueAction } from '../src/processor';

const now = new Date('2026-04-20T12:00:00Z');
const upcomingLabels = [
  { days: 7, label: 'Due in 1 week' },
  { days: 14, label: 'Due in 2 weeks' },
];
const baseOptions = { overdueLabel: 'Overdue', upcomingLabels, now };

const makeIssue = (overrides: Partial<{ number: number; body: string | null; labels: string[] }> = {}) => ({
  number: 1,
  body: null,
  labels: [],
  ...overrides,
});

describe('planIssueAction', () => {
  it('returns null for issues without a due date', () => {
    expect(planIssueAction(makeIssue({ body: 'no frontmatter' }), baseOptions)).toBeNull();
  });

  it('adds Overdue label for past due dates', () => {
    const issue = makeIssue({ body: '---\ndue: 2026-04-10\n---' });
    const action = planIssueAction(issue, baseOptions);
    expect(action?.labelsToAdd).toEqual(['Overdue']);
    expect(action?.labelsToRemove).toEqual([]);
  });

  it('adds the correct upcoming bucket', () => {
    const issue = makeIssue({ body: '---\ndue: 2026-04-25\n---' });
    expect(planIssueAction(issue, baseOptions)?.labelsToAdd).toEqual(['Due in 1 week']);

    const farther = makeIssue({ body: '---\ndue: 2026-05-02\n---' });
    expect(planIssueAction(farther, baseOptions)?.labelsToAdd).toEqual(['Due in 2 weeks']);
  });

  it('removes stale upcoming label when an issue becomes overdue (issue #75)', () => {
    const issue = makeIssue({
      body: '---\ndue: 2026-04-15\n---',
      labels: ['Due in 1 week'],
    });
    const action = planIssueAction(issue, baseOptions);
    expect(action?.labelsToAdd).toEqual(['Overdue']);
    expect(action?.labelsToRemove).toEqual(['Due in 1 week']);
  });

  it('removes stale Overdue label when due date moves to the future', () => {
    const issue = makeIssue({
      body: '---\ndue: 2026-04-25\n---',
      labels: ['Overdue'],
    });
    const action = planIssueAction(issue, baseOptions);
    expect(action?.labelsToAdd).toEqual(['Due in 1 week']);
    expect(action?.labelsToRemove).toEqual(['Overdue']);
  });

  it('does nothing when the correct label is already present', () => {
    const issue = makeIssue({
      body: '---\ndue: 2026-04-25\n---',
      labels: ['Due in 1 week'],
    });
    expect(planIssueAction(issue, baseOptions)).toBeNull();
  });

  it('leaves unmanaged labels alone', () => {
    const issue = makeIssue({
      body: '---\ndue: 2026-04-15\n---',
      labels: ['bug', 'Due in 1 week'],
    });
    const action = planIssueAction(issue, baseOptions);
    expect(action?.labelsToRemove).toEqual(['Due in 1 week']);
    expect(action?.labelsToAdd).toEqual(['Overdue']);
  });

  it('renders overdue comment template with vars', () => {
    const issue = makeIssue({ number: 42, body: '---\ndue: 2026-04-10\n---' });
    const action = planIssueAction(issue, {
      ...baseOptions,
      commentOnOverdue: 'Issue #{{issueNumber}} was due on {{dueDate}} ({{daysUntil}}d).',
    });
    expect(action?.commentToPost).toContain('Issue #42 was due on 2026-04-10 (-10d).');
    expect(action?.commentToPost).toContain('<!-- github-issue-due-dates-action --> kind=overdue');
  });

  it('renders upcoming comment template with vars', () => {
    const issue = makeIssue({ number: 5, body: '---\ndue: 2026-04-25\n---' });
    const action = planIssueAction(issue, {
      ...baseOptions,
      commentOnUpcoming: 'Reminder: due in {{daysUntil}} day(s).',
    });
    expect(action?.commentToPost).toContain('Reminder: due in 5 day(s).');
    expect(action?.commentToPost).toContain('kind=upcoming');
  });

  it('skips comment generation when no template configured', () => {
    const issue = makeIssue({ body: '---\ndue: 2026-04-10\n---' });
    expect(planIssueAction(issue, baseOptions)?.commentToPost).toBeNull();
  });
});

describe('alreadyCommented', () => {
  it('detects existing marker', () => {
    const existing = ['first', 'stale\n\n<!-- github-issue-due-dates-action --> kind=overdue due=2026-04-10'];
    expect(alreadyCommented(existing, 'overdue', '2026-04-10')).toBe(true);
  });

  it('ignores markers for a different due date', () => {
    const existing = ['<!-- github-issue-due-dates-action --> kind=overdue due=2026-03-01'];
    expect(alreadyCommented(existing, 'overdue', '2026-04-10')).toBe(false);
  });
});
