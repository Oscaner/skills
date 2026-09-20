// packages/cdd-engine/src/rules/__tests__/rules.residue.test.ts
// Residue settlement (settleResidue): EXECUTION_FAILURE / TIMEOUT + dirty working tree → the engine
// auto-preserves the residue as a stash (pure object-store, zero ref pollution) and records
// residue_ref + WIP scale in the handoff's recovery carrier. CONTRACT_VIOLATION-class causes are
// deliberately NOT auto-swallowed. The eligibility set is derived from FAILURE_CATEGORIES — no
// hand-written category literals (same AC14 discipline as rules/failure.ts).
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gitInit, gitCommit } from "../../infra/__tests__/helpers.ts";
import { gitStatusPorcelain } from "../../infra/git.ts";
import { FAILURE_CATEGORIES } from "../failure.ts";
import { recoveryEligible, preserveRoundResidue } from "../residue.ts";

const tmpRepos: string[] = [];

afterEach(() => {
  for (const repo of tmpRepos.splice(0)) rmSync(repo, { recursive: true, force: true });
});

function tmpRepo(): { repo: string; handoff: string } {
  const repo = mkdtempSync(path.join(tmpdir(), "cdd-residue-"));
  tmpRepos.push(repo);
  gitInit(repo);
  // Stash push needs a persistent identity (helpers gitInit uses -c inline only).
  execFileSync("git", ["-C", repo, "config", "user.name", "t"]);
  execFileSync("git", ["-C", repo, "config", "user.email", "t@t"]);
  return { repo, handoff: path.join(repo, "task-1-handoff.json") };
}

