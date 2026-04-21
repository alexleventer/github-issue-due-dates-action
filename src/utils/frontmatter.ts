import fm from 'front-matter';

export interface IssueFrontmatter {
  due?: string;
}

export const extractDueDate = (body: string | null | undefined): string | null => {
  if (!body) return null;
  try {
    const parsed = fm<IssueFrontmatter & Record<string, unknown>>(body);
    const attrs = parsed.attributes || {};
    const raw = (attrs.due ?? (attrs as Record<string, unknown>).Due) as unknown;
    if (raw instanceof Date) {
      return raw.toISOString().slice(0, 10);
    }
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    return null;
  } catch {
    return null;
  }
};
