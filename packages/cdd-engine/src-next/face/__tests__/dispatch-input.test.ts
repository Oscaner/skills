// packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts
// P38 T2 — the `dispatch-input` gate's pins (design spec §2.1–§2.4). The gate judges
// "can this round stand at all" BEFORE the artifact gate and before any child exists:
// every cell its layout requires was supplied, every read path it names is on disk, and
// a structural precondition declared in the identity document's front matter is honoured.
//
// The pins are the DECLARATION, never a hand-written table of today's values:
//   · (a)–(g) one behaviour per arm — the reported row/token, the absolute existence
//     read, the closed two-word reason set, the two structural preconditions;
//   · (h) a data-driven sweep over the thirteen reachable (row, type) pairs: every
//     exigible cell that can be emptied is emptied once and must be named, so a new
//     required cell can never land without a pin;
//   · (i)–(l) the reversals the phase turns over and the two row-selector slots the
//     gate is never asked about;
//   · the two dispatch-side pins: a refusal books no round and leaves no writable
//     carrier behind.

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { planSourceOf } from "../../__tests__/support/plan-source.ts";
import { stripComments } from "../../__tests__/support/strip-comments.ts";
import type { DocFs } from "../../contract/invariants.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import type { ContextLine, WorkMode } from "../../render/templates.ts";
import { TemplateAssembler } from "../../render/templates.ts";
import type { TargetType } from "../../session/faces.ts";
import { Ledger } from "../../session/ledger.ts";
import { ArtifactRegistry } from "../../session/round-artifacts.ts";
import type { OpenFrame } from "../../session/run.ts";
import type { CliIo, DispatchScene } from "../lifecycle.ts";
import { CliLifecycle } from "../lifecycle.ts";
import type { ChildOutcome, ChildRun, ChildRunner } from "../termination.ts";

// ---------------------------------------------------------------------------
// the seams — a recording read face, a silent io, and the scene over a temp root
// ---------------------------------------------------------------------------

/** The gate's existence read, recorded — every questioned path is kept so the
 *  absolute-path arm can assert the ONE erasure point ran before the read. */
class RecordingFs implements DocFs {
  readonly asked: string[] = [];
  readonly #present: ReadonlySet<string>;
  readonly #known: boolean;

  constructor(present: readonly string[] = [], known = false) {
    this.#present = new Set(present);
    this.#known = known;
  }

  exists(p: string): boolean {
    this.asked.push(p);
    return this.#known || this.#present.has(p);
  }

  read(): string | null {
    return null;
  }

  list(): readonly string[] {
    return [];
  }
}

class SilentIo implements CliIo {
  stdoutText = "";
  stderrText = "";
  stdout(text: string): void {
    this.stdoutText += text;
  }
  stderr(text: string): void {
    this.stderrText += text;
  }
}

/** A hermetic repo root for the whole file — the ledger writes `progress.json` here, so
 *  the scene is a real workspace (never a fictional coordinate). */
const REPO = realpathSync(mkdtempSync(path.join(tmpdir(), "dispatch-input-")));
const WORKSPACE = new Workspace(new WorkspaceRoot(REPO, ".kairos/cdd"), "p9").ensure();

/** The paths of a fully supplied in-register scene — every read cell names a file, so
 *  an arm that wants one cell to fail disturbs exactly that cell. */
const SUPPLIED = {
  briefPath: path.join(REPO, ".kairos", "cdd", "p9", "tasks-1-brief.md"),
  planPath: path.join(REPO, "docs", "kairos", "plans", "p9.md"),
  specLink: "docs/kairos/specs/p9-design.md",
  overallLink: "docs/kairos/overalls/p9-charter.md",
  baseBranch: "develop",
  program: "p9",
  docType: "phase-spec",
} as const;

