# Automatic Bun Update

## Synopsis

This action provides an _opinionated workflow_ for updating dependencies in a Bun project.

By default, this action upgrades the dependencies in the `package.json` file
with `bun update --latest` and merges the changes to the target branch with a
commit message that includes the upgraded packages. Versions newer than the
configured minimum release age are ignored during update and install steps.

## Inputs

Variables ending with the suffix `-script` can either be a file path to a script
or a multi-line string that starts with a shebang line.

| Input                    | Description                                                                                                                                                           | Required | Default                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| source-branch            | The branch to create the PR with changes from.                                                                                                                        | No       | <pre>automatic-bun-update</pre>                        |
| target-branch            | The branch to merge the changes into. Defaults to `github.head_ref` or `github.ref_name`.                                                                             | No       | <pre>${{ github.head_ref \|\| github.ref_name }}</pre> |
| github-token             | The GitHub token to use for creating, approving, and merging the PR with the changes.                                                                                 | No       | <pre>${{ github.token }}</pre>                         |
| approve-pr               | Whether to approve the pull request before merging it. This should only be enabled when the approval identity is different from the pull request author.              | No       | <pre>true</pre>                                        |
| merge-pr                 | Whether to merge the pull request after creating it.                                                                                                                  | No       | <pre>true</pre>                                        |
| approve-token            | Optional GitHub token to use for approving the pull request. Defaults to `github-token` when omitted.                                                                 | No       | <pre></pre>                                            |
| merge-token              | Optional GitHub token to use for merging the pull request. Defaults to `github-token` when omitted.                                                                   | No       | <pre></pre>                                            |
| upgrade-options          | The options to pass to `bun update`. This value is appended verbatim to the command so it can include flags such as `--latest`, `--production`, or package selectors. | No       | <pre>--latest</pre>                                    |
| minimum-release-age-days | The minimum age, in days, that a package version must reach before Bun can install or update it.                                                                      | No       | <pre>7</pre>                                           |
| post-update-commands     | The commands to run after updating the dependencies. They will be executed in a bash shell.                                                                           | No       | <pre>bun audit \|\| true<br></pre>                     |
| verify-script            | The script to run to verify the changes. This could be used to run tests, etc.                                                                                        | No       | <pre>bun run test<br></pre>                            |
| commit-title             | The commit title.                                                                                                                                                     | No       | <pre>Upgrade dependencies</pre>                        |

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
          upgrade-options: --latest --no-progress
```
