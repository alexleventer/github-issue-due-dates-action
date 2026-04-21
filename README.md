# :calendar: GitHub Issue Due Dates Action

A GitHub Action that manages labels (and optionally posts comments) on issues based on a due date you embed in the issue body as YAML frontmatter.

- Runs on Node.js 20
- Zero runtime cost from `moment` — uses native `Date`
- Configurable labels and thresholds
- Optional reminder comments with templating
- Idempotent label reconciliation (stale labels are removed when the date changes)

---

## 1. Annotate your issues

Add YAML frontmatter to the top of any issue's body:

```
---
due: 2026-09-19
---

Rest of the issue description...
```

## 2. Add the workflow

Create `.github/workflows/due-dates.yml`:

```yaml
name: Mark issues with due dates
on:
  schedule:
    - cron: '0 * * * *'
  workflow_dispatch:

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

That's it — the built-in `GITHUB_TOKEN` has enough permission. No personal access token required.

---

## Inputs

| Name                   | Required | Default              | Description                                                                                     |
| ---------------------- | -------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `GH_TOKEN`             | yes      | —                    | Token used to read issues and write labels/comments.                                            |
| `overdue-label`        | no       | `Overdue`            | Label to apply when an issue is past its due date.                                              |
| `upcoming-labels`      | no       | see below            | YAML list of `{ days, label }` buckets. Smallest-matching bucket wins.                          |
| `comment-on-overdue`   | no       | *(disabled)*         | Template posted once when an issue becomes overdue. Supports `{{daysUntil}}`, `{{dueDate}}`, `{{issueNumber}}`. |
| `comment-on-upcoming`  | no       | *(disabled)*         | Template posted once when an issue enters an upcoming-due bucket.                               |
| `dry-run`              | no       | `false`              | Log planned changes instead of writing to GitHub.                                               |

Default `upcoming-labels`:
```yaml
- days: 7
  label: 'Due in 1 week'
```

## Outputs

| Name              | Description                                        |
| ----------------- | -------------------------------------------------- |
| `issues-processed`| Total open issues fetched.                         |
| `issues-changed`  | Number of issues that had labels or comments updated. |

---

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

### With reminder comments

```yaml
- uses: alexleventer/github-issue-due-dates-action@v2
  with:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    comment-on-overdue: |
      :rotating_light: This issue is overdue (was due on **{{dueDate}}**, {{daysUntil}} day(s) ago).
    comment-on-upcoming: |
      :hourglass: Heads up — this issue is due on **{{dueDate}}** ({{daysUntil}} day(s) away).
```

Comments are deduplicated per due-date — bumping the due date will allow one new comment; running the action repeatedly against the same due date will not.

### Dry run

```yaml
- uses: alexleventer/github-issue-due-dates-action@v2
  with:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    dry-run: true
```

---

## Development

```bash
npm ci
npm test        # unit tests (no network)
npm run lint    # type-check
npm run build   # bundles to dist/ with @vercel/ncc
```

CI verifies that `dist/` is committed and up to date.

## License

MIT
