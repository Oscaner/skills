// packages/cdd-engine/src/artifacts/__tests__/residue-save.test.ts
// The SAVE family unit tests (T28, spec T7.7; ex rules/__tests__/rules.residue.test.ts — migrated
// with the save single-owner convergence). settleFromCarrier (the adapter shared by the base
// settleResidue template hook + the branch inline lane) + preserveAndAnnounceResidue: an eligible
// EXECUTION_FAILURE / TIMEOUT carrier with a dirty working tree → WIP stashed with the STANDARDIZED
// message (cdd-<op>-<type>-task-<N>-r<round>-<cause> — the same contract the task lane's
// settleResidue emits) and recovery gains residue_ref / stash_message / residue_scope / wip_stat /
// cause / round / preserved. Idempotence: an already-preserved carrier never double-stashes (the
// template-hook + task-lane coexistence defense). CONTRACT_VIOLATION-class causes are deliberately
// NOT auto-swallowed. The eligibility set derives from FAILURE_CATEGORIES — no hand-written
// category literals (same AC14 discipline as rules/failure.ts).
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gitInit, gitCommit, captureStderr } from "../../infra/__tests__/helpers.ts";
import { gitStatusPorcelain } from "../../infra/git.ts";
import { FAILURE_CATEGORIES } from "../../rules/failure.ts";
import {
  recoveryEligible,
  roundFromCarrierBasename,
  settleFromCarrier,
  preserveAndAnnounceResidue,
  matchesStandardStashMessage,
} from "../residue.ts";

const tmpRepos: string[] = [];

afterEach(() => {
  for (const repo of tmpRepos.splice(0)) rmSync(repo, { recursive: true, force: true });
});

// Production-shaped fixture: engine carriers live in the gitignored `.osuperpowers/cdd/` workspace
// (materializeWorkspace writes an in-dir `.gitignore`), so the canonical `git stash push -u`
// (untracked only, never ignored) leaves the pass-through carrier untouched — no pathspec exclusion
// exists anymore (gitStashPreserve deleted). The `.gitignore` itself is committed: an untracked one
// would ride the stash.
function tmpRepo(handoffBasename = "tasks-1-implement.json"): { repo: string; handoff: string } {
  const repo = mkdtempSync(path.join(tmpdir(), "cdd-residue-save-"));
  tmpRepos.push(repo);
  gitInit(repo);
  writeFileSync(path.join(repo, ".gitignore"), ".osuperpowers/\n");
  gitCommit(repo, "gitignore");
  // The engine materializes the carrier dir itself (materializeWorkspace mkdir) — mirror it here
  // so the fixture equals the production tree shape, not an ENOENT landmine.
  mkdirSync(path.join(repo, ".osuperpowers", "cdd"), { recursive: true });
  return { repo, handoff: path.join(repo, ".osuperpowers", "cdd", handoffBasename) };
}

function stashList(repo: string): string {
  return execFileSync("git", ["-C", repo, "stash", "list", "--format=%gd%x09%gs"], { encoding: "utf8" });
}

describe("artifacts/residue.ts — recoveryEligible (save-family preservation eligibility)", () => {
  it("EXECUTION_FAILURE / TIMEOUT → eligible (the recovery-quota causes)", () => {
    expect(recoveryEligible(FAILURE_CATEGORIES.EXECUTION_FAILURE.id)).toBe(true);
    expect(recoveryEligible(FAILURE_CATEGORIES.TIMEOUT.id)).toBe(true);
  });

  it("CONTRACT_VIOLATION / undefined / null / unknown → not eligible (no auto-swallow)", () => {
    expect(recoveryEligible(FAILURE_CATEGORIES.CONTRACT_VIOLATION.id)).toBe(false);
    expect(recoveryEligible(FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id)).toBe(false);
    expect(recoveryEligible(undefined)).toBe(false);
    expect(recoveryEligible(null)).toBe(false);
    expect(recoveryEligible("NOPE")).toBe(false);
  });
});

