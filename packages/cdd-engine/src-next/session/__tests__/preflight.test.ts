// packages/cdd-engine/src-next/session/__tests__/preflight.test.ts
// P4.1 T1 — PreFlight suite: the lifecycle pre-flight seam (design §1) — the
// tree-clean + graph + wave + doc-contract dispatch gates converge into ONE
// single-entry gate:
//   · the dirty-tree hard gate — implement/review/fix on a dirty working tree
//     BLOCKs (the CDD_BLOCKED guidance) BEFORE any wave/doc judgment, child zero;
//   · the gate order — tree-clean → graph → wave → doc-contract, one verdict
//     carries the run gate list (the judgeable order);
//   · the graph gate — a plan whose DependsOn edges fail validates refuses;
//   · the wave gate — the three-verb split/wrong-phase refusals ride the seam;
//   · the doc-contract gate — the doc faces judge the target doc's structure;
//   · the unreadable-doc skip — an absent doc carries no doc-contract judgment;
//   · the lifecycle wiring — a refused frame never reaches the child dispatch.
// Fixtures are hermetic git repos (the dirty/clean tree) + a memory fs for the
// doc-contract backstop (the contract's context seam reads through it).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DocFs } from "../../contract/invariants.ts";
import { Contract } from "../../contract/judge.ts";
import type { DocKey } from "../../contract/project.ts";
import { Words } from "../../face/words.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { GitClient } from "../../infra/git.ts";
import type { RepoPath } from "../../infra/root.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { targetFaces } from "../faces.ts";
import { InFlight, type InFlightRecord } from "../inflight.ts";
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
const gitRepo = (ignore = ".kairos\n/docs/\n"): { repoRoot: string; cleanup: () => void } => {
  const repoRoot = mkdtempSync(path.join(tmpdir(), "preflight-"));
  spawnSync("git", ["init", "-q"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.email", "preflight@test"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.name", "preflight-test"], { cwd: repoRoot });
  writeFileSync(path.join(repoRoot, ".gitignore"), ignore, "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  return { repoRoot, cleanup: () => rmSync(repoRoot, { recursive: true, force: true }) };
};

/** Dirty the fixture repo — an uncommitted change (`git status --porcelain` non-empty). */
const dirty = (repoRoot: string): void => {
  writeFileSync(path.join(repoRoot, "dirty.txt"), "dirty\n", "utf8");
};

/** A plan literal over `### Task N:` blocks + `- **DependsOn**:` values (the
 *  front-matter head the plan parser reads). */
const planDoc = (blocks: readonly (readonly string[])[]): string => {
  return [
    "---",
    "title: Test Plan",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-10-09",
    "slug: x-p3",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...blocks.flat(),
  ].join("\n");
};

const task = (id: number, dependsOn: string): readonly string[] => {
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
};

/** The hermetic PreFlight — real git + the real contract + the shared wave gate. */
const preflightOf = (fs?: DocFs): PreFlight => {
  return new PreFlight({
    git: new GitClient(),
    contract: new Contract(),
    words: new Words(),
    waveGate: new WaveGate(),
    fs,
  });
};

/** A memory fs — every path resolves into the judged doc's own content (the
 *  context-seam backstop: chain/sibling reads return the judged content, so the
 *  doc-contract gate's judgment is the doc's own structure, not its neighbors).
 *  The one exception is the program overall (`x-overall.md`): the phase-spec's
 *  `program:` reference is judged by an identity lookup, so the fixture serves the
 *  minimal overall the reference names. */
const memoryFs = (content: string): DocFs => {
  return {
    exists: () => true,
    read: (p) =>
      p.endsWith("/x-overall.md") || p === "x-overall.md"
        ? "---\ntitle: O\ndoc-type: overall\nslug: x-overall\nversion: v1.0\n---\n"
        : content,
    // The sibling scan lists the same-family docs of the judged document.
    list: (_p: string) => ["x-overall.md"],
  };
};

/** A conforming phase-spec — every current + P4.1-T2 phase-spec element present
 *  (the front-matter head (since T6) + the version lineage + a Change-history
 *  table + the design skeleton), so the doc-contract gate passes it (zero
 *  structural findings). */
const CONFORMING_SPEC = [
  "---",
  "title: Test Spec",
  "doc-type: phase-spec",
  "version: v1.0",
  "date: 2026-10-09",
  "slug: x-p3",
  "program: x-overall",
  "status: Draft",
  "author: x",
  "parent-version: v1.0",
  "---",
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

/** A defective phase-spec — the required sections/head keys missing, so the
 *  doc-contract gate refuses it (the negative case). It carries a legal `slug:`
 *  so the identity gates pass and the structural findings are what BLOCK. */
const DEFECTIVE_SPEC = [
  "---",
  "title: Test Spec",
  "doc-type: phase-spec",
  "version: v1.0",
  "slug: defective",
  "status: Draft",
  "---",
  "",
  "## Design",
].join("\n");

// ---------------------------------------------------------------------------
// the seam's context builders
// ---------------------------------------------------------------------------

/** The tree-level in-flight handle of a fixture repo — the injected liveness table
 *  keeps the gate's judgment hermetic (no real process table). */
const inflightOf = (repoRoot: string, alive: boolean): InFlight =>
  new InFlight(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "preflight-slug", {
    live: async () => alive,
  });

/** One standing in-flight record — the identity facts the gate names. */
const recordOf = (over: Partial<InFlightRecord> = {}): InFlightRecord => ({
  pid: 4242,
  pgid: 4242,
  command: "cdd implement --tasks 1 --plan docs/p.md",
  slug: "other-slug",
  startedAt: Date.parse("2026-10-28T10:00:00.000Z"),
  wave: "1",
  phase: "implement",
  briefHash: null,
  plan: "docs/p.md",
  sampledAt: null,
  verdict: null,
  ...over,
});

/** Write a standing record at the tree-level path. */
const writeRecord = (repoRoot: string, record: InFlightRecord | string): string => {
  const dir = path.join(repoRoot, ".kairos", "cdd");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "in-flight.json");
  writeFileSync(
    file,
    typeof record === "string" ? record : JSON.stringify(record, null, 2),
    "utf8",
  );
  return file;
};

/** The byte snapshot of the in-flight record + its lock carrier (the gate's
 *  zero-write assertion: the same bytes before and after `vet`). */
const inFlightSnapshot = (repoRoot: string): string => {
  const file = path.join(repoRoot, ".kairos", "cdd", "in-flight.json");
  const lock = `${file}.lock`;
  return JSON.stringify({
    record: existsSync(file) ? readFileSync(file, "utf8") : null,
    locked: existsSync(lock),
  });
};

/** The wave-face context — the plan + the requested group over a fresh ledger. */
const waveCtx = (
  repoRoot: string,
  blocks: readonly (readonly string[])[],
  tasks: number[],
  verb: PreFlightContext["verb"],
): PreFlightContext => {
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
    inflight: inflightOf(repoRoot, false),
  };
};

