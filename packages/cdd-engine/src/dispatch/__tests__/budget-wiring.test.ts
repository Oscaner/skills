// packages/cdd-engine/src/dispatch/__tests__/budget-wiring.test.ts
// T9 budget-dimension wiring assertions: every dispatch island passes its ACTUAL op
// into resolveTerminationConfig, so the spawn receives terminationCfg.budgetMs = the canonical
// default of the DISPATCHED op (implement 6h / review 3h / fix 6h). The wiring is what escaped
// before — the previous bugs were all hardcoded budget keys at the spawn points:
//   task.ts     hardcoded "task"    → `cdd review --type task` read the IMPLEMENT budget
//                                     (the T7 accident: a task review overrunning 2h was never
//                                     capped by the 1h review budget — no review cutoff);
//   docs.ts     hardcoded "review"  → docs fix read the REVIEW budget;
//   branch.ts   branch-fix hardcoded "review" → branch-fix read the REVIEW budget.
// The resolver UNIT tests (infra.invoke.test.ts / cli-shared.test.ts) own the DEFAULT VALUES; this
// file owns the WIRING — the op the island hands to the resolver + the budget that reaches the
// spawn seam (invokeCli / invokeCliWithRetry's termination argument). Seven op combos are pinned:
//   task.implement 6h · task.review 3h · task.fix 6h · branch.review 3h · branch.fix 6h ·
//   docs.review 3h · docs.fix 6h.
//
// Technique: prototype spies on EngineInvoker (all three islands' module-scope invokers are plain
// `new EngineInvoker()` class instances — class methods live on the prototype, so a prototype spy
// intercepts them regardless of module-load order). resolveTerminationConfig records the op and
// DELEGATES to the real resolver (the canonical defaults stay the single source); invokeCli /
// invokeCliWithRetry capture the TerminationConfig the island passes to the spawn and delegate to
// the real spawn (execa is mocked — the budget seam is asserted, no real binary ever runs).

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("execa", () => ({ execa: vi.fn() }));
const { GHOST_REG } = vi.hoisted(() => ({
  GHOST_REG: {
    ghost: {
      cli: "fake-cli",
      invoke: "-p",
      output: "text",
      ship: "full",
      prefix: {
        implement: "",
        review: { task: "", spec: "", plan: "", branch: "" },
        fix: "",
      },
      suffix: {},
    },
  },
}));
vi.mock("../../infra/registry.ts", async () => {
  const actual =
    await vi.importActual<typeof import("../../infra/registry.ts")>("../../infra/registry.ts");
  class MockRegistry extends actual.Registry {
    load = vi.fn(() => GHOST_REG);
  }
  return { ...actual, Registry: MockRegistry };
});

import { execa } from "execa";
import { commitValidDocs, gitInit, writeBranchChain } from "../../infra/__tests__/helpers.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { ExitRequested } from "../../infra/exit.ts";
import { type DispatchOp, EngineInvoker } from "../../infra/invoke.ts";
import { BranchFixLifecycle, BranchReviewLifecycle } from "../branch.ts";
import { DocsLifecycle } from "../docs.ts";
import { TaskLifecycle } from "../task.ts";

const defaults = new ConfigLoader().engineConfig().contextContract.timeouts.defaults as Record<
  DispatchOp,
  number
>;
// The acceptance budget table (implement 6h / review 3h / fix 6h) read from the canonical —
// the wiring resolves against the SAME single source the resolver reads.
const BUDGET: Record<DispatchOp, number> = {
  implement: 21_600_000,
  review: 10_800_000,
  fix: 21_600_000,
};
for (const op of ["implement", "review", "fix"] as const) {
  expect(defaults[op]).toBe(BUDGET[op]);
}

// ---- EngineInvoker prototype spies (record + delegate) ----

type TerminationArg = { budgetMs?: number } | undefined;

const origResolve = EngineInvoker.prototype.resolveTerminationConfig;
const origInvokeCli = EngineInvoker.prototype.invokeCli;
const origInvokeCliWithRetry = EngineInvoker.prototype.invokeCliWithRetry;

const resolveSpy = vi.spyOn(EngineInvoker.prototype, "resolveTerminationConfig");
const invokeCliSpy = vi.spyOn(EngineInvoker.prototype, "invokeCli");
const invokeCliWithRetrySpy = vi.spyOn(EngineInvoker.prototype, "invokeCliWithRetry");

