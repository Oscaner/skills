// packages/cdd-engine/src-next/session/__tests__/preflight.test.ts
// P4.1 T1 — PreFlight suite: the lifecycle pre-flight seam (design §1) — the
// tree-clean + plan-graph + wave + doc-contract dispatch gates converge into ONE
// single-entry gate:
//   · the dirty-tree hard gate — implement/review/fix on a dirty working tree
//     BLOCKs (the CDD_BLOCKED guidance) BEFORE any wave/doc judgment, child zero;
//   · the gate order — tree-clean → plan-graph → wave → doc-contract, one verdict
//     carries the run gate list (the judgeable order);
//   · the plan-graph gate — a plan whose DependsOn edges fail validates refuses;
//   · the wave gate — the three-verb split/wrong-phase refusals ride the seam;
//   · the doc-contract gate — the doc faces judge the target doc's structure;
//   · the unreadable-doc skip — an absent doc carries no doc-contract judgment;
//   · the lifecycle wiring — a refused frame never reaches the child dispatch.
// Fixtures are hermetic git repos (the dirty/clean tree) + a memory fs for the
// doc-contract backstop (the contract's context seam reads through it).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DocFs } from "../../contract/invariants.ts";
import { Contract } from "../../contract/judge.ts";
import type { DocKey } from "../../contract/project.ts";
import { Words } from "../../face/words.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { GitClient } from "../../infra/git.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { targetFaces } from "../faces.ts";
import { Ledger } from "../ledger.ts";
import type { PreFlightContext, PreFlightVerdict } from "../preflight.ts";
import { PreFlight } from "../preflight.ts";
import type { DispatchStep, OpenFrame } from "../run.ts";
import { EMPTY_RUN_STATE, Lifecycle } from "../run.ts";
import { WaveGate } from "../wave.ts";

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

/** A hermetic git repo — the tree-clean gate's judgment surface. The `.kairos` +
 *  `/docs/` gitignore keeps the fixture's synthetic writes (the engine workspace
 *  mirror + the docs) out of the tree — same as the consumer setup the kairos README
 *  documents. Pass an explicit ignore content to shape it (the no-`.kairos`-ignore
 *  consumer regression). */
