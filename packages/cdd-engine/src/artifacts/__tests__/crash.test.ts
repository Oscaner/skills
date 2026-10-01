// packages/cdd-engine/src/artifacts/__tests__/crash.test.ts
// T7 crash recovery — the CrashTeardown artifact family: Workspace.crashPath(lane, round) naming,
// resumeCommandFor (the same-command reconstruction), the tail capture window, and the integrated
// teardown (crash-only snapshot + crash record write on a real git fixture).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { Workspace } from "../../infra/workspace.ts";
import {
  CRASH_TAIL_LINES,
  CrashTeardown,
  crashCauseFor,
  isStaleCrashRecord,
  resumeCommandFor,
} from "../crash.ts";

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
}

// Real git fixture — repo-level identity so the crash snapshot's simple-git commit works on CI too.
function setupGitRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-crash-ts-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  git(dest, "init", "-q");
  git(dest, "config", "user.name", "cdd-crash-test");
  git(dest, "config", "user.email", "cdd-crash-test@example.com");
  git(dest, "add", "-A");
  git(dest, "commit", "-qm", "fixture");
  return dest;
}

function teardownOpts(
  repo: string,
  ws: string,
  extra: Partial<Parameters<CrashTeardown["run"]>[0]> = {},
) {
  return {
    lane: "implement",
    round: 1,
    exitCode: 3,
    cause: "child-exit",
    stdout: "A\nB\n",
    stderr: "boom from the harness\n",
    attemptedHandoff: path.join(ws, "tasks-1-implement.json"),
    next: "cdd implement --tasks 1 --plan /p.md",
    workspace: Workspace.fromPath(ws),
    repoRoot: repo,
    ...extra,
  } as Parameters<CrashTeardown["run"]>[0];
}

describe("artifacts/crash.ts — resumeCommandFor (the same-command reconstruction)", () => {
  it("implement carries no --type; review/fix/branch/docs shapes mirror the CLI surface", () => {
    expect(resumeCommandFor({ op: "implement", type: "task", group: "1", plan: "/p.md" })).toBe(
      "cdd implement --tasks 1 --plan /p.md",
    );
    expect(resumeCommandFor({ op: "review", type: "task", group: "2", plan: "/p.md" })).toBe(
      "cdd review --type task --tasks 2 --plan /p.md",
    );
    expect(
      resumeCommandFor({
        op: "fix",
        type: "task",
        group: "1,2",
        plan: "/p.md",
        findingsPath: "/h.json",
      }),
    ).toBe("cdd fix --type task --tasks 1,2 --plan /p.md --findings /h.json");
    expect(
      resumeCommandFor({
        op: "review",
        type: "branch",
        plan: "/p.md",
        base: "abc1234",
        head: "def5678",
      }),
    ).toBe("cdd review --type branch --plan /p.md --base abc1234 --head def5678");
    expect(
      resumeCommandFor({ op: "fix", type: "branch", plan: "/p.md", findingsPath: "/h.json" }),
    ).toBe("cdd fix --type branch --plan /p.md --findings /h.json");
    expect(resumeCommandFor({ op: "review", type: "spec", doc: "/s.md" })).toBe(
      "cdd review --type spec --spec /s.md",
    );
    expect(
      resumeCommandFor({ op: "fix", type: "plan", doc: "/p.md", findingsPath: "/h.json" }),
    ).toBe("cdd fix --type plan --plan /p.md --findings /h.json");
  });
});

describe("infra/workspace.ts — crashPath(lane, round) naming", () => {
  it("the two-parameter signature pins the rounded file name; malformed lane/round are rejected", () => {
    const ws = Workspace.fromPath("/tmp/ws");
    expect(ws.crashPath("implement", 1)).toBe("/tmp/ws/crash-implement-1.json");
    expect(ws.crashPath("docs", 7)).toBe("/tmp/ws/crash-docs-7.json");
    expect(ws.crashPath("review", 2)).toBe("/tmp/ws/crash-review-2.json");
    expect(() => ws.crashPath("IMPLEMENT", 1)).toThrow(/invalid crash lane/);
    expect(() => ws.crashPath("../x", 1)).toThrow(/invalid crash lane/);
    expect(() => ws.crashPath("implement", 0)).toThrow(/invalid crash round/);
    expect(() => ws.crashPath("implement", 1.5)).toThrow(/invalid crash round/);
  });
});

