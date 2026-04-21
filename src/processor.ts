import { OVERDUE_LABEL, UpcomingLabel } from './constants';
import { daysUntilDue } from './utils/dateUtils';
import { extractDueDate } from './utils/frontmatter';
import { pickUpcomingLabel } from './utils/labels';
import type { RepoIssue } from './integrations/Octokit';

export interface ProcessOptions {
  overdueLabel: string;
  upcomingLabels: UpcomingLabel[];
  now?: Date;
  commentOnOverdue?: string | null;
  commentOnUpcoming?: string | null;
}

export interface IssueAction {
  issueNumber: number;
  dueDate: string;
  daysUntil: number;
  labelsToAdd: string[];
  labelsToRemove: string[];
  commentToPost: string | null;
}

const COMMENT_MARKER = '<!-- github-issue-due-dates-action -->';

const buildMarker = (kind: 'overdue' | 'upcoming', dueDate: string): string =>
  `${COMMENT_MARKER} kind=${kind} due=${dueDate}`;

export const renderComment = (
  template: string,
  vars: { daysUntil: number; dueDate: string; issueNumber: number },
): string => {
  return template
    .replace(/\{\{\s*daysUntil\s*\}\}/g, String(vars.daysUntil))
    .replace(/\{\{\s*dueDate\s*\}\}/g, vars.dueDate)
    .replace(/\{\{\s*issueNumber\s*\}\}/g, String(vars.issueNumber));
};

export const planIssueAction = (
  issue: RepoIssue,
  options: ProcessOptions,
): IssueAction | null => {
  const dueDate = extractDueDate(issue.body);
  if (!dueDate) return null;

  const daysUntil = daysUntilDue(dueDate, options.now);
  const isOverdue = daysUntil <= 0;
  const upcomingLabel = pickUpcomingLabel(daysUntil, options.upcomingLabels);

  const managedLabels = new Set<string>([
    options.overdueLabel,
    ...options.upcomingLabels.map(u => u.label),
  ]);

  const desiredLabels = new Set<string>();
  if (isOverdue) desiredLabels.add(options.overdueLabel);
  else if (upcomingLabel) desiredLabels.add(upcomingLabel);

  const existing = new Set(issue.labels);
  const labelsToAdd = [...desiredLabels].filter(l => !existing.has(l));
  const labelsToRemove = [...existing].filter(
    l => managedLabels.has(l) && !desiredLabels.has(l),
  );

  let commentToPost: string | null = null;
  if (isOverdue && options.commentOnOverdue) {
    commentToPost =
      renderComment(options.commentOnOverdue, { daysUntil, dueDate, issueNumber: issue.number }) +
      `\n\n${buildMarker('overdue', dueDate)}`;
  } else if (!isOverdue && upcomingLabel && options.commentOnUpcoming) {
    commentToPost =
      renderComment(options.commentOnUpcoming, { daysUntil, dueDate, issueNumber: issue.number }) +
      `\n\n${buildMarker('upcoming', dueDate)}`;
  }

  if (!labelsToAdd.length && !labelsToRemove.length && !commentToPost) return null;

  return { issueNumber: issue.number, dueDate, daysUntil, labelsToAdd, labelsToRemove, commentToPost };
};

export const alreadyCommented = (
  existingComments: string[],
  kind: 'overdue' | 'upcoming',
  dueDate: string,
): boolean => {
  const marker = buildMarker(kind, dueDate);
  return existingComments.some(body => body.includes(marker));
};