/** One scene over the file's workspace, with the supplied cells as the default. */
const sceneOf = (over: Partial<DispatchScene> = {}): DispatchScene => ({
  workspace: WORKSPACE,
  ledger: new Ledger(WORKSPACE, new ConfigLoader(), planSourceOf(WORKSPACE.root.basis)),
  planPath: SUPPLIED.planPath,
  plan: planSourceOf(WORKSPACE.root.basis).readFor(null),
  briefPath: SUPPLIED.briefPath,
  baseBranch: SUPPLIED.baseBranch,
  specLink: SUPPLIED.specLink,
  overallLink: SUPPLIED.overallLink,
  program: SUPPLIED.program,
  docType: SUPPLIED.docType,
  ...over,
});

/** One gate instance — the read face is injected so no case touches the real tree. */
const gateOf = (
  over: Partial<DispatchScene> = {},
  fs: DocFs = new RecordingFs([], true),
  reviews: string | null = null,
): CliLifecycle =>
  new CliLifecycle({
    scene: sceneOf(over),
    artifacts: new ArtifactRegistry(),
    io: new SilentIo(),
    fs,
    reviews,
    env: {},
  });

/** The refused reason of one frame (null when the round stands). */
const refusalOf = (gate: CliLifecycle, frame: OpenFrame): string | null => gate.inputRefusal(frame);

// ---------------------------------------------------------------------------
// frames — one factory per row, so the sweep iterates the reachable pairs
// ---------------------------------------------------------------------------

/** The judged target of a type — the shape `#valuesOf` reads the doc path from: the
 *  plan face names its plan document, the spec-shaped faces their judged document. */
const targetOf = (type: TargetType): OpenFrame["target"] => {
  switch (type) {
    case "wave":
      return { kind: "wave", tasks: [1] };
    case "branch":
      return { kind: "branch" };
    case "plan":
      return { kind: "plan", doc: SUPPLIED.planPath };
    default:
      return { kind: "spec", doc: path.join(REPO, "docs", "kairos", "specs", "p9-design.md") };
  }
};

/** The phase a (role, type) pair rides — the ROLE is what the row label prints. */
const phaseOf = (role: WorkMode, type: TargetType): OpenFrame["phase"] => {
  if (role === "implement") return "implement";
  if (role === "review") return type === "branch" ? "branch-review" : "review";
  return "fix";
};

/** The row frames the production can reach: implement → wave · review → six faces ·
 *  fix → wave + branch · docs-fix → the four document faces (never `fix --type
 *  overall`, which `#roleOf` maps onto the docs-fix row). */
const ROWS: readonly (readonly [WorkMode, TargetType])[] = [
  ["implement", "wave"],
  ["review", "wave"],
  ["review", "branch"],
  ["review", "plan"],
  ["review", "phase-spec"],
  ["review", "single-spec"],
  ["review", "overall"],
  ["fix", "wave"],
  ["fix", "branch"],
  ["docs-fix", "phase-spec"],
  ["docs-fix", "single-spec"],
  ["docs-fix", "plan"],
  ["docs-fix", "overall"],
];

/** One frame of a (role, type) pair. */
const frameOf = (role: WorkMode, type: TargetType, over: Partial<OpenFrame> = {}): OpenFrame => ({
  type,
  phase: phaseOf(role, type),
  round: 1,
  target: targetOf(type),
  params: { tasks: "1", round: 1 },
  key: type === "wave" ? "1" : type,
  ...over,
});

/** The row's declared layout — the ONE declaration read, over a values object that
 *  carries the two row-selector slots alone (`layoutOf` selects, it resolves nothing). */
const layoutOf = (role: WorkMode, type: TargetType): readonly ContextLine[] =>
  new TemplateAssembler().layoutOf({ ROLE: role, TARGET_TYPE: type });

/** The token a declared line carries (undefined for the value-less lines). */
const tokenOf = (decl: ContextLine): string | undefined => TemplateAssembler.slotOf(decl.line);

// ---------------------------------------------------------------------------
// the sweep's own declaration reading — folded from the arms, never from the gate
// ---------------------------------------------------------------------------

/** The two row-selector slots — emptied, the assembler throws before the gate and the
 *  gate is never asked (arm (l)). */
const ROW_SELECTORS: readonly string[] = ["ROLE", "TARGET_TYPE"];

/** The cells the ENGINE computes for every round — no frame can leave one empty, so
 *  they are outside the empty-value domain by structure, not by omission. */
