# :calendar: GitHub Issue Due Dates Action

> Give GitHub Issues a real due date. This action reads a date from each issue's YAML frontmatter and keeps labels (and optionally comments) in sync.

[![CI](https://github.com/alexleventer/github-issue-due-dates-action/actions/workflows/ci.yml/badge.svg)](https://github.com/alexleventer/github-issue-due-dates-action/actions/workflows/ci.yml)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GitHub%20Issue%20Due%20Dates-blue?logo=github)](https://github.com/marketplace/actions/github-issue-due-dates)
[![Release](https://img.shields.io/github/v/release/alexleventer/github-issue-due-dates-action?sort=semver)](https://github.com/alexleventer/github-issue-due-dates-action/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Why?

GitHub Issues don't have a native "due date" concept — only milestones, which are one-per-issue and don't map cleanly to personal task lists or roadmaps. This action lets you drop a one-line date into any issue body and get automatic, queryable labels for free:

- Want a Kanban column for *stuff due this week*? Filter by the `Due in 1 week` label.
- Want to triage what slipped? Filter by `Overdue`.
- Want to @-mention yourself a week out? Turn on reminder comments.

No bots to install, no external service — just one scheduled workflow.

## Table of Contents

- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Examples](#examples)
- [Permissions](#permissions)
- [Versioning](#versioning)
- [FAQ](#faq)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Quick start

**1. Annotate issues.** Add YAML frontmatter to the top of any issue body:

```markdown
---
due: 2026-09-19
---

The actual description of the issue goes here.
```

**2. Add a scheduled workflow** at `.github/workflows/due-dates.yml`:

```yaml
name: Issue due-date labels
on:
  schedule:
    - cron: '0 * * * *'   # hourly
  workflow_dispatch:       # or run it manually

jobs:
  label:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read
    steps:
      - uses: alexleventer/github-issue-due-dates-action@v2
        with:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

That's it. The built-in `GITHUB_TOKEN` has enough permission — **no personal access token required.**

## How it works

On every run the action:

1. Fetches all **open** issues (pull requests are skipped).
2. Parses YAML frontmatter from each issue body and looks for a `due:` key.
3. Computes the number of whole days between today (UTC) and the due date.
4. Reconciles the issue's labels against your configured buckets:
   - `daysUntil <= 0` → `Overdue` label.
   - Otherwise, the smallest-matching upcoming bucket (default: `Due in 1 week`).
   - Any **managed** label that no longer applies is removed. Unrelated labels are left alone.
5. Optionally posts one comment per *(issue, due date, kind)* — changing the due date bumps the dedup key.

All logic is idempotent: running it a hundred times in a row produces the same state as running it once.

## Inputs

| Name                  | Required | Default                       | Description                                                                                                             |
| --------------------- | :------: | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GH_TOKEN`            |    ✓     | —                             | Token used to read issues and write labels/comments. `${{ secrets.GITHUB_TOKEN }}` is usually enough.                   |
| `overdue-label`       |          | `Overdue`                     | Label applied when an issue is past its due date.                                                                       |
| `upcoming-labels`     |          | see below                     | YAML list of `{ days, label }` buckets. Smallest-matching bucket wins.                                                  |
| `comment-on-overdue`  |          | *(disabled)*                  | Template posted once when an issue becomes overdue. Supports `{{daysUntil}}`, `{{dueDate}}`, `{{issueNumber}}`.         |
| `comment-on-upcoming` |          | *(disabled)*                  | Template posted once when an issue enters an upcoming-due bucket. Same template variables.                              |
| `dry-run`             |          | `false`                       | Log planned changes instead of calling the GitHub API — handy for first-time setup.                                     |

Default `upcoming-labels`:

```yaml
- days: 7
  label: 'Due in 1 week'
```

## Outputs

| Name               | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `issues-processed` | Total number of open issues fetched.                   |
| `issues-changed`   | Number of issues whose labels or comments were updated.|

## Examples

### Multiple upcoming-due buckets

```yaml
- uses: alexleventer/github-issue-due-dates-action@v2
  with:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    upcoming-labels: |
      - days: 3
        label: 'Due in 3 days'
      - days: 14
        label: 'Due in 2 weeks'
      - days: 30
        label: 'Due in a month'
```

An issue due in 10 days will get `Due in 2 weeks`. In 5 days, `Due in 3 days`. In 31 days, no label.

### Reminder comments

```yaml
- uses: alexleventer/github-issue-due-dates-action@v2
  with:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    comment-on-overdue: |
      :rotating_light: This issue is **overdue** (was due on `{{dueDate}}`, {{daysUntil}} day(s) ago).
    comment-on-upcoming: |
      :hourglass_flowing_sand: Heads up — this issue is due on `{{dueDate}}` ({{daysUntil}} day(s) away).
```

Comments are deduplicated per due date. Bumping the due date allows exactly one new comment; repeated runs against the same date do nothing.

### Custom label names (e.g. emoji)

```yaml
- uses: alexleventer/github-issue-due-dates-action@v2
  with:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    overdue-label: '🔥 overdue'
    upcoming-labels: |
      - days: 7
        label: '⏰ due soon'
```

### Dry run (no writes)

```yaml
- uses: alexleventer/github-issue-due-dates-action@v2
  with:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    dry-run: true
```

## Permissions

When using `GITHUB_TOKEN`, the job needs:

```yaml
permissions:
  issues: write     # to add/remove labels and post comments
  contents: read    # to check out nothing, really — just kept for future extensibility
```

If your repo defaults to a restricted `GITHUB_TOKEN`, set these explicitly at the workflow or job level. A PAT with the `repo` scope works too but is rarely necessary.

## Versioning

Pin using one of:

- `@v2` — floating major, recommended. Gets bug fixes and backwards-compatible features automatically.
- `@v2.0.0` — exact version, reproducible.
- `@master` — bleeding edge, not recommended.

See [releases](https://github.com/alexleventer/github-issue-due-dates-action/releases) for the changelog.

## FAQ

<details>
<summary><b>Can I use this on private repos?</b></summary>

Yes. The built-in `GITHUB_TOKEN` works fine; no PAT required.
</details>

<details>
<summary><b>Will it touch labels I don't manage?</b></summary>

No. The action only adds/removes its own configured `overdue-label` and `upcoming-labels`. Hand-applied labels (e.g. `bug`, `enhancement`, triage labels) are left alone.
</details>

<details>
<summary><b>What date formats are supported?</b></summary>

Any `YYYY-MM-DD` string or a native YAML date. The comparison is done in UTC at day granularity, so there's no time zone foot-gun.
</details>

<details>
<summary><b>Why doesn't my label appear immediately?</b></summary>

Scheduled workflows run on cron — they aren't instant. For an immediate test, trigger the workflow manually via `workflow_dispatch` (see the quick-start example).
</details>

<details>
<summary><b>What if I change the due date?</b></summary>

On the next run the action recomputes: it will remove any stale label it previously applied and add the correct one. If reminder comments are enabled, the new due date will trigger one new comment; the old one stays for history.
</details>

<details>
<summary><b>Does it handle pull requests?</b></summary>

No — PRs are filtered out. The GitHub REST API treats PRs as issues, but this action only labels real issues.
</details>

## Development

```bash
npm ci
npm run lint       # tsc --noEmit
npm test           # Jest unit tests (no network)
npm run build      # bundles to dist/index.js with @vercel/ncc
npm run all        # lint + test + build
```

CI enforces that `dist/` is checked in and up to date. Run `npm run build` and commit the result before pushing.

Project layout:

```
src/
  app.ts                # entry point (reads inputs, loops over issues)
  processor.ts          # pure reconciliation logic (fully unit-tested)
  integrations/Octokit.ts
  utils/{dateUtils,frontmatter,labels}.ts
__tests__/              # Jest tests, all mocked — no live API calls
dist/                   # ncc bundle, committed
```

## Contributing

Issues and PRs welcome. If you're adding a new label mode or comment behavior, please include a test in `__tests__/processor.test.ts` — that's where all the business logic lives and where regressions get caught.

## License

[MIT](LICENSE) — © 2020-2026 Alex Leventer
