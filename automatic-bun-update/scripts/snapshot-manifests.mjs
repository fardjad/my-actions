#!/usr/bin/env bun

import fs from "node:fs/promises";
import { collectSnapshotPaths, copyRelativeFiles } from "./_shared.mjs";

const sourceRoot = process.argv[2] ?? process.cwd();
const targetRoot = process.argv[3];

if (!targetRoot) {
  console.error("Expected a target snapshot directory.");
  process.exit(1);
}

await fs.mkdir(targetRoot, { recursive: true });

const snapshotPaths = await collectSnapshotPaths(sourceRoot);
await copyRelativeFiles(sourceRoot, targetRoot, snapshotPaths);