const ENGINE_COMPUTED: readonly string[] = [
  "OUTPUT_REPORT",
  "OUTPUT_EVIDENCE",
  "OUTPUT_HANDOFF",
  "WORKSPACE_DIR",
  "WORKSPACE_ID",
];

/** Whether one arm is exigible for a type under the given declarations (the test's own
 *  reading of §1.3 — deliberately independent of the gate's implementation). */
const armHits = (
  arm: ContextLine["requiredOn"][number],
  type: TargetType,
  declared: { readonly program: boolean; readonly identity: boolean },
): boolean => {
  const typed = arm.types === "always" || arm.types.includes(type);
  if (!typed) return false;
  if (arm.when === "program") return declared.program;
  if (arm.when === "identity") return declared.identity;
  return true;
};

/** The exigible tokens of one row under the given declarations. */
const exigibleTokens = (
  role: WorkMode,
  type: TargetType,
  declared: { readonly program: boolean; readonly identity: boolean },
): readonly string[] => {
  const tokens: string[] = [];
  for (const decl of layoutOf(role, type)) {
    const token = tokenOf(decl);
    if (token === undefined) continue;
    if (decl.requiredOn.some((arm) => armHits(arm, type, declared))) tokens.push(token);
  }
  return tokens;
};

/** How one cell is emptied — the scene/frame disturbance that leaves exactly that cell
 *  without a value. Keyed by TOKEN because the value is the token's, whichever row
 *  reads it. */
interface Recipe {
  readonly scene?: Partial<DispatchScene>;
  readonly frame?: Partial<OpenFrame>;
}

const EMPTY_RECIPES: Readonly<Record<string, Recipe>> = {
  WAVE: { frame: { params: { round: 1 } } },
  INPUT_WAVE_BRIEF: { scene: { briefPath: null } },
  INPUT_PLAN: { scene: { planPath: null }, frame: { target: { kind: "plan", doc: "" } } },
  INPUT_SPEC: { scene: { specLink: null }, frame: { target: { kind: "spec", doc: "" } } },
  INPUT_OVERALL: { scene: { overallLink: null }, frame: { target: { kind: "spec", doc: "" } } },
  BASE_BRANCH: { scene: { baseBranch: "" } },
  // Reversal ②'s empty half: a cycle that RECORDED a review whose carrier never landed
  // resolves to no path at all (`Ledger#carrierPathOf`'s step ③), so the cell is empty
  // rather than a composed-but-absent name.
  INPUT_REVIEWS: {},
};

// ---------------------------------------------------------------------------
// (a)–(g) one behaviour per arm
// ---------------------------------------------------------------------------

