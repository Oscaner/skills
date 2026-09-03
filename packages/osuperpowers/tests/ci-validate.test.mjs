// packages/osuperpowers/tests/ci-validate.test.mjs — T4: validate 编排的 osuperpowers 接线守卫。
// Node port of ci-validate-wiring.test.sh: guards scripts/ci-validate.mjs so future edits
// cannot drop osuperpowers coverage from `pnpm run validate`. Unlike the bash guard (source
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

// 1. == 5b. osuperpowers plugin validation == marker present
test("5b marker step present", () => {
  const idx = steps.findIndex((s) => s.name === "5b. osuperpowers plugin validation");
  assert.ok(idx !== -1, "missing 5b. osuperpowers plugin validation marker step");
});

// 2. plugin.json structural check present (osuperpowers plugin validation + skills-count print)
test("osuperpowers plugin validation + skills-count wired", () => {
  assert.ok(steps.some((s) => s.name.includes("osuperpowers plugin validation")), "5b marker step missing");
  assert.ok(steps.some((s) => s.name.includes("osuperpowers skills")), "skills-count step missing");
});

// 3. 5b node:test 跑两棵树（行为/集成 + 模块）；旧 shell engine 测试不得再被 invoke
const OLD_SHELL_TESTS = [
  "registry-schema.test.sh",
  "cdd-select.test.sh",
  "cdd-cli-dry-run-smoke.sh",
  "cdd-commit-gate-smoke.sh",
  "cdd-common-functions.test.sh",
  "cdd-severity-contract.test.sh",
  "cdd-orchestrator-line-budget.test.sh",
];
function behaviorNodeTestStep() {
  return steps.find((s) => s.name.startsWith("5b. node:test") && s.args?.some((a) => a === "--test"));
}
test("5b node:test 跑行为 + 引擎两棵树；旧 shell 测试不 invoke", () => {
  const markerIndex = steps.findIndex((s) => s.name === "5b. osuperpowers plugin validation");
  assert.ok(markerIndex !== -1, "5b marker missing");
  const nt = behaviorNodeTestStep();
  assert.ok(nt, "5b node:test 步骤缺失");
  assert.ok(nt.args.some((a) => a.includes("packages/osuperpowers/tests/*.test.mjs")), "行为树 glob 缺失");
  assert.ok(nt.args.some((a) => a.includes("packages/osuperpowers/bin/engine/tests/*.test.mjs")), "引擎模块树 glob 缺失");
  const idx = steps.indexOf(nt);
  assert.ok(idx > markerIndex, "node:test 步骤位于 5b marker 之前");
  for (const t of OLD_SHELL_TESTS) {
    assert.ok(!steps.some((s) => s.name.includes(t)), `${t} 不应再被 invoke`);
  }
});

// 4. rule-reference.test.mjs invoked via node --test (semantic mode is enforced
// by the suite's real-scan test case, not CLI args)
test("rule-reference.test.mjs invoked via node --test", () => {
  const rr = steps.find((s) => s.name.includes("rule-reference.test.mjs"));
  assert.ok(rr, "rule-reference.test.mjs not invoked");
  assert.equal(rr.cmd, "node", "rule-reference must run under node");
  assert.ok(rr.args.includes("--test"), "rule-reference must run via node --test");
  assert.ok(rr.args.some((a) => a.includes("rule-reference.test.mjs")), "rule-reference.test.mjs path missing");
});

// 5. node:test gate + init + engine suites wired (T1-T3 node:test aggregation)
test("node:test 步骤含 gate + init + engine 套件 glob", () => {
  const nt = behaviorNodeTestStep();
  assert.ok(nt, "5b node:test 步骤缺失");
  assert.ok(nt.args.some((a) => a.includes("packages/osuperpowers/bin/gate/tests/*.test.mjs")), "gate suite glob missing");
  assert.ok(nt.args.some((a) => a.includes("packages/osuperpowers/bin/init/tests/*.test.mjs")), "init suite glob missing");
  assert.ok(nt.args.some((a) => a.includes("packages/osuperpowers/bin/engine/tests/*.test.mjs")), "engine suite glob missing");
});

// 6. engine zero-residue check present (grep targets + OK echo)
test("zero-residue check present with correct grep targets", () => {
  const zr = steps.find((s) => s.name.startsWith("5c."));
  assert.ok(zr, "zero-residue check missing");
  assert.ok(zr.grepTargets?.includes("packages/osuperpowers/skills"), "zero-residue grep misses osuperpowers/skills");
  assert.ok(zr.grepTargets?.includes("packages/osuperpowers/bin"), "zero-residue grep misses osuperpowers/bin");
});

// 7. 5b2 osuperpowers gate hooks check present
test("5b2 osuperpowers gate hooks step present", () => {
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
