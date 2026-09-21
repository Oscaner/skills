// packages/cdd-engine/src/artifacts/__tests__/residue.test.ts
// T26 resume-from-residue (spec T7.5) unit tests: the standardized stash name round-trip, the
// salvage happy/clean faces (settleResidue), the resume resolution primary + legacy fallback
// (findResumeResidue + resumeFromResidue), the dead-carrier read, the appendix render + brief
// wiring, and the schema contract (a TIMEOUT carrier with `recovery` validates; normalizeHandoff
// keeps it).
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  stashMessage,
  matchesStandardStashMessage,
  settleResidue,
  readDeadCarrier,
  findResumeResidue,
  resumeFromResidue,
  renderResidueAppendix,
  appendixFromRecovery,
  type DeadCarrierRead,
} from "../residue.ts";
import { validateHandoffSchema, loadHandoffSchema } from "../../rules/schema.ts";
import { normalizeHandoff } from "../handoff/finalize.ts";
import { generateBrief } from "../../render/brief.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../..");

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// Fresh git repo with one committed file — the salvage/resume fixture baseline.
function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-residue-"));
  git(dest, "init", "-q");
  git(dest, "config", "user.name", "t");
  git(dest, "config", "user.email", "t@t");
  writeFileSync(path.join(dest, "wip.txt"), "line1\n");
  git(dest, "add", "-A");
  git(dest, "commit", "-qm", "fixture");
  return dest;
}

// A dead-round carrier handed to findResumeResidue (readDeadCarrier's shape — covered separately).
function carrier(obj: Record<string, unknown> = {}): DeadCarrierRead {
  return { status: "TIMEOUT", failureCategory: "TIMEOUT", recovery: {}, ...obj } as DeadCarrierRead;
}

describe("artifacts/residue.ts — standardized stash name (settleResidue output ≡ resume input, T7.5)", () => {
  it("stashMessage builds cdd-<op>-<type>-task-<N>-r<round>-<cause> (type renders literally — a task round names the CDD index twice)", () => {
    expect(stashMessage("implement", "task", 26, 1, "stalled")).toBe("cdd-implement-task-task-26-r1-stalled");
    expect(stashMessage("review", "task", 4, 2, "over-budget")).toBe("cdd-review-task-task-4-r2-over-budget");
    expect(stashMessage("implement", "task", 7, 1, "exec-failure")).toBe("cdd-implement-task-task-7-r1-exec-failure");
    // the `-task-` literal is a namespace marker — non-task types still carry it
    expect(stashMessage("review", "branch", 12, 2, "stalled")).toBe("cdd-review-branch-task-12-r2-stalled");
  });

  it("matchesStandardStashMessage round-trips the standard and rejects bespoke/foreign names", () => {
    expect(matchesStandardStashMessage("cdd-implement-task-task-26-r1-stalled")).toBe(true);
    expect(matchesStandardStashMessage("cdd-review-branch-task-12-r2-stalled")).toBe(true);
    // the `-task-` separator is required — dropping it (or the r<round> cause) is not a match
    expect(matchesStandardStashMessage("cdd-implement-task-26-r1-stalled")).toBe(false);
    expect(matchesStandardStashMessage("cdd-implement-task-task-26-r1")).toBe(false); // missing cause
    // T25's bespoke treasury stash (date suffix, T25 label) is NOT a standard match — the legacy
    // scan is scoped to the standardized name (documented boundary).
    expect(matchesStandardStashMessage("cdd-T25-implement-TIMEOUT-2026-09-20 (settleResidue+recovery WIP)")).toBe(false);
    expect(matchesStandardStashMessage("cdd-branch-fix-b4fe6d8-wip-2026-09-20")).toBe(false);
    expect(matchesStandardStashMessage("")).toBe(false);
  });
});