describe("the dispatch-input gate — the reported cell (§2.2)", () => {
  it("(a) names the failing row and token for a required cell the engine never supplied", () => {
    // implement's brief is the round's single plan face: no brief, no round.
    const implement = gateOf({ briefPath: null });
    expect(refusalOf(implement, frameOf("implement", "wave"))).toBe(
      "dispatch-input · implement · INPUT_WAVE_BRIEF · empty-value",
    );
    // review's scope anchor is the base branch — the cell is a branch name, not a path.
    const review = gateOf({ baseBranch: "" });
    expect(refusalOf(review, frameOf("review", "wave"))).toBe(
      "dispatch-input · review · BASE_BRANCH · empty-value",
    );
  });

  it("(b) asks the existence leg with the ABSOLUTE path, never the repo-relative spelling", () => {
    const gone = path.join(REPO, "docs", "kairos", "plans", "gone.md");
    const fs = new RecordingFs([
      path.join(REPO, SUPPLIED.specLink),
      path.join(REPO, SUPPLIED.overallLink),
    ]);
    const gate = gateOf({ planPath: gone }, fs);
    expect(refusalOf(gate, frameOf("review", "branch"))).toBe(
      "dispatch-input · review · INPUT_PLAN · target-absent",
    );
    // The read is taken at the ONE erasure point: a dispatch from a subdirectory still
    // resolves every landed path, so a cwd-relative spelling would read them all absent.
    expect(fs.asked).toEqual([
      gone,
      path.join(REPO, SUPPLIED.specLink),
      path.join(REPO, SUPPLIED.overallLink),
    ]);
    expect(path.isAbsolute(fs.asked[0] ?? "")).toBe(true);
  });

  it("(c) reports every failing cell in ONE line, `; ` between the segments", () => {
    const gate = gateOf({ planPath: null, baseBranch: "" });
    const reason = refusalOf(gate, frameOf("review", "branch"));
    expect(reason).toBe(
      "dispatch-input · review · INPUT_PLAN · empty-value; review · BASE_BRANCH · empty-value",
    );
    // One line, two segments: never one block per cell (a fold would read as two blocks).
    expect(reason?.match(/dispatch-input/g)).toHaveLength(1);
    expect(reason?.split("; ")).toHaveLength(2);
  });

  it("(d) does not report a `when: program` cell whose precondition is NOT declared", () => {
    // The identity document declares no `program:`, so the charter cell does not exist
    // on this round — an absent declaration is not a broken resolution.
    const gate = gateOf({ program: null, overallLink: null });
    expect(refusalOf(gate, frameOf("review", "plan"))).toBeNull();
  });

  it("(e) does not report `INPUT_RULINGS` — the `never` cell is not a missing input", () => {
    // The sidecar genuinely may not exist: the declaration renders the bare word `none`
    // (the assembler's job), and the gate has no arm that would red it.
    const gate = gateOf({}, new RecordingFs([], true), null);
    expect(refusalOf(gate, frameOf("fix", "wave"))).toBeNull();
    expect(layoutOf("fix", "wave").some((decl) => tokenOf(decl) === "INPUT_RULINGS")).toBe(true);
  });

  it("(f) a fully supplied round stands — the gate answers null", () => {
    for (const [role, type] of ROWS) {
      expect(refusalOf(gateOf(), frameOf(role, type)), `${role}/${type}`).toBeNull();
    }
  });

  it("(g) reversal ④ — a tree review without `base.json` is refused, not silently narrowed", () => {
    // `#baseBranchOf` hands the empty string when the artifact is absent; the review of a
    // live tree against no baseline can not judge what the round changed.
    const gate = gateOf({ baseBranch: "" });
    expect(refusalOf(gate, frameOf("review", "branch"))).toBe(
      "dispatch-input · review · BASE_BRANCH · empty-value",
    );
  });
});

// ---------------------------------------------------------------------------
// (h) the data-driven sweep — every emptyable exigible cell, one at a time
// ---------------------------------------------------------------------------

/** Every slot some row's layout carries — the domain the classification below reads, and
 *  the liveness face of every hand list it holds. */
const CARRIED: ReadonlySet<string> = (() => {
  const carried = new Set<string>();
  for (const [role, type] of ROWS) {
    for (const decl of layoutOf(role, type)) {
      const token = tokenOf(decl);
      if (token !== undefined) carried.add(token);
    }
  }
  return carried;
})();

/** Every slot some row REQUIRES under at least one declaration set. */
const REQUIRED_CELLS: ReadonlySet<string> = (() => {
  const required = new Set<string>();
  for (const [role, type] of ROWS) {
    for (const token of exigibleTokens(role, type, { program: true, identity: true })) {
      required.add(token);
    }
    for (const token of exigibleTokens(role, type, { program: false, identity: false })) {
      required.add(token);
    }
  }
  return required;
})();

/** The cells no row requires under either declaration set — computed, never listed: a
 *  `{ types: [] }` arm names no type, so no frame can make it exigible. */
const NEVER_CELLS: ReadonlySet<string> = new Set(
  [...CARRIED].filter((token) => !REQUIRED_CELLS.has(token)),
);

