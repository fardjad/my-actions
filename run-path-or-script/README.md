# Run Path or Script

## Synopsis

This action takes a string input and determines whether it&#39;s a file path or a script. If it&#39;s a file path, it executes the file found there. If it&#39;s a script, it runs the script.

A script is expected to start with a shebang line.

## Inputs

| Input                      | Description                                                                                   | Required | Default         |
| -------------------------- | --------------------------------------------------------------------------------------------- | -------- | --------------- |
| path-or-script             | The input string, which can be a file path or a script to execute.                            | Yes      | <pre></pre>     |
| fail-on-non-zero-exit-code | Specifies whether the action should fail if the executed script returns a non-zero exit code. | No       | <pre>true</pre> |

## Outputs

| Output    | Description                                                                               |
| --------- | ----------------------------------------------------------------------------------------- |
| is-path   | Indicates whether the input was identified as a file path ("true") or a script ("false"). |
| exit-code | The exit code returned by the executed script or file.                                    |
| stdout    | The standard output produced by the executed script or file.                              |
| stderr    | The standard error output from the executed script or file.                               |

## Example Usage

```yaml
name: run-path-or-script

on:
  workflow_dispatch: {}

jobs:
  run-path-or-script:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
      - id: run-file
        uses: fardjad/my-actions/run-path-or-script@main
        with:
          path-or-script: "/bin/pwd"
      - id: run-script
        uses: fardjad/my-actions/run-path-or-script@main
        with:
          path-or-script: |
            #!/usr/bin/env bash

            echo "Hello stdout"
            echo "Hello stderr" >&2
      - name: Echo outputs
        shell: bash
        run: |
          echo run-file is-path: "${{ steps.run-file.outputs.is-path }}" # true
          echo run-file exit-code: "${{ steps.run-file.outputs.exit-code }}" # 0
          echo run-file stdout: "${{ steps.run-file.outputs.stdout }}" # output of /bin/pwd

          echo run-script is-path: "${{ steps.run-script.outputs.is-path }}" # false
          echo run-script exit-code: "${{ steps.run-script.outputs.exit-code }}" # 0
          echo run-script stdout: "${{ steps.run-script.outputs.stdout }}" # Hello stdout
          echo run-script stderr: "${{ steps.run-script.outputs.stderr }}" # Hello stderr
```
