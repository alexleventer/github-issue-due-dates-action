import * as core from '@actions/core';
import {GitHub, context} from '@actions/github';
import Octokit from './Octokit';
import {datesToDue} from './utils/dateUtils';

const run = async () => {
  try {
    const githubToken = core.getInput('GH_TOKEN');
    const ok = new Octokit(githubToken);

    const issues = await ok.listAllOpenIssues(context.repo.owner, context.repo.repo);
    const results = await ok.getIssuesWithDueDate(issues);
    results.forEach(async issue => {
      const daysUtilDueDate = await datesToDue(issue.due);
      if (daysUtilDueDate <= 7 && daysUtilDueDate > 0) {
        await ok.addLabelToIssue(context.repo.owner, context.repo.repo, issue.number, ['Due in next week']);
      } else if (daysUtilDueDate <= 0) {
        await ok.removeLabelFromIssue(context.repo.owner, context.repo.repo, 'Due in next week', issue.number);
        await ok.addLabelToIssue(context.repo.owner, context.repo.repo, issue.number, ['Overdue']);
      }
    });
  } catch (error) {
    core.setFailed(error.message);
  }
};

run();