describe("artifacts/residue.ts — settleFromCarrier (save adapter: carrier + standardized stash)", () => {
  it("eligible recovery + dirty tree → standardized stash; carrier gains the full recovery facts", async () => {
    const { repo, handoff } = tmpRepo();
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(path.join(repo, "untracked.txt"), "u\n");
    writeFileSync(handoff, JSON.stringify({
      tasks: [1], phase: "implement", status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
      recovery: { cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id, exit_code: 143 },
      blocker: "agent killed mid-round",
    }));

    const res = await settleFromCarrier(repo, handoff, repo);
    expect(res).not.toBeNull();
    expect(res!.residue_ref).toMatch(/^[0-9a-f]{40}$/);
    expect(res!.wip_stat).toEqual({ files: 2, insertions: 2, deletions: 1 });
    // The agent residue moved into the object store (tracked edit + untracked file gone); the
    // pass-through carrier stays on disk (ignored workspace) — the tree is clean again.
    expect(await gitStatusPorcelain(repo)).toBe("");
    expect(existsSync(handoff)).toBe(true);
    // ...and the carrier now carries the full standardized-save recovery facts (blocker untouched:
    // the facts live in the carrier, the prose stays in the blocker).
    const carrier = JSON.parse(readFileSync(handoff, "utf8"));
    expect(carrier.recovery).toEqual({
      cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
      exit_code: 143,
      residue_ref: res!.residue_ref,
      stash_message: "cdd-implement-task-task-1-r1-EXECUTION_FAILURE",
      residue_scope: "1 file changed, 1 insertion(+), 1 deletion(-); 1 untracked file(s)",
      wip_stat: { files: 2, insertions: 2, deletions: 1 },
      round: 1,
      preserved: true,
    });
    expect(carrier.blocker).toBe("agent killed mid-round");
    // The stash is archivable under the STANDARDIZED message; applying it restores the full residue
    // without disturbing the surviving carrier.
    const list = stashList(repo);
    expect(list).toContain("cdd-implement-task-task-1-r1-EXECUTION_FAILURE");
    execFileSync("git", ["-C", repo, "stash", "pop"], { encoding: "utf8" });
    expect(readFileSync(path.join(repo, "tracked.txt"), "utf8")).toBe("v2\n");
    expect(existsSync(path.join(repo, "untracked.txt"))).toBe(true);
    expect(existsSync(handoff)).toBe(true);
  });

  it("TIMEOUT review carrier → round derived from the canonical basename (tasks-5-review-3 → r3)", async () => {
    const { repo, handoff } = tmpRepo("tasks-5-review-3.json");
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(handoff, JSON.stringify({
      tasks: [5], phase: "review", status: "TIMEOUT",
      failure_category: FAILURE_CATEGORIES.TIMEOUT.id,
      recovery: { cause: FAILURE_CATEGORIES.TIMEOUT.id },
      blocker: "agent stalled while closing the review",
    }));

    const res = await settleFromCarrier(repo, handoff, repo);
    expect(res).not.toBeNull();
    const list = stashList(repo);
    expect(list).toContain("cdd-review-task-task-5-r3-TIMEOUT");
    const carrier = JSON.parse(readFileSync(handoff, "utf8"));
    expect(carrier.recovery).toEqual({
      cause: FAILURE_CATEGORIES.TIMEOUT.id,
      residue_ref: res!.residue_ref,
      stash_message: "cdd-review-task-task-5-r3-TIMEOUT",
      residue_scope: "1 file changed, 1 insertion(+), 1 deletion(-)",
      wip_stat: { files: 1, insertions: 1, deletions: 1 },
      round: 3,
      preserved: true,
    });
    // human prose untouched — facts in the carrier, prose in the blocker
    expect(carrier.blocker).toBe("agent stalled while closing the review");
  });

  it("CONTRACT_VIOLATION recovery → no stash, carrier untouched, tree stays dirty (not swallowed)", async () => {
    const { repo, handoff } = tmpRepo("tasks-3-review-1.json");
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(handoff, JSON.stringify({
      task: 3, phase: "review", status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id,
      recovery: { cause: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id, exit_code: 1 },
      blocker: "handoff schema invalid",
    }));

    const res = await settleFromCarrier(repo, handoff, repo);
    expect(res).toBeNull();
    // Discipline failures surface explicitly: the tree stays dirty and no stash appears.
    expect(await gitStatusPorcelain(repo)).not.toBe("");
    expect(stashList(repo).trim()).toBe("");
    const carrier = JSON.parse(readFileSync(handoff, "utf8"));
    expect(carrier.recovery).not.toHaveProperty("residue_ref");
    expect(carrier.recovery).not.toHaveProperty("preserved");
  });

  it("already-preserved carrier → no double stash (idempotence — the template hook + task lane coexistence guard)", async () => {
    const { repo, handoff } = tmpRepo();
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(handoff, JSON.stringify({
      tasks: [1], phase: "implement", status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
      recovery: {
        cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id, exit_code: 1,
        residue_ref: "x".repeat(40), stash_message: "cdd-implement-task-task-1-r1-EXECUTION_FAILURE",
        residue_scope: "1 file changed", wip_stat: { files: 1, insertions: 1, deletions: 0 }, preserved: true,
      },
      blocker: "b",
    }));

    const res = await settleFromCarrier(repo, handoff, repo);
    expect(res).toBeNull();
    // No stash write happened (the tree stayed dirty — the guard skipped before any git op).
    expect(await gitStatusPorcelain(repo)).not.toBe("");
    expect(stashList(repo).trim()).toBe("");
  });

  it("missing handoff / null cwd → null (fail-open)", async () => {
    const { repo, handoff } = tmpRepo();
    expect(await settleFromCarrier(repo, handoff, repo)).toBeNull(); // no carrier file
    expect(await settleFromCarrier("", handoff, repo)).toBeNull();   // no git ops base
  });

  it("doc-family carrier (spec-review-2) → task defaults to 1; round from the name (r2)", async () => {
    const { repo, handoff } = tmpRepo("spec-review-2.json");
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(handoff, JSON.stringify({
      phase: "review", status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
      recovery: { cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id, exit_code: 1 },
      blocker: "b",
    }));

    const res = await settleFromCarrier(repo, handoff, repo);
    expect(res).not.toBeNull();
    expect(stashList(repo)).toContain("cdd-review-spec-task-1-r2-EXECUTION_FAILURE");
  });
});

