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

    if (entry.name !== "package.json") {
      continue;
    }

    files.push(path.relative(rootDir, path.join(currentDir, entry.name)));
  }

  return files.sort();
};

const collectSnapshotPaths = async (rootDir) => {
  const snapshotPaths = await walkPackageJsonFiles(rootDir);

  for (const fileName of ["bun.lock", "bun.lockb"]) {
    if (await fileExists(path.join(rootDir, fileName))) {
      snapshotPaths.push(fileName);
    }
  }

  return snapshotPaths.sort();
};

const collectCheckPaths = async (rootDir) => {
  const checkPaths = await collectSnapshotPaths(rootDir);

  for (const fileName of ["bunfig.toml", ".npmrc"]) {
    if (await fileExists(path.join(rootDir, fileName))) {
      checkPaths.push(fileName);
    }
  }

  return checkPaths.sort();
};

const copyRelativeFiles = async (sourceRoot, targetRoot, relativePaths) => {
  for (const relativePath of relativePaths) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
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

  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content);
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

        if (beforeVersion === afterVersion) {
          continue;
        }

        changes.push({
          field,
          relativePath,
          packageName,
          beforeVersion,
          afterVersion,
        });
      }
    }
  }

  return changes;
};

export {
  collectCheckPaths,
  collectDependencyChanges,
  collectSnapshotPaths,
  copyRelativeFiles,
  findChangedFiles,
};
