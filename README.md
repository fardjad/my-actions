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
   `vars.AUTO_MAINTENANCE_APP_ID`.
4. Store the app private key PEM in a repository or organization secret such as
   `secrets.AUTO_MAINTENANCE_APP_PRIVATE_KEY`.

To use the `prepare-repo` workflow in this repository, add these extra GitHub
App repository permissions on top of the permissions needed for PR creation and
merge:

- `Administration: Read and write`
- `Secrets: Read and write`
- `Variables: Read and write`

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
          app-id: ${{ vars.AUTO_MAINTENANCE_APP_ID }}
          private-key: ${{ secrets.AUTO_MAINTENANCE_APP_PRIVATE_KEY }}
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
    runs-on: ubuntu-latest
    steps:
      - name: Resolve app slug
        id: app-token
        uses: actions/create-github-app-token@main
        with:
          app-id: ${{ vars.AUTO_MAINTENANCE_APP_ID }}
          private-key: ${{ secrets.AUTO_MAINTENANCE_APP_PRIVATE_KEY }}
      - name: Approve PR
        if: >
          github.event.pull_request.user.login == format('{0}[bot]', steps.app-token.outputs.app-slug) &&
          github.event.pull_request.user.type == 'Bot'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_URL: ${{ github.event.pull_request.html_url }}
        run: gh pr review --approve "$PR_URL"
```

### 3a. Repository Preparation Workflow

This repository includes a helper workflow at
[`.github/workflows/prepare-repo.yml`](.github/workflows/prepare-repo.yml)
that prepares a target repository using the GitHub App stored in
`AUTO_MAINTENANCE_APP_ID` and `AUTO_MAINTENANCE_APP_PRIVATE_KEY`.

The same logic is also available as a standalone CLI:

```bash
python3 scripts/prepare-repo.py --help
```

Local example:

```bash
export GH_TOKEN=your-admin-token
export SOURCE_APP_ID=123456
export SOURCE_APP_PRIVATE_KEY="$(cat path/to/auto-maintenance-app.pem)"

python3 scripts/prepare-repo.py \
  fardjad/node-parse-my-command \
  --default-branch main \
  --required-status-checks "test,lint"
```

The CLI uses your current `gh` authentication or `GH_TOKEN` for GitHub API
calls, and it copies `SOURCE_APP_ID` / `SOURCE_APP_PRIVATE_KEY` into the target
repository as `AUTO_MAINTENANCE_APP_ID` and
`AUTO_MAINTENANCE_APP_PRIVATE_KEY`.

It configures:

- rebase merge only
- auto-merge
- automatic branch deletion on merge
- branch protection on the selected branch
- Actions permissions, including write-enabled `GITHUB_TOKEN` and PR approval
- repository `AUTO_MAINTENANCE_APP_ID` and
  `AUTO_MAINTENANCE_APP_PRIVATE_KEY`

Workflow inputs:

- `repository`: target repository in `owner/repo` form
- `default-branch`: protected branch name, defaults to `main`
- `required-status-checks`: comma-separated check names; when omitted, the
  workflow leaves required status checks unmanaged
- `extra-allowed-actions-patterns`: comma-separated additional allowed action or
  reusable workflow patterns such as `owner/action@*`

GitHub's documented API does not expose settings for:

- including Git LFS objects in archives
- auto-closing issues with merged linked pull requests

Those two settings still need to be managed manually.

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
