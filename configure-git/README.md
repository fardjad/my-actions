# Configure Git

## Synopsis

This action configures git for making changes to the repository.

## Inputs

| Input    | Description                              | Required | Default                                                 |
| -------- | ---------------------------------------- | -------- | ------------------------------------------------------- |
| username | The username to use for configuring git. | No       | <pre>github-actions[bot]</pre>                          |
| email    | The email to use for configuring git.    | No       | <pre>github-actions[bot]@users.noreply.github.com</pre> |

## Example Usage

```yaml
name: configure-git

on:
  workflow_dispatch: {}

jobs:
  configure-git:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
      - name: Configure Git
        uses: fardjad/my-actions/configure-git@main
```
