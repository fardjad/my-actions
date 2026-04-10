# Automatic Bun Update

## Synopsis

This action provides an _opinionated workflow_ for updating dependencies in a Bun project.

By default, this action upgrades the dependencies in the `package.json` file
with `bun update --latest` and merges the changes to the target branch with a
commit message that includes the upgraded packages. Versions newer than the
configured minimum release age are ignored during update and install steps.
Set `working-directory` to update an independent Bun package project in a
subdirectory.
Package lifecycle scripts are disabled during dependency updates by default.
Set `run-package-scripts` to `true` to allow them.

## Inputs

Variables ending with the suffix `-script` can either be a file path to a script
or a multi-line string that starts with a shebang line.

| Input                    | Description                                                                                                                                                              | Required | Default                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------ |
| source-branch            | The branch to create the PR with changes from.                                                                                                                           | No       | <pre>automatic-bun-update</pre>                        |
| target-branch            | The branch to merge the changes into. Defaults to `github.head_ref` or `github.ref_name`.                                                                                | No       | <pre>${{ github.head_ref \|\| github.ref_name }}</pre> |
| github-token             | The GitHub token to use for creating and merging the PR with the changes.                                                                                                | No       | <pre>${{ github.token }}</pre>                         |
| merge-pr                 | Whether to merge the pull request after creating it. This first attempts an immediate merge and falls back to enabling auto-merge if GitHub rejects the immediate merge. | No       | <pre>true</pre>                                        |
| upgrade-options          | The options to pass to `bun update`. This value is appended verbatim to the command so it can include flags such as `--latest`, `--production`, or package selectors.    | No       | <pre>--latest</pre>                                    |
| minimum-release-age-days | The minimum age, in days, that a package version must reach before Bun can install or update it.                                                                         | No       | <pre>7</pre>                                           |
| working-directory        | The package project directory to update, relative to the repository root. Use "." for the repository root.                                                               | No       | <pre>.</pre>                                           |
| run-package-scripts      | Whether to allow package lifecycle scripts while updating dependencies.                                                                                                  | No       | <pre>false</pre>                                       |
| post-update-commands     | The commands to run after updating the dependencies. They will be executed in a bash shell.                                                                              | No       | <pre>bun audit \|\| true<br></pre>                     |
| verify-script            | The script to run to verify the changes. This could be used to run tests, etc.                                                                                           | No       | <pre>bun run test<br></pre>                            |
| commit-title             | The commit title.                                                                                                                                                        | No       | <pre>Upgrade dependencies</pre>                        |

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
      - uses: oven-sh/setup-bun@main
        with:
          bun-version: latest
      - name: Cache Bun packages
        uses: actions/cache@main
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock', '**/bun.lockb') }}
          restore-keys: |
            ${{ runner.os }}-bun-
      - uses: fardjad/my-actions/automatic-bun-update@main
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          upgrade-options: --latest
```

To update a package project in a subdirectory, call the action with a separate
`source-branch` and set `working-directory`:

```yaml
- uses: fardjad/my-actions/automatic-bun-update@main
  with:
    source-branch: automatic-bun-update-opencode-plugin
    github-token: ${{ steps.app-token.outputs.token }}
    working-directory: opencode-plugin
    upgrade-options: --latest
```
