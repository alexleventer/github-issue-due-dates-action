# GitHub Issue Due Dates Action

## How it works:
1. Add the following to the top of issues you'd like assign due dates to:
```
---
due: 2019-09-19
---
```
2. Create a .github/workflows/workflow.yml file with the following contents:
```
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
        uses: alexleventer/github-issue-due-dates-action@master
        env:
          GH_TOKEN: "${{ secrets.GH_TOKEN }}"
```
3. Generate a GitHub token and add it to your repository secrets.
