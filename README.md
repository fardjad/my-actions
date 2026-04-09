# My GitHub Actions

This repository contains my GitHub Actions.

## GitHub App Setup

These actions are intended to be used with a private GitHub App. The app token
creates the pull request and merges it later. Approval is handled separately in
a repository workflow with `GITHUB_TOKEN`.

### 1. Create the App

Create a private GitHub App in your personal account or organization with these
repository permissions:

- `Contents: Read and write`
- `Pull requests: Read and write`

Then:

1. Generate a private key for the app.
2. Install the app on the repositories that should use these actions.
3. Store the app ID in a repository or organization variable such as
   `vars.APP_ID`.
4. Store the app private key PEM in a repository or organization secret such as
   `secrets.APP_PRIVATE_KEY`.

### 2. Use the App in Update Workflows

Generate an installation token with `actions/create-github-app-token@main` and
pass it as `github-token` to these actions.

Example workflow:

```yaml
name: automatic-bun-update

on:
  workflow_dispatch: {}
  schedule:
    - cron: "0 6 * * 1"

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
      - name: Generate app token
        id: app-token
        uses: actions/create-github-app-token@main
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
      - uses: oven-sh/setup-bun@main
        with:
          bun-version: latest
      - uses: fardjad/my-actions/automatic-bun-update@main
        with:
          github-token: ${{ steps.app-token.outputs.token }}
```

### 3. Add a Repository Approval Workflow

If your repository requires an approval before merge, add a
`pull_request_target` workflow that approves pull requests opened by the app
with `GITHUB_TOKEN`.

Repository requirements:

- Enable `Settings` -> `Actions` -> `General` -> `Workflow permissions` ->
  `Allow GitHub Actions to create and approve pull requests`
- Do not check out or run code from the pull request branch in this workflow

Example approval workflow:

```yaml
name: approve-app-prs

on:
  pull_request_target:
    types: [opened, reopened, synchronize]

permissions:
  pull-requests: write

jobs:
  approve:
    if: >
      github.event.pull_request.user.login == 'your-app-slug[bot]' &&
      github.event.pull_request.user.type == 'Bot'
    runs-on: ubuntu-latest
    steps:
      - name: Approve PR
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_URL: ${{ github.event.pull_request.html_url }}
        run: gh pr review --approve "$PR_URL"
```

### 4. Merge After Checks Pass

Use the same app token for merge. If you use the actions in this repository,
that is already handled by the `github-token` input.

## Actions

| Action                                                     | Description                                                                                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Automatic Bun Update](automatic-bun-update)               | This action provides an _opinionated workflow_ for updating dependencies in a Bun project.                                                                                                       |
| [Automatic Maintenance](automatic-maintenance)             | This action provides an _opinionated workflow_ for performing automatic maintenance tasks on a repository. It can be used to automate tasks such as updating dependencies, formatting code, etc. |
| [Automatic npm-check-updates](automatic-npm-check-updates) | This action provides an _opinionated workflow_ for updating dependencies in a Node.js project.                                                                                                   |
| [Configure Git](configure-git)                             | This action configures git for making changes to the repository.                                                                                                                                 |
| [Merge Commits](merge-commits)                             | This action merges commits from a source branch into a target branch by creating a pull request and optionally merging it.                                                                       |
| [Run Path or Script](run-path-or-script)                   | This action takes a string input and determines whether it&#39;s a file path or a script. If it&#39;s a file path, it executes the file found there. If it&#39;s a script, it runs the script.   |
