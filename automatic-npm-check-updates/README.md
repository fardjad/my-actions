# Automatic npm-check-updates

## Example Usage

```yaml
name: automatic-npm-check-updates

on:
  workflow_dispatch: {}
  schedule:
    - cron: "0 0 * * *"

jobs:
  automatic-npm-check-updates:
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
      - uses: fardjad/my-actions/automatic-npm-check-update@main
        with:
          github-token: ${{ secrets.GH_PAT }}
```