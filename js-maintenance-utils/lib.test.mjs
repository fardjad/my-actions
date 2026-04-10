import assert from "node:assert";
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  collectInputPaths,
  collectSnapshotPaths,
  copyRelativeFiles,
  findChangedFiles,
  renderUpdateSummary,
  resolvePackageDirectory,
  stageProject,
} from "./lib.mjs";

const makeTempRepo = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), "js-maintenance-utils-test-"));

const __dirname = new URL(".", import.meta.url).pathname;

test("resolves repository root", () => {
  const workspace = path.join(os.tmpdir(), "repo");
  const result = resolvePackageDirectory(workspace, ".");

  assert.strictEqual(result.absolute, workspace);
  assert.strictEqual(result.relative, ".");
});

test("resolves subdirectory relative to repository root", () => {
  const workspace = path.join(os.tmpdir(), "repo");
  const result = resolvePackageDirectory(workspace, "opencode-plugin");

  assert.strictEqual(result.absolute, path.join(workspace, "opencode-plugin"));
  assert.strictEqual(result.relative, "opencode-plugin");
});

test("rejects invalid working-directory values", () => {
  const workspace = path.join(os.tmpdir(), "repo");

  assert.throws(
    () => resolvePackageDirectory(workspace, ""),
    /must not be empty/,
  );
  assert.throws(
    () => resolvePackageDirectory(workspace, "/tmp/project"),
    /must be relative/,
  );
  assert.throws(
    () => resolvePackageDirectory(workspace, "packages/../app"),
    /must not contain '\.\.'/,
  );
  assert.throws(
    () => resolvePackageDirectory(workspace, "../outside"),
    /must not contain '\.\.'/,
  );
});

test("collects root project paths by default", async () => {
  const repo = await makeTempRepo();

  await fs.writeFile(path.join(repo, "package.json"), "{}\n");
  await fs.writeFile(path.join(repo, "bun.lock"), "root lock\n");

  assert.deepStrictEqual(
    await collectSnapshotPaths({
      lockfiles: ["bun.lock", "bun.lockb"],
      projectDir: repo,
      workspace: repo,
    }),
    ["bun.lock", "package.json"],
  );
});

test("collects only selected subdirectory project paths", async () => {
  const repo = await makeTempRepo();
  const project = path.join(repo, "opencode-plugin");

  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(path.join(repo, "package.json"), "{}\n");
  await fs.writeFile(path.join(repo, "bun.lock"), "root lock\n");
  await fs.writeFile(path.join(project, "package.json"), "{}\n");
  await fs.writeFile(path.join(project, "bun.lock"), "plugin lock\n");
  await fs.writeFile(
    path.join(project, ".npmrc"),
    "registry=https://example.test\n",
  );

  assert.deepStrictEqual(
    await collectSnapshotPaths({
      lockfiles: ["bun.lock", "bun.lockb"],
      projectDir: project,
      workspace: repo,
    }),
    ["opencode-plugin/bun.lock", "opencode-plugin/package.json"],
  );
  assert.deepStrictEqual(
    await collectInputPaths({
      configFiles: [".npmrc"],
      lockfiles: ["bun.lock", "bun.lockb"],
      projectDir: project,
      workspace: repo,
    }),
    [
      "opencode-plugin/.npmrc",
      "opencode-plugin/bun.lock",
      "opencode-plugin/package.json",
    ],
  );
});

test("finds lockfile-only changes in selected subdirectory", async () => {
  const before = await makeTempRepo();
  const after = await makeTempRepo();

  await fs.mkdir(path.join(before, "opencode-plugin"), { recursive: true });
  await fs.mkdir(path.join(after, "opencode-plugin"), { recursive: true });
  await fs.writeFile(
    path.join(before, "opencode-plugin", "bun.lock"),
    "before\n",
  );
  await fs.writeFile(
    path.join(after, "opencode-plugin", "bun.lock"),
    "after\n",
  );

  assert.deepStrictEqual(
    await findChangedFiles(before, after, ["opencode-plugin/bun.lock"]),
    ["opencode-plugin/bun.lock"],
  );
});