describe("artifacts/crash.ts — CrashTeardown.run (crash-only snapshot + crash record)", () => {
  it("clean tree → snapshotSha null (nothing to snapshot); the record still writes", async () => {
    const repo = setupGitRepo();
    const wsDir = path.join(repo, "cdd", "ws");
    const record = await new CrashTeardown().run(teardownOpts(repo, wsDir));
    expect(record.snapshotSha).toBeNull();
    expect(record.exitCode).toBe(3);
    expect(record.attemptedHandoff).toBe(path.join(wsDir, "tasks-1-implement.json"));
    expect(record.next).toBe("cdd implement --tasks 1 --plan /p.md");
    const disk = JSON.parse(readFileSync(path.join(wsDir, "crash-implement-1.json"), "utf8"));
    expect(disk).toEqual(record);
  });

  it("dirty tree → the WIP normalizes into a crash-only snapshot commit (record.snapshotSha == HEAD)", async () => {
    const repo = setupGitRepo();
    const wsDir = path.join(repo, "cdd", "ws");
    writeFileSync(path.join(repo, "wip.md"), "half-finished-wip\n");
    const record = await new CrashTeardown().run(teardownOpts(repo, wsDir));
    expect(record.snapshotSha).toMatch(/^[0-9a-f]{40}$/);
    expect(record.snapshotSha).toBe(git(repo, "rev-parse", "HEAD"));
    // the snapshot message carries the lane + the explicit exit code
    expect(git(repo, "log", "-1", "--format=%s")).toBe(
      "chore(cdd-engine): crash-only snapshot — implement abort (exit 3)",
    );
    // tree returns to clean — the re-dispatch entry gate passes on the snapshot commit
    expect(git(repo, "status", "--porcelain")).toBe("");
  });

  it("tail capture keeps the last CRASH_TAIL_LINES lines (the 403-trace mitigation window)", async () => {
    const repo = setupGitRepo();
    const wsDir = path.join(repo, "cdd", "ws");
    const many = Array.from({ length: 60 }, (_, i) => `line${i}`).join("\n");
    const record = await new CrashTeardown().run(
      teardownOpts(repo, wsDir, { stdout: many, stderr: many }),
    );
    expect(record.stdoutTail).toHaveLength(CRASH_TAIL_LINES);
    expect(record.stdoutTail[0]).toBe("line20");
    expect(record.stdoutTail[CRASH_TAIL_LINES - 1]).toBe("line59");
    expect(record.stderrTail).toHaveLength(CRASH_TAIL_LINES);
    // empty stream → [] (no phantom empty line)
    const empty = await new CrashTeardown().run(
      teardownOpts(repo, wsDir, { stdout: "", stderr: "" }),
    );
    expect(empty.stdoutTail).toEqual([]);
    expect(empty.stderrTail).toEqual([]);
  });

  it("non-repo repoRoot → fail-open (snapshotSha null, record still lands)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-crash-nogit-"));
    const record = await new CrashTeardown().run({
      lane: "docs",
      round: 1,
      exitCode: 143,
      cause: "child-signal",
      stdout: "",
      stderr: "killed\n",
      attemptedHandoff: path.join(dir, "spec-review-1.json"),
      next: "cdd review --type spec --spec /s.md",
      workspace: Workspace.fromPath(dir),
      repoRoot: "/nonexistent/repo",
    });
    expect(record.snapshotSha).toBeNull();
    expect(record.exitCode).toBe(143);
    // The cause field persists verbatim — the T8 postmortem classification, zero behavior fork.
    expect(record.cause).toBe("child-signal");
    const disk = JSON.parse(readFileSync(path.join(dir, "crash-docs-1.json"), "utf8"));
    expect(disk.stderrTail).toEqual(["killed"]);
    expect(disk.cause).toBe("child-signal");
  });
});

