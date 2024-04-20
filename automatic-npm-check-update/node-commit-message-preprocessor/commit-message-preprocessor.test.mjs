import { test } from "node:test";
import assert from "node:assert";
import childProcess from "node:child_process";
import fs from "node:fs";

const __dirname = new URL(".", import.meta.url).pathname;

const runPreprocessor = (commitMessage) => {
  const child = childProcess.spawnSync(
    "node",
    ["commit-message-preprocessor.mjs"],
    {
      cwd: __dirname,
      input: commitMessage,
      stdio: ["pipe", "pipe", "inherit"],
      encoding: "utf-8",
    },
  );

  return child;
};

test("deep", (t) => {
  const commitMessage = fs.readFileSync(
    __dirname + "/__fixtures__/deep.txt",
    "utf-8",
  );

  const child = runPreprocessor(commitMessage);

  assert.strictEqual(
    child.output.join("\n").trim(),
    "Commit Title\n\na: ^0.0.0\nb: ^0.0.0",
  );

  assert.strictEqual(child.status, 0);
});

test("shallow", (t) => {
  const commitMessage = fs.readFileSync(
    __dirname + "/__fixtures__/shallow.txt",
    "utf-8",
  );

  const child = runPreprocessor(commitMessage);

  assert.strictEqual(
    child.output.join("\n").trim(),
    "Commit Title\n\na: ^0.0.0",
  );

  assert.strictEqual(child.status, 0);
});
