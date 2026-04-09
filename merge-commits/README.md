# Merge Commits

## Synopsis

This action merges commits from a source branch into a target branch by creating a pull request and optionally merging it.

## Inputs

| Input         | Description                                                                                                                                                              | Required | Default                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------ |
| source-branch | The name of the branch to merge the commits from.                                                                                                                        | Yes      | <pre></pre>                                            |
| target-branch | The name of the branch to merge the commits into.                                                                                                                        | No       | <pre>${{ github.head_ref \|\| github.ref_name }}</pre> |
| github-token  | The GitHub token to use for creating the pull request and, by default, merging it.                                                                                       | No       | <pre>${{ github.token }}</pre>                         |
| merge-pr      | Whether to merge the pull request after creating it. This first attempts an immediate merge and falls back to enabling auto-merge if GitHub rejects the immediate merge. | No       | <pre>true</pre>                                        |

When `merge-pr` is `true`, this action first tries to merge the pull request
immediately. If GitHub rejects the immediate merge, it falls back to enabling
auto-merge for the pull request.

## Example Usage

These actions are documented for GitHub App usage. Generate an installation
token in the workflow and pass it as `github-token`. Approval should be handled
in a separate `pull_request_target` workflow in the repository.

```yaml
name: merge-commits

on:
  workflow_dispatch: {}

jobs:
  merge-commits:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
      - name: Generate app token
        id: app-token
        uses: actions/create-github-app-token@main
        with:
          app-id: ${{ vars.AUTO_MAINTENANCE_APP_ID }}
          private-key: ${{ secrets.AUTO_MAINTENANCE_APP_PRIVATE_KEY }}
      - name: Configure Git
        uses: fardjad/my-actions/configure-git@main
      - name: Make some changes
        run: |
          git checkout -b source-branch

          echo "Hello, world!" > hello.txt
          git add hello.txt
          git commit -m "Add hello.txt"
      - name: Merge Commits
        uses: fardjad/my-actions/merge-commits@main
        with:
          source-branch: source-branch
          target-branch: main
          github-token: ${{ steps.app-token.outputs.token }}
```