describe("rules/residue.ts — recoveryEligible (preservation eligibility)", () => {
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

describe("rules/residue.ts — preserveRoundResidue (carrier + stash)", () => {
  it("eligible recovery + dirty tree → stash; carrier gains residue_ref/wip_stat/preserved", async () => {
    const { repo, handoff } = tmpRepo();
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(path.join(repo, "untracked.txt"), "u\n");
    writeFileSync(handoff, JSON.stringify({
      task: 1, phase: "implement", status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
      recovery: { cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id, exit_code: 143 },
      blocker: "agent killed mid-round",
    }));

    const res = await preserveRoundResidue(handoff, repo);
    expect(res).not.toBeNull();
    expect(res!.ref).toMatch(/^[0-9a-f]{40}$/);
    expect(res!.wip).toEqual({ files: 2, insertions: 2, deletions: 1 });
    // The agent residue moved into the object store (tracked edit + untracked file gone) — only
    // the pass-through engine carrier remains untracked (it stayed on disk, excluded from the stash).
    const porcelain = await gitStatusPorcelain(repo);
    expect(porcelain).not.toContain("tracked.txt");
    expect(porcelain).not.toContain("untracked.txt");
    expect(porcelain).toContain("task-1-handoff.json");
    // ...and the carrier now carries the full recovery facts (structured, human-readable blocker untouched).
    const carrier = JSON.parse(readFileSync(handoff, "utf8"));
    expect(carrier.recovery).toEqual({
      cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
      exit_code: 143,
      residue_ref: res!.ref,
      wip_stat: { files: 2, insertions: 2, deletions: 1 },
      preserved: true,
    });
    expect(carrier.blocker).toBe("agent killed mid-round");
    // The stash is archivable: `git stash list` matches the round annotation, and applying it
    // restores the full residue without disturbing the surviving carrier.
    const list = execFileSync("git", ["-C", repo, "stash", "list"], { encoding: "utf8" });
    expect(list).toContain("cdd residue: EXECUTION_FAILURE task-1-handoff.json");
    execFileSync("git", ["-C", repo, "stash", "pop"], { encoding: "utf8" });
    expect(readFileSync(path.join(repo, "tracked.txt"), "utf8")).toBe("v2\n");
    expect(existsSync(path.join(repo, "untracked.txt"))).toBe(true);
    expect(existsSync(handoff)).toBe(true);
  });

  it("CONTRACT_VIOLATION recovery → no stash, carrier untouched, tree stays dirty (not swallowed)", async () => {
    const { repo, handoff } = tmpRepo();
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(handoff, JSON.stringify({
      task: 1, phase: "review", status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id,
      recovery: { cause: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id, exit_code: 1 },
      blocker: "handoff schema invalid",
    }));

    const res = await preserveRoundResidue(handoff, repo);
    expect(res).toBeNull();
    // Discipline failures surface explicitly: the tree stays dirty and no stash appears.
    expect(await gitStatusPorcelain(repo)).not.toBe("");
    const carrier = JSON.parse(readFileSync(handoff, "utf8"));
    expect(carrier.recovery).not.toHaveProperty("residue_ref");
    expect(carrier.recovery).not.toHaveProperty("preserved");
  });

  it("already-preserved carrier → no double stash (idempotence)", async () => {
    const { repo, handoff } = tmpRepo();
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(handoff, JSON.stringify({
      task: 1, phase: "implement", status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
      recovery: { cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id, exit_code: 1, residue_ref: "x".repeat(40), wip_stat: { files: 1, insertions: 1, deletions: 0 }, preserved: true },
      blocker: "b",
    }));

    const res = await preserveRoundResidue(handoff, repo);
    expect(res).toBeNull();
    // No stash write happened (nothing new in the list under the annotation).
    const list = execFileSync("git", ["-C", repo, "stash", "list"], { encoding: "utf8" });
    expect(list).toBe("");
  });

  it("missing handoff / null repoRoot → null (fail-open)", async () => {
    const { repo, handoff } = tmpRepo();
    expect(await preserveRoundResidue(handoff, repo)).toBeNull(); // no carrier file
    expect(await preserveRoundResidue(handoff, null)).toBeNull();
  });

  it("TIMEOUT cause + dirty tree → stash; carrier gains residue_ref/wip_stat/preserved (category-id eligibility)", async () => {
    const { repo, handoff } = tmpRepo();
    writeFileSync(path.join(repo, "tracked.txt"), "v1\n");
    gitCommit(repo, "base");
    writeFileSync(path.join(repo, "tracked.txt"), "v2\n");
    writeFileSync(handoff, JSON.stringify({
      task: 5, phase: "review", status: "TIMEOUT",
      failure_category: FAILURE_CATEGORIES.TIMEOUT.id,
      recovery: { cause: FAILURE_CATEGORIES.TIMEOUT.id },
      blocker: "agent stalled while closing the review",
    }));

    const res = await preserveRoundResidue(handoff, repo);
    expect(res).not.toBeNull();
    const carrier = JSON.parse(readFileSync(handoff, "utf8"));
    expect(carrier.recovery).toEqual({
      cause: FAILURE_CATEGORIES.TIMEOUT.id,
      residue_ref: res!.ref,
      wip_stat: { files: 1, insertions: 1, deletions: 1 },
      preserved: true,
    });
    // human prose untouched — the facts live in the carrier, the prose stays in the blocker
    expect(carrier.blocker).toBe("agent stalled while closing the review");
  });
});

// ---- T25 residue guards (§35 执法 + residue 守卫断言) ----
// Zero-stage-anchor enforcement over the injection surfaces (template-contract shell + both schema
// descriptions), zero "discard or commit" residue across the failure-lane sources, and the
// scope-composition-axis / two-schema carrier-contract greps — the acceptance's reproducibility
// asserts, kept as a guard so the cleaned landforms never regress.
describe("rules/residue.ts — T25 residue guards (§35 stage-anchor zero / discard-or-commit zero / two-schema carrier)", () => {
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
      const res = await preserveRoundResidue(handoff, repo);
      expect(res).not.toBeNull();
      const carrier = JSON.parse(readFileSync(handoff, "utf8"));
      expect(carrier.recovery.exit_code).toBe(code);
    }
  });
});