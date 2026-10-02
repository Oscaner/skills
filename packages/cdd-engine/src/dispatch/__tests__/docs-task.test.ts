// packages/cdd-engine/src/dispatch/__tests__/docs-task.test.ts
// exercised through the merged single CLI (dist/cli.mjs). Invocation map (D11: type
// 自解释 target 参数):
//   docs-task --mode review --template <t>  → cdd review --type spec|plan [--spec/--plan <path>]
//   docs-task --mode fix --template <t>     → cdd fix --type spec|plan [--spec/--plan <path>]
// P6 T3: docs workspace derives entirely via resolveWorkspace(doc) (.kairos/cdd/<slug>/) — the
// test must pass a repo-local doc for the workspace derivation; the fix round parses --findings
// (named <type>-review-{R}.json).
// **5b CLI 黑盒用例依赖「入口门意义下的干净树」（E2②/G4①，P6 T10）**：docs 家族 dry-run（review/
// fix --type spec|plan）以 cwd=REPO_ROOT 黑盒运行，入口门（rules/commit.ts）放行依赖两态之一——
// 真实干净树，或 dirty + dry-run 的 CDD_WARN 降级（exit 0，纯模拟）。本文件期望按 E2② 编写；
// 入口门/dry-run 协议语义变更需同步维护此处（详见 vitest.config.mjs 5b）。

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
const CDD_MJS = path.join(REPO_ROOT, "packages/cdd-engine/dist/cli.mjs");
const SMOKE_PLAN = path.join("packages/cdd-engine/src/cli/__tests__/fixtures/smoke-plan.md");
// SMOKE_PLAN-derived workspace = .kairos/cdd/smoke/ (engine workspaceSlug strips the
// trailing -plan: smoke-plan.md → smoke) — the test teardown clears it so validate-root noise
// cannot pollute the F6 single root (same semantics as the branch-review/cdd.test tmp/teardown
// migration) (T10 warn).
// **Do not clean smoke/**: the engine self-provisions it on test runs, shared by the same slug
// in cdd / cli-shape / host-detection / lifecycle.wiring — deleting it races those files'
// brief self-provisioning (directory removed between mkdirSync and generateBrief → ENOENT false
// red). `.kairos` is gitignored, so residue never pollutes the version tree.
afterAll(() => {
  rmSync(FINDINGS_DIR, { recursive: true, force: true });
});

// Legal findings names (round source) — since P4 T2 `--findings` normalizes via resolveDocArg
// (repo-root relative → absolute, missing → exit 1 with the three-line diagnostic, read point ⑦),
// a fixture must be materialized on disk. The landing dir is a dedicated tmp dir, not
// `.kairos/cdd/smoke/`: the latter is SMOKE_PLAN's workspace, and planting spec-review-1.json there
// would let cdd.test.mjs's same-slug case hit Review Convergence (cross-file shared disk). The
// round parses only from the file name; location is irrelevant.
const FINDINGS_DIR = mkdtempSync(path.join(tmpdir(), "cdd-doctask-findings-"));
const SPEC_FINDINGS = path.join(FINDINGS_DIR, "spec-review-1.json");
const PLAN_FINDINGS = path.join(FINDINGS_DIR, "plan-review-1.json");
for (const f of [SPEC_FINDINGS, PLAN_FINDINGS]) {
  writeFileSync(f, JSON.stringify({ status: "CHANGES_REQUESTED", findings: [] }));
}
// The lifecycle path is purely derived: always <repoRoot>/.kairos/cdd/lifecycle.json; concurrency
// safety rests on reapStale's owner-liveness judgement, not on path separation.

function run(
  args: string[],
  extraEnv: Record<string, string | undefined> = {},
  opts: { noHost?: boolean } = {},
) {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  // Host detection is ambient-env driven — a no-host test must explicitly delete the
  // host markers (parent session may carry CLAUDE_CODE_SESSION_ID/AI_AGENT) (T3).
  if (opts.noHost) {
    delete env.CLAUDE_CODE_SESSION_ID;
    delete env.CURSOR_TRACE_ID;
    delete env.AI_AGENT;
  }
  return spawnSync("node", [CDD_MJS, ...args], {
    cwd: REPO_ROOT,
    env: { ...env, ...extraEnv },
    encoding: "utf8",
  });
}

describe("cdd review/fix --type spec|plan CLI contract", () => {
  it("-h → citty help on stdout + exit 0", () => {
    const r = run(["-h"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/USAGE cdd/);
  });

  it("no host env → CDD_BLOCKED + exit 1 (harness resolved from ambient host, no flag)", () => {
    const r = run(["review", "--type", "spec", "--spec", "/x.md"], {}, { noHost: true });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
  });

  it("missing --spec (type=spec target param) → stderr + exit 2", () => {
    const r = run(["review", "--type", "spec"], { CLAUDE_CODE_SESSION_ID: "1" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/missing required --spec/);
  });

  it("dry-run review --type spec → exit 0", () => {
    const r = run(["--dry-run", "review", "--type", "spec", "--spec", SMOKE_PLAN], {
      CLAUDE_CODE_SESSION_ID: "1",
    });
    expect(r.status, r.stderr).toBe(0);
  });

  it("dry-run review --type plan → exit 0", () => {
    const r = run(["--dry-run", "review", "--type", "plan", "--plan", SMOKE_PLAN], {
      CLAUDE_CODE_SESSION_ID: "1",
    });
    expect(r.status, r.stderr).toBe(0);
  });

  it("dry-run fix --type spec → exit 0（T3: round 从 --findings spec-review-{R}.json 名解析）", () => {
    const r = run(
      ["--dry-run", "fix", "--type", "spec", "--spec", SMOKE_PLAN, "--findings", SPEC_FINDINGS],
      { CLAUDE_CODE_SESSION_ID: "1" },
    );
    expect(r.status, r.stderr).toBe(0);
  });

  it("dry-run fix --type plan → exit 0", () => {
    const r = run(
      ["--dry-run", "fix", "--type", "plan", "--plan", SMOKE_PLAN, "--findings", PLAN_FINDINGS],
      { CLAUDE_CODE_SESSION_ID: "1" },
    );
    expect(r.status, r.stderr).toBe(0);
  });
});
