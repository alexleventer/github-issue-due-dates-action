const MS_PER_DAY = 1000 * 60 * 60 * 24;

const startOfDayUTC = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export const daysUntilDue = (dueDate: string | Date, now: Date = new Date()): number => {
  const due =
    dueDate instanceof Date ? dueDate : new Date(`${String(dueDate).trim()}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) {
    throw new Error(`Invalid due date: ${String(dueDate)}`);
  }
  return Math.ceil((startOfDayUTC(due) - startOfDayUTC(now)) / MS_PER_DAY);
};