describe("artifacts/residue.ts — preserveAndAnnounceResidue (announce wrapper)", () => {
  it("eligible save → stderr CDD_WARN with the structured WIP scale", async () => {
    const { repo, handoff } = tmpRepo("tasks-5-fix-2.json");
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(handoff, JSON.stringify({
      tasks: [5], phase: "fix", status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
      recovery: { cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id, exit_code: 143 },
      blocker: "b",
    }));

    const cap = captureStderr();
    try {
      const res = await preserveAndAnnounceResidue(repo, handoff, repo);
      expect(res).not.toBeNull();
      expect(cap.text).toContain("CDD_WARN: worktree residue preserved for recovery");
      expect(cap.text).toContain(res!.residue_ref.slice(0, 7));
      expect(cap.text).toContain("1 file(s), +1/-1");
    } finally {
      cap.restore();
    }
  });
});

describe("artifacts/residue.ts — roundFromCarrierBasename (the save adapter's round source)", () => {
  it("implement-family carrier (round = fixed, no {round} slot) → 1 (implement rounds are always round 1)", () => {
    expect(roundFromCarrierBasename("tasks-5-implement.json")).toBe(1);
  });

  it("round-bearing family carriers → the canonical basename's own round number", () => {
    expect(roundFromCarrierBasename("tasks-5-review-3.json")).toBe(3);
    expect(roundFromCarrierBasename("tasks-5-fix-2.json")).toBe(2);
    expect(roundFromCarrierBasename("spec-review-2.json")).toBe(2);
    expect(roundFromCarrierBasename("spec-fix-1.json")).toBe(1);
    expect(roundFromCarrierBasename("plan-review-1.json")).toBe(1);
    expect(roundFromCarrierBasename("plan-fix-2.json")).toBe(2);
    expect(roundFromCarrierBasename("branch-review-faa2bc8..b4fe6d8-r1.json")).toBe(1);
    expect(roundFromCarrierBasename("branch-fix-faa2bc8..b4fe6d8-r1.json")).toBe(1);
  });

  it("unclassifiable basenames → null (the save is never fabricated for a foreign carrier)", () => {
    expect(roundFromCarrierBasename("tasks-1-handoff.json")).toBeNull();
    expect(roundFromCarrierBasename("notes.md")).toBeNull();
  });
});

describe("artifacts/residue.ts — standardized stash message on the adapter save (three-path same contract)", () => {
  it("a KILLED-round stash always carries the round in the standardized message (never a duplicate marker)", async () => {
    const { repo, handoff } = tmpRepo("tasks-5-fix-2.json");
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(handoff, JSON.stringify({
      tasks: [5], phase: "fix", status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
      recovery: { cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id, exit_code: 143 },
      blocker: "agent killed mid-round",
    }));

    const res = await settleFromCarrier(repo, handoff, repo);
    expect(res).not.toBeNull();
    const list = stashList(repo);
    expect(list).toContain("cdd-fix-task-task-5-r2-EXECUTION_FAILURE"); // round 2 lives IN the name
  });
});

