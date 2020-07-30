import Octokit from '../src/integrations/Octokit';
import {datesToDue} from '../src/utils/dateUtils';
import {OVERDUE_TAG_NAME, NEXT_WEEK_TAG_NAME} from '../src/constants';

describe('Octokit', () => {
  const GH_TOKEN = process.env.GH_TOKEN;
  const TEST_REPO_AUTHOR = 'alexleventer';
  const TEST_REPO_NAME = 'github-issue-due-dates';

  if (!GH_TOKEN) {
    throw new Error('Cannot run tests without GH_TOKEN environment variable');
  }

  // @ts-ignore
  const gh = new Octokit(GH_TOKEN);

  it('should add label to issue', async () => {
    const issues = await gh.listAllOpenIssues(TEST_REPO_AUTHOR, TEST_REPO_NAME);
    const initialIssue = await gh.get(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[1].number);
    expect(initialIssue.labels.map(label => label.name).join(', ')).not.toContain('Test');
    await gh.addLabelToIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[1].number, ['Test']);
    const updatedIssue = await gh.get(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[1].number);
    expect(updatedIssue.labels.map(label => label.name).join(', ')).toContain('Test');
    await gh.removeLabelsFromIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[1].number, ['Test']);
  });

  it('should remove labels from issue without label', async () => {
    const issues = await gh.listAllOpenIssues(TEST_REPO_AUTHOR, TEST_REPO_NAME);
    const results = await gh.removeLabelsFromIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[0].number, ['Test']);
    expect(results).toHaveLength(0);
  });

  it('should remove label from issue with label', async () => {
    const issues = await gh.listAllOpenIssues(TEST_REPO_AUTHOR, TEST_REPO_NAME);
    await gh.addLabelToIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[1].number, ['Test']);
    const results = await gh.removeLabelsFromIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[1].number, ['Test']);
    expect(results).toHaveLength(1);
  });

  it('should get overdue issues', async () => {
    const issues = await gh.listAllOpenIssues(TEST_REPO_AUTHOR, TEST_REPO_NAME);
    const overdueIssues = await gh.getOverdueIssues(issues);
  });
});