// One recorded wiring row per dispatch: the op the island hands to the resolver + the budget the
// spawn receives (captured on the TerminationConfig the island passes to the spawn seam).
let recorded: Array<{ op: string; budgetMs: number | undefined }>;
beforeEach(() => {
  recorded = [];
});

resolveSpy.mockImplementation(function (
  this: EngineInvoker,
  mode: DispatchOp,
  overrides,
  progressPath,
) {
  recorded.push({ op: mode, budgetMs: undefined });
  return origResolve.call(this, mode, overrides, progressPath);
});
invokeCliSpy.mockImplementation(async function (
  this: EngineInvoker,
  entry,
  prompt,
  params,
  env,
  cwd,
  termination: TerminationArg,
) {
  const last = recorded[recorded.length - 1];
  if (last) last.budgetMs = termination?.budgetMs;
  return origInvokeCli.call(this, entry, prompt, params, env, cwd, termination);
});
invokeCliWithRetrySpy.mockImplementation(async function (
  this: EngineInvoker,
  entry,
  prompt,
  params,
  env,
  cwd,
  termination: TerminationArg,
) {
  const last = recorded[recorded.length - 1];
  if (last) last.budgetMs = termination?.budgetMs;
  return origInvokeCliWithRetry.call(this, entry, prompt, params, env, cwd, termination);
});

// ---- fixtures ----

function git(repo: string, ...args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/** Doc-contract-valid clean repo (the entry/doc gates pass) + gitignored engine workspace. */
function makeRepo(): string {
  const repo = mkdtempSync(path.join(tmpdir(), "cdd-budget-wiring-"));
  gitInit(repo);
  // Workspace bootstrap: the engine's `.kairos/cdd/` writes stay out of the tracked tree.
  writeFileSync(path.join(repo, ".gitignore"), ".kairos/\n");
  execFileSync("git", ["-C", repo, "add", "-A"], { encoding: "utf8" });
  execFileSync(
    "git",
    ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "gitignore"],
    { encoding: "utf8" },
  );
  return repo;
}

function installFakeCli(): () => void {
  const bin = mkdtempSync(path.join(tmpdir(), "cdd-budget-fakecli-"));
  writeFileSync(path.join(bin, "fake-cli"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(bin, "fake-cli"), 0o755);
  const origPath = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${origPath}`;
  return () => {
    process.env.PATH = origPath;
  };
}
const restorePath = installFakeCli();
afterAll(restorePath);

// The fake agent (execa is mocked): a successful spawn whose stdout is the implement 3-line
// return block (commits ground on the repo HEAD) — the task implement run stays green end-to-end.
function mockAgentReturnBlock(repo: string): void {
  const head = git(repo, "rev-parse", "HEAD");
  vi.mocked(execa).mockImplementation(async () => ({
    exitCode: 0,
    stdout: `status: APPROVED\ncommits: base=${head} head=${head}\nartifacts: brief=b report=r test_evidence=e\n`,
    stderr: "",
    signal: undefined,
    timedOut: false,
  }));
}

async function runTaskDispatch(mode: DispatchOp, repo: string): Promise<unknown> {
  const planFile = commitValidDocs(repo);
  if (mode === "fix") {
    // The fix round's source: a previous review handoff (the findings input the fix path reads).
    const wsDir = path.join(repo, ".kairos", "cdd", "plan");
    mkdirSync(wsDir, { recursive: true });
    writeFileSync(
      path.join(wsDir, "tasks-1-review-1.json"),
      JSON.stringify({
        status: "CHANGES_REQUESTED",
        findings: [{ severity: "blocker", summary: "b" }],
        artifacts: {},
      }),
    );
  }
  mockAgentReturnBlock(repo);
  return TaskLifecycle.run("ghost", 1, {
    mode,
    planFile,
    root: repo,
    noExit: true,
  });
}

const TASK_COMBOS: Array<[DispatchOp, number]> = [
  ["implement", 21_600_000],
  ["review", 10_800_000],
  ["fix", 21_600_000],
];

describe("task island — spawn budget keyed by the DISPATCHED op (review --type task reads review 3h, not the implement 6h)", () => {
  it.each(TASK_COMBOS)("task.%s → spawn terminationCfg.budgetMs = %i", async (mode, budget) => {
    const repo = makeRepo();
    await runTaskDispatch(mode, repo);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].op).toBe(mode); // the island passes its actual op — never the legacy "task"
    expect(recorded[0].budgetMs).toBe(budget);
  });
});

async function runDocsDispatch(mode: "review" | "fix", repo: string): Promise<unknown> {
  commitValidDocs(repo);
  // The doc-contract-valid spec the docs lane audits (the same valid chain the fixtures commit).
  const doc = path.join(repo, "docs", "kairos", "specs", "plan-design.md");
  const wsDir = path.join(repo, ".kairos", "cdd", "plan");
  mkdirSync(wsDir, { recursive: true });
  vi.mocked(execa).mockResolvedValue({
    exitCode: 0,
    stdout: "",
    stderr: "",
    signal: undefined,
    timedOut: false,
  });
  return DocsLifecycle.run({
    harness: "ghost",
    mode,
    template: "review",
    type: "spec",
    doc,
    handoffPath: path.join(wsDir, mode === "review" ? "spec-review-1.json" : "spec-fix-1.json"),
    repoRoot: repo,
    dryRun: false,
  });
}

describe("docs island — spawn budget keyed by the DISPATCHED op (docs fix reads fix 6h, not the hardcoded review 3h)", () => {
  it.each([["review", 10_800_000] as const, ["fix", 21_600_000] as const])(
    "docs.%s → spawn terminationCfg.budgetMs = %i",
    async (mode, budget) => {
      const repo = makeRepo();
      await runDocsDispatch(mode, repo);
      expect(recorded).toHaveLength(1);
      expect(recorded[0].op).toBe(mode);
      expect(recorded[0].budgetMs).toBe(budget);
    },
  );
});

async function runBranchDispatch(mode: "review" | "fix", repo: string): Promise<unknown> {
  const planAbs = writeBranchChain(repo, "pi-branch.md");
  execFileSync("git", ["-C", repo, "add", "-A"], { encoding: "utf8" });
  execFileSync(
    "git",
    ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "branch chain"],
    { encoding: "utf8" },
  );
  const head = git(repo, "rev-parse", "HEAD");
  const base = git(repo, "rev-parse", "HEAD~1");
  const base7 = base.slice(0, 7);
  const head7 = head.slice(0, 7);
  vi.mocked(execa).mockResolvedValue({
    exitCode: 0,
    stdout: "",
    stderr: "",
    signal: undefined,
    timedOut: false,
  });
  if (mode === "review") {
    const lc = new BranchReviewLifecycle({
      plan: planAbs,
      base,
      head,
      harness: "ghost",
      type: "branch",
      root: repo,
      dryRun: false,
      ctx: { mode: "branch-review", repoRoot: repo, dryRun: false },
    });
    await expect(lc.run()).rejects.toBeInstanceOf(ExitRequested); // no-agent-handoff BLOCKED lane
    return undefined;
  }
  const findingsPath = path.join(
    repo,
    ".kairos",
    "cdd",
    "pi-branch",
    `branch-review-${base7}..${head7}-r1.json`,
  );
  mkdirSync(path.dirname(findingsPath), { recursive: true });
  writeFileSync(
    findingsPath,
    JSON.stringify({
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker", summary: "b" }],
      commits: { base, head },
      artifacts: {},
    }),
  );
  const lc = new BranchFixLifecycle({
    plan: planAbs,
    findings: findingsPath,
    harness: "ghost",
    type: "branch",
    root: repo,
    dryRun: false,
    ctx: { mode: "fix", repoRoot: repo, dryRun: false },
  });
  await expect(lc.run()).rejects.toBeInstanceOf(ExitRequested); // no-agent-handoff BLOCKED lane
  return undefined;
}

describe("branch island — spawn budget keyed by the DISPATCHED op (branch-fix reads fix 6h, not the hardcoded review 3h)", () => {
  it.each([["review", 10_800_000] as const, ["fix", 21_600_000] as const])(
    "branch.%s → spawn terminationCfg.budgetMs = %i",
    async (mode, budget) => {
      const repo = makeRepo();
      await runBranchDispatch(mode, repo);
      expect(recorded).toHaveLength(1);
      expect(recorded[0].op).toBe(mode);
      expect(recorded[0].budgetMs).toBe(budget);
    },
  );
});
