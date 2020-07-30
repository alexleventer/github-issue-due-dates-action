# :calendar: GitHub Issue Due Dates Action
Add due dates to GitHub issues - issues are automatically tagged with labels when they pass certain date thresholds, as defined by you.

## How it works:
1. Add the following snippet to the top of issues you'd like to assign due dates to:
```
---
due: 2019-09-19
---
```
2. Create a `.github/workflows/workflow.yml` file with the following contents:
```yaml
name: Main Workflow
on:
  schedule:
    - cron:  '0 * * * *'
jobs:
  Ubuntu:
    name: Add labels to issues
    runs-on: ubuntu-latest
    steps:
      - name: GitHub Issue Due Dates Action
        uses: alexleventer/github-issue-due-dates-action@1.0.12
        with:
          GH_TOKEN: "${{ secrets.GH_TOKEN }}"
          OVERDUE_LABEL: OVERDUE!
          INTERVALS: >-
            - days: 30
              label: Due in 1 month
            - days: 14
              label: Due in 2 weeks
            - days: 7
              label: Due in 1 week
            - days: 1
              label: DUE TOMORROW
```
3. Generate a [personal access GitHub token](https://github.com/settings/tokens).
4. Add the following environment variable to your repository secrets: `GH_TOKEN={{your personal access token}}`.

## Defining intervals

Intervals are defined as a sequence (list) with a number of `days` and
a `label` to be set.

You can define intervals and labels to meet your requirements; the
above is simply a guide.

### Note the block syntax

The value of the `INTERVALS` key must be interpreted as a string,
and must be a valid YAML block. Your action will fail if you do not
set the block indicator.
