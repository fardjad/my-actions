# NPM Automatic Dependency Update

## Example Usage

```yaml
name: upgrade-node-dependencies

on:
  workflow_dispatch: {}
  schedule:
    - cron: "0 0 * * *"

jobs:
  upgrade-node-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
      - uses: actions/setup-node@main
        with:
          node-version: "lts/*"
          check-latest: true
      - uses: fardjad/my-actions/npm-automatic-dependency-update@main
        with:
          github-token: ${{ secrets.GH_PAT }}
```