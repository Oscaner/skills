// packages/cdd-engine/src/dispatch/__tests__/lifecycle-validation.test.ts — Task 29 (spec T7.8):
// the two lifecycle template-method hooks black-boxed on the task face — docContractValidate
// (pre-flight, after validateMode: three invalid doc fixtures → blocked exit 1 + guidance; the
// dry-run WARN lane) and statusValidate (post-flight: the CDD_INFO six-state line + plan verdict on
// a normal dispatch). Exit code table 0/1/2/3 asserted unchanged (the doc-contract block lands on
// exit 1; the cli-missing lane stays exit 2; a passing dispatch exits 0).
import { it, expect, describe } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { TaskLifecycle } from "../task.ts";
import { REG_PATH } from "../../infra/registry.ts";
import { captureStderr } from "../../infra/__tests__/helpers.ts";

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/** Fresh git repo: the `.osuperpowers/cdd/` workspace is gitignored (engine writes stay out of the
 * tree), the doc chain is committed → the entry gate sees a clean tree. */
function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-lifecycle-val-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(dest, "-c", "user.name=lifecycle-test", "-c", "user.email=lifecycle-test@example.com", "commit", "--allow-empty", "-qm", "fixture");
  return dest;
}

/** Registry copy outside the repo (an untracked registry.json inside would dirty the tree). cli
 * "env" resolves on PATH so a REAL non-dry dispatch passes the checkHarness probe and reaches the
 * doc-contract gate (dispatch itself never runs — the gate fires pre-flight). */
function registry(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-lifecycle-reg-"));
  const regPath = path.join(dir, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8")) as Record<string, unknown>;
  (reg as Record<string, unknown>).ctr = { cli: "env", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));
  return regPath;
}

const SPEC_DIR = "docs/osuperpowers/specs";
const PLAN_DIR = "docs/osuperpowers/plans";
const OVERALL = [
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "|---|---|---|---|---|---|---|",
  "| P1 | phase one | [Pending] | Pending | | none |",
  "",
  "## Change history",
  "",
  "| Version | date | summary |",
  "|---|---|---|",
  "| v1.0 | 2026-09-21 | Initial |",
  "",
].join("\n");
const SPEC = [
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)",
  "",
].join("\n");
const PLAN = [
  "# Plan",
  "",
  "**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)",
  "",
  "## Constraints",
  "",
  "- boundary one",
  "",
  "### Task 1: x",
  "body",
  "",
].join("\n");

/** write the committed doc chain; null member / explicit body overrides per fixture. */
function writeChain(repo: string, overrides: { plan?: string; spec?: string; overall?: string } = {}): void {
  mkdirSync(path.join(repo, SPEC_DIR), { recursive: true });
  mkdirSync(path.join(repo, PLAN_DIR), { recursive: true });
  writeFileSync(path.join(repo, PLAN_DIR, "plan.md"), overrides.plan ?? PLAN);
  writeFileSync(path.join(repo, SPEC_DIR, "plan-design.md"), overrides.spec ?? SPEC);
  writeFileSync(path.join(repo, SPEC_DIR, "plan-overall.md"), overrides.overall ?? OVERALL);
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=lifecycle-test", "-c", "user.email=lifecycle-test@example.com", "commit", "-qm", "docs");
}

interface RunShape {
  lc: TaskLifecycle;
  cap: { text: string };
}

/** run a review dispatch through the TaskLifecycle; real (non-dry) unless dryRun — review mode keeps
 * the implement-only constraints/pre-submit pre-flight out of the way so the doc-contract gate is
 * the sole downstream judge. */
async function runReview(repo: string, { dryRun = false } = {}): Promise<{ exitCode: number; diagnostic: { prefix: string; msg: string } | null; stderr: string }> {
  const cap = captureStderr();
  const lc = new TaskLifecycle({
    harness: "ctr",
    tasks: [1],
    opts: {
      mode: "review",
      dryRun,
      noExit: true,
      root: repo,
      planFile: path.join(PLAN_DIR, "plan.md"),
      registryPath: registry(),
    },
    ctx: { mode: "review", repoRoot: repo, handoffPath: "", dryRun },
  });
  try {
    await lc.run();
  } finally {
    cap.restore();
  }
  return { exitCode: lc.result.exitCode, diagnostic: lc.diagnostic, stderr: cap.text };
}

