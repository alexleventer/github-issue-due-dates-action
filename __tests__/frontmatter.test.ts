import { extractDueDate } from '../src/utils/frontmatter';

describe('extractDueDate', () => {
  it('parses a due attribute', () => {
    const body = '---\ndue: 2026-05-01\n---\nbody';
    expect(extractDueDate(body)).toBe('2026-05-01');
  });

  it('parses capital-D Due attribute', () => {
    const body = '---\nDue: 2026-05-01\n---';
    expect(extractDueDate(body)).toBe('2026-05-01');
  });

  it('returns null when no frontmatter', () => {
    expect(extractDueDate('just a regular issue body')).toBeNull();
  });

  it('returns null when frontmatter lacks due', () => {
    expect(extractDueDate('---\nowner: alex\n---\n')).toBeNull();
  });

  it('handles null/empty body', () => {
    expect(extractDueDate(null)).toBeNull();
    expect(extractDueDate('')).toBeNull();
  });
});
