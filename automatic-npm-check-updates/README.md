# Automatic npm-check-updates

## Synopsis

This action provides an _opinionated workflow_ for updating dependencies in a Node.js project.

By default, this action updates the dependencies in the `package.json` file
and merges the changes to the target branch with a commit message that includes
the list of updated packages. Versions newer than the configured minimum
release age are ignored during both the update and install steps.

## Inputs

Variables ending with the suffix `-script` can either be a file path to a script
or a multi-line string that starts with a shebang line.

| Input                    | Description                                                                                                                                                              | Required | Default                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------- |
| source-branch            | The branch to create the PR with changes from.                                                                                                                           | No       | <pre>automatic-npm-check-updates</pre>                                                                               |
| target-branch            | The branch to merge the changes into. Defaults to `github.head_ref` or `github.ref_name`.                                                                                | No       | <pre>${{ github.head_ref \|\| github.ref_name }}</pre>                                                               |
| github-token             | The GitHub token to use for creating and merging the PR with the changes.                                                                                                | No       | <pre>${{ github.token }}</pre>                                                                                       |
| merge-pr                 | Whether to merge the pull request after creating it. This first attempts an immediate merge and falls back to enabling auto-merge if GitHub rejects the immediate merge. | No       | <pre>true</pre>                                                                                                      |
| minimum-release-age-days | The minimum age, in days, that a package version must reach before npm can install it or npm-check-updates can select it.                                                | No       | <pre>7</pre>                                                                                                         |
| post-update-commands     | The commands to run after updating the dependencies. They will be executed in a bash shell.                                                                              | No       | <pre>npm audit fix --quiet --no-progress --no-fund \|\| true<br><br>npm version patch --no-git-tag-version<br></pre> |
| verify-script            | The script to run to verify the changes. This could be used to run tests, etc.                                                                                           | No       | <pre>npm run test<br></pre>                                                                                          |
| commit-title             | The commit title.                                                                                                                                                        | No       | <pre>Upgrade dependencies</pre>                                                                                      |

## Building Blocks

This action is very opinionated and may not be suitable for all use cases.
If you need more flexibility, you can use [its main building
block](../automatic-maintenance) directly or use
[these other smaller actions](../) in this repository.

## Example Usage

These actions are documented for GitHub App usage. Generate an installation
token in the workflow and pass it as `github-token`. Approval should be handled
in a separate `pull_request_target` workflow in the repository.

```yaml
name: update-dependencies

on:
  workflow_dispatch: {}

jobs:
  update-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
      - name: Generate app token
        id: app-token
        uses: actions/create-github-app-token@main
        with:
          app-id: ${{ vars.AUTO_MAINTENANCE_APP_ID }}
          private-key: ${{ secrets.AUTO_MAINTENANCE_APP_PRIVATE_KEY }}
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
          github-token: ${{ steps.app-token.outputs.token }}
```
