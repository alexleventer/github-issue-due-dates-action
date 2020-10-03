import { getOctokit } from '@actions/github';
import fm from 'front-matter';
import { OVERDUE_TAG_NAME } from '../constants';

export default class Octokit {
  public client;

  constructor(token: string) {
    this.client = getOctokit(token);
  }

  async listAllOpenIssues(owner: string, repo: string) {
    const {data} = await this.client.issues.listForRepo({
      owner,
      repo,
      state: 'open',
    });
    return data;
  }

  async get(owner: string, repo: string, issueNumber: number) {
    const {data} = await this.client.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });
    return data;
  }

  async addLabelToIssue(owner: string, repo: string, issueNumber: number, labels: string[]) {
    const {data} = await this.client.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
    return data;
  }

  async removeLabelFromIssue(owner: string, repo: string, name: string, issue_number: number) {
    try {
      const {data} = await this.client.issues.removeLabel({
        owner,
        repo,
        name,
        issue_number,
      });
      return data;
    } catch (e) {
      // Do not throw error
      return [];
    }
  }

  async getIssuesWithDueDate(rawIssues: any[]) {
    return rawIssues.filter(issue => {
      // TODO: Move into utils
      const meta: any = fm(issue.body);

      const due = meta.attributes && (meta.attributes.due || meta.attributes.Due);
      if (meta.attributes && due) {
        return Object.assign(issue, {due});
      }
    });
  }

  async getOverdueIssues(rawIssues: any[]) {
    return rawIssues.filter(issue => {
      const activeLabels = issue.labels.map(label => label.name);
      return activeLabels.includes(OVERDUE_TAG_NAME);
    });
  }

  async createIssue(options: any) {
    return await this.client.issues.create(options);
  }

  async updateIssue(options: any) {
    return await this.client.issues.update(options);
  }
}