/** The doc-face context — the target doc judged by the doc-contract gate. `docKey`
 *  is the doc's declared type (spec §12 · D34); null models a present doc carrying
 *  no `doc-type:` key (the seam BLOCKs). */
const docCtx = (
  repoRoot: string,
  docKey: DocKey | null,
  verb: PreFlightContext["verb"],
): PreFlightContext => {
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
    doc: {
      docKey,
      path: `docs/kairos/specs/${docKey === "plan" ? "plan" : "spec"}.md` as RepoPath,
    },
    inflight: inflightOf(repoRoot, false),
  };
};

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
        // the refusal keeps its commit/discard guidance and names the
        // orchestrator as the recovery owner; the engine only refuses
        expect(verdict.message).toContain("dirty");
        expect(verdict.message).toContain("commit or discard");
        expect(verdict.message).toContain("orchestrator");
        expect(verdict.message).toMatch(/never stashes/);
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
      // dangling DependsOn (the graph gate would refuse) + a defective doc: the dirty
      // tree still owns the verdict — the gate sequence stops at tree-clean.
      const badPlan = [task(1, "none"), task(2, "99")];
      const verdict = await preflight.vet(docCtx(repoRoot, "phase-spec", "review"));
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
      expect(verdict.order).toEqual(["tree-clean", "in-flight", "graph", "plan-ledger", "wave"]);
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