function gitRepo(ignore = ".kairos\n/docs/\n"): { repoRoot: string; cleanup: () => void } {
  const repoRoot = mkdtempSync(path.join(tmpdir(), "preflight-"));
  spawnSync("git", ["init", "-q"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.email", "preflight@test"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.name", "preflight-test"], { cwd: repoRoot });
  writeFileSync(path.join(repoRoot, ".gitignore"), ignore, "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  return { repoRoot, cleanup: () => rmSync(repoRoot, { recursive: true, force: true }) };
}

/** Dirty the fixture repo — an uncommitted change (`git status --porcelain` non-empty). */
function dirty(repoRoot: string): void {
  writeFileSync(path.join(repoRoot, "dirty.txt"), "dirty\n", "utf8");
}

/** A plan literal over `### Task N:` blocks + `- **DependsOn**:` values. */
function planDoc(blocks: readonly (readonly string[])[]): string {
  return [
    "# Test Plan",
    "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
    "- **Parent program**: [x-overall.md v1.0](docs/kairos/specs/x-overall.md)",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...blocks.flat(),
  ].join("\n");
}

function task(id: number, dependsOn: string): readonly string[] {
  return [
    `### Task ${id}: task ${id}`,
    "- **Objective**: objective",
    "- **Files**: a.ts",
    "- **Consumes**: x",
    "- **Produces**: y",
    "- **Steps**:",
    "  - step — checkable: green",
    "- **Acceptance**: ok",
    `- **DependsOn**: ${dependsOn}`,
  ];
}

/** The hermetic PreFlight — real git + the real contract + the shared wave gate. */
function preflightOf(fs?: DocFs): PreFlight {
  return new PreFlight({
    git: new GitClient(),
    contract: new Contract(),
    words: new Words(),
    waveGate: new WaveGate(),
    fs,
  });
}

/** A memory fs — every path resolves into the judged doc's own content (the
 *  context-seam backstop: chain/sibling reads return the judged content, so the
 *  doc-contract gate's judgment is the doc's own structure, not its neighbors). */
function memoryFs(content: string): DocFs {
  return {
    exists: () => true,
    read: () => content,
    // The sibling scan resolves the `**Parent program**` target basename — the
    // judged doc's family lists it.
    list: (_p: string) => ["x-overall.md"],
  };
}

/** A conforming phase-spec — every current + P4.1-T2 phaseSpec element present (the
 *  header tuple + the version lineage + a Change-history table + the design
 *  skeleton), so the doc-contract gate passes it (zero structural findings). */
const CONFORMING_SPEC = [
  "# Test Spec",
  "- **Version**: v1.0 · 2026-10-09",
  "- **Status**: Draft",
  "- **Author**: x",
  "- **Parent program**: [x-overall.md v1.0](docs/kairos/specs/x-overall.md)",
  "- **Depends on**: P1",
  "",
  "## Design",
  "",
  "Design intro — the double-layer skeleton semantics.",
  "",
  "### 1. 数据面",
  "#### 1.1 登记表",
  "- text",
  "",
  "### Acceptance criteria",
  "",
  "- `c`",
  "",
  "## Constraints",
  "",
  "- delta",
  "",
  "## Change history",
  "",
  "| Version | date | summary | author |",
  "|---|---|---|---|",
  "| v1.0 | 2026-10-09 | initial | [human] |",
].join("\n");

/** A defective phase-spec — a required section missing, so the doc-contract
 *  gate refuses it (the negative case). */
const DEFECTIVE_SPEC = ["# Test Spec", "- **Version**: v1.0", "", "## Design"].join("\n");

// ---------------------------------------------------------------------------
// the seam's context builders
// ---------------------------------------------------------------------------

/** The wave-face context — the plan + the requested group over a fresh ledger. */
function waveCtx(
  repoRoot: string,
  blocks: readonly (readonly string[])[],
  tasks: number[],
  verb: PreFlightContext["verb"],
): PreFlightContext {
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repoRoot, ".kairos", "cdd"), "session"),
    "preflight-slug",
  ).ensure();
  const ledger = new Ledger(workspace, new ConfigLoader());
  return {
    verb,
    type: "wave",
    repoRoot,
    planText: planDoc(blocks),
    tasks: new Set(tasks),
    ledger,
    doc: null,
  };
}

/** The doc-face context — the target doc judged by the doc-contract gate. */
function docCtx(
  repoRoot: string,
  docKey: DocKey,
  verb: PreFlightContext["verb"],
): PreFlightContext {
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repoRoot, ".kairos", "cdd"), "session"),
    "preflight-slug",
  ).ensure();
  const ledger = new Ledger(workspace, new ConfigLoader());
  return {
    verb,
    type: docKey === "plan" ? "plan" : "spec",
    repoRoot,
    planText: null,
    tasks: null,
    ledger,
    doc: { docKey, path: `docs/kairos/specs/${docKey === "plan" ? "plan" : "spec"}.md` },
  };
}

// ---------------------------------------------------------------------------
// the dirty-tree hard gate — three verbs × dirty → BLOCK
// ---------------------------------------------------------------------------

