#!/usr/bin/env node

import {
  renderUpdateSummary,
  resolvePackageDirectory,
  snapshotProject,
  stageProject,
} from "./lib.mjs";

const [command, ...args] = process.argv.slice(2);

const optionValue = (name, defaultValue = "") => {
  const prefix = `${name}=`;
  const option = args.find((arg) => arg.startsWith(prefix));
  return option ? option.slice(prefix.length) : defaultValue;
};

const splitList = (value) => value.split(",").filter(Boolean);

const fail = (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
};

try {
  if (command === "resolve") {
    const [workspace, workingDirectory, outputMode = "absolute"] = args;
    const packageDirectory = resolvePackageDirectory(
      workspace,
      workingDirectory,
    );
    console.log(
      outputMode === "relative"
        ? packageDirectory.relative
        : packageDirectory.absolute,
    );
    process.exit(0);
  }

  if (command === "snapshot") {
    const [workspace, targetRoot, workingDirectory] = args;
    const packageDirectory = resolvePackageDirectory(
      workspace,
      workingDirectory,
    );
    await snapshotProject({
      lockfiles: splitList(optionValue("--lockfiles")),
      projectDir: packageDirectory.absolute,
      targetRoot,
      workspace: packageDirectory.workspace,
    });
    process.exit(0);
  }

  if (command === "summary") {
    const [beforeRoot, workspace, workingDirectory] = args;
    const packageDirectory = resolvePackageDirectory(
      workspace,
      workingDirectory,
    );
    console.log(
      await renderUpdateSummary({
        afterRoot: packageDirectory.workspace,
        beforeRoot,
        lockfiles: splitList(optionValue("--lockfiles")),
        projectDir: packageDirectory.absolute,
      }),
    );
    process.exit(0);
  }

  if (command === "stage") {
    const [workspace, workingDirectory] = args;
    const packageDirectory = resolvePackageDirectory(
      workspace,
      workingDirectory,
    );
    stageProject({
      addLockfiles: optionValue("--add-lockfiles", "never"),
      lockfiles: splitList(optionValue("--lockfiles")),
      packagePath: packageDirectory.relative,
    });
    process.exit(0);
  }

  fail(`Unknown command: ${command}`);
} catch (error) {
  fail(error);
}