describe("PreFlight — the gate order composition (tree-clean → graph → wave → doc-contract)", () => {
  it("a clean wave dispatch passes through tree-clean → graph → wave in order", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const preflight = preflightOf();
      const verdict = await preflight.vet(
        waveCtx(repoRoot, [task(1, "none"), task(2, "1")], [1], "implement"),
      );
      expect(verdict.ok).toBe(true);
      expect(verdict.order).toEqual(["tree-clean", "in-flight", "graph", "plan-ledger", "wave"]);
    } finally {
      cleanup();
    }
  });

  it("a clean doc dispatch passes through tree-clean → doc-contract in order", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const preflight = preflightOf(memoryFs(CONFORMING_SPEC));
      const verdict = await preflight.vet(docCtx(repoRoot, "phase-spec", "review"));
      expect(verdict.ok).toBe(true);
      expect(verdict.order).toEqual(["tree-clean", "in-flight", "doc-contract"]);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the graph gate
// ---------------------------------------------------------------------------

describe("PreFlight — the graph gate", () => {
  it("a dangling DependsOn edge BLOCKs the dispatch with the named edge issues", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const preflight = preflightOf();
      const verdict = await preflight.vet(
        waveCtx(repoRoot, [task(1, "none"), task(2, "99")], [1, 2], "implement"),
      );
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("graph");
      expect(verdict.reason).toBe("graph");
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
      // the wave gate ran AFTER tree-clean + graph
      expect(verdict.order).toEqual(["tree-clean", "in-flight", "graph", "plan-ledger", "wave"]);
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
      const verdict = await preflight.vet(docCtx(repoRoot, "phase-spec", "review"));
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
      const verdict = await preflight.vet(docCtx(repoRoot, "phase-spec", "review"));
      expect(verdict.ok).toBe(true);
      expect(verdict.order).toEqual(["tree-clean", "in-flight", "doc-contract"]);
    } finally {
      cleanup();
    }
  });

  it("a present doc carrying no Doc type declaration BLOCKs — zero filename-suffix fallback (spec §12 · D34)", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const noDocType = CONFORMING_SPEC.split("\n")
        .filter((line) => !line.startsWith("doc-type:"))
        .join("\n");
      const preflight = preflightOf(memoryFs(noDocType));
      const verdict = await preflight.vet(docCtx(repoRoot, null, "review"));
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("doc-contract");
      expect(verdict.reason).toBe("doc-contract");
      expect(verdict.message).toContain("declares no `doc-type:` key");
      expect(verdict.order).toEqual(["tree-clean", "in-flight", "doc-contract"]);
    } finally {
      cleanup();
    }
  });

  it("a present doc declaring an out-of-domain doc-type BLOCKs naming the value and the domain", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const retired = CONFORMING_SPEC.replace("doc-type: phase-spec", "doc-type: overall-spec");
      const preflight = preflightOf(memoryFs(retired));
      const verdict = await preflight.vet(docCtx(repoRoot, null, "review"));
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("doc-contract");
      expect(verdict.reason).toBe("doc-contract");
      expect(verdict.message).toContain("`doc-type: overall-spec`");
      expect(verdict.message).toContain("outside the declared domain");
      expect(verdict.message).toContain("overall, plan, phase-spec, single-spec");
      expect(verdict.message).not.toContain("declares no `doc-type:` key");
      expect(verdict.order).toEqual(["tree-clean", "in-flight", "doc-contract"]);
    } finally {
      cleanup();
    }
  });

  it("a present doc carrying no `slug:` declaration BLOCKs on the SAME face as a missing doc-type", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const noSlug = CONFORMING_SPEC.split("\n")
        .filter((line) => !line.startsWith("slug:"))
        .join("\n");
      const preflight = preflightOf(memoryFs(noSlug));
      const verdict = await preflight.vet(docCtx(repoRoot, "phase-spec", "review"));
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("doc-contract");
      expect(verdict.reason).toBe("doc-contract");
      expect(verdict.message).toContain("declares no `slug:` key");
      expect(verdict.order).toEqual(["tree-clean", "in-flight", "doc-contract"]);
    } finally {
      cleanup();
    }
  });

  it("an illegal `slug:` value BLOCKs before any workspace is built", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const badSlug = CONFORMING_SPEC.replace("slug: x-p3", "slug: ../x");
      const preflight = preflightOf(memoryFs(badSlug));
      const verdict = await preflight.vet(docCtx(repoRoot, "phase-spec", "review"));
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("doc-contract");
      expect(verdict.message).toContain('"../x"');
      expect(verdict.message).toContain("illegal");
    } finally {
      cleanup();
    }
  });

  it("an unparseable front-matter BLOCKs with the REAL YAML failure — never the no-doc-type misread (D1 · #341)", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const malformed = [
        "---",
        "title: Test Spec",
        "doc-type: phase-spec",
        "version: v1.0",
        "status: Draft",
        "author: [human] · Claude Opus 5",
        "---",
        "",
        "## Design",
      ].join("\n");
      const preflight = preflightOf(memoryFs(malformed));
      const verdict = await preflight.vet(docCtx(repoRoot, "phase-spec", "review"));
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("doc-contract");
      expect(verdict.reason).toBe("doc-contract");
      // the misread dies — the wording reports the parse position, never "no doc-type"
      expect(verdict.message).toContain("not valid YAML");
      expect(verdict.message).toMatch(/on line \d+, column \d+/);
      expect(verdict.message).not.toContain("declares no `doc-type:` key");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the lifecycle wiring — a refused frame never reaches the child dispatch
// ---------------------------------------------------------------------------

describe("PreFlight — the lifecycle dispatch-entry wiring (child zero dispatch)", () => {
  it("advance() refuses a preflight-blocked frame without dispatching the child", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const calls: OpenFrame[] = [];
      const dispatch: DispatchStep = async (frame) => {
        calls.push(frame);
        return { status: "APPROVED", findings: [] };
      };
      const blocked: PreFlightVerdict = {
        ok: false,
        gate: "tree-clean",
        reason: "dirty-tree",
        message: "the working tree is dirty",
        order: ["tree-clean"],
        checked: ["tree-clean"],
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
        target: { kind: "spec", doc: "docs/kairos/specs/x.md" },
        preflight: { gate: () => blocked },
      });
      const step = await run.advance();
      expect(step).not.toBeNull();
      expect(step!.preflight).toEqual(blocked);
      expect(step!.route).toBeNull();
      expect(calls).toEqual([]); // child zero dispatch
      expect(await run.advance()).not.toBeNull(); // the refused frame re-offers (resume)
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P21 T2 — the plan-ledger gate and the checked rule list (§3.1/§3.4/§6.4)
// ---------------------------------------------------------------------------

/** The branch-face context — the plan + its ledger (the branch line carries no doc
 *  target and no `--tasks`, so only the plan-ledger gate judges structure). */
const branchCtx = (
  repoRoot: string,
  blocks: readonly (readonly string[])[],
  seed: (ledger: Ledger) => void = () => {},
): PreFlightContext => {
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repoRoot, ".kairos", "cdd"), "session"),
    "preflight-slug",
  ).ensure();
  const ledger = new Ledger(workspace, new ConfigLoader());
  seed(ledger);
  return {
    verb: "review",
    type: "branch",
    repoRoot,
    planText: planDoc(blocks),
    tasks: null,
    ledger,
    doc: null,
    inflight: inflightOf(repoRoot, false),
  };
};