describe("PreFlight — the clean-tree hard gate (implement/review/fix)", () => {
  it("a dirty tree BLOCKs implement/review/fix with the dirty-tree gate before any other judgment", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      dirty(repoRoot);
      const preflight = preflightOf();
      const plan = [task(1, "none"), task(2, "1")];
      for (const verb of ["implement", "review", "fix"] as const) {
        const verdict = await preflight.vet(waveCtx(repoRoot, plan, [1], verb));
        expect(verdict.ok).toBe(false);
        expect(verdict.gate).toBe("tree-clean");
        expect(verdict.reason).toBe("dirty-tree");
        expect(verdict.message).toContain("commit or discard");
        expect(verdict.order).toEqual(["tree-clean"]);
      }
    } finally {
      cleanup();
    }
  });

  it("the dirty-tree gate runs FIRST — a dirty tree BLOCKs even when the wave/doc judgments would refuse too", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      dirty(repoRoot);
      const preflight = preflightOf();
      // dangling DependsOn (plan-graph would refuse) + a defective doc: the dirty
      // tree still owns the verdict — the gate sequence stops at tree-clean.
      const badPlan = [task(1, "none"), task(2, "99")];
      const verdict = await preflight.vet(docCtx(repoRoot, "phaseSpec", "review"));
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("tree-clean");
      expect(verdict.order).toEqual(["tree-clean"]);
      const waveVerdict = await preflight.vet(waveCtx(repoRoot, badPlan, [1, 2], "implement"));
      expect(waveVerdict.gate).toBe("tree-clean");
    } finally {
      cleanup();
    }
  });

  it("the workspace self-publishes its .gitignore — a consumer repo WITHOUT a .kairos ignore stays clean across dispatches (P4.1 F1 regression)", async () => {
    // The consumer-repo shape: no `.kairos` in the root .gitignore (the fixture's
    // default mask is overridden). The scene's workspace ensure self-publishes
    // `.kairos/.gitignore` (namespace root, content `*`) BEFORE the gate reads
    // the tree, so git's own judgment is clean — the engine's run artifacts never
    // read as uncommitted user work, with zero engine-side exclusion in isClean.
    const { repoRoot, cleanup } = gitRepo("/docs/\n");
    try {
      const workspace = new Workspace(
        new WorkspaceRoot(repoRoot, ".kairos/cdd"),
        "preflight-slug",
      ).ensure();
      workspace.writeJson("implement-1.json", { status: "APPROVED" });
      // The self-published keep-out marker sits at the namespace root
      expect(readFileSync(path.join(repoRoot, ".kairos", ".gitignore"), "utf8")).toBe("*\n");
      const ctx = waveCtx(repoRoot, [task(1, "none")], [1], "review");
      ctx.ledger!.recordRound("1", "implement"); // the first dispatch's progress — review now opens
      const preflight = preflightOf();
      const verdict = await preflight.vet(ctx);
      expect(verdict.ok).toBe(true);
      expect(verdict.order).toEqual(["tree-clean", "plan-graph", "wave"]);
      // A genuinely dirty USER file still refuses — the ignore is the workspace's
      // own self-published marker, never a pass for the user's uncommitted work.
      dirty(repoRoot);
      const refused = await preflight.vet(waveCtx(repoRoot, [task(1, "none")], [1], "implement"));
      expect(refused.ok).toBe(false);
      expect(refused.gate).toBe("tree-clean");
      expect(refused.reason).toBe("dirty-tree");
      // The bonus semantics: a user who git-TRACKS the workspace keeps seeing its
      // changes — `.gitignore` affects only untracked files, so the tracked
      // workspace surface rides the gate like any other user file. Force-add the
      // ignored workspace (the `*` marker hides it from a plain add) to model the
      // tracked case.
      rmSync(path.join(repoRoot, "dirty.txt"));
      spawnSync("git", ["add", "-f", ".kairos"], { cwd: repoRoot });
      spawnSync("git", ["add", "-A", ":!dirty.txt"], { cwd: repoRoot });
      spawnSync("git", ["commit", "-q", "-m", "track the workspace"], { cwd: repoRoot });
      // A change to the TRACKED workspace surface (implement-1.json was force-added
      // into the commit above) rides the gate like any user file — the ignore covers
      // only untracked paths.
      workspace.writeJson("implement-1.json", { status: "APPROVED", modified: true });
      const tracked = await preflightOf().vet(
        waveCtx(repoRoot, [task(1, "none")], [1], "implement"),
      );
      expect(tracked.ok).toBe(false);
      expect(tracked.gate).toBe("tree-clean");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the gate order composition — the judgeable gate order
// ---------------------------------------------------------------------------

describe("PreFlight — the gate order composition (tree-clean → plan-graph → wave → doc-contract)", () => {
  it("a clean wave dispatch passes through tree-clean → plan-graph → wave in order", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const preflight = preflightOf();
      const verdict = await preflight.vet(
        waveCtx(repoRoot, [task(1, "none"), task(2, "1")], [1], "implement"),
      );
      expect(verdict.ok).toBe(true);
      expect(verdict.order).toEqual(["tree-clean", "plan-graph", "wave"]);
    } finally {
      cleanup();
    }
  });

  it("a clean doc dispatch passes through tree-clean → doc-contract in order", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const preflight = preflightOf(memoryFs(CONFORMING_SPEC));
      const verdict = await preflight.vet(docCtx(repoRoot, "phaseSpec", "review"));
      expect(verdict.ok).toBe(true);
      expect(verdict.order).toEqual(["tree-clean", "doc-contract"]);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the plan-graph gate
// ---------------------------------------------------------------------------

describe("PreFlight — the plan-graph gate", () => {
  it("a dangling DependsOn edge BLOCKs the dispatch with the named edge issues", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const preflight = preflightOf();
      const verdict = await preflight.vet(
        waveCtx(repoRoot, [task(1, "none"), task(2, "99")], [1, 2], "implement"),
      );
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("plan-graph");
      expect(verdict.reason).toBe("plan-graph");
      expect(verdict.message).toContain("edge violation");
      expect((verdict.details ?? []).length).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the wave gate
// ---------------------------------------------------------------------------

describe("PreFlight — the wave gate inside the seam", () => {
  it("a split/subset --tasks rides the WaveGate split BLOCK (the word-table row)", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const preflight = preflightOf();
      // two independent tasks open the single root wave {1,2} — a {1} request splits
      const verdict = await preflight.vet(
        waveCtx(repoRoot, [task(1, "none"), task(2, "none")], [1], "review"),
      );
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("wave");
      expect(verdict.reason).toBe("split");
      expect(verdict.message).toContain("derived wave");
      // the wave gate ran AFTER tree-clean + plan-graph
      expect(verdict.order).toEqual(["tree-clean", "plan-graph", "wave"]);
    } finally {
      cleanup();
    }
  });

  it("a wrong-phase request rides the WaveGate wrong-phase BLOCK", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const preflight = preflightOf();
      const ctx = waveCtx(repoRoot, [task(1, "none")], [1], "implement");
      ctx.ledger!.recordRound("1", "implement"); // the open wave now sits at review
      const verdict = await preflight.vet(ctx);
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("wave");
      expect(verdict.reason).toBe("wrong-phase");
      expect(verdict.message).toContain("at review");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the doc-contract gate
// ---------------------------------------------------------------------------

describe("PreFlight — the doc-contract gate (Contract.validate over the doc face)", () => {
  it("a doc face whose target carries structural findings BLOCKs with the named findings", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const preflight = preflightOf(memoryFs(DEFECTIVE_SPEC));
      const verdict = await preflight.vet(docCtx(repoRoot, "phaseSpec", "review"));
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("doc-contract");
      expect(verdict.reason).toBe("doc-contract");
      expect((verdict.details ?? []).length).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  it("an unreadable target doc skips the doc-contract judgment (no judgment, no BLOCK)", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const preflight = preflightOf({
        exists: () => false,
        read: () => null,
        list: () => [],
      });
      const verdict = await preflight.vet(docCtx(repoRoot, "phaseSpec", "review"));
      expect(verdict.ok).toBe(true);
      expect(verdict.order).toEqual(["tree-clean", "doc-contract"]);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the lifecycle wiring — a refused frame never reaches the child dispatch
// ---------------------------------------------------------------------------

describe("PreFlight — the lifecycle dispatch-entry wiring (child zero dispatch)", () => {
  it("advance() refuses a preflight-blocked frame without dispatching the child", () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const calls: OpenFrame[] = [];
      const dispatch: DispatchStep = (frame) => {
        calls.push(frame);
        return { status: "APPROVED", findings: [] };
      };
      const blocked: PreFlightVerdict = {
        ok: false,
        gate: "tree-clean",
        reason: "dirty-tree",
        message: "the working tree is dirty",
        order: ["tree-clean"],
      };
      const run = new Lifecycle({
        face: targetFaces.spec,
        state: EMPTY_RUN_STATE,
        ledger: new Ledger(
          new Workspace(
            new WorkspaceRoot(path.join(repoRoot, ".kairos", "cdd"), "session"),
            "preflight-slug",
          ).ensure(),
          new ConfigLoader(),
        ),
        dispatch,
        target: { kind: "doc", doc: "docs/kairos/specs/x.md" },
        preflight: { gate: () => blocked },
      });
      const step = run.advance();
      expect(step).not.toBeNull();
      expect(step!.preflight).toEqual(blocked);
      expect(step!.route).toBeNull();
      expect(calls).toEqual([]); // child zero dispatch
      expect(run.advance()).not.toBeNull(); // the refused frame re-offers (resume)
    } finally {
      cleanup();
    }
  });
});
