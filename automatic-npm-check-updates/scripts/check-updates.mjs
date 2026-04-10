#!/usr/bin/env node

import childProcess from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  collectDependencyChanges,
  collectInputPaths,
  collectSnapshotPaths,
  copyRelativeFiles,
  findChangedFiles,
  resolvePackageDirectory,
} from "../../js-maintenance-utils/lib.mjs";

const workspaceDir = process.argv[2] ?? process.cwd();
const minimumReleaseAgeDays = process.argv[3] ?? "7";
const workingDirectory = process.argv[4] ?? ".";
const runPackageScripts = process.argv[5] === "true";
const lockfiles = ["package-lock.json"];
const packageDirectory = resolvePackageDirectory(
  workspaceDir,
  workingDirectory,
);
const projectDir = packageDirectory.absolute;
const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "automatic-npm-check-updates-check-"),
);
const projectRelativePath =
  packageDirectory.relative === "." ? "" : packageDirectory.relative;
const tempProjectDir = path.join(tempRoot, projectRelativePath);

const run = (command) => {
  const env = {
    ...process.env,
    npm_config_min_release_age: minimumReleaseAgeDays,
  };

  if (!runPackageScripts) {
    env.npm_config_ignore_scripts = "true";
  }

  childProcess.execFileSync("bash", ["-lc", command], {
    cwd: tempProjectDir,
    env,
    stdio: "inherit",
  });
};

try {
  const inputPaths = await collectInputPaths({
    configFiles: [".npmrc"],
    lockfiles,
    projectDir,
    workspace: packageDirectory.workspace,
  });
  await copyRelativeFiles(packageDirectory.workspace, tempRoot, inputPaths);
  await fs.mkdir(tempProjectDir, { recursive: true });

  const packageScriptOptions = runPackageScripts ? "" : " --ignore-scripts";
  run(
    `npm install --min-release-age="${minimumReleaseAgeDays}"${packageScriptOptions}`,
  );
  run(`npm-check-updates --cooldown "${minimumReleaseAgeDays}d" -u`);

  const beforeSnapshotPaths = await collectSnapshotPaths({
    lockfiles,
    projectDir,
    workspace: packageDirectory.workspace,
  });
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
    packageDirectory.workspace,
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

  const afterSnapshotPaths = await collectSnapshotPaths({
    lockfiles,
    projectDir: tempProjectDir,
    workspace: tempRoot,
  });
  const relativePaths = [
    ...new Set([...beforeSnapshotPaths, ...afterSnapshotPaths]),
  ].sort();
  const changedFiles = await findChangedFiles(
    packageDirectory.workspace,
    tempRoot,
    relativePaths,
  );

  const lockfilePath = path.join(projectRelativePath, "package-lock.json");
  const hasLockfileChanges =
    beforeSnapshotPaths.includes(lockfilePath) &&
    changedFiles.includes(lockfilePath);

  if (!hasLockfileChanges) {
    process.exit(0);
  }

  console.error(`Updates available in: ${changedFiles.join(", ")}`);
  process.exit(1);
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}
