import * as core from '@actions/core';
import {GitHub, context} from '@actions/github';
import Octokit from './integrations/Octokit';
import {datesToDue, byDays} from './utils/dateUtils';
import YAML from 'yaml';

export const run = async () => {
  try {
    const githubToken = core.getInput('GH_TOKEN');
    const inputIntervals = core.getInput('INTERVALS');
    const overdueLabel = core.getInput('OVERDUE_LABEL') || 'OVERDUE';

    if (!githubToken) {
      throw new Error('Missing GH_TOKEN environment variable');
    }

    if (!inputIntervals) {
      throw new Error('Missing INTERVALS environment variable');
    }

    const ok = new Octokit(githubToken);

    const issues = await ok.listAllOpenIssues(context.repo.owner, context.repo.repo);
    console.log(`Found ${issues.length} open issue(s)`);

    const results = await ok.getIssuesWithDueDate(issues);
    console.log(`Found ${results.length} issue(s) with due dates`);

    const intervals = YAML.parse(inputIntervals).sort(byDays);
    const intervalLabels = intervals.map(interval => interval.label);
    console.log(`Found ${intervals.length} defined intervals`);

    results.forEach(async issue => {
      console.log(`Processing issue #${issue.number} with due date of ${issue.due}`);
      const daysUtilDueDate = await datesToDue(issue.due);

      if (daysUtilDueDate <= 0) {
        await ok.removeLabelsFromIssue(context.repo.owner, context.repo.repo, issue.number, intervalLabels);
        await ok.addLabelToIssue(context.repo.owner, context.repo.repo, issue.number, [overdueLabel]);
        console.log(`Marked issue #${issue.number} as overdue`);
      } else {
        for (interval of intervals) {
          if (daysUtilDueDate <= interval.days) {
            await ok.removeLabelsFromIssue(context.repo.owner, context.repo.repo, issue.number, intervalLabels);
            await ok.addLabelToIssue(context.repo.owner, context.repo.repo, issue.number, [interval.label]);
            console.log(`Marked issue #${issue.number} with label: ${interval.label}`);
            break; // don't process any more intervals
          }
        }
      }
    });

    return {
      ok: true,
      issuesProcessed: results.length,
    }

  } catch (e) {
    core.setFailed(e.message);
    throw e;
  }
};

run();
