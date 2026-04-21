export const OVERDUE_LABEL = 'Overdue';

export interface UpcomingLabel {
  days: number;
  label: string;
}

export const DEFAULT_UPCOMING_LABELS: UpcomingLabel[] = [
  { days: 7, label: 'Due in 1 week' },
];
