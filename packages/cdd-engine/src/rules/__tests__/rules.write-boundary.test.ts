// packages/cdd-engine/src/rules/__tests__/rules.write-boundary.test.ts
// WriteBoundary — pure-soft changed-surface bookkeeping (2026-09-20 ruling — NEVER BLOCK): the
// agent's `changes[]` attribution ledger is mechanically reconciled against `git diff base..HEAD`;
// a diff file no ledger entry attributes is a booking gap, visible as a stderr CDD_WARN + a notes
// record — never a hard block. implement materializes no changes[] (the return block is the only
// surface) → the diff fileset is recorded verbatim as the ledger origin, zero warn. No base →
// reconcile skipped (docs-family has no commits field; boundary = doc_path; the unknown-base
// failure carriers skip too).
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { gitInit, gitCommit, captureStderr } from "../../infra/__tests__/helpers.ts";
import { gitRevParseHead } from "../../infra/git.ts";
import { writeHandoff } from "../../artifacts/handoff/write.ts";
import { reconcileChangedSurface } from "../write-boundary.ts";

const tmpRepos: string[] = [];

afterEach(() => {
  for (const repo of tmpRepos.splice(0)) rmSync(repo, { recursive: true, force: true });
});

/** init repo, commit a seed baseline, return { repo, handoff, base } with base = the seed commit. */
async function tmpRepo(): Promise<{ repo: string; handoff: string; base: string }> {
  const repo = mkdtempSync(path.join(tmpdir(), "cdd-wb-"));
  tmpRepos.push(repo);
  gitInit(repo);
  writeFileSync(path.join(repo, "seed.txt"), "0\n");
  gitCommit(repo, "seed");
  const base = (await gitRevParseHead(repo)) as string;
  return { repo, handoff: path.join(repo, "task-1-handoff.json"), base };
}

function commitChanges(repo: string, files: Record<string, string>, message: string): void {
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(repo, name), content);
  gitCommit(repo, message);
}

describe("rules/write-boundary.ts — reconcileChangedSurface (on-book vs off-book)", () => {
  it("fix round: whole diff attributed in changes[] → zero warn, no notes record", async () => {
    const { repo, handoff, base } = await tmpRepo();
    commitChanges(repo, { "a.md": "a1\n" }, "round-a");
    writeHandoff(handoff, {
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
      commits: { base },
      changes: [{ file: "a.md", reason: "fix the a.md heading" }],
    });

    const cap = captureStderr();
    let res;
    try {
      res = await reconcileChangedSurface("fix", repo, handoff);
    } finally {
      cap.restore();
    }
    expect(res).not.toBeNull();
    expect(res!.unattributed).toEqual([]);
    expect(res!.diffFiles).toEqual(["a.md"]);
    expect(cap.text).toBe("");
    const h = JSON.parse(readFileSync(handoff, "utf8"));
    expect(h.notes).toBeUndefined(); // no booking gap → nothing recorded
  });

  it("fix round: diff ⊄ changes[] → CDD_WARN stderr + notes records the unattributed list (never BLOCK)", async () => {
    const { repo, handoff, base } = await tmpRepo();
    commitChanges(repo, { "a.md": "a1\n", "b.ts": "b1\n" }, "round-ab");
    writeHandoff(handoff, {
      phase: "fix",
      status: "APPROVED",
      findings: [],
      artifacts: {},
      commits: { base },
      changes: [{ file: "a.md", reason: "fix a" }], // b.ts is off-book
    });

    const cap = captureStderr();
    let res;
    try {
      res = await reconcileChangedSurface("fix", repo, handoff);
    } finally {
      cap.restore();
    }
    expect(res!.unattributed).toEqual(["b.ts"]);
    expect(cap.text).toMatch(/CDD_WARN/);
    expect(cap.text).toContain("b.ts");
    const h = JSON.parse(readFileSync(handoff, "utf8"));
    expect(h.notes).toContain("b.ts"); // unattributed list lands in notes
    expect(h.status).toBe("APPROVED"); // zero hard block — the round's conclusion is untouched
  });

  it("implement round: no changes[] → diff fileset recorded as ledger origin, zero warn", async () => {
    const { repo, handoff, base } = await tmpRepo();
    commitChanges(repo, { "a.md": "a1\n" }, "round-a");
    writeHandoff(handoff, {
      task: 1,
      phase: "implement",
      status: "APPROVED",
      findings: [],
      artifacts: {},
      commits: { base },
      // no changes[] — the implement return block is the only surface
    });

    const cap = captureStderr();
    let res;
    try {
      res = await reconcileChangedSurface("implement", repo, handoff);
    } finally {
      cap.restore();
    }
    expect(res!.unattributed).toEqual([]);
    expect(res!.diffFiles).toEqual(["a.md"]);
    expect(cap.text).toBe(""); // implement never warns
    const h = JSON.parse(readFileSync(handoff, "utf8"));
    expect(h.notes).toContain("a.md"); // ledger origin recorded for the review layer
  });

  it("review mode / no handoff / no base → skipped (null, nothing recorded)", async () => {
    const { repo, handoff, base } = await tmpRepo();
    commitChanges(repo, { "a.md": "a1\n" }, "round-a");
    expect(await reconcileChangedSurface("review", repo, handoff)).toBeNull(); // review skips
    expect(await reconcileChangedSurface("fix", repo, path.join(repo, "nope.json"))).toBeNull(); // no handoff
    const hNoBase = path.join(repo, "task-2-handoff.json");
    writeHandoff(hNoBase, { phase: "fix", status: "APPROVED", findings: [], artifacts: {} }); // no commits.base
    expect(await reconcileChangedSurface("fix", repo, hNoBase)).toBeNull();
    const hEmptyDiff = path.join(repo, "task-3-handoff.json");
    const headAfter = (await gitRevParseHead(repo)) as string; // base == HEAD → diff is empty
    writeHandoff(hEmptyDiff, { phase: "fix", status: "APPROVED", findings: [], artifacts: {}, commits: { base: headAfter } });
    expect(await reconcileChangedSurface("fix", repo, hEmptyDiff)).toBeNull(); // zero diff → nothing off-book
    void base;
  });
});