describe("artifacts/residue.ts — settleResidue salvage", () => {
  it("dirty tree → stash pushed + RecoveryInfo recorded (ref + standard message + scope); WIP leaves the worktree", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, "wip.txt"), "line2\nline3\n"); // two tracked-line additions
    const info = await settleResidue(repo, { op: "implement", task: 26, round: 1, cause: "stalled" });
    expect(info).not.toBeNull();
    expect(info!.stash_message).toBe("cdd-implement-task-task-26-r1-stalled");
    expect(info!.residue_ref).toMatch(/^[0-9a-f]{40}$/); // index-independent SHA
    expect(info!.residue_scope).toMatch(/file changed/); // scope read BEFORE the push (tree dirty)
    expect(info!.cause).toBe("stalled");
    // the stash moved the WIP out of the worktree → the tree is clean again (entry-gate baseline)
    expect(readFileSync(path.join(repo, "wip.txt"), "utf8")).toBe("line1\n");
    expect(git(repo, "status", "--porcelain")).toBe("");
    // the stash exists and is listed with the standard message
    expect(git(repo, "stash", "list")).toContain("cdd-implement-task-task-26-r1-stalled");
  });

  it("clean tree → null (nothing to salvage; the carrier writes without a recovery record)", async () => {
    const repo = setupRepo();
    expect(await settleResidue(repo, { op: "implement", task: 1, round: 1, cause: "signal" })).toBeNull();
  });

  it("T27: scope_base recorded when passed; omitted key absent when not (closed recovery schema)", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, "wip.txt"), "line2\n");
    const withBase = await settleResidue(repo, {
      op: "implement", task: 27, round: 1, cause: "stalled",
      scopeBase: "9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63",
    });
    expect(withBase?.scope_base).toBe("9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63");
    // JSON serialization keeps exactly the declared recovery keys — a round without a ledger/fallback
    // writes no scope_base key (validateHandoffSchema's closed recovery object stays satisfiable).
    const noBase = await settleResidue(repo, { op: "implement", task: 28, round: 1, cause: "stalled" });
    expect(noBase?.scope_base).toBeUndefined();
    const asJson = JSON.parse(JSON.stringify(noBase));
    expect(asJson).not.toHaveProperty("scope_base");
    // Write-side guard: a non-40-hex scopeBase (a malformed brief TASK_BASE) drops the key rather
    // than shipping a schema-violating recovery.scope_base — the read side (resume pre-flight)
    // filters identically, so the two lanes agree. (T27)
    appendFileSync(path.join(repo, "wip.txt"), "line3\n"); // dirty the tree again — a clean tree stashes nothing
    const badBase = await settleResidue(repo, {
      op: "implement", task: 29, round: 1, cause: "stalled",
      scopeBase: "not-a-sha",
    });
    expect(badBase).not.toBeNull();
    expect(badBase?.scope_base).toBeUndefined();
    expect(JSON.parse(JSON.stringify(badBase))).not.toHaveProperty("scope_base");
  });
});

describe("artifacts/residue.ts — dead carrier read", () => {
  it("readDeadCarrier: TIMEOUT/EXECUTION_FAILURE live; APPROVED dead; missing file → null", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-carrier-"));
    // missing file
    expect(readDeadCarrier(path.join(dir, "nope.json"))).toBeNull();
    // a live implement round (APPROVED) is not resume-able
    const hp = path.join(dir, "task-1-implement.json");
    writeFileSync(hp, JSON.stringify({ task: 1, phase: "implement", status: "APPROVED" }));
    expect(readDeadCarrier(hp)).toBeNull();
    // TIMEOUT carrier → status + failureCategory + recovery surfaced
    writeFileSync(hp, JSON.stringify({ status: "TIMEOUT", failure_category: "TIMEOUT", recovery: { residue_ref: "abc" } }));
    const t = readDeadCarrier(hp);
    expect(t?.status).toBe("TIMEOUT");
    expect(t?.failureCategory).toBe("TIMEOUT");
    expect(t?.recovery.residue_ref).toBe("abc");
    // EXECUTION_FAILURE (BLOCKED status, mechanism channel) → still resume-able
    writeFileSync(hp, JSON.stringify({ status: "BLOCKED", failure_category: "EXECUTION_FAILURE" }));
    const e = readDeadCarrier(hp);
    expect(e?.status).toBe("BLOCKED");
    expect(e?.failureCategory).toBe("EXECUTION_FAILURE");
    expect(e?.recovery).toEqual({}); // no recovery record → empty { }
  });
});

