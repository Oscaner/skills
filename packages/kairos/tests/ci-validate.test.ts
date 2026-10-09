// packages/kairos/tests/ci-validate.test.ts — T4: validate wiring guard for kairos.
// The T15 cutover replaced the old validate tree (scripts/validate/orchestrate.ts) with
// the single orchestrator (scripts/validate.ts); this guard now pins the new wiring so
// future edits cannot drop kairos coverage from `pnpm run validate` / `pnpm run
// precommit`. Unlike the old bash guard (source grep), it imports the orchestrator and
// inspects the exported `steps` array — wiring is asserted on real step registration,
// not string matching. Also covers failure propagation: the runner returns 1 with a
// structured `== FAIL: <step> ==` on stderr when a step throws.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  engineSuiteStep,
  precommitSteps,
  steps,
  validateRunner,
} from "../../../scripts/validate.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const VAL = path.join(REPO_ROOT, "scripts/validate.ts");

// Captures validateRunner.run()'s stdout/stderr (no process.exit mock).
async function capture(fn: () => Promise<number>) {
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  let stdout = "";
  let stderr = "";
  process.stdout.write = (s) => {
    stdout += s;
    return true;
  };
  process.stderr.write = (s) => {
    stderr += s;
    return true;
  };
  try {
    const ret = await fn();
    return { stdout, stderr, ret };
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
}

test("validate orchestration entry (validate.ts) exists", () => {
  assert.ok(existsSync(VAL), `missing ${VAL}`);
});

// 1. the kairos node:test behavior-tree step must be present — the new single
// data-table validates kairos through `node --test packages/kairos/tests/*.test.ts`.
test("kairos node:test behavior tree wired with the full behavior glob", () => {
  const nt = steps.find((s) => s.name.startsWith("kairos node:test behavior tree"));
  assert.ok(nt, "kairos node:test behavior-tree step missing");
  const args = "args" in nt ? (nt.args as readonly string[]) : [];
  assert.ok(
    args.some((a) => a.includes("packages/kairos/tests/*.test.ts")),
    "behavior-tree glob missing from the node:test step",
  );
});

// 2. the engine suite step stays wired (the validate table's tree-dependent block).
test("cdd-engine engine test suite step wired", () => {
  assert.ok(
    steps.some((s) => s.name.startsWith("cdd-engine engine test suite (vitest")),
    "cdd-engine engine test suite (vitest) not wired",
  );
});

// 3. 5b legacy shell tests are not invoked by the new data table.
const OLD_SHELL_TESTS = [
  "registry-schema.test.sh",
  "cdd-select.test.sh",
  "cdd-cli-dry-run-smoke.sh",
  "cdd-common-functions.test.sh",
  "cdd-severity-contract.test.sh",
  "cdd-orchestrator-line-budget.test.sh",
];
test("legacy shell tests are not invoked", () => {
  for (const t of OLD_SHELL_TESTS) {
    assert.ok(!steps.some((s) => s.name.includes(t)), `${t} must not be invoked`);
  }
});

// 4. the guard triune is wired (anatomy · word-face · channels) — the new tree's
// contract-consumption surface; its names are semantic (AC4-shaped).
test("guard triune steps wired", () => {
  assert.ok(
    steps.some((s) => s.name.startsWith("kairos skill anatomy")),
    "admin anatomy step missing",
  );
  assert.ok(
    steps.some((s) => s.name.startsWith("word-face audit")),
    "word-face audit step missing",
  );
  assert.ok(
    steps.some((s) => s.name.startsWith("engine channel audit")),
    "engine channel audit step missing",
  );
});

// 5. rule-reference removed (reverse assertion) — no step may reference rule-reference.
test("rule-reference step removed with the suite", () => {
  assert.ok(
    !steps.some((s) => s.name.includes("rule-reference")),
    "rule-reference step must be removed with the suite",
  );
});

// 6. overall-consistency retired (no four-table step).
test("overall-consistency block retired (no four-table step)", () => {
  assert.ok(
    !steps.some((s) => s.name === "12. overall consistency"),
    "overall consistency step must not be wired (S1/S2 guards retired)",
  );
});

// 7. the pre-commit subset retains the kairos behavior tree (kairos coverage cannot
// drop at commit time) and excludes the tree-dependent engine suite.
test("precommit subset keeps kairos coverage, excludes the engine suite", () => {
  assert.ok(
    precommitSteps.length === steps.length - 1,
    "precommit subset must be one step smaller",
  );
  assert.ok(
    !precommitSteps.some((s) => s === engineSuiteStep),
    "precommit must exclude the tree-dependent engine suite",
  );
  assert.ok(
    precommitSteps.some((s) => s.name.startsWith("kairos node:test behavior tree")),
    "precommit must retain the kairos behavior tree",
  );
});

// 8. AC4 probe (D3): step names are semantic — no numeric/anchor prefixes. The
//     probe must not match any live name.
const NUMERIC_ANCHOR_PROBE = /(?:^| )\b(?:[0-9]+\.|5b\d*|5c|8-10)[. ]+[A-Za-z(]/;
test("AC4: no numeric-anchored step names in the validate wiring", () => {
  const hits = steps.map((s) => s.name).filter((n) => NUMERIC_ANCHOR_PROBE.test(n));
  assert.deepEqual(hits, [], `numeric-anchored step names remain: ${hits.join(", ")}`);
});

// 9. AC4 anti-white-green: the probe must not be vacuously green.
test("AC4 anti-white-green: legacy step names all HIT the anchor probe", () => {
  for (const name of [
    "0. unified emit freshness (emit-check)",
    "5b. kairos plugin validation",
    "5c. engine zero-residue + channel-audit grep",
    "6. marketplace validate",
    "7. scripts unit tests",
    "8-10. version sync",
    "12. overall consistency",
  ]) {
    assert.match(name, NUMERIC_ANCHOR_PROBE, `anchor probe must HIT legacy name: ${name}`);
  }
});

test("AC4 anti-white-green: semantic step names all MISS the anchor probe", () => {
  for (const name of [
    "emit freshness (scripts emit, byte-checked)",
    "kairos skill anatomy (the typed skill-anatomy contract)",
    "word-face audit (the guard-ban vocabulary from the word-table export)",
    "engine channel audit (CLI × runtime · host markers · dispatch/refs)",
    "cdd-engine engine test suite (vitest, src-next)",
    "scripts unit tests (root vitest run)",
    "kairos node:test behavior tree",
    "type-check (tsc --noEmit × 3 projects)",
    "package version sync",
  ]) {
    assert.doesNotMatch(
      name,
      NUMERIC_ANCHOR_PROBE,
      `anchor probe must MISS semantic name: ${name}`,
    );
  }
});

// 10. failure propagation — a throwing step → structured FAIL + return 1
test("runner: failing step → structured FAIL on stderr + return 1", async () => {
  const { stdout, stderr, ret } = await capture(() =>
    validateRunner.run([
      {
        name: "boom",
        run() {
          throw new Error("kaboom");
        },
      },
    ]),
  );
  assert.equal(ret, 1);
  assert.match(stdout, /== boom ==/);
  assert.match(stderr, /== FAIL: boom ==/);
  assert.match(stderr, /kaboom/);
});

// 11. success path — all-green steps → OK markers + ALL PASS + return 0
test("runner: all-green → OK + ALL PASS + return 0", async () => {
  const { stdout, stderr, ret } = await capture(() =>
    validateRunner.run([{ name: "ok", run() {} }]),
  );
  assert.equal(ret, 0);
  assert.equal(stderr, "");
  assert.match(stdout, /== ok ==/);
  assert.match(stdout, /OK/);
  assert.match(stdout, /ALL PASS/);
});