describe("artifacts/crash.ts — crashCauseFor (T8 five-cause unified derivation)", () => {
  // The teardown matrix (child-exit / child-signal / over-budget / timeout) — every pre-exit-gate
  // termination maps onto the crash-record cause vocabulary; the engine-terminated and the
  // child-died faces are ONE derivation (no second implementation).
  it("child-exit: not timed out, plain non-zero exit", () => {
    expect(crashCauseFor({ exitCode: 3 })).toBe("child-exit");
    expect(crashCauseFor({ exitCode: 1 })).toBe("child-exit");
  });

  it("child-signal: the 128+signo shell convention (SIGTERM=143 / SIGINT=130)", () => {
    expect(crashCauseFor({ exitCode: 143 })).toBe("child-signal");
    expect(crashCauseFor({ exitCode: 130 })).toBe("child-signal");
    expect(crashCauseFor({ exitCode: 137 })).toBe("child-signal");
  });

  it("engine-over-budget: the budget cap fired (timedOut + monitor over-budget)", () => {
    expect(crashCauseFor({ timedOut: true, monitorCause: "over-budget", exitCode: 1 })).toBe(
      "engine-over-budget",
    );
  });

  it("engine-timeout: the liveness/stall monitor fired (timedOut + stalled)", () => {
    expect(crashCauseFor({ timedOut: true, monitorCause: "stalled", exitCode: 1 })).toBe(
      "engine-timeout",
    );
  });

  it("child-signal: an external SIGTERM folds in as the monitor's signal cause — the CHILD's death shape, never an engine cause", () => {
    expect(crashCauseFor({ timedOut: true, monitorCause: "signal", exitCode: 143 })).toBe(
      "child-signal",
    );
  });

  it("unknown: no facts classify the death (defensive fallback)", () => {
    expect(crashCauseFor({})).toBe("unknown");
    expect(crashCauseFor({ exitCode: 0 })).toBe("unknown");
    expect(crashCauseFor({ timedOut: true })).toBe("unknown");
  });
});

describe("artifacts/crash.ts — isStaleCrashRecord (T8 reapStale stale judgment)", () => {
  const base = {
    exitCode: 3,
    stderrTail: [],
    stdoutTail: [],
    snapshotSha: null,
    attemptedHandoff: "/ws/tasks-1-implement.json",
    next: "cdd implement --tasks 1",
    cause: "child-exit" as const,
  };

  it("attemptedHandoff now holds a non-dead carrier → stale (the round resolved at the normal face)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-stale-"));
    const hp = path.join(dir, "tasks-1-implement.json");
    writeFileSync(
      hp,
      JSON.stringify({ phase: "implement", status: "APPROVED", findings: [], artifacts: {} }),
    );
    expect(isStaleCrashRecord({ ...base, attemptedHandoff: hp })).toBe(true);
  });

  it("a TIMEOUT / HARNESS_ABORT carrier at the attemptedHandoff → still live (the round is dead, not resolved)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-live-"));
    const hp = path.join(dir, "tasks-1-implement.json");
    writeFileSync(hp, JSON.stringify({ status: "TIMEOUT", failure_category: "TIMEOUT" }));
    expect(isStaleCrashRecord({ ...base, attemptedHandoff: hp })).toBe(false);
    writeFileSync(hp, JSON.stringify({ status: "BLOCKED", failure_category: "HARNESS_ABORT" }));
    expect(isStaleCrashRecord({ ...base, attemptedHandoff: hp })).toBe(false);
  });

  it("no attemptedHandoff / missing handoff / illegible → keep (no resolution signal)", () => {
    expect(isStaleCrashRecord({ ...base, attemptedHandoff: null })).toBe(false);
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-keep-"));
    const hp = path.join(dir, "tasks-1-implement.json");
    expect(isStaleCrashRecord({ ...base, attemptedHandoff: hp })).toBe(false); // missing file
    writeFileSync(hp, "not-json{");
    expect(isStaleCrashRecord({ ...base, attemptedHandoff: hp })).toBe(false); // illegible
  });
});
