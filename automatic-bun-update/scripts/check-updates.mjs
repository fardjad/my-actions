#!/usr/bin/env bun

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  collectCheckPaths,
  collectDependencyChanges,
  collectSnapshotPaths,
  copyRelativeFiles,
  findChangedFiles,
} from "./_shared.mjs";

const workspaceDir = process.argv[2] ?? process.cwd();
const upgradeOptions = process.argv[3] ?? "--latest";
const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "automatic-bun-update-check-"),
);

try {
  const inputPaths = await collectCheckPaths(workspaceDir);
  await copyRelativeFiles(workspaceDir, tempRoot, inputPaths);

  const updateCommand = `set -euo pipefail\nbun update ${upgradeOptions}`;
  const subprocess = Bun.spawn(["bash", "-lc", updateCommand], {
    cwd: tempRoot,
    stderr: "inherit",
    stdout: "inherit",
  });

  const exitCode = await subprocess.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  const beforeSnapshotPaths = await collectSnapshotPaths(workspaceDir);
  const packageJsonPaths = [
    ...new Set([
      ...beforeSnapshotPaths.filter(
        (relativePath) =>
          relativePath.endsWith("/package.json") ||
          relativePath === "package.json",
      ),
    ]),
  ].sort();
  const dependencyChanges = await collectDependencyChanges(
    workspaceDir,
    tempRoot,
    packageJsonPaths,
  );

  if (dependencyChanges.length > 0) {
    console.error(
      `Updates available in: ${dependencyChanges
        .map(
          ({ relativePath, packageName }) => `${relativePath}:${packageName}`,
        )
        .join(", ")}`,
    );
    process.exit(1);
  }

  const afterSnapshotPaths = await collectSnapshotPaths(tempRoot);
  const relativePaths = [
    ...new Set([...beforeSnapshotPaths, ...afterSnapshotPaths]),
  ].sort();
  const changedFiles = await findChangedFiles(
    workspaceDir,
    tempRoot,
    relativePaths,
  );

  const hadExistingLockfile =
    beforeSnapshotPaths.includes("bun.lock") ||
    beforeSnapshotPaths.includes("bun.lockb");
  const hasLockfileChanges =
    hadExistingLockfile &&
    changedFiles.some(
      (relativePath) =>
        relativePath === "bun.lock" || relativePath === "bun.lockb",
    );

  if (!hasLockfileChanges) {
    process.exit(0);
  }

  console.error(`Updates available in: ${changedFiles.join(", ")}`);
  process.exit(1);
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}
