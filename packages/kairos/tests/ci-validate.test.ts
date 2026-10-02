// packages/kairos/tests/ci-validate.test.ts — T4: validate wiring guard for kairos.
// Node port of ci-validate-wiring.test.sh: guards scripts/validate/index.ts so future edits
// cannot drop kairos coverage from `pnpm run validate`. Unlike the bash guard (source
// grep), this imports the orchestrator and inspects the exported `steps` array — wiring is
// asserted on real step registration, not string matching. Also covers failure propagation:
// main() returns 1 with a structured `== FAIL: <step> ==` on stderr when a step throws.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// The composed step set + main() live at the named orchestrate.ts entry (directory-index
// imports are not used under the T4 nodenext typecheck — see scripts/validate/orchestrate.ts).
import { main, steps } from "../../../scripts/validate/orchestrate.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const VAL = path.join(REPO_ROOT, "scripts/validate/index.ts");

// Captures main()'s stdout/stderr (aligning with the runner capture pattern — no process.exit mock).
async function capture(fn: () => unknown) {
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

test("validate orchestration entry (index.ts) exists", () => {
  assert.ok(existsSync(VAL), `missing ${VAL}`);
});

// 1. == kairos plugin resolution == marker present
test("kairos plugin resolution marker step present", () => {
  const idx = steps.findIndex((s) => s.name === "kairos plugin resolution");
  assert.ok(idx !== -1, "missing kairos plugin resolution marker step");
});

// 2. plugin.json structural check present (kairos plugin resolution + skills-count print)
test("kairos plugin resolution + skills-count wired", () => {
  assert.ok(
    steps.some((s) => s.name.includes("kairos plugin resolution")),
    "kairos plugin resolution step missing",
  );
  assert.ok(
    steps.some((s) => s.name.includes("kairos skills")),
    "skills-count step missing",
  );
});

// 3. 5b node:test runs the two trees (behavior/integration + engine); legacy shell tests are not invoked
const OLD_SHELL_TESTS = [
  "registry-schema.test.sh",
  "cdd-select.test.sh",
  "cdd-cli-dry-run-smoke.sh",
  "cdd-common-functions.test.sh",
  "cdd-severity-contract.test.sh",
  "cdd-orchestrator-line-budget.test.sh",
];
function behaviorNodeTestStep() {
  return steps.find(
    (s) =>
      s.name.startsWith("kairos node:test behavior tree") && s.args?.some((a) => a === "--test"),
  );
}
test("5b node:test runs the behavior + engine trees; legacy shell tests are not invoked", () => {
  const markerIndex = steps.findIndex((s) => s.name === "kairos plugin resolution");
  assert.ok(markerIndex !== -1, "kairos plugin resolution marker missing");
  const nt = behaviorNodeTestStep();
  assert.ok(nt, "kairos node:test behavior-tree step missing");
  assert.ok(
    nt.args?.some((a) => a.includes("packages/kairos/tests/*.test.ts")) ?? false,
    "behavior-tree glob missing",
  );
  assert.ok(
    steps.some((s) => s.name.startsWith("cdd-engine engine test suite (vitest)")),
    "cdd-engine engine test suite (vitest) not wired",
  );
  const idx = steps.indexOf(nt);
  assert.ok(idx > markerIndex, "node:test step must sit after the 5b marker");
  for (const t of OLD_SHELL_TESTS) {
    assert.ok(!steps.some((s) => s.name.includes(t)), `${t} must not be invoked`);
  }
});

// 4. rule-reference suite removed (T16 Step 2 ③) — reverse assertion: no step may
// reference rule-reference (suite file + validate wiring + ci-validate wiring are
// deleted in the same commit). The old case asserted the step EXISTS, which went red
// the moment the validate wiring was removed — this keeps AC13 reachable.
test("rule-reference step removed with the suite", () => {
  assert.ok(
    !steps.some((s) => s.name.includes("rule-reference")),
    "rule-reference step must be removed with the suite",
  );
});

// 5. node:test behavior + engine suites wired (T2 removed init/utils suite globs — the
//    harness selection/detection/install layers are deleted)
test("node:test steps carry the behavior glob, no init/utils suite globs (T2), engine suite stays", () => {
  const nt = behaviorNodeTestStep();
  assert.ok(nt, "5b node:test step missing");
  assert.ok(
    !(nt.args?.some((a) => a.includes("packages/kairos/bin/init/tests/*.test.ts")) ?? true),
    "init suite glob remainder",
  );
  assert.ok(
    !(nt.args?.some((a) => a.includes("packages/kairos/bin/utils/tests/*.test.ts")) ?? true),
    "utils suite glob remainder",
  );
  assert.ok(
    steps.some((s) => s.name.startsWith("cdd-engine engine test suite (vitest)")),
    "cdd-engine engine test suite (vitest) missing",
  );
});

// 6. engine zero residue + channel audit check present (grep targets + OK echo)
test("zero-residue check present with correct grep targets", () => {
  const zr = steps.find((s) => s.name === "engine zero residue + channel audit");
  assert.ok(zr, "engine zero residue + channel audit check missing");
  assert.ok(
    zr.grepTargets?.includes("packages/kairos/skills"),
    "zero-residue grep misses kairos/skills",
  );
  assert.ok(
    zr.grepTargets?.includes("packages/cdd-engine/src"),
    "zero-residue grep misses cdd-engine/src (re-org: mechanism files moved into src/)",
  );
  assert.ok(
    zr.grepTargets?.includes("packages/cdd-engine/config"),
    "zero-residue grep misses cdd-engine/config (C7: the read-as-data home)",
  );
});

// 6b. channel-audit scope pinned (T8 + P6 Task 3): the 5c step must carry channelTargets covering the
// §2.8 rows 1–11 and 13 guard scopes — a future edit silently narrowing one fails the wiring guard.
// P6 Task 3: tests/ retired — src/**/__tests__ test positions are source-tree paths now (walk default
// self-exempt); the retired top-level dir must NOT be re-added to the scope.
// C7 (P4): the schema resources moved from templates/schema to config/schema.
test("5c channel-audit targets pinned (T8)", () => {
  const zr = steps.find((s) => s.name === "engine zero residue + channel audit");
  assert.ok(zr, "engine zero residue + channel audit check missing");
  assert.ok(Array.isArray(zr.channelTargets), "5c step missing channelTargets meta");
  for (const p of [
    "packages/cdd-engine/src",
    "packages/cdd-engine/config/schema",
    "packages/kairos/skills",
    "scripts",
  ]) {
    assert.ok(zr.channelTargets.includes(p), `channel-audit scope misses ${p}`);
  }
  assert.ok(
    !zr.channelTargets.includes("packages/cdd-engine/tests"),
    "channel-audit scope must not reference retired tests/ dir",
  );
});

// 7. the wiring guard itself is invoked by the orchestrator (guards the guard)
test("orchestrator invokes ci-validate.test.ts wiring guard", () => {
  const guard = steps.find((s) => s.args?.some((a) => a.includes("ci-validate.test.ts")));
  assert.ok(guard, "ci-validate.test.ts not invoked by orchestrator");
});

// 8. failure propagation — a throwing step → structured FAIL + return 1
test("main: failing step → structured FAIL on stderr + return 1", async () => {
  const { stdout, stderr, ret } = await capture(() =>
    main([
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

// 9. success path — all-green steps → OK markers + ALL PASS + return 0
test("main: all-green → OK + ALL PASS + return 0", async () => {
  const { stdout, stderr, ret } = await capture(() => main([{ name: "ok", run() {} }]));
  assert.equal(ret, 0);
  assert.equal(stderr, "");
  assert.match(stdout, /== ok ==/);
  assert.match(stdout, /OK/);
  assert.match(stdout, /ALL PASS/);
});

// 10. overall-consistency block retired (P3 T1) — the four-table guard is deleted,
//     so no "12. overall consistency" step may be wired
test("overall-consistency block retired (no four-table step)", () => {
  assert.ok(
    !steps.some((s) => s.name === "12. overall consistency"),
    "overall consistency step must not be wired (S1/S2 guards retired)",
  );
});

// 11. block composition pinned by name-set (P3 T1 retired the four-table block;
//     T2 upgraded the count pin to a name-set) — every expected step must be
//     present by name, including the pi-package well-formed guard.
const EXPECTED_VALIDATE_STEPS = [
  "emit freshness (checked against regenerated products)",
  "kairos plugin resolution",
  "kairos skills inventory count",
  "kairos node:test behavior tree",
  "validate wiring guard (ci-validate.test.ts)",
  "kairos pi-package well-formed",
  "cdd-engine dev stub materialization",
  "cdd-engine engine test suite (vitest)",
  "engine zero residue + channel audit",
  "marketplace manifests validate",
  "emit harness registry consistency",
  "scripts unit tests (vitest)",
  "type-check (tsc --noEmit × 3 projects)",
  "package version sync",
];
test("validate wiring carries every expected step by name (name-set pin)", () => {
  const names = new Set(steps.map((s) => s.name));
  for (const n of EXPECTED_VALIDATE_STEPS) {
    assert.ok(names.has(n), `missing expected validate step: ${n}`);
  }
});

// 12. AC4 probe (D3): step names are semantic — no numeric/anchor prefixes. The
//     probe must not match any live name (prefix-anchored, whole-string judgement:
//     digit-prefixed names are all caught, semantic names zero false positives).
const NUMERIC_ANCHOR_PROBE = /(?:^| )\b(?:[0-9]+\.|5b\d*|5c|8-10)[. ]+[A-Za-z(]/;
test("AC4: no numeric-anchored step names in the validate wiring", () => {
  const hits = steps.map((s) => s.name).filter((n) => NUMERIC_ANCHOR_PROBE.test(n));
  assert.deepEqual(hits, [], `numeric-anchored step names remain: ${hits.join(", ")}`);
});

// 13. AC4 anti-white-green: the probe must not be vacuously green. Legacy names
//     all HIT; current semantic names all MISS.
test("AC4 anti-white-green: legacy step names all HIT the anchor probe", () => {
  for (const name of [
    "0. unified emit freshness (emit-check)",
    "5b. kairos plugin validation",
    "5b. kairos skills-count",
    "5b1. cdd-engine Vitest engine suite",
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
    "emit freshness (checked against regenerated products)",
    "kairos plugin resolution",
    "kairos skills inventory count",
    "kairos pi-package well-formed",
    "kairos node:test behavior tree",
    "validate wiring guard (ci-validate.test.ts)",
    "cdd-engine dev stub materialization",
    "cdd-engine engine test suite (vitest)",
    "engine zero residue + channel audit",
    "marketplace manifests validate",
    "scripts unit tests (vitest)",
    "package version sync",
  ]) {
    assert.doesNotMatch(
      name,
      NUMERIC_ANCHOR_PROBE,
      `anchor probe must MISS semantic name: ${name}`,
    );
  }
});