describe("PreFlight — the checked rule list (derived from the declaration surface)", () => {
  it("lists 19 doc-scope skips (`no doc target`) and the 2 ledger rows on a wave dispatch", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const verdict = await preflightOf().vet(
        waveCtx(repoRoot, [task(1, "none"), task(2, "1")], [1], "implement"),
      );
      expect(verdict.ok).toBe(true);
      expect(verdict.checked.filter((row) => row.endsWith("skipped (no doc target)"))).toHaveLength(
        19,
      );
      expect(verdict.checked).toContain("closed-wave-fits-depends-on-layers: passed");
      expect(verdict.checked).toContain("planned-tasks-vs-recorded-tasks: passed");
      // one rule, one row — the declaration rows render once, never per gate
      expect(
        verdict.checked.filter((row) => row.startsWith("planned-tasks-vs-recorded-tasks:")),
      ).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

  it("lists the same 19 doc-scope skips on a branch dispatch", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const verdict = await preflightOf().vet(branchCtx(repoRoot, [task(1, "none")]));
      expect(verdict.ok).toBe(true);
      expect(verdict.checked.filter((row) => row.endsWith("skipped (no doc target)"))).toHaveLength(
        19,
      );
      expect(verdict.checked).toContain("closed-wave-fits-depends-on-layers: passed");
    } finally {
      cleanup();
    }
  });

  it("renders the doc-scope rule results on a doc dispatch, and the ledger rows as skipped", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const verdict = await preflightOf(memoryFs(CONFORMING_SPEC)).vet(
        docCtx(repoRoot, "phase-spec", "review"),
      );
      expect(verdict.ok).toBe(true);
      expect(verdict.checked).toContain("presence: passed");
      expect(verdict.checked).toContain("change-history-version-unique: passed");
      expect(
        verdict.checked.filter((row) => row.endsWith("skipped (no ledger facts)")),
      ).toHaveLength(2);
    } finally {
      cleanup();
    }
  });
});

