# Automatic Maintenance

## Example Usage

```yaml
name: automatic-maintenance

on:
  workflow_dispatch: {}
  schedule:
    - cron: "0 0 * * *"

jobs:
  automatic-maintenance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
      - uses: fardjad/my-actions/automatic-maintenance@main
        with:
          prepare-script: |
            #!/usr/bin/env bash

            # TODO: Prepare the repository for automatic maintenance tasks 
            # e.g. install dependencies, etc.

            exit 0
          check-script: |
            #!/usr/bin/env bash

            # Zero exit code: No maintenance is required
            # Non-zero exit code: Maintenance is required

            exit 1
          change-script: |
            #!/usr/bin/env bash

            # TODO: Perform the automatic maintenance tasks

            exit 0
          verify-script: |
            #!/usr/bin/env bash

            # TODO: Validate the changes made by the change script
            # e.g. run tests, etc.

            exit 0
          commit-script: |
            #!/usr/bin/env bash

            set -euo pipefail

            # You can generate a commit message and commit the changes
            # git add .
            # git commit -m "Perform automatic maintenance tasks"

            exit 0
          github-token: ${{ secrets.GH_PAT }}
```
