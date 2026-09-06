#!/usr/bin/env node
// scripts/validate/gate-hooks.mjs — block 5b2: osuperpowers gate hooks
// (hooks.json + hooks-cursor.json exist; claude/cursor adapters executable).

import { accessSync, constants, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runIfMain } from "./runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

function isExecutable(p) {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function checkOsuperpowersGateHooks() {
  const p = path.join(ROOT, "packages/osuperpowers");
  for (const f of ["hooks/hooks.json", "hooks/hooks-cursor.json"]) {
    assert(existsSync(path.join(p, f)), `missing: ${f}`);
  }
  for (const f of [
    "bin/gate/adapters/claude.mjs",
    "bin/gate/adapters/cursor.mjs",
  ]) {
    assert(isExecutable(path.join(p, f)), `not executable: ${f}`);
  }
  console.log("OK — osuperpowers gate hooks executable");
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

export const steps = [
  {
    name: "5b2. osuperpowers gate hooks executable",
    run: checkOsuperpowersGateHooks,
  },
];

runIfMain(import.meta.url, steps);