import { getOctokit } from '@actions/github';
import type { GitHub } from '@actions/github/lib/utils';

export type GitHubClient = InstanceType<typeof GitHub>;

export interface RepoIssue {
  number: number;
  body: string | null | undefined;
  labels: string[];
  pull_request?: unknown;
}

export default class Octokit {
  public readonly client: GitHubClient;

  constructor(token: string) {
    this.client = getOctokit(token);
  }

  async listAllOpenIssues(owner: string, repo: string): Promise<RepoIssue[]> {
    const raw = await this.client.paginate(this.client.rest.issues.listForRepo, {
      owner,
      repo,
      state: 'open',
      per_page: 100,
    });
    return raw
      .filter((issue: any) => !issue.pull_request)
      .map((issue: any) => ({
        number: issue.number,
        body: issue.body,
        labels: (issue.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name)).filter(Boolean),
      }));
  }

  async addLabels(owner: string, repo: string, issue_number: number, labels: string[]): Promise<void> {
    if (!labels.length) return;
    await this.client.rest.issues.addLabels({ owner, repo, issue_number, labels });
  }

  async removeLabel(owner: string, repo: string, issue_number: number, name: string): Promise<void> {
    try {
      await this.client.rest.issues.removeLabel({ owner, repo, issue_number, name });
    } catch (e: any) {
      if (e?.status !== 404) throw e;
    }
  }

  async createComment(owner: string, repo: string, issue_number: number, body: string): Promise<void> {
    await this.client.rest.issues.createComment({ owner, repo, issue_number, body });
  }

  async listCommentsByBot(owner: string, repo: string, issue_number: number): Promise<string[]> {
    const comments = await this.client.paginate(this.client.rest.issues.listComments, {
      owner,
      repo,
      issue_number,
      per_page: 100,
    });
    return comments.map((c: any) => c.body || '');
  }
}
