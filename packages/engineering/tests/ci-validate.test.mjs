// packages/engineering/tests/ci-validate.test.mjs — T4: validate 编排的 engineering 接线守卫。
// Node port of ci-validate-wiring.test.sh: guards scripts/ci-validate.mjs so future edits
// cannot drop engineering coverage from `pnpm run validate`. Unlike the bash guard (source
// grep), this imports the orchestrator and inspects the exported `steps` array — wiring is
// asserted on real step registration, not string matching. Also covers failure propagation:
// main() returns 1 with a structured `== FAIL: <step> ==` on stderr when a step throws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { steps, main } from "../../../scripts/ci-validate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const VAL = path.join(REPO_ROOT, "scripts/ci-validate.mjs");

// 捕获 main() 的 stdout/stderr（对齐 runner.test.mjs capture 模式，无需 mock process.exit）。
async function capture(fn) {
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
  let ret;
  try {
    ret = await fn();
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
  return { stdout, stderr, ret };
}

test("ci-validate.mjs 存在", () => {
  assert.ok(existsSync(VAL), `missing ${VAL}`);
});

// 1. == 5b. engineering plugin validation == marker present
test("5b marker step present", () => {
  const idx = steps.findIndex((s) => s.name === "5b. engineering plugin validation");
  assert.ok(idx !== -1, "missing 5b. engineering plugin validation marker step");
});

// 2. plugin.json structural check present (engineering plugin validation + skills-count print)
test("engineering plugin validation + skills-count wired", () => {
  assert.ok(steps.some((s) => s.name.includes("engineering plugin validation")), "5b marker step missing");
  assert.ok(steps.some((s) => s.name.includes("engineering skills")), "skills-count step missing");
});

// 3. every engine test invoked exactly once, after the 5b marker
const ENGINE_TESTS = [
  "registry-schema.test.sh",
  "cdd-select.test.sh",
  "cdd-cli-dry-run-smoke.sh",
  "cdd-commit-gate-smoke.sh",
  "cdd-common-functions.test.sh",
  "cdd-severity-contract.test.sh",
];
test("6 engine shell tests wired exactly once inside 5b", () => {
  const markerIndex = steps.findIndex((s) => s.name === "5b. engineering plugin validation");
  assert.ok(markerIndex !== -1, "5b marker missing");
  for (const t of ENGINE_TESTS) {
    const idxs = steps.map((s, i) => (s.name.includes(t) ? i : -1)).filter((i) => i !== -1);
    assert.equal(idxs.length, 1, `${t}: expected 1 invocation in ci-validate.mjs, got ${idxs.length}`);
    assert.ok(idxs[0] > markerIndex, `${t}: invoked before == 5b == block`);
  }
});

// 4. rule-reference invoked with semantic-only --skills args
test("rule-reference invoked with semantic-only --skills args", () => {
  const rr = steps.find((s) => s.name.includes("rule-reference.test.py"));
  assert.ok(rr, "rule-reference.test.py not invoked");
  assert.ok(
    rr.args.join(" ").includes("--skills packages/engineering/skills:semantic"),
    "rule-reference --skills args missing/wrong",
  );
});

// 5. node:test gate + os-init + engine suites wired (T1-T3 node:test aggregation)
test("node:test gate + os-init + engine suites wired", () => {
  const nt = steps.find((s) => s.name.includes("node:test gate"));
  assert.ok(nt, "node:test gate+engine suite step missing");
  assert.ok(nt.args.some((a) => a.includes("packages/engineering/bin/gate/tests/*.test.mjs")), "gate suite glob missing");
  assert.ok(nt.args.some((a) => a.includes("packages/engineering/bin/os-init/tests/*.test.mjs")), "os-init suite glob missing");
  assert.ok(nt.args.some((a) => a.includes("packages/engineering/bin/engine/tests/*.test.mjs")), "engine suite glob missing");
});

// 6. engine + router zero-residue check present (grep targets + OK echo)
test("zero-residue check present with correct grep targets", () => {
  const zr = steps.find((s) => s.name.startsWith("5c."));
  assert.ok(zr, "zero-residue check missing");
  assert.ok(zr.grepTargets?.includes("packages/engineering/skills"), "zero-residue grep misses engineering/skills");
  assert.ok(
    zr.grepTargets?.includes("packages/superpowers-overrides/build/generated"),
    "zero-residue grep misses router build/generated",
  );
});

// 7. 5b2 engineering gate hooks check present
test("5b2 engineering gate hooks step present", () => {
  assert.ok(steps.some((s) => s.name.startsWith("5b2.")), "5b2 gate hooks check missing");
});

// 8. the wiring guard itself is invoked by the orchestrator (guards the guard)
test("orchestrator invokes ci-validate.test.mjs wiring guard", () => {
  const guard = steps.find((s) => s.args?.some((a) => a.includes("ci-validate.test.mjs")));
  assert.ok(guard, "ci-validate.test.mjs not invoked by orchestrator");
});

// 9. failure propagation — a throwing step → structured FAIL + return 1
test("main: failing step → structured FAIL on stderr + return 1", async () => {
  const { stdout, stderr, ret } = await capture(() => main([{ name: "boom", run() { throw new Error("kaboom"); } }]));
  assert.equal(ret, 1);
  assert.match(stdout, /== boom ==/);
  assert.match(stderr, /== FAIL: boom ==/);
  assert.match(stderr, /kaboom/);
});

// 10. success path — all-green steps → OK markers + ALL PASS + return 0
test("main: all-green → OK + ALL PASS + return 0", async () => {
  const { stdout, stderr, ret } = await capture(() => main([{ name: "ok", run() {} }]));
  assert.equal(ret, 0);
  assert.equal(stderr, "");
  assert.match(stdout, /== ok ==/);
  assert.match(stdout, /OK/);
  assert.match(stdout, /ALL PASS/);
});
