#!/usr/bin/env bun

import {
  collectDependencyChanges,
  collectSnapshotPaths,
  findChangedFiles,
} from "./_shared.mjs";

const beforeRoot = process.argv[2];
const afterRoot = process.argv[3] ?? process.cwd();

if (!beforeRoot) {
  console.error("Expected a snapshot directory.");
  process.exit(1);
}

const packageJsonPaths = (await collectSnapshotPaths(beforeRoot)).filter(
  (relativePath) =>
    relativePath.endsWith("/package.json") || relativePath === "package.json",
);
const dependencyChanges = await collectDependencyChanges(
  beforeRoot,
  afterRoot,
  packageJsonPaths,
);

if (dependencyChanges.length > 0) {
  const lines = dependencyChanges.map(
    ({ field, relativePath, packageName, beforeVersion, afterVersion }) =>
      `${relativePath} ${field}.${packageName}: ${beforeVersion ?? "(missing)"} -> ${afterVersion ?? "(removed)"}`,
  );

  console.log(lines.join("\n"));
  process.exit(0);
}

const changedFiles = await findChangedFiles(
  beforeRoot,
  afterRoot,
  await collectSnapshotPaths(beforeRoot),
);

if (
  changedFiles.some(
    (relativePath) =>
      relativePath === "bun.lock" || relativePath === "bun.lockb",
  )
) {
  console.log("Lockfile-only dependency refresh.");
  process.exit(0);
}

console.log("Dependency refresh.");
process.exit(0);
