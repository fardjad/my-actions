#!/usr/bin/env node

import readline from "node:readline";

const createPromiseWithResolvers = () => {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const readLinesFromStdin = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, // This ensures readline doesn't treat input as a terminal
  });

  const lines = [];

  rl.on("line", (line) => {
    lines.push(line);
  });

  const { promise: waitForStdin, resolve } = createPromiseWithResolvers();

  rl.on("close", () => {
    resolve(lines);
  });

  await waitForStdin;

  return lines;
};

const isDeep = (ncuOutput) => {
  if (Object.values(ncuOutput).some((value) => typeof value === "object")) {
    return true;
  }
};

const printVersions = (data) => {
  let deps = data;

  if (isDeep(data)) {
    deps = Object.values(data).reduce((acc, obj) => ({ ...acc, ...obj }), {});
  }

  const output = [];
  for (const [key, value] of Object.entries(deps)) {
    output.push(`${key}: ${value}`);
  }

  return output.join("\n");
};

const splitCommitMessage = (commitMessageLines) => {
  const title = commitMessageLines[0];
  const body = commitMessageLines.slice(1).join("\n");

  return { title, body };
};

const stdinLines = await readLinesFromStdin();
const { title, body } = splitCommitMessage(stdinLines);

console.log(title);
const ncuOutput = JSON.parse(body);
console.log(`\n${printVersions(ncuOutput)}`);