describe("the dispatch-input gate — the declaration sweep (§4.1 · §4.2)", () => {
  it("(h) names every exigible cell that can be emptied, one cell per arm", () => {
    // The cells NO row requires under either declaration set — the `never` form (§1.3):
    // a legal declaration, not a gap the gate could ever ask about.
    // The sweep's domain is the declaration itself: every slot a row's layout carries
    // must be one of the two row selectors, an engine-computed cell, or a recipe.
    for (const [role, type] of ROWS) {
      for (const decl of layoutOf(role, type)) {
        const token = tokenOf(decl);
        if (token === undefined) continue;
        const known =
          ROW_SELECTORS.includes(token) ||
          ENGINE_COMPUTED.includes(token) ||
          NEVER_CELLS.has(token) ||
          token in EMPTY_RECIPES;
        expect(known, `${role}/${type} carries an unclassified cell ${token}`).toBe(true);
      }
    }
    // And every recipe is live: a recipe no row requires is a stale arm.
    for (const token of Object.keys(EMPTY_RECIPES)) {
      expect(REQUIRED_CELLS.has(token), `recipe ${token} is required by no row`).toBe(true);
    }

    for (const [role, type] of ROWS) {
      const exigible = exigibleTokens(role, type, { program: true, identity: true });
      for (const token of exigible) {
        if (ROW_SELECTORS.includes(token) || ENGINE_COMPUTED.includes(token)) continue;
        const recipe = EMPTY_RECIPES[token];
        if (recipe === undefined) continue;
        const frame = frameOf(role, type, recipe.frame ?? {});
        const scene = { ...(recipe.scene ?? {}) };
        if (token === "INPUT_REVIEWS") {
          // The empty path is the RECORDED review whose carrier never landed: seed the
          // cycle, leave the file absent (reversal ②'s empty half).
          WORKSPACE.ensure();
          sceneOf().ledger.recordRound(String(frame.key), { op: "review", cycle: 1, attempt: 1 });
        }
        const reason = refusalOf(gateOf(scene), frame);
        expect(reason, `${role}/${type}/${token} was not reported`).toContain(
          `${role} · ${token} · `,
        );
      }
    }
  });

  it("(h2) the engine-computed exemption is live and no recipe can empty it", () => {
    // The inverse of the recipe liveness above: a hand list is only honest while every
    // token on it is still carried by a row and still unemptyable. A renamed or retired
    // cell left sitting here is a hole in the sweep, and a cell that BECOMES emptyable is
    // an input cell — the only way in is a recipe, so a recipe beside an exemption is
    // exactly the demotion this pin refuses to leave unread.
    for (const token of ENGINE_COMPUTED) {
      expect(CARRIED.has(token), `ENGINE_COMPUTED names ${token}, which no row carries`).toBe(true);
      expect(
        token in EMPTY_RECIPES,
        `ENGINE_COMPUTED ${token} is emptyable — demote it to a recipe`,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// (i)–(l) the reversals and the row-selector precondition
// ---------------------------------------------------------------------------

/** The child stand-in whose prompt is read — it writes nothing and exits 0. */
class PromptRunner implements ChildRunner {
  calls: ChildRun[] = [];
  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

/** A hermetic repo: one seed commit, the plan document and `.kairos` kept out of the tree. */
const repoFixture = (): { repoRoot: string; cleanup: () => void } => {
  const repoRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "dispatch-input-repo-")));
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "dispatch-input@test"],
    ["config", "user.name", "dispatch-input-test"],
  ]) {
    spawnSync("git", args, { cwd: repoRoot });
  }
  writeFileSync(path.join(repoRoot, ".gitignore"), ".kairos\n", "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  const planPath = path.join(repoRoot, "docs", "kairos", "plans", "p9.md");
  mkdirSync(path.dirname(planPath), { recursive: true });
  writeFileSync(planPath, "# plan\n\n### Task 1: task 1\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  return { repoRoot, cleanup: () => rmSync(repoRoot, { recursive: true, force: true }) };
};

/** The review frame of the fixture's wave. */
const reviewFrameOf = (): OpenFrame => frameOf("review", "wave");

describe("the dispatch-input gate — the structural preconditions (§1.3 · §2.3)", () => {
  it("(i) a declared `slug:` with no `doc-type:` leaves `INPUT_SPEC` non-exigible — the bytes stand", async () => {
    const f = repoFixture();
    try {
      const workspace = new Workspace(new WorkspaceRoot(f.repoRoot, ".kairos/cdd"), "p9").ensure();
      const brief = path.join(workspace.path, "tasks-1-brief.md");
      writeFileSync(brief, "# brief\n", "utf8");
      // P37 T4's ④ arm: the identity document is on disk with `slug:` but no `doc-type:`,
      // so the index hands `docType: null` — the shape the gate reads as "not declared".
      const runner = new PromptRunner();
      const io = new SilentIo();
      const lifecycle = new CliLifecycle({
        scene: {
          workspace,
          ledger: new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis)),
          planPath: null,
          plan: planSourceOf(workspace.root.basis).readFor(null),
          briefPath: brief,
          baseBranch: "develop",
          specLink: null,
          overallLink: null,
          program: null,
          docType: null,
        },
        artifacts: new ArtifactRegistry(),
        io,
        sync: runner,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      expect(lifecycle.inputRefusal(reviewFrameOf())).toBeNull();
      await lifecycle.step()(reviewFrameOf());
      // The gate passed: the child exists and the block channel never named dispatch-input.
      expect(runner.calls).toHaveLength(1);
      expect(io.stderrText).not.toContain("dispatch-input");
      // The cell is absent from the row, not emptied: the round context carries no line
      // for it (the shell prose still names the token — that is the fixed prefix's text).
      const prompt = runner.calls[0]?.args.join(" ") ?? "";
      expect(prompt).toContain("- `INPUT_WAVE_BRIEF`: ");
      expect(prompt).not.toContain("- `INPUT_SPEC`: ");
    } finally {
      f.cleanup();
    }
  });

  it("(j) a declared `program:` whose charter does not resolve is `target-absent`", () => {
    // The declaration is the identity document's `program:` literal; the value is the
    // resolved link. Reading the resolved value alone would flatten this into "absent".
    const gate = gateOf({ program: "p9", overallLink: null });
    const reason = refusalOf(gate, frameOf("review", "wave"));
    expect(reason?.endsWith("INPUT_OVERALL · target-absent")).toBe(true);
  });

  it("(k) a declared `doc-type:` whose spec link is null is `empty-value`", () => {
    // The identity arm exists (the shape is declared), so the cell is required — and the
    // engine supplied nothing: an omission, never a broken link.
    const gate = gateOf({ docType: "phase-spec", specLink: null });
    const reason = refusalOf(gate, frameOf("review", "wave"));
    expect(reason?.endsWith("INPUT_SPEC · empty-value")).toBe(true);
  });

  it("(l) the two row-selector slots stay the assembler's precondition, not a third reason", () => {
    // Emptied, the row can not even be selected: the assembler throws its own message
    // before the gate exists. This is why the reason set stays closed at two words.
    const template = new TemplateAssembler();
    expect(() => template.layoutOf({ ROLE: "", TARGET_TYPE: "wave" })).toThrow(
      "template work-mode not declared",
    );
    expect(() => template.layoutOf({ ROLE: "review", TARGET_TYPE: "" })).toThrow(
      "template review type not declared",
    );
  });
});

// ---------------------------------------------------------------------------
// the gate's order and its two shape constraints (§2.1 · §2.2 · the acceptance)
// ---------------------------------------------------------------------------

/** The rulings sidecar path of one carrier — the matrix's own render, never a
 *  hand-spelled name. */
const sidecarOf = (workspace: Workspace, carrierPath: string): string => {
  const registry = new ArtifactRegistry();
  const attributed = registry.attribute(path.basename(carrierPath));
  if (attributed === null || attributed.identity.domain !== "round") {
    throw new Error(`the fixture carrier ${carrierPath} attributes to no round`);
  }
  const sidecar = registry.locate({ ...attributed.identity, op: "review" }, "rulings", workspace);
  if (sidecar === null) throw new Error("the matrix renders no rulings sidecar");
  return sidecar;
};

/** The engine source of one face file, comments stripped (shape pins only). */
const sourceOf = (rel: string): string =>
  stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

describe("the dispatch-input gate — order and shape (§2.1 · §2.2)", () => {
  it("(m) the input gate runs BEFORE the artifact gate — both violated, the input line wins", async () => {
    const f = repoFixture();
    try {
      const workspace = new Workspace(new WorkspaceRoot(f.repoRoot, ".kairos/cdd"), "p9").ensure();
      const carrier = path.join(workspace.path, "tasks-1-review-1.json");
      writeFileSync(carrier, JSON.stringify({ findings: [] }), "utf8");
      // A sidecar the strict schema refuses: the artifact gate's own refusal, on the
      // same frame that names no brief (the input gate's).
      writeFileSync(sidecarOf(workspace, carrier), "{ not json", "utf8");
      const io = new SilentIo();
      const lifecycle = new CliLifecycle({
        scene: {
          workspace,
          ledger: new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis)),
          planPath: null,
          plan: planSourceOf(workspace.root.basis).readFor(null),
          // the wave brief is absent — the round can not stand at all
          briefPath: null,
          baseBranch: "develop",
          specLink: null,
          overallLink: null,
          program: null,
          docType: null,
        },
        artifacts: new ArtifactRegistry(),
        io,
        sync: new PromptRunner(),
        env: { CLAUDE_CODE_SESSION_ID: "s" },
        reviews: carrier,
      });
      const frame = frameOf("fix", "wave");
      expect(lifecycle.inputRefusal(frame)).toBe(
        "dispatch-input · fix · INPUT_WAVE_BRIEF · empty-value",
      );
      // … and the artifact gate would have refused it: the input line still wins.
      expect(lifecycle.artifactRefusal(frame)).toContain("rulings sidecar");
      const outcome = await lifecycle.step()(frame);
      expect(outcome.status).toBe("BLOCKED");
      expect(io.stderrText).toContain("CDD_BLOCKED: dispatch-input · fix · INPUT_WAVE_BRIEF");
      expect(io.stderrText).not.toContain("rulings sidecar");
    } finally {
      f.cleanup();
    }
  });

  it("(n) composes the values ONCE per dispatch — the gate and the prompt read one value", () => {
    const face = sourceOf("../lifecycle.ts");
    const start = face.indexOf("async #runDispatch(");
    // the body ends at the NEXT method declaration (`#runDispatch` is not the last one)
    const body = face.slice(start, face.indexOf("\n  async #", start + 10));
    const reads = body.match(/#valuesOf\(/g) ?? [];
    // One composition, two consumers (spec §2.3's "一份读取、两个消费者"): a second
    // `#valuesOf` call would let the gate judge a value the child never receives.
    expect(reads).toHaveLength(1);
    expect(body).toContain('this.#inputRefusalOf(values, frame, "dispatch")');
    expect(body).toContain("this.#template.render(values)");
  });

  it("(p) answers the preview's brief cell from the naming line — never an existence read", () => {
    const fs = new RecordingFs([], false);
    const isolated = {
      briefPath: null,
      baseBranch: "",
      specLink: null,
      overallLink: null,
      program: null,
      docType: null,
    };
    const gate = gateOf(isolated, fs);
    const frame = frameOf("review", "wave");
    expect(gate.inputRefusal(frame)).toBe(
      "dispatch-input · review · INPUT_WAVE_BRIEF · empty-value; review · BASE_BRANCH · empty-value",
    );
    // The preview exempts ONLY the engine-written (`written: "engine"`) cell, and only its existence
    // leg: the wave's brief is named by the naming row, while the scope anchor is judged.
    expect(gate.inputRefusal(frame, "preview")).toBe(
      "dispatch-input · review · BASE_BRANCH · empty-value",
    );
    // Nothing was asked: the preview never questions a file it would not write.
    expect(fs.asked).toEqual([]);
    // A wave that names no task group names no brief — the empty-value arm is back.
    const bare = gateOf(isolated, new RecordingFs([], false));
    expect(
      bare.inputRefusal(frameOf("review", "wave", { params: { round: 1 } }), "preview"),
    ).toContain("INPUT_WAVE_BRIEF · empty-value");
  });

  it("(o) keeps the reason set closed at two words — no third reason exists", () => {
    const words = sourceOf("../words.ts");
    const face = sourceOf("../lifecycle.ts");
    // The declared union IS the set: a third word would have to be declared here first.
    expect(words).toContain('export type DispatchInputReason = "empty-value" | "target-absent";');
    for (const text of [words, face]) {
      expect(text).not.toContain("missing-line");
      expect(text).not.toContain("undeclared-cell");
    }
  });
});

// ---------------------------------------------------------------------------
// the dispatch-side pins — no round booked, no writable carrier left behind
// ---------------------------------------------------------------------------

/** A file's permission bits. */
const modeOf = (file: string): number => statSync(file).mode & 0o777;

describe("the dispatch-input gate — the refused round (§2.1)", () => {
  it("books no round and takes no in-flight record — the child never exists", async () => {
    const f = repoFixture();
    try {
      const workspace = new Workspace(new WorkspaceRoot(f.repoRoot, ".kairos/cdd"), "p9").ensure();
      const brief = path.join(workspace.path, "tasks-1-brief.md");
      writeFileSync(brief, "# brief\n", "utf8");
      const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
      const io = new SilentIo();
      const runner = new PromptRunner();
      const lifecycle = new CliLifecycle({
        scene: {
          workspace,
          ledger,
          planPath: null,
          plan: planSourceOf(workspace.root.basis).readFor(null),
          briefPath: brief,
          // Reversal ④: no `base.json` — the tree review has no baseline.
          baseBranch: "",
          specLink: null,
          overallLink: null,
          program: null,
          docType: null,
        },
        artifacts: new ArtifactRegistry(),
        io,
        sync: runner,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await lifecycle.step()(reviewFrameOf());
      expect(outcome.status).toBe("BLOCKED");
      expect(runner.calls).toHaveLength(0);
      expect(io.stderrText).toContain(
        "CDD_BLOCKED: dispatch-input · review · BASE_BRANCH · empty-value",
      );
      // No in-flight record was ever published, and no round was booked.
      expect(
        statSync(path.join(workspace.root.path, "in-flight.json"), { throwIfNoEntry: false }),
      ).toBeUndefined();
      expect(ledger.recordsOf("1")).toHaveLength(0);
    } finally {
      f.cleanup();
    }
  });

  it("re-seals the round's own draft — an `-a2` retry leaves no writable carrier", async () => {
    const f = repoFixture();
    try {
      const workspace = new Workspace(new WorkspaceRoot(f.repoRoot, ".kairos/cdd"), "p9").ensure();
      const brief = path.join(workspace.path, "tasks-1-brief.md");
      writeFileSync(brief, "# brief\n", "utf8");
      // The previous attempt's draft, left writable by the preflight's own window.
      const draft = path.join(workspace.path, "tasks-1-review-1-a2.json");
      writeFileSync(draft, JSON.stringify({ findings: [] }), "utf8");
      expect(modeOf(draft)).toBe(0o644);
      const io = new SilentIo();
      const runner = new PromptRunner();
      const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
      const lifecycle = new CliLifecycle({
        scene: {
          workspace,
          ledger,
          planPath: null,
          plan: planSourceOf(workspace.root.basis).readFor(null),
          briefPath: brief,
          // Reversal ④: no `base.json` — the tree review has no baseline.
          baseBranch: "",
          specLink: null,
          overallLink: null,
          program: null,
          docType: null,
        },
        artifacts: new ArtifactRegistry(),
        io,
        sync: runner,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const frame = frameOf("review", "wave", {
        round: 1,
        attempt: 2,
        params: { tasks: "1", round: 1, attempt: 2 },
      });
      const outcome = await lifecycle.step()(frame);
      expect(outcome.status).toBe("BLOCKED");
      // The refusal is the input gate's, never the read-back's.
      expect(io.stderrText).toContain("dispatch-input · review · BASE_BRANCH · empty-value");
      // The window the preflight opened is closed by the refusal itself (P31 §2.4).
      expect(modeOf(draft)).toBe(0o444);
    } finally {
      f.cleanup();
    }
  });
});