describe("artifacts/residue.ts — resume resolution", () => {
  it("findResumeResidue primary: carrier.recovery.residue_ref wins (index-independent)", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, "wip.txt"), "line2\n");
    const info = (await settleResidue(repo, { op: "implement", task: 26, round: 1, cause: "stalled" }))!;
    const found = await findResumeResidue(repo, carrier({ recovery: info }), 26);
    expect(found?.ref).toBe(info.residue_ref);
    expect(found?.message).toBe("cdd-implement-task-task-26-r1-stalled");
  });

  it("legacy fallback: no recovery in the carrier → standardized stash-message scan matches the task's stash", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, "wip.txt"), "saved\n");
    await settleResidue(repo, { op: "implement", task: 9, round: 1, cause: "stalled" });
    // a bare TIMEOUT carrier written before the recovery field existed (no recovery object)
    const found = await findResumeResidue(repo, carrier(), 9);
    expect(found).not.toBeNull();
    expect(found!.ref).toMatch(/^stash@\{0\}$/); // matches by list ref
    expect(found!.message).toBe("cdd-implement-task-task-9-r1-stalled");
  });

  it("legacy fallback: pinned to the task number — a Task 25 stash is NOT a Task 26 match", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, "wip.txt"), "saved\n");
    await settleResidue(repo, { op: "implement", task: 25, round: 1, cause: "stalled" });
    expect(await findResumeResidue(repo, carrier(), 26)).toBeNull();
  });

  it("legacy fallback: a bespoke non-standard stash is NOT a match (scoped to the standardized name)", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, "wip.txt"), "bespoke\n");
    git(repo, "stash", "push", "-qm", "cdd-T25-implement-TIMEOUT-2026-09-20 (bespoke)");
    expect(await findResumeResidue(repo, carrier(), 25)).toBeNull();
  });

  it("resumeFromResidue applies the WIP back onto the (gate-clean) worktree without dropping the stash", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, "wip.txt"), "salvaged\n");
    const info = (await settleResidue(repo, { op: "implement", task: 26, round: 1, cause: "stalled" }))!;
    expect(git(repo, "status", "--porcelain")).toBe(""); // salvage left the tree clean (entry-gate baseline)
    expect(await resumeFromResidue(repo, info.residue_ref)).toBe(true);
    expect(readFileSync(path.join(repo, "wip.txt"), "utf8")).toBe("line1\nsalvaged\n"); // WIP restored
    expect(git(repo, "stash", "list")).toContain("cdd-implement-task-task-26-r1-stalled"); // apply ≠ pop
  });

  it("resumeFromResidue fails open on an unknown ref", async () => {
    const repo = setupRepo();
    expect(await resumeFromResidue(repo, "0000000000000000000000000000000000000000")).toBe(false);
  });
});

describe("artifacts/residue.ts — appendix render (data-driven, §35 self-sufficiency)", () => {
  it("renderResidueAppendix is self-contained prose (status/cause/stash/scope + continue-not-rewrite)", () => {
    const text = renderResidueAppendix({
      status: "TIMEOUT",
      cause: "stalled",
      ref: "abc123",
      message: "cdd-implement-task-26-r1-stalled",
      scope: "2 files changed, 727 insertions(+)",
    });
    expect(text).toContain("## Residue status from the previous dispatch");
    expect(text).toContain("ended in TIMEOUT (cause: stalled)");
    expect(text).toContain("abc123");
    expect(text).toContain("2 files changed, 727 insertions(+)");
    expect(text).toContain("Continue from the existing work instead of rewriting from scratch");
  });

  it("appendixFromRecovery distills the carrier + found match (legacy carrier → cause falls back to the failure category)", () => {
    const input = appendixFromRecovery(carrier(), { ref: "stash@{0}", message: "cdd-implement-task-26-r1-stalled" });
    expect(input.status).toBe("TIMEOUT");
    expect(input.cause).toBe("TIMEOUT"); // no recovery.cause → the failure category
    expect(input.ref).toBe("stash@{0}");
    expect(input.message).toBe("cdd-implement-task-26-r1-stalled");
    expect(input.scope).toBe(""); // legacy carriers record no scope
  });

  it("generateBrief appends the Residue-status section only when residue is passed", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-brief-res-"));
    const planFile = path.join(dir, "plan.md");
    writeFileSync(planFile, "### Task 26: Resume test\nAcceptance: WIP restored.\n");
    const withResidue = path.join(dir, "task-26-brief.md");
    await generateBrief(planFile, 26, withResidue, REPO_ROOT, {
      status: "TIMEOUT",
      cause: "stalled",
      ref: "abc123",
      message: "cdd-implement-task-26-r1-stalled",
      scope: "1 file changed, 2 insertions(+)",
    });
    const content = readFileSync(withResidue, "utf8");
    expect(content).toMatch(/^TASK_BASE: [0-9a-f]{40}$/m);
    expect(content).toContain("## Residue status from the previous dispatch");
    expect(content).toContain("cdd-implement-task-26-r1-stalled");
    // no residue → no appendix section (and the brief stays byte-stable otherwise)
    const plain = path.join(dir, "task-26-plain.md");
    await generateBrief(planFile, 26, plain, REPO_ROOT);
    expect(readFileSync(plain, "utf8")).not.toContain("Residue status");
  });
});

