# Automatic npm-check-updates

## Synopsis

This action provides an _opinionated workflow_ for updating dependencies in a Node.js project.

By default, this action updates the dependencies in the `package.json` file
and merges the changes to the target branch with a commit message that includes
the list of updated packages.

## Inputs

Variables ending with the suffix `-script` can either be a file path to a script
or a multi-line string that starts with a shebang line.

| Input                | Description                                                                                 | Required | Default                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| source-branch        | The branch to create the PR with changes from.                                              | No       | automatic-npm-check-updates                                                                                              |
| target-branch        | The branch to merge the changes into. Defaults to `github.head_ref` or `github.ref_name`.   | No       | ${{ github.head_ref \|\| github.ref_name }}                                                                              |
| github-token         | The GitHub PAT to use for creating, approving, and merging the PR with the changes.         | Yes      |
| post-update-commands | The commands to run after updating the dependencies. They will be executed in a bash shell. | No       | npm install<br>npm audit fix --quiet --no-progress --no-fund \|\| true<br><br>npm version patch --no-git-tag-version<br> |
| verify-script        | The script to run to verify the changes. This could be used to run tests, etc.              | No       | npm run test<br>                                                                                                         |
| commit-title         | The commit title.                                                                           | No       | Upgrade dependencies                                                                                                     |

## Building Blocks

This action is very opinionated and may not be suitable for all use cases.
If you need more flexibility, you can use [its main building
block](../automatic-maintenance) directly or use
[these other smaller actions](../) in this repository.

## Example Usage

```yaml
name: update-dependencies

on:
  workflow_dispatch: {}

jobs:
  update-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
      - uses: actions/setup-node@main
        with:
          node-version: "lts/*"
          check-latest: true
      - name: Cache node modules
        uses: actions/cache@main
        env:
          cache-name: cache-node-modules
        with:
          path: ~/.npm
          key: ${{ runner.os }}-build-${{ env.cache-name }}-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-build-${{ env.cache-name }}-
            ${{ runner.os }}-build-
            ${{ runner.os }}-
      - uses: fardjad/my-actions/automatic-npm-check-updates@main
        with:
          github-token: ${{ secrets.GH_PAT }}
```
