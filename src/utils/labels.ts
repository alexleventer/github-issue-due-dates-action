import yaml from 'js-yaml';
import type { UpcomingLabel } from '../constants';

export const parseUpcomingLabels = (input: string, fallback: UpcomingLabel[]): UpcomingLabel[] => {
  const trimmed = input?.trim();
  if (!trimmed) return fallback;

  const parsed = yaml.load(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error(`"upcoming-labels" must be a YAML list of { days, label } entries.`);
  }

  const labels: UpcomingLabel[] = parsed.map((entry, idx) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`upcoming-labels[${idx}] must be an object.`);
    }
    const days = Number((entry as Record<string, unknown>).days);
    const label = String((entry as Record<string, unknown>).label ?? '').trim();
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error(`upcoming-labels[${idx}].days must be a positive number.`);
    }
    if (!label) {
      throw new Error(`upcoming-labels[${idx}].label must be a non-empty string.`);
    }
    return { days: Math.floor(days), label };
  });

  return [...labels].sort((a, b) => a.days - b.days);
};

export const pickUpcomingLabel = (
  daysUntil: number,
  labels: UpcomingLabel[],
): string | null => {
  if (daysUntil <= 0) return null;
  for (const entry of labels) {
    if (daysUntil <= entry.days) return entry.label;
  }
  return null;
};
