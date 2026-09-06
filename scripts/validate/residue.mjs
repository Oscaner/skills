#!/usr/bin/env node
// scripts/validate/residue.mjs — block 5c: engine zero-residue grep
// (sdd_/SDD_/sdd-run-/spor- must not regress in engine executable products).
// The grepTargets meta is consumed by the wiring guard
// (packages/osuperpowers/tests/ci-validate.test.mjs) to pin the target set.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "tinyglobby";

import { runIfMain } from "./runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const RESIDUE_TARGETS = [
  "packages/osuperpowers/bin",
  "packages/osuperpowers/skills",
];
const RESIDUE_RE = /\b(sdd_|_sdd_|SDD_|sdd-run-|spor-)/;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function checkZeroResidue() {
  const hits = [];
  for (const t of RESIDUE_TARGETS) {
    // tinyglobby replaces the hand-written recursive walk; `dot: true` is
    // required so hidden dirs (e.g. .claude-plugin/) are scanned too.
    for (const f of globSync("**/*", { cwd: path.join(ROOT, t), absolute: true, dot: true })) {
      const buf = readFileSync(f);
      if (buf.includes(0)) continue; // binary — grep -rn reports, doesn't content-match
      if (RESIDUE_RE.test(buf.toString("utf8"))) hits.push(path.relative(ROOT, f));
    }
  }
  assert(hits.length === 0, `RESIDUE FOUND — sdd_/SDD_/sdd-run-/spor- in engine executable products:\n  ${hits.join("\n  ")}`);
  console.log("OK — zero residue in engine executable products");
}

export const steps = [
  {
    name: "5c. engine zero-residue grep",
    run: checkZeroResidue,
    grepTargets: RESIDUE_TARGETS,
  },
];

runIfMain(import.meta.url, steps);