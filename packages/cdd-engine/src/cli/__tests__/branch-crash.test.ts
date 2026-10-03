// packages/cdd-engine/src/cli/__tests__/branch-crash.test.ts
// Branch-family crash/termination lanes (T7/T8, branch-review r1 findings 1+2): the repeat-abort
// stale-carrier rotation (mirror of the task lane's step 7.5) and the T8 unified-cause threading
// that the shared schemaValidateBranch crash lane carries — the branch no-handoff faces. White-box:
// execa is mocked at the file level (the nested agent CLI never spawns); the branch lifecycle runs
// in-process over a real tmp git repo (commitSnapshot + the review→fix round/ref derivation need
// the real tree), with a ghost registry + PATH'd fake-cli binary to pass the registerGate cliInPath
// check.
//
// Faces under test, per the finding's two root defects:
//   · a SECOND consecutive abort on the resumed round-stable FIX path re-fires the crash teardown
//     (stale BLOCKED carrier rotated pre-dispatch) → fresh crash record covering the resume session;
//   · an engine-terminated (timedOut) no-handoff round routes to the TIMEOUT category with the
//     unified cause (signal-folding included) — never HARNESS_ABORT/child-*;
//   · the child-exit face keeps HARNESS_ABORT with the exit-shape cause (regression pin).

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { DispatchBlocked } from "../../dispatch/base.ts";
import { BranchFixLifecycle } from "../../dispatch/branch.ts";
import { mockExeca, writeBranchChain } from "../../infra/__tests__/helpers.ts";
import { ExitRequested, exitWithCode } from "../../infra/exit.ts";
import { REG_PATH } from "../../infra/registry.ts";

// File-level execa mock: the nested agent CLI is never spawned in these tests — the fake-cli in
// PATH exists only for the registry gate's cliInPath check.
vi.mock("execa", () => ({ execa: vi.fn() }));

function tmpGitRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-bc-"));
  execFileSync("git", ["-C", dir, "init", "-q"]);
  execFileSync("git", ["-C", dir, "config", "user.name", "cdd-test"]);
  execFileSync("git", ["-C", dir, "config", "user.email", "cdd-test@example.com"]);
  execFileSync("git", ["-C", dir, "commit", "--allow-empty", "-qm", "fixture"]);
  return dir;
}

/** Branch-fix crash fixture: a committed doc-contract-valid plan chain + the workspace + a source
 *  branch-review handoff (the round/ref + FIX_BASE the fix lane derives from) + a PATH'd fake-cli
 *  for the registry gate. Returns the paths + a cleanup. */
function setup() {
  const dir = tmpGitRepo();
  const planPath = writeBranchChain(dir, "test-plan-bc.md");
  execFileSync("git", ["-C", dir, "add", "-A"]);
  execFileSync("git", ["-C", dir, "commit", "-qm", "docs"]);
  const base = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const ws = path.join(dir, ".kairos", "cdd", "test-plan-bc");
  mkdirSync(ws, { recursive: true });
  const base7 = base.slice(0, 7);
  const head7 = "def5678";
  const reviewPath = path.join(ws, `branch-review-${base7}..${head7}-r1.json`);
  writeFileSync(
    reviewPath,
    `${JSON.stringify(
      {
        tasks: [1],
        phase: "branch-review",
        status: "CHANGES_REQUESTED",
        commits: { base, head: base },
        findings: [{ severity: "blocker" }],
        artifacts: {},
      },
      null,
      2,
    )}\n`,
  );
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bc-bin-"));
  writeFileSync(path.join(binDir, "fake-cli"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(binDir, "fake-cli"), 0o755);
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  // Ghost registry route (the ghost entry's cli is resolved by the gate, never spawned).
  const regPath = path.join(dir, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
  reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg, null, 2));
  return {
    dir,
    planPath,
    ws,
    reviewPath,
    regPath,
    handoffPath: path.join(ws, `branch-fix-${base7}..${head7}-r1.json`),
    cleanup: () => {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    },
  };
}

type CrashFixture = ReturnType<typeof setup>;

/** Drive one BranchFixLifecycle dispatch in-process (mirror of the cli wrapper's exit mapping:
 *  the inherited exit-gate DispatchBlocked → exit 1; the crash lanes exit via ExitRequested). */
async function runBranchFix(fx: CrashFixture): Promise<number | null> {
  const dryRun = false;
  const lc = new BranchFixLifecycle({
    harness: "ghost",
    plan: fx.planPath,
    findings: fx.reviewPath,
    root: fx.dir,
    registryPath: fx.regPath,
    dryRun,
    ctx: { mode: "fix", repoRoot: fx.dir, dryRun },
  });
  let exitCode: number | null = null;
  try {
    try {
      await lc.run();
    } catch (e) {
      if (e instanceof DispatchBlocked && e.gate === "exit") exitWithCode(1);
      throw e;
    }
    exitWithCode(lc.exitCode);
  } catch (e) {
    if (e instanceof ExitRequested) exitCode = e.code;
    else throw e;
  }
  return exitCode;
}

describe("branch fix crash/termination lanes (T7/T8)", () => {
  it("child-exit no-handoff face: HARNESS_ABORT carrier + crash record with the exit-shape cause (child-exit)", async () => {
    const fx = setup();
    try {
      const execa = mockExeca((await import("execa")).execa);
      execa.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "round1-trace",
        timedOut: false,
      });
      const exitCode = await runBranchFix(fx);
      expect(exitCode).toBe(1);
      const carrier = JSON.parse(readFileSync(fx.handoffPath, "utf8"));
      expect(carrier.status).toBe("BLOCKED");
      expect(carrier.failure_category).toBe("HARNESS_ABORT");
      const crash = JSON.parse(readFileSync(path.join(fx.ws, "crash-fix-1.json"), "utf8"));
      expect(crash.cause).toBe("child-exit");
      expect(crash.exitCode).toBe(1);
      expect(crash.stderrTail).toContain("round1-trace");
      expect(crash.next).toContain("cdd fix --type branch");
    } finally {
      fx.cleanup();
    }
  });

  it("engine-terminated (timedOut, signal) no-handoff face: TIMEOUT category + unified cause — not HARNESS_ABORT/child-*", async () => {
    const fx = setup();
    try {
      const execa = mockExeca((await import("execa")).execa);
      // spawnManaged folds res.signal === "SIGTERM" → timedOut + cause "signal".
      execa.mockResolvedValue({
        exitCode: 143,
        stdout: "",
        stderr: "term-trace",
        signal: "SIGTERM",
      });
      const exitCode = await runBranchFix(fx);
      expect(exitCode).toBe(1);
      const carrier = JSON.parse(readFileSync(fx.handoffPath, "utf8"));
      expect(carrier.status).toBe("TIMEOUT");
      expect(carrier.failure_category).toBe("TIMEOUT");
      const crash = JSON.parse(readFileSync(path.join(fx.ws, "crash-fix-1.json"), "utf8"));
      expect(crash.cause).toBe("child-signal"); // the signal-folding classification (task-lane parity)
      expect(crash.exitCode).toBe(143);
      expect(crash.stderrTail).toContain("term-trace");
    } finally {
      fx.cleanup();
    }
  });

  it("repeat-abort rotation: a SECOND consecutive abort on the resumed round-stable fix path re-fires the crash teardown → fresh crash record covering the resume session", async () => {
    const fx = setup();
    try {
      const execa = mockExeca((await import("execa")).execa);
      // Round 1: agent aborts → HARNESS_ABORT teardown + carrier at the round-stable fix path.
      execa.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "round1-trace",
        timedOut: false,
      });
      const r1 = await runBranchFix(fx);
      expect(r1).toBe(1);
      expect(JSON.parse(readFileSync(fx.handoffPath, "utf8")).failure_category).toBe(
        "HARNESS_ABORT",
      );
      const rec1 = JSON.parse(readFileSync(path.join(fx.ws, "crash-fix-1.json"), "utf8"));
      expect(rec1.stderrTail).toContain("round1-trace");
      // Resume (same command — the fix round is pinned to the source review's round/ref): agent
      // aborts AGAIN with a new trace. The stale round-1 carrier must be rotated pre-dispatch so
      // the teardown re-fires with the resume session's output.
      execa.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "round2-trace",
        timedOut: false,
      });
      const r2 = await runBranchFix(fx);
      expect(r2).toBe(1);
      expect(JSON.parse(readFileSync(fx.handoffPath, "utf8")).failure_category).toBe(
        "HARNESS_ABORT",
      );
      const rec2 = JSON.parse(readFileSync(path.join(fx.ws, "crash-fix-1.json"), "utf8"));
      expect(rec2.stderrTail).toContain("round2-trace"); // fresh record — not the stale round-1 one
      expect(existsSync(fx.handoffPath)).toBe(true); // the fresh BLOCKED carrier replaced the rotated stale one
    } finally {
      fx.cleanup();
    }
  });
});