test("copies selected project files without root project files", async () => {
  const repo = await makeTempRepo();
  const target = await makeTempRepo();

  await fs.mkdir(path.join(repo, "opencode-plugin"), { recursive: true });
  await fs.writeFile(path.join(repo, "package.json"), "{}\n");
  await fs.writeFile(
    path.join(repo, "opencode-plugin", "package.json"),
    "{}\n",
  );

  await copyRelativeFiles(repo, target, ["opencode-plugin/package.json"]);

  await assert.rejects(fs.access(path.join(target, "package.json")));
  await assert.doesNotReject(
    fs.access(path.join(target, "opencode-plugin", "package.json")),
  );
});

test("renders subdirectory dependency summary with repository-relative paths", async () => {
  const before = await makeTempRepo();
  const after = await makeTempRepo();
  const project = path.join(after, "opencode-plugin");

  await fs.mkdir(path.join(before, "opencode-plugin"), { recursive: true });
  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(
    path.join(before, "opencode-plugin", "package.json"),
    JSON.stringify({ dependencies: { zod: "^4.3.6" } }),
  );
  await fs.writeFile(
    path.join(after, "opencode-plugin", "package.json"),
    JSON.stringify({ dependencies: { zod: "^4.3.7" } }),
  );

  assert.strictEqual(
    await renderUpdateSummary({
      afterRoot: after,
      beforeRoot: before,
      lockfiles: ["bun.lock", "bun.lockb"],
      projectDir: project,
    }),
    "opencode-plugin/package.json dependencies.zod: ^4.3.6 -> ^4.3.7",
  );
});

test("renders subdirectory lockfile-only summary", async () => {
  const before = await makeTempRepo();
  const after = await makeTempRepo();
  const project = path.join(after, "opencode-plugin");

  await fs.mkdir(path.join(before, "opencode-plugin"), { recursive: true });
  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(
    path.join(before, "opencode-plugin", "package.json"),
    "{}",
  );
  await fs.writeFile(path.join(after, "opencode-plugin", "package.json"), "{}");
  await fs.writeFile(
    path.join(before, "opencode-plugin", "bun.lock"),
    "before\n",
  );
  await fs.writeFile(
    path.join(after, "opencode-plugin", "bun.lock"),
    "after\n",
  );

  assert.strictEqual(
    await renderUpdateSummary({
      afterRoot: after,
      beforeRoot: before,
      lockfiles: ["bun.lock", "bun.lockb"],
      projectDir: project,
    }),
    "Lockfile-only dependency refresh.",
  );
});

test("cli resolves relative package paths", () => {
  const child = childProcess.spawnSync(
    "node",
    [
      path.join(__dirname, "cli.mjs"),
      "resolve",
      "/tmp/repo",
      "plugin",
      "relative",
    ],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
  );

  assert.strictEqual(child.status, 0);
  assert.strictEqual(child.stdout.trim(), "plugin");
});

test("stages only the selected subdirectory project", async () => {
  const repo = await makeTempRepo();
  const project = path.join(repo, "opencode-plugin");

  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(path.join(repo, "package.json"), "{}\n");
  await fs.writeFile(path.join(project, "package.json"), "{}\n");

  for (const args of [
    ["init"],
    ["config", "user.email", "test@example.com"],
    ["config", "user.name", "Test User"],
    ["add", "."],
    ["commit", "-m", "initial"],
  ]) {
    childProcess.execFileSync("git", args, { cwd: repo, stdio: "ignore" });
  }

  await fs.writeFile(path.join(repo, "package.json"), '{"private":true}\n');
  await fs.writeFile(path.join(project, "package.json"), '{"private":true}\n');
  await fs.writeFile(path.join(project, "package-lock.json"), "{}\n");

  const previousCwd = process.cwd();
  process.chdir(repo);
  try {
    stageProject({
      addLockfiles: "subdirectory",
      lockfiles: ["package-lock.json"],
      packagePath: "opencode-plugin",
    });
  } finally {
    process.chdir(previousCwd);
  }

  const child = childProcess.spawnSync(
    "git",
    ["diff", "--cached", "--name-only"],
    {
      cwd: repo,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  assert.strictEqual(child.status, 0);
  assert.deepStrictEqual(child.stdout.trim().split("\n").sort(), [
    "opencode-plugin/package-lock.json",
    "opencode-plugin/package.json",
  ]);
});
