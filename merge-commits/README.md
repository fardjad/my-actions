# Merge Commits

## Synopsis

This action merges commits from a source branch into a target branch by automatically creating and approving a pull request.

## Inputs

| Input         | Description                                                                                    | Required | Default                                                |
| ------------- | ---------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| source-branch | The name of the branch to merge the commits from.                                              | Yes      | <pre></pre>                                            |
| target-branch | The name of the branch to merge the commits into.                                              | No       | <pre>${{ github.head_ref \|\| github.ref_name }}</pre> |
| github-token  | The GitHub Personal Access Token to use for creating, approving, and merging the pull request. | No       | <pre>${{ github.token }}</pre>                         |

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