describe("artifacts/residue.ts — resume-scan boundary (category-id causes are never a legacy-resume match)", () => {
  // The legacy stash scan drives the IMPLEMENT resume lane only (op = implement, cause ∈ the
  // termination trio + exec-failure). Review/fix/branch/doc-family saves carry the FAILURE-CATEGORY
  // id as the message cause — they are operator-recovered via `git stash list`, and their never-
  // matching shape is protective: a stale review/fix stash can never be misresumed by a task-N scan.
  it("review/fix lane standardized messages (category-id cause) do not match the resume scan", () => {
    expect(matchesStandardStashMessage("cdd-review-task-task-5-r3-TIMEOUT")).toBe(false);
    expect(matchesStandardStashMessage("cdd-fix-task-task-5-r2-EXECUTION_FAILURE")).toBe(false);
    expect(matchesStandardStashMessage("cdd-review-spec-task-1-r2-EXECUTION_FAILURE")).toBe(false);
    // implement-lane salvage causes remain the resume scan's match surface
    expect(matchesStandardStashMessage("cdd-implement-task-task-1-r1-over-budget")).toBe(true);
  });
});

// ---- Residue guards: §35 enforcement + the residue-guard assertions (T25/T28) ----
// Zero-stage-anchor enforcement over the injection surfaces (template-contract shell + both schema
// descriptions), zero "discard or commit" residue across the failure-lane sources, and the
// scope-composition-axis / two-schema carrier-contract greps — the acceptance's reproducibility
// asserts, kept as a guard so the cleaned landforms never regress.
describe("residue guards (§35 stage-anchor zero / discard-or-commit zero / two-schema carrier)", () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); // → src/
  const TPL = path.resolve(SRC, "..", "templates");
  const INJECTION_FILES = [
    "template-contract.json",
    "schema/task-handoff-schema.json",
    "schema/docs-handoff-schema.json",
  ];
  const FAILURE_LANE_SOURCES = ["dispatch/task.ts", "dispatch/branch.ts", "dispatch/docs.ts", "rules/failure.ts"];

  it("zero stage anchors (T\\d+|P\\d+) across the injection surfaces (template-contract + both schema descriptions)", () => {
    for (const rel of INJECTION_FILES) {
      const text = readFileSync(path.join(TPL, rel), "utf8");
      expect(text, rel).not.toMatch(/\bT\d+\b|\bP\d+\b/);
    }
  });

  it("zero 'discard or commit' residue across the failure-lane sources (§⑤ upgrade is complete)", () => {
    for (const rel of FAILURE_LANE_SOURCES) {
      const text = readFileSync(path.join(SRC, rel), "utf8");
      expect(text, rel).not.toContain("discard or commit");
    }
  });

  it("all four review types' axesGuide carry the scope-composition axis + the changed-surface shell clause exists (grep assertion)", () => {
    const contract = JSON.parse(readFileSync(path.join(TPL, "template-contract.json"), "utf8"));
    for (const type of ["task", "branch", "spec", "plan"]) {
      expect(contract.reviews[type].axesGuide, type).toContain("changed-surface reasonableness");
    }
    expect(contract.clauses).toHaveProperty("cl:changed-surface");
  });

  it("recovery + changes fields ride BOTH handoff schemas (task and docs) — the two-schema carrier contract", () => {
    for (const rel of ["schema/task-handoff-schema.json", "schema/docs-handoff-schema.json"]) {
      const schema = JSON.parse(readFileSync(path.join(TPL, rel), "utf8")) as {
        properties: Record<string, { properties?: Record<string, unknown>; required?: string[] }>;
      };
      expect(schema.properties, rel).toHaveProperty("changes");
      const recovery = schema.properties.recovery;
      expect(recovery, rel).toBeDefined();
      for (const key of ["cause", "exit_code", "residue_ref", "wip_stat", "preserved"]) {
        expect(recovery!.properties, `${rel} recovery.${key}`).toHaveProperty(key);
      }
      expect(recovery!.required).toContain("cause");
    }
  });

  it("EXECUTION_FAILURE diagnostic distinguishes exit 1 vs 143 (recovery.exit_code archives the death diagnosis)", async () => {
    const { repo, handoff } = tmpRepo();
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    for (const code of [1, 143]) {
      writeFileSync(path.join(repo, "tracked.txt"), `v${code + 1}\n`); // re-dirty the tree each salvage
      writeFileSync(handoff, JSON.stringify({
        task: 1, phase: "fix", status: "BLOCKED",
        failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
        recovery: { cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id, exit_code: code },
        blocker: "b",
      }));
      const res = await settleFromCarrier(repo, handoff, repo);
      expect(res).not.toBeNull();
      const carrier = JSON.parse(readFileSync(handoff, "utf8"));
      expect(carrier.recovery.exit_code).toBe(code);
    }
  });
});
