import * as core from '@actions/core';
import { context } from '@actions/github';
import Octokit from './integrations/Octokit';
import { DEFAULT_UPCOMING_LABELS, OVERDUE_LABEL } from './constants';
import { parseUpcomingLabels } from './utils/labels';
import { alreadyCommented, planIssueAction } from './processor';

const asNullable = (value: string): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const run = async (): Promise<{ ok: true; issuesProcessed: number; issuesChanged: number }> => {
  const token = core.getInput('GH_TOKEN') || core.getInput('github-token');
  if (!token) {
    throw new Error('Missing GH_TOKEN input');
  }

  const overdueLabel = core.getInput('overdue-label') || OVERDUE_LABEL;
  const upcomingLabels = parseUpcomingLabels(
    core.getInput('upcoming-labels'),
    DEFAULT_UPCOMING_LABELS,
  );
  const commentOnOverdue = asNullable(core.getInput('comment-on-overdue'));
  const commentOnUpcoming = asNullable(core.getInput('comment-on-upcoming'));
  const dryRun = core.getBooleanInput('dry-run');

  const ok = new Octokit(token);
  const { owner, repo } = context.repo;

  const issues = await ok.listAllOpenIssues(owner, repo);
  core.info(`Fetched ${issues.length} open issues.`);

  let changed = 0;
  for (const issue of issues) {
    const action = planIssueAction(issue, {
      overdueLabel,
      upcomingLabels,
      commentOnOverdue,
      commentOnUpcoming,
    });
    if (!action) continue;

    core.info(
      `#${action.issueNumber} due ${action.dueDate} (${action.daysUntil}d): ` +
        `+[${action.labelsToAdd.join(', ')}] -[${action.labelsToRemove.join(', ')}]` +
        (action.commentToPost ? ' +comment' : ''),
    );

    if (dryRun) {
      changed++;
      continue;
    }

    if (action.labelsToAdd.length) {
      await ok.addLabels(owner, repo, action.issueNumber, action.labelsToAdd);
    }
    for (const label of action.labelsToRemove) {
      await ok.removeLabel(owner, repo, action.issueNumber, label);
    }

    if (action.commentToPost) {
      const kind: 'overdue' | 'upcoming' = action.daysUntil <= 0 ? 'overdue' : 'upcoming';
      const existing = await ok.listCommentsByBot(owner, repo, action.issueNumber);
      if (!alreadyCommented(existing, kind, action.dueDate)) {
        await ok.createComment(owner, repo, action.issueNumber, action.commentToPost);
      }
    }

    changed++;
  }

  core.setOutput('issues-processed', String(issues.length));
  core.setOutput('issues-changed', String(changed));
  return { ok: true, issuesProcessed: issues.length, issuesChanged: changed };
};

if (require.main === module) {
  run().catch(err => {
    core.setFailed(err instanceof Error ? err.message : String(err));
  });
}