describe("rules/schema.ts — recovery property contract (T7.5)", () => {
  const TIMEOUT_WITH_RECOVERY = {
    task: 26,
    phase: "implement",
    status: "TIMEOUT",
    findings: [],
    artifacts: {},
    blocker: "resume or discard: cdd implement --task 26 re-dispatch auto-resumes (recovery.residue_ref), or git stash drop to abandon",
    recovery: {
      residue_ref: "abc123",
      stash_message: "cdd-implement-task-26-r1-stalled",
      residue_scope: "2 files changed, 727 insertions(+)",
      round: 1,
      cause: "stalled",
    },
  };

  it("a TIMEOUT carrier with recovery validates; the key is declared in loadHandoffSchema", () => {
    const schema = loadHandoffSchema("task") as { properties: Record<string, unknown> };
    expect(schema.properties).toHaveProperty("recovery");
    expect(validateHandoffSchema(TIMEOUT_WITH_RECOVERY, "task").valid).toBe(true);
  });

  it("normalizeHandoff keeps recovery (schema properties now declare it — normalize strips only undeclared keys)", () => {
    const out = normalizeHandoff(TIMEOUT_WITH_RECOVERY, "task") as Record<string, unknown>;
    expect(out.recovery).toEqual(TIMEOUT_WITH_RECOVERY.recovery);
  });

  it("an undeclared recovery key still violates the schema (recovery stays a closed object)", () => {
    const bad = {
      ...TIMEOUT_WITH_RECOVERY,
      recovery: { ...TIMEOUT_WITH_RECOVERY.recovery, stray: "x" },
    };
    expect(validateHandoffSchema(bad, "task").valid).toBe(false);
  });

  it("recovery requires residue_ref (the resume pre-flight's dependency)", () => {
    const { recovery, ...rest } = TIMEOUT_WITH_RECOVERY;
    const noRef = { ...rest, recovery: { stash_message: "cdd-implement-task-26-r1-stalled", cause: "stalled" } };
    expect(validateHandoffSchema(noRef, "task").valid).toBe(false);
  });

  it("T27: recovery accepts a 40-hex scope_base (the settled ledger anchor survives round death)", () => {
    const withBase = {
      ...TIMEOUT_WITH_RECOVERY,
      recovery: { ...TIMEOUT_WITH_RECOVERY.recovery, scope_base: "9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63" },
    };
    expect(validateHandoffSchema(withBase, "task").valid).toBe(true);
    // normalizeHandoff keeps the undeclared-until-now key (schema declares it, normalize strips
    // only keys the schema does not know)
    const out = normalizeHandoff(withBase, "task") as { recovery: Record<string, unknown> };
    expect(out.recovery.scope_base).toBe("9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63");
    // non-40-hex scope_base is a schema violation (fraud lane — a bogus anchor must not ride recovery)
    const badBase = {
      ...TIMEOUT_WITH_RECOVERY,
      recovery: { ...TIMEOUT_WITH_RECOVERY.recovery, scope_base: "not-a-sha" },
    };
    expect(validateHandoffSchema(badBase, "task").valid).toBe(false);
  });
});
