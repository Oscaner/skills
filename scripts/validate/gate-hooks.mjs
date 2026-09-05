#!/usr/bin/env node
// scripts/validate/gate-hooks.mjs — block 5b2: osuperpowers gate hooks
// (hooks.json + hooks-cursor.json exist; claude/cursor adapters executable).

import { accessSync, constants, existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

function main(stepsArg = steps) {
  for (const s of stepsArg) {
    try {
      console.log(`== ${s.name} ==`);
      s.run();
      console.log("OK");
    } catch (e) {
      console.error(`== FAIL: ${s.name} ==`);
      console.error(e?.message ?? String(e));
      return 1;
    }
  }
  console.log("ALL PASS");
  return 0;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  Promise.resolve(main())
    .then((code) => process.exit(code != null ? code : 1))
    .catch(() => process.exit(1));
}