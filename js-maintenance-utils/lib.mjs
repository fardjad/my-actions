import childProcess from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const EXCLUDED_DIRS = new Set([".git", "node_modules"]);
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const resolvePackageDirectory = (workspaceArg, workingDirectoryArg) => {
  if (!workspaceArg) {
    throw new Error("Expected a repository workspace path.");
  }

  if (workingDirectoryArg === undefined || workingDirectoryArg.trim() === "") {
    throw new Error("working-directory must not be empty.");
  }

  if (
    path.isAbsolute(workingDirectoryArg) ||
    path.win32.isAbsolute(workingDirectoryArg)
  ) {
    throw new Error(
      "working-directory must be relative to the repository workspace.",
    );
  }

  if (workingDirectoryArg.includes("..")) {
    throw new Error("working-directory must not contain '..'.");
  }

  const workspace = path.resolve(workspaceArg);
  const absolute = path.resolve(workspace, workingDirectoryArg);
  const relative = path.relative(workspace, absolute);

  if (
    relative.startsWith("..") ||
    relative === ".." ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "working-directory must stay inside the repository workspace.",
    );
  }

  return {
    absolute,
    relative: relative === "" ? "." : relative,
    workspace,
  };
};

const walkPackageJsonFiles = async (rootDir, currentDir = rootDir) => {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      files.push(
        ...(await walkPackageJsonFiles(
          rootDir,
          path.join(currentDir, entry.name),
        )),
      );
      continue;
    }

    if (entry.name === "package.json") {
      files.push(path.relative(rootDir, path.join(currentDir, entry.name)));
    }
  }

  return files.sort();
};

const toRootRelativePath = (rootDir, filePath) =>
  path.relative(rootDir, filePath);

const collectSnapshotPaths = async ({ lockfiles, projectDir, workspace }) => {
  const snapshotPaths = (await walkPackageJsonFiles(projectDir)).map(
    (relativePath) =>
      toRootRelativePath(workspace, path.join(projectDir, relativePath)),
  );

  for (const fileName of lockfiles) {
    const lockfilePath = path.join(projectDir, fileName);
    if (await fileExists(lockfilePath)) {
      snapshotPaths.push(toRootRelativePath(workspace, lockfilePath));
    }
  }

  return snapshotPaths.sort();
};

const collectInputPaths = async ({
  configFiles = [],
  lockfiles,
  projectDir,
  workspace,
}) => {
  const inputPaths = await collectSnapshotPaths({
    lockfiles,
    projectDir,
    workspace,
  });

  for (const fileName of configFiles) {
    const configPath = path.join(projectDir, fileName);
    if (await fileExists(configPath)) {
      inputPaths.push(toRootRelativePath(workspace, configPath));
    }
  }

  return inputPaths.sort();
};

const copyRelativeFiles = async (sourceRoot, targetRoot, relativePaths) => {
  for (const relativePath of relativePaths) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
};

const snapshotProject = async ({
  lockfiles,
  projectDir,
  targetRoot,
  workspace,
}) => {
  await fs.mkdir(targetRoot, { recursive: true });
  await copyRelativeFiles(
    workspace,
    targetRoot,
    await collectSnapshotPaths({ lockfiles, projectDir, workspace }),
  );
};

const readFileOrNull = async (rootDir, relativePath) => {
  const filePath = path.join(rootDir, relativePath);

  if (!(await fileExists(filePath))) {
    return null;
  }

  return fs.readFile(filePath);
};

const findChangedFiles = async (beforeRoot, afterRoot, relativePaths) => {
  const changedFiles = [];

  for (const relativePath of relativePaths) {
    const [beforeContent, afterContent] = await Promise.all([
      readFileOrNull(beforeRoot, relativePath),
      readFileOrNull(afterRoot, relativePath),
    ]);

    const beforeText = beforeContent?.toString("utf-8") ?? null;
    const afterText = afterContent?.toString("utf-8") ?? null;

    if (beforeText !== afterText) {
      changedFiles.push(relativePath);
    }
  }

  return changedFiles.sort();
};

const readJsonOrNull = async (rootDir, relativePath) => {
  const filePath = path.join(rootDir, relativePath);

  if (!(await fileExists(filePath))) {
    return null;
  }

  return JSON.parse(await fs.readFile(filePath, "utf-8"));
};

const collectDependencyChanges = async (
  beforeRoot,
  afterRoot,
  relativePaths,
) => {
  const changes = [];

  for (const relativePath of relativePaths) {
    const [beforeJson, afterJson] = await Promise.all([
      readJsonOrNull(beforeRoot, relativePath),
      readJsonOrNull(afterRoot, relativePath),
    ]);

    for (const field of DEPENDENCY_FIELDS) {
      const beforeDeps = beforeJson?.[field] ?? {};
      const afterDeps = afterJson?.[field] ?? {};
      const packageNames = new Set([
        ...Object.keys(beforeDeps),
        ...Object.keys(afterDeps),
      ]);

      for (const packageName of [...packageNames].sort()) {
        const beforeVersion = beforeDeps[packageName] ?? null;
        const afterVersion = afterDeps[packageName] ?? null;

        if (beforeVersion !== afterVersion) {
          changes.push({
            afterVersion,
            beforeVersion,
            field,
            packageName,
            relativePath,
          });
        }
      }
    }
  }

  return changes;
};

const renderUpdateSummary = async ({
  afterRoot,
  beforeRoot,
  lockfiles,
  projectDir,
}) => {
  const projectRelativePath = path.relative(afterRoot, projectDir);
  const beforeProjectRoot = path.join(beforeRoot, projectRelativePath);
  const snapshotPaths = await collectSnapshotPaths({
    lockfiles,
    projectDir: beforeProjectRoot,
    workspace: beforeRoot,
  });
  const packageJsonPaths = snapshotPaths.filter(
    (relativePath) =>
      relativePath.endsWith("/package.json") || relativePath === "package.json",
  );
  const dependencyChanges = await collectDependencyChanges(
    beforeRoot,
    afterRoot,
    packageJsonPaths,
  );

  if (dependencyChanges.length > 0) {
    return dependencyChanges
      .map(
        ({ field, relativePath, packageName, beforeVersion, afterVersion }) =>
          `${relativePath} ${field}.${packageName}: ${
            beforeVersion ?? "(missing)"
          } -> ${afterVersion ?? "(removed)"}`,
      )
      .join("\n");
  }

  const changedFiles = await findChangedFiles(
    beforeRoot,
    afterRoot,
    snapshotPaths,
  );
  const lockfilePaths = lockfiles.map((fileName) =>
    path.join(projectRelativePath, fileName),
  );

  if (
    changedFiles.some((relativePath) => lockfilePaths.includes(relativePath))
  ) {
    return "Lockfile-only dependency refresh.";
  }

  return "Dependency refresh.";
};

const stageProject = ({ addLockfiles, lockfiles, packagePath }) => {
  childProcess.execFileSync("git", ["add", "-u", "--", packagePath], {
    stdio: "inherit",
  });

  if (addLockfiles === "never") {
    return;
  }

  if (addLockfiles === "subdirectory" && packagePath === ".") {
    return;
  }

  for (const lockfile of lockfiles) {
    childProcess.spawnSync(
      "git",
      ["add", "--", path.join(packagePath, lockfile)],
      {
        stdio: "ignore",
      },
    );
  }
};

export {
  collectDependencyChanges,
  collectInputPaths,
  collectSnapshotPaths,
  copyRelativeFiles,
  findChangedFiles,
  renderUpdateSummary,
  resolvePackageDirectory,
  snapshotProject,
  stageProject,
};
