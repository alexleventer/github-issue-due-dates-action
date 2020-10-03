import Octokit from '../src/integrations/Octokit';

describe('Octokit', () => {
  const GH_TOKEN = process.env.GH_TOKEN;
  const TEST_REPO_AUTHOR = 'alexleventer';
  const TEST_REPO_NAME = 'github-issue-due-dates';

  if (!GH_TOKEN) {
    throw new Error('Cannot run tests without GH_TOKEN environment variable');
  }

  // @ts-ignore
  const gh = new Octokit(GH_TOKEN);

  it('should list all open issues', async () => {
    const issues = await gh.listAllOpenIssues(TEST_REPO_AUTHOR, TEST_REPO_NAME);
    expect(issues).toBeInstanceOf(Array);
    expect(issues[0].state).toEqual('open');
  });

  it('should add label to issue', async () => {
    const issues = await gh.listAllOpenIssues(TEST_REPO_AUTHOR, TEST_REPO_NAME);
    const initialIssue = await gh.get(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[1].number);
    expect(initialIssue.labels.map(label => label.name).join(', ')).not.toContain('Test');
    await gh.addLabelToIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[1].number, ['Test']);
    const updatedIssue = await gh.get(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[1].number);
    expect(updatedIssue.labels.map(label => label.name).join(', ')).toContain('Test');
    await gh.removeLabelFromIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, 'Test', issues[1].number);
  });

  it('should remove label from issue without label', async () => {
    const issues = await gh.listAllOpenIssues(TEST_REPO_AUTHOR, TEST_REPO_NAME);
    const results = await gh.removeLabelFromIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, 'Test', issues[0].number);
    expect(results).toHaveLength(0);
  });

  it('should remove label from issue with label', async () => {
    const issues = await gh.listAllOpenIssues(TEST_REPO_AUTHOR, TEST_REPO_NAME);
    await gh.addLabelToIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, issues[1].number, ['Test']);
    const results = await gh.removeLabelFromIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, 'Test', issues[1].number);
    expect(results).toHaveLength(1);
  });

  it('should get overdue issues', async () => {
    const issues = await gh.listAllOpenIssues(TEST_REPO_AUTHOR, TEST_REPO_NAME);
    const overdueIssues = await gh.getOverdueIssues(issues);
    expect(overdueIssues).toHaveLength(0);
    const newIssue = await gh.createIssue({
      title: 'test issue',
      repo: TEST_REPO_NAME,
      owner: TEST_REPO_AUTHOR,
      body: `---\ndue: 2019-09-01\n---`
    });
    const { data: {url, id, number} } = newIssue;
    await gh.addLabelToIssue(TEST_REPO_AUTHOR, TEST_REPO_NAME, number, ['overdue']);
    const updatedIssues = await gh.listAllOpenIssues(TEST_REPO_AUTHOR, TEST_REPO_NAME);
    const updatedOverdueIssues = await gh.getOverdueIssues(updatedIssues);
    expect(updatedOverdueIssues).toHaveLength(1);
    await gh.updateIssue({
      issue_number: number,
      repo: TEST_REPO_NAME,
      owner: TEST_REPO_AUTHOR,
      state: 'closed'
    })
  });
});
