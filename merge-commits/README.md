# Merge Commits

## Synopsis

This action merges commits from a source branch into a target branch by creating a pull request and optionally approving it before merging.

## Inputs

| Input         | Description                                                                                                                                              | Required | Default                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| source-branch | The name of the branch to merge the commits from.                                                                                                        | Yes      | <pre></pre>                                            |
| target-branch | The name of the branch to merge the commits into.                                                                                                        | No       | <pre>${{ github.head_ref \|\| github.ref_name }}</pre> |
| github-token  | The GitHub token to use for creating the pull request and, by default, merging it.                                                                       | No       | <pre>${{ github.token }}</pre>                         |
| approve-pr    | Whether to approve the pull request before merging it. This should only be enabled when the approval identity is different from the pull request author. | No       | <pre>false</pre>                                       |
| merge-pr      | Whether to merge the pull request after creating it.                                                                                                     | No       | <pre>true</pre>                                        |
| approve-token | Optional GitHub token to use for approving the pull request. Defaults to `github-token` when omitted.                                                    | No       | <pre></pre>                                            |
| merge-token   | Optional GitHub token to use for merging the pull request. Defaults to `github-token` when omitted.                                                      | No       | <pre></pre>                                            |

## Example Usage

```yaml
name: merge-commits

on:
  workflow_dispatch: {}

jobs:
  merge-commits:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
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
          github-token: ${{ secrets.GITHUB_TOKEN }}
```
