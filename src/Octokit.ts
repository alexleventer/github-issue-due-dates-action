import {GitHub, context} from '@actions/github';
import fm from 'front-matter';

export default class Octokit {
  public client: GitHub;

  constructor(token: string) {
    this.client = new GitHub(token);
  }

  async listAllOpenIssues(owner: string, repo: string) {
    const {data} = await this.client.issues.listForRepo({
      owner,
      repo,
      state: 'open',
    });
    return data;
  }

  async addLabelToIssue(owner: string, repo: string, issueNumber: number, labels: string[]) {
    return await this.client.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    })
  }

  async removeLabelFromIssue(owner: string, repo: string, name: string, issue_number: number) {
    return await this.client.issues.removeLabel({
      owner,
      repo,
      name,
      issue_number,
    });
  }

  async getIssuesWithDueDate(rawIssues: any[]) {
    return rawIssues.filter(issue => {
      const meta: any = fm(issue.body);
      if (meta.attributes && meta.attributes.due) {
        return Object.assign(issue, {due: meta.attributes.due});
      }
    });
  }
}