describe("PreFlight — the plan-ledger gate", () => {
  it("lets the plan lead the ledger by one task, reporting it as an info row (not a refusal)", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const ctx = branchCtx(repoRoot, [task(1, "none"), task(2, "1")], (ledger) => {
        ledger.recordRound("1", "implement");
      });
      const verdict = await preflightOf().vet(ctx);
      expect(verdict.ok).toBe(true);
      expect(verdict.reason).toBeUndefined();
      expect(verdict.checked).toContain("plan-ledger: info (plan leads ledger by 1 tasks)");
      expect(verdict.checked).toContain("planned-tasks-vs-recorded-tasks: passed");
    } finally {
      cleanup();
    }
  });

  it("BLOCKs when the ledger records a task the plan no longer carries (the mutation guard)", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      // The plan carries 1..3 while the ledger recorded 1 and 11 — the executed task
      // 11 is absent from the plan, the ONE disagreement this gate judges.
      const ctx = branchCtx(repoRoot, [task(1, "none"), task(2, "1"), task(3, "2")], (ledger) => {
        ledger.recordRound("1", "implement");
        ledger.recordRound("11", "implement");
      });
      const verdict = await preflightOf().vet(ctx);
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("plan-ledger");
      // the gate name carries the refusal's identity — `reason` stays absent (the
      // zero-dead-value discipline: no borrowed `doc-contract` row, no dead row)
      expect(verdict.reason).toBeUndefined();
      expect((verdict.details ?? []).join("\n")).toContain("planned-tasks-vs-recorded-tasks");
      expect(verdict.checked).toContain("planned-tasks-vs-recorded-tasks: failed");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P21 T6 — the in-flight gate (the tree's dispatch fact, §2.2 / §6.4)
// ---------------------------------------------------------------------------

describe("PreFlight — the in-flight gate", () => {
  it("refuses a live holder before the structural gates, names it, and writes nothing", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const record = recordOf();
      writeRecord(repoRoot, record);
      const lock = path.join(repoRoot, ".kairos", "cdd", "in-flight.json.lock");
      mkdirSync(lock, { recursive: true });
      const ctx = waveCtx(repoRoot, [task(1, "none")], [1], "implement");
      const before = inFlightSnapshot(repoRoot);

      const verdict = await preflightOf().vet({ ...ctx, inflight: inflightOf(repoRoot, true) });

      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("in-flight");
      expect(verdict.reason).toBe("held");
      for (const token of [
        "4242",
        record.command,
        "2026-10-28T10:00:00.000Z",
        "wave: 1",
        "other-slug",
      ]) {
        expect(verdict.message).toContain(token);
      }
      expect(verdict.order).toEqual(["tree-clean", "in-flight"]);
      expect(verdict.checked[0]).toBe("tree-clean");
      expect(verdict.checked[1]).toMatch(/^in-flight: held/);
      expect(verdict.holding).toEqual(expect.objectContaining({ kind: "held", alive: true }));
      // the gate only judged — the record and the lock carrier are byte-identical
      expect(inFlightSnapshot(repoRoot)).toBe(before);
    } finally {
      cleanup();
    }
  });

  it("refuses a dead holder with the takeover hint, and only the explicit flag lets the gate pass", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      writeRecord(repoRoot, recordOf());
      const before = inFlightSnapshot(repoRoot);
      const ctx = waveCtx(repoRoot, [task(1, "none")], [1], "implement");

      const refused = await preflightOf().vet({ ...ctx, inflight: inflightOf(repoRoot, false) });
      expect(refused.ok).toBe(false);
      expect(refused.gate).toBe("in-flight");
      expect(refused.reason).toBe("held");
      expect(refused.message).toContain("--steal-stale");
      expect(inFlightSnapshot(repoRoot)).toBe(before);

      // the flag only lets the GATE pass; the takeover itself is the real
      // dispatch's acquire — the gate still writes nothing
      const takeover = await preflightOf().vet({
        ...ctx,
        inflight: inflightOf(repoRoot, false),
        stealStale: true,
      });
      expect(takeover.ok).toBe(true);
      expect(takeover.checked).toContain(
        "in-flight: stale holder — pid 4242 (re-run with --steal-stale to take over)",
      );
      expect(inFlightSnapshot(repoRoot)).toBe(before);
    } finally {
      cleanup();
    }
  });

  it("treats a corrupt record with its lock as held (refuse, or pass under the flag) — never clears it", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      writeRecord(repoRoot, "{ not json");
      mkdirSync(path.join(repoRoot, ".kairos", "cdd", "in-flight.json.lock"), { recursive: true });
      const before = inFlightSnapshot(repoRoot);
      const ctx = waveCtx(repoRoot, [task(1, "none")], [1], "implement");

      const refused = await preflightOf().vet({ ...ctx, inflight: inflightOf(repoRoot, true) });
      expect(refused.ok).toBe(false);
      expect(refused.gate).toBe("in-flight");
      expect(refused.reason).toBe("corrupt-record");
      expect(refused.message).toContain("unreadable");
      expect(inFlightSnapshot(repoRoot)).toBe(before);

      const takeover = await preflightOf().vet({
        ...ctx,
        inflight: inflightOf(repoRoot, true),
        stealStale: true,
      });
      expect(takeover.ok).toBe(true);
      expect(inFlightSnapshot(repoRoot)).toBe(before);
    } finally {
      cleanup();
    }
  });

  it("passes a corrupt record with no lock behind it, naming the fact (zero write)", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      writeRecord(repoRoot, "{ not json");
      const before = inFlightSnapshot(repoRoot);
      const ctx = waveCtx(repoRoot, [task(1, "none")], [1], "implement");
      const verdict = await preflightOf().vet({ ...ctx, inflight: inflightOf(repoRoot, true) });
      expect(verdict.ok).toBe(true);
      expect(verdict.checked).toContain("in-flight: unreadable record — no lock behind");
      expect(inFlightSnapshot(repoRoot)).toBe(before);
    } finally {
      cleanup();
    }
  });

  it("renders the `in-flight:` row on the doc, wave and branch dispatch faces", async () => {
    const { repoRoot, cleanup } = gitRepo();
    try {
      const wave = await preflightOf().vet(waveCtx(repoRoot, [task(1, "none")], [1], "implement"));
      const branch = await preflightOf().vet(branchCtx(repoRoot, [task(1, "none")]));
      const doc = await preflightOf(memoryFs(CONFORMING_SPEC)).vet(
        docCtx(repoRoot, "phase-spec", "review"),
      );
      for (const verdict of [wave, branch, doc]) {
        expect(verdict.ok).toBe(true);
        expect(verdict.checked.some((row) => row.startsWith("in-flight:"))).toBe(true);
        expect(verdict.order).toContain("in-flight");
      }
    } finally {
      cleanup();
    }
  });
});