describe("docContractValidate — three invalid doc contracts block the real dispatch (exit 1 + guidance)", () => {
  it("plan invalid: no `**Spec:**` reference + no Constraints source → blocked with plan guidance", async () => {
    const repo = setupRepo();
    writeChain(repo, { plan: "# Plan\n\n### Task 1: x\nbody\n" });
    const r = await runReview(repo);
    expect(r.exitCode).toBe(1);
    expect(r.diagnostic?.prefix).toBe("CDD_BLOCKED");
    expect(r.diagnostic?.msg).toMatch(/doc contract validation failed/);
    expect(r.diagnostic?.msg).toContain("- [plan]");
    expect(r.diagnostic?.msg).toContain("plan.md");
    expect(r.diagnostic?.msg).toContain("`**Spec:**`");
    expect(r.diagnostic?.msg).toContain("Constraints source");
    expect(r.diagnostic?.msg).toMatch(/→ add a|→ declare/); // actionable fix prose
  });

  it("spec invalid: missing `**Version**` line → blocked with phase-spec guidance", async () => {
    const repo = setupRepo();
    writeChain(repo, { spec: "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)\n" });
    const r = await runReview(repo);
    expect(r.exitCode).toBe(1);
    expect(r.diagnostic?.msg).toContain("- [phase spec]");
    expect(r.diagnostic?.msg).toContain("plan-design.md");
    expect(r.diagnostic?.msg).toContain("`**Version**`");
    expect(r.diagnostic?.msg).toContain("add a `- **Version**");
  });

  it("overall invalid: non-canonical Phase inventory header → blocked with overall guidance", async () => {
    const repo = setupRepo();
    writeChain(repo, {
      overall: [
        "- **Version**: v1.0 · 2026-09-21",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Acceptance criteria | Dependency |",
        "|---|---|---|---|---|",
        "| P1 | phase one | | | none |",
        "",
      ].join("\n"),
    });
    const r = await runReview(repo);
    expect(r.exitCode).toBe(1);
    expect(r.diagnostic?.msg).toContain("- [overall]");
    expect(r.diagnostic?.msg).toContain("plan-overall.md");
    expect(r.diagnostic?.msg).toMatch(/canonical|Implementation plan/);
  });

  it("dry-run WARN lane: the same invalid plan does NOT exit 1 — the check warns and the simulation completes", async () => {
    const repo = setupRepo();
    writeChain(repo, { plan: "# Plan\n\n### Task 1: x\nbody\n" });
    const r = await runReview(repo, { dryRun: true });
    expect(r.exitCode).toBe(0); // warn-not-block (E2② entry-gate precedent)
    expect(r.stderr).toContain("CDD_WARN: doc contract invalid (dry-run)");
    expect(r.stderr).toContain("`**Spec:**`");
  });
});

describe("statusValidate — CDD_INFO six-state line + plan verdict on a normal dispatch", () => {
  it("valid chain + dry-run review → exit 0 + `task 1 state: in-flight` + the pending verdict", async () => {
    const repo = setupRepo();
    writeChain(repo);
    const r = await runReview(repo, { dryRun: true });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toContain("CDD_INFO: task 1 state: in-flight");
    expect(r.stderr).toContain("CDD_INFO: 0/1 complete — pending: task 1 (in-flight)");
  });
});

describe("exit code table preserved (0/1/2/3)", () => {
  it("doc-contract BLOCK lands on exit 1 (never the cli-missing 2 or the usage 3)", async () => {
    const repo = setupRepo();
    writeChain(repo, { plan: "# Plan\n\n### Task 1: x\nbody\n" });
    const r = await runReview(repo);
    expect(r.exitCode).toBe(1);
  });

  it("a real dispatch with an unresolvable harness CLI still exits 2 (cli-missing lane untouched)", async () => {
    const repo = setupRepo();
    writeChain(repo);
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-lifecycle-reg-"));
    const regPath = path.join(dir, "registry.json");
    const reg = JSON.parse(readFileSync(REG_PATH, "utf8")) as Record<string, unknown>;
    (reg as Record<string, unknown>).ctr = { cli: "cdd-no-such-binary-xyz", invoke: "-p", output: "text", ship: "full" };
    writeFileSync(regPath, JSON.stringify(reg));
    const lc = new TaskLifecycle({
      harness: "ctr",
      tasks: [1],
      opts: { mode: "review", dryRun: false, noExit: true, root: repo, planFile: path.join(PLAN_DIR, "plan.md"), registryPath: regPath },
      ctx: { mode: "review", repoRoot: repo, handoffPath: "", dryRun: false },
    });
    await lc.run();
    expect(lc.result.exitCode).toBe(2);
    expect(lc.diagnostic?.prefix).toBe("CDD_CLI_MISSING");
  });
});
