// packages/cdd-engine/src-next/contract/__tests__/preflight-rows.test.ts
// P40 T3 — the four pre-dispatch judgments as a pure value judgment. One case per row
// plus the two properties the extraction exists for:
//   (a) `no-host` — an empty host probe is the row's only input;
//   (b) `carrier` — the snapshot carries FACTS and the sentence is `CarrierLine`'s;
//   (c) `dispatch-input` — an exigible empty cell is named with its declared word, and
//       no existence read is taken for an empty value;
//   (d) `dispatch-input` — a declared path cell is read once through `RepoRoot.resolve`;
//   (e) every violation in ONE pass, in the fixed station order (no short-circuit);
//   (f) an engine-written slot takes ZERO existence reads, empty value or not;
//   (g) exigibility is resolved from the DECLARATIONS + the two scene facts + the type —
//       `always` / a type set / both `when` arms / the `never` form, judged on the
//       contract plane alone.
//
// P40 T5 re-homed the FACE's pure-judgment cases here (they were pinned through
// `CliLifecycle#inputRefusal` / `#artifactRefusal`, entries that retired with the gate):
// the letters `(P38 …)` keep the original label, and the expectation literals are the
// face suite's own bytes. The values come from the composer the composition root uses
// (`DispatchValues.compose`), the declarations from the renderer's row selection
// (`TemplateAssembler#layoutOf`) and the scene facts are flat values — a contract-plane
// judgment needs no workspace, no ledger and no frame.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "../../__tests__/support/strip-comments.ts";
import {
  type DispatchIdentity,
  type DispatchSceneFacts,
  DispatchValues,
} from "../../face/dispatch-values.ts";
import { Words } from "../../face/words.ts";
import { RepoRoot } from "../../infra/root.ts";
import { TemplateAssembler, type WorkMode } from "../../render/templates.ts";
import type { TargetType } from "../../session/faces.ts";
import { type CarrierFacts, CarrierLine } from "../carrier-line.ts";
import type { ContextLine } from "../context-declarations.ts";
import { ExigibleCells } from "../context-declarations.ts";
import type { DocFs } from "../invariants.ts";
import {
  type ArtifactSnapshot,
  type ArtifactSnapshotRead,
  PreFlightRows,
  type PreFlightRowsInput,
} from "../preflight-rows.ts";

// ---------------------------------------------------------------------------
// the seams — a recording existence read and a repo basis
// ---------------------------------------------------------------------------

/** The existence read, recorded — every questioned absolute path is kept, so "zero
 *  reads" and "the ONE erasure point ran" are both assertable. */
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

const ROOT = new RepoRoot("/repo");
const WORDING = new Words().preflightWording();

/** A value-cell declaration — a `{{TOKEN}}` line with the arms the case needs. */
const cellOf = (token: string, over: Partial<Omit<ContextLine, "line">> = {}): ContextLine => ({
  line: `- \`${token}\`: {{${token}}}`,
  absent: "drop",
  requiredOn: [{ types: "always" }],
  ...over,
});

const ALWAYS = cellOf("INPUT_TARGET", { path: true });

/** One judgment input — every cell defaults to the no-violation value, so a case only
 *  states the fact it judges. */
const inputOf = (over: Partial<PreFlightRowsInput> = {}): PreFlightRowsInput => ({
  facts: { type: "wave", host: "claude" },
  values: { ROLE: "review", INPUT_TARGET: "docs/spec.md" },
  declarations: [ALWAYS],
  scene: { program: false, docType: false },
  artifact: { kind: "read", reviewsPath: null, read: ABSENT },
  repoRoot: ROOT,
  fs: new RecordingFs(["/repo/docs/spec.md"]),
  wording: WORDING,
  ...over,
});

const ABSENT: ArtifactSnapshotRead = {
  kind: "absent",
  path: null,
  reason: null,
  found: [],
  identity: null,
  sidecarKind: null,
};

const CARRIER: CarrierFacts = {
  line: "/repo/.kairos/cdd/p/review-1.json",
  recorded: "aaaa",
  current: "bbbb",
};

const MISPLACED: ArtifactSnapshotRead = {
  kind: "misplaced",
  path: ".kairos/cdd/p/review-1.rulings.json",
  reason: null,
  found: [".kairos/cdd/p/review.rulings.json"],
  identity: "line=review · op=review · attempt=1",
  sidecarKind: "rulings",
};

const detailsOf = (input: PreFlightRowsInput): readonly string[] =>
  PreFlightRows.judge(input).map((row) => row.detail);

// ---------------------------------------------------------------------------
// (a) · (b) the two rows whose byte home is not the words table
// ---------------------------------------------------------------------------

describe("the no-host row", () => {
  it("(a) names its sentence from the injected wording — the empty probe is the only input", () => {
    const [only] = PreFlightRows.judge(inputOf({ facts: { type: "wave", host: "" } }));
    expect(only?.station).toBe("no-host");
    expect(only?.detail).toBe("no host harness detected (run cdd from within a supported harness)");
    expect(PreFlightRows.judge(inputOf())).toEqual([]);
  });
});

describe("the carrier row", () => {
  it("(b) renders the snapshot's FACTS through the ONE line composer", () => {
    const artifact: ArtifactSnapshot = { kind: "mismatch", reviewsPath: null, carrier: CARRIER };
    const [only] = PreFlightRows.judge(inputOf({ artifact }));
    expect(only?.station).toBe("carrier");
    expect(only?.detail).toBe(CarrierLine.of(CARRIER));
    expect(only?.detail).toBe(
      "carrier-mismatch · line=/repo/.kairos/cdd/p/review-1.json · recorded=aaaa · current=bbbb",
    );
  });
});

// ---------------------------------------------------------------------------
// (c) · (d) the dispatch-input row's two failing legs
// ---------------------------------------------------------------------------

describe("the dispatch-input row", () => {
  it("(c) names an exigible empty cell with its declared word — zero existence reads", () => {
    const fs = new RecordingFs();
    const input = inputOf({ values: { ROLE: "review", INPUT_TARGET: "" }, fs });
    expect(detailsOf(input)).toEqual(["dispatch-input · review · INPUT_TARGET · empty-value"]);
    expect(fs.asked).toEqual([]);
  });

  it("(d) reads a declared path cell ONCE, through the basis conversion", () => {
    const fs = new RecordingFs();
    const input = inputOf({ values: { ROLE: "fix", INPUT_TARGET: "docs/gone.md" }, fs });
    expect(detailsOf(input)).toEqual(["dispatch-input · fix · INPUT_TARGET · target-absent"]);
    expect(fs.asked).toEqual(["/repo/docs/gone.md"]);
  });

  it("(c') a declared `program:` whose charter did not resolve is `target-absent` — not an omission", () => {
    const input = inputOf({
      values: { ROLE: "review", INPUT_OVERALL: "" },
      declarations: [
        cellOf("INPUT_OVERALL", { requiredOn: [{ types: "always", when: "program" }] }),
      ],
      scene: { program: true, docType: false },
    });
    expect(detailsOf(input)).toEqual(["dispatch-input · review · INPUT_OVERALL · target-absent"]);
  });
});

// ---------------------------------------------------------------------------
// (e) one pass, fixed order
// ---------------------------------------------------------------------------

describe("the four rows judged once", () => {
  it("(e) reports every violation in the fixed station order — no short-circuit", () => {
    const input = inputOf({
      facts: { type: "wave", host: "" },
      values: { ROLE: "review", INPUT_TARGET: "" },
      artifact: { kind: "read", reviewsPath: null, read: MISPLACED },
    });
    const rows = PreFlightRows.judge(input);
    expect(rows.map((row) => row.station)).toEqual(["no-host", "dispatch-input", "artifact"]);
    expect(rows[1]?.detail).toBe("dispatch-input · review · INPUT_TARGET · empty-value");
    expect(rows[2]?.detail).toContain(
      "artifact-identity · the round's `rulings` sidecar sits off its rendered name",
    );
    expect(rows[2]?.detail).toContain("  derived:  .kairos/cdd/p/review-1.rulings.json");
    expect(rows[2]?.detail).toContain("  found:    .kairos/cdd/p/review.rulings.json");
    expect(rows[2]?.detail).toContain("  identity: line=review · op=review · attempt=1");
  });

  it("(e') the present-but-unreadable arm prints the read's reason verbatim", () => {
    const read: ArtifactSnapshotRead = {
      kind: "invalid",
      path: ".kairos/cdd/p/review-1.rulings.json",
      reason: "unreadable",
      found: [],
      identity: null,
      sidecarKind: null,
    };
    const input = inputOf({ artifact: { kind: "read", reviewsPath: null, read } });
    expect(detailsOf(input)).toEqual(["rulings sidecar — unreadable"]);
  });
});

// ---------------------------------------------------------------------------
// (f) the engine-written slot
// ---------------------------------------------------------------------------

describe("the engine-written slot", () => {
  const ENGINE = cellOf("INPUT_WAVE_BRIEF", { path: true, written: "engine" });

  it("(f) takes zero existence reads and zero empty-value penalties — the declaration is the answer", () => {
    const fs = new RecordingFs();
    const empty = inputOf({
      values: { ROLE: "review", INPUT_WAVE_BRIEF: "" },
      declarations: [ENGINE],
      fs,
    });
    expect(PreFlightRows.judge(empty)).toEqual([]);
    // A non-empty value still takes no read: the engine guarantees the file.
    const filled = inputOf({
      values: { ROLE: "review", INPUT_WAVE_BRIEF: ".kairos/cdd/p/tasks-1-brief.md" },
      declarations: [ENGINE],
      fs,
    });
    expect(PreFlightRows.judge(filled)).toEqual([]);
    expect(fs.asked).toEqual([]);
  });

  it("(f²) answers the engine-written cell the same way on every face — one judgment, no mode", () => {
    // P40 T5 retired the preview's naming exemption: the cell's answer is the
    // DECLARATION (`written: "engine"`), so an empty engine-written value stands on every
    // face and the engine-written cell never asks the disk. Only a cell the ENGINE does
    // not write keeps its empty-value word.
    const fs = new RecordingFs();
    const input = inputOf({
      values: { ROLE: "review", INPUT_WAVE_BRIEF: "", BASE_BRANCH: "" },
      declarations: [ENGINE, cellOf("BASE_BRANCH", { requiredOn: [{ types: "always" }] })],
      facts: { type: "wave", host: "claude" },
      fs,
    });
    expect(detailsOf(input)).toEqual(["dispatch-input · review · BASE_BRANCH · empty-value"]);
    expect(fs.asked).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (g) the declaration-driven exigibility
// ---------------------------------------------------------------------------

describe("the exigibility resolution", () => {
  const DECLARATIONS: readonly ContextLine[] = [
    cellOf("ALWAYS"),
    cellOf("TYPE_SET", { requiredOn: [{ types: ["branch"] }] }),
    cellOf("PROGRAM_ARM", { requiredOn: [{ types: "always", when: "program" }] }),
    cellOf("IDENTITY_ARM", { requiredOn: [{ types: "always", when: "identity" }] }),
    cellOf("NEVER", { requiredOn: [{ types: [] }] }),
    { line: "## Round context", absent: "drop", requiredOn: [{ types: [] }] },
  ];

  const tokensOf = (scene: { program: boolean; docType: boolean }, type: "wave" | "branch") =>
    ExigibleCells.resolve(DECLARATIONS, scene, type).map((cell) => cell.token);

  it("(g) resolves `always` / a type set / both `when` arms / the `never` form off the declarations", () => {
    expect(tokensOf({ program: false, docType: false }, "wave")).toEqual(["ALWAYS"]);
    expect(tokensOf({ program: false, docType: false }, "branch")).toEqual(["ALWAYS", "TYPE_SET"]);
    expect(tokensOf({ program: true, docType: false }, "wave")).toEqual(["ALWAYS", "PROGRAM_ARM"]);
    expect(tokensOf({ program: false, docType: true }, "wave")).toEqual(["ALWAYS", "IDENTITY_ARM"]);
  });

  it("(g') gives each cell the word its EMPTY value earns — the two `when` legs differ", () => {
    const cells = ExigibleCells.resolve(DECLARATIONS, { program: true, docType: true }, "wave");
    const reasonOf = (token: string) => cells.find((cell) => cell.token === token)?.reason;
    expect(reasonOf("ALWAYS")).toBe("empty-value");
    expect(reasonOf("PROGRAM_ARM")).toBe("target-absent");
    expect(reasonOf("IDENTITY_ARM")).toBe("empty-value");
    expect(reasonOf("NEVER")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// the dispatch-input row over a REAL row's declarations (the face suite's cases, P40 T5)
// ---------------------------------------------------------------------------

/** The row set the production can reach: implement → wave · review → six faces · fix →
 *  wave + branch · docs-fix → the four document faces. */
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

/** The phase a (role, type) pair rides — the ROLE is what the row label prints. */
const phaseOf = (role: WorkMode, type: TargetType): string => {
  if (role === "implement") return "implement";
  if (role === "review") return type === "branch" ? "branch-review" : "review";
  return "fix";
};

/** The identity a fixture round consumes — the two row selectors' own subject. */
const identityOf = (role: WorkMode, type: TargetType, over: Partial<DispatchIdentity> = {}) => ({
  op: (role === "docs-fix" ? "fix" : role) as DispatchIdentity["op"],
  type,
  phase: phaseOf(role, type),
  tasks: type === "wave" ? "1" : "",
  cycle: 1,
  attempt: 1,
  ...over,
});

/** The requesting carrier the fix face names — a composed path, present or not. */
const REVIEWS = ".kairos/cdd/p9/tasks-1-review-1.json";

/** The fully supplied scene facts: every path cell names a document, every scope anchor
 *  a branch — a recipe empties exactly the cell it judges. */
const FACTS: DispatchSceneFacts = {
  repoRoot: ROOT,
  docPath: "docs/kairos/specs/p9-design.md",
  planPath: "docs/kairos/plans/p9.md",
  specLink: "docs/kairos/specs/p9-design.md",
  overallLink: "docs/kairos/overalls/p9-charter.md",
  baseBranch: "develop",
  briefPath: ".kairos/cdd/p9/tasks-1-brief.md",
  workspaceDir: ".kairos/cdd/p9",
  workspaceId: "p9",
  reportPath: ".kairos/cdd/p9/tasks-1-implement-1-report.md",
  evidencePath: ".kairos/cdd/p9/tasks-1-implement-1-test-evidence.json",
  handoffPath: ".kairos/cdd/p9/tasks-1-implement-1.json",
  handoffSchema: "",
};

/** The healthy artifact snapshot — a present requesting carrier, an absent sidecar. */
const SNAPSHOT: ArtifactSnapshot = { kind: "read", reviewsPath: REVIEWS, read: ABSENT };

/** One judged round over the REAL declarations: the composer builds the record, the
 *  renderer selects the row, the scene facts are flat values. */
const judged = (
  role: WorkMode,
  type: TargetType,
  over: {
    readonly facts?: Partial<DispatchSceneFacts>;
    readonly identity?: Partial<DispatchIdentity>;
    readonly fs?: DocFs;
    readonly artifact?: ArtifactSnapshot;
    readonly scene?: { readonly program: boolean; readonly docType: boolean };
  } = {},
): PreFlightRowsInput => {
  const identity = identityOf(role, type, over.identity);
  const artifact = over.artifact ?? SNAPSHOT;
  const values = DispatchValues.compose(identity, { ...FACTS, ...over.facts }, artifact);
  return inputOf({
    facts: { type, host: "claude" },
    values,
    declarations: new TemplateAssembler().layoutOf(values),
    scene: over.scene ?? { program: true, docType: true },
    artifact,
    fs: over.fs ?? new RecordingFs([], true),
  });
};

describe("the dispatch-input row over a real layout — the reported cell", () => {
  it("(P38 a) names the failing row and token for a required cell the engine never supplied", () => {
    // review's scope anchor is the base branch — the cell is a branch name, not a path.
    expect(detailsOf(judged("review", "wave", { facts: { baseBranch: "" } }))).toEqual([
      "dispatch-input · review · BASE_BRANCH · empty-value",
    ]);
    // The branch line's plan read is the orchestrator's input: no plan, no round.
    expect(detailsOf(judged("review", "branch", { facts: { planPath: "" } }))).toEqual([
      "dispatch-input · review · INPUT_PLAN · empty-value",
    ]);
  });

  it("(P38 b) asks the existence leg with the ABSOLUTE path, never the repo-relative spelling", () => {
    const gone = "/repo/docs/kairos/plans/gone.md";
    const fs = new RecordingFs([
      "/repo/docs/kairos/specs/p9-design.md",
      "/repo/docs/kairos/overalls/p9-charter.md",
    ]);
    const input = judged("review", "branch", { facts: { planPath: gone }, fs });
    expect(detailsOf(input)).toEqual(["dispatch-input · review · INPUT_PLAN · target-absent"]);
    // The read is taken at the ONE erasure point: a dispatch from a subdirectory still
    // resolves every landed path, so a cwd-relative spelling would read them all absent.
    expect(fs.asked).toEqual([
      gone,
      "/repo/docs/kairos/specs/p9-design.md",
      "/repo/docs/kairos/overalls/p9-charter.md",
    ]);
    expect(fs.asked.every((asked) => asked.startsWith("/"))).toBe(true);
  });

  it("(P38 c) reports every failing cell in ONE line, `; ` between the segments", () => {
    const details = detailsOf(
      judged("review", "branch", { facts: { planPath: "", baseBranch: "" } }),
    );
    expect(details).toEqual([
      "dispatch-input · review · INPUT_PLAN · empty-value; review · BASE_BRANCH · empty-value",
    ]);
    // One line, two segments: never one block per cell (a fold would read as two blocks).
    expect(details[0]?.match(/dispatch-input/g)).toHaveLength(1);
    expect(details[0]?.split("; ")).toHaveLength(2);
  });

  it("(P38 d) does not report a `when: program` cell whose precondition is NOT declared", () => {
    // The identity document declares no `program:`, so the charter cell does not exist on
    // this round — an absent declaration is not a broken resolution.
    const input = judged("review", "plan", {
      facts: { overallLink: "" },
      scene: { program: false, docType: false },
    });
    expect(detailsOf(input)).toEqual([]);
  });

  it("(P38 e) does not report `INPUT_RULINGS` — the `never` cell is not a missing input", () => {
    // The sidecar genuinely may not exist: the declaration renders the bare word `none`
    // (the assembler's job), and the judgment has no arm that would red it.
    const input = judged("fix", "wave");
    expect(detailsOf(input)).toEqual([]);
    expect(input.declarations.some((decl) => decl.line.includes("INPUT_RULINGS"))).toBe(true);
  });

  it("(P38 f) a fully supplied round stands — the judgment answers no row at all", () => {
    for (const [role, type] of ROWS) {
      expect(detailsOf(judged(role, type)), `${role}/${type}`).toEqual([]);
    }
  });

  it("(P38 g) reversal ④ — a tree review without a base artifact is refused, not silently narrowed", () => {
    // `#baseBranchOf` hands the empty string when the artifact is absent; the review of a
    // live tree against no baseline can not judge what the round changed.
    expect(detailsOf(judged("review", "branch", { facts: { baseBranch: "" } }))).toEqual([
      "dispatch-input · review · BASE_BRANCH · empty-value",
    ]);
  });

  it("(P38 p) answers a real engine-written cell from the DECLARATION — zero existence reads, every face", () => {
    const fs = new RecordingFs();
    // The wave's brief is the engine's own write, so an empty cell is answered; the scope
    // anchor beside it is the orchestrator's input and is still judged.
    const input = judged("review", "wave", {
      facts: { briefPath: "", specLink: "", overallLink: "", baseBranch: "" },
      scene: { program: false, docType: false },
      fs,
    });
    expect(detailsOf(input)).toEqual(["dispatch-input · review · BASE_BRANCH · empty-value"]);
    // Nothing was asked: the judgment never questions a file the engine guarantees.
    expect(fs.asked).toEqual([]);
  });

  it("(P38 i) a declared `slug:` with no `doc-type:` leaves `INPUT_SPEC` non-exigible", () => {
    // The identity document carries `slug:` but no `doc-type:`, so the index hands
    // `docType: null` — the shape the row reads as "not declared", not as an omission.
    const input = judged("review", "wave", {
      facts: { specLink: "" },
      scene: { program: false, docType: false },
    });
    expect(detailsOf(input)).toEqual([]);
  });

  it("(P38 j) a declared `program:` whose charter does not resolve is `target-absent`", () => {
    // The declaration is the identity document's `program:` literal; the value is the
    // resolved link. Reading the resolved value alone would flatten this into "absent".
    expect(detailsOf(judged("review", "wave", { facts: { overallLink: "" } }))).toEqual([
      "dispatch-input · review · INPUT_OVERALL · target-absent",
    ]);
  });

  it("(P38 k) a declared `doc-type:` whose spec link is null is `empty-value`", () => {
    // The identity arm exists (the shape is declared), so the cell is required — and the
    // engine supplied nothing: an omission, never a broken link.
    expect(detailsOf(judged("review", "wave", { facts: { specLink: "" } }))).toEqual([
      "dispatch-input · review · INPUT_SPEC · empty-value",
    ]);
  });

  it("(P38 l) the two row-selector slots stay the assembler's precondition, not a third reason", () => {
    // Emptied, the row can not even be selected: the assembler throws its own message
    // before the judgment exists. This is why the reason set stays closed at two words.
    const template = new TemplateAssembler();
    expect(() => template.layoutOf({ ROLE: "", TARGET_TYPE: "wave" })).toThrow(
      "template work-mode not declared",
    );
    expect(() => template.layoutOf({ ROLE: "review", TARGET_TYPE: "" })).toThrow(
      "template review type not declared",
    );
  });

  it("(P38 m) the input row outranks the artifact row — both violated, the input line is first", () => {
    const invalid: ArtifactSnapshot = {
      kind: "read",
      reviewsPath: REVIEWS,
      read: { ...ABSENT, kind: "invalid", path: REVIEWS, reason: "unreadable" },
    };
    const rows = PreFlightRows.judge(
      judged("review", "branch", { facts: { planPath: "" }, artifact: invalid }),
    );
    // The judgment's fixed station order is the priority: `dispatch-input` precedes
    // `artifact`, so the seam's first row (the verdict's `message`) is the input line.
    expect(rows.map((row) => row.station)).toEqual(["dispatch-input", "artifact"]);
    expect(rows[0]?.detail).toBe("dispatch-input · review · INPUT_PLAN · empty-value");
    expect(rows[1]?.detail).toContain("rulings sidecar");
  });
});

// ---------------------------------------------------------------------------
// (P38 h) the declaration sweep — every emptyable exigible cell, one at a time
// ---------------------------------------------------------------------------

/** The recipe type: which SCENE FACT (and, for the wave unit, which identity cell) is
 *  emptied to leave exactly that token without a value. */
interface Recipe {
  readonly facts?: Partial<DispatchSceneFacts>;
  readonly identity?: Partial<DispatchIdentity>;
  readonly artifact?: ArtifactSnapshot;
}

const EMPTY_RECIPES: Readonly<Record<string, Recipe>> = {
  WAVE: { identity: { tasks: "" } },
  INPUT_PLAN: { facts: { planPath: "", docPath: "" } },
  INPUT_SPEC: { facts: { specLink: "", docPath: "" } },
  INPUT_OVERALL: { facts: { overallLink: "", docPath: "" } },
  BASE_BRANCH: { facts: { baseBranch: "" } },
  INPUT_REVIEWS: { artifact: { kind: "read", reviewsPath: null, read: ABSENT } },
};

/** The two row-selector slots — emptied, the assembler throws before the judgment. */
const ROW_SELECTORS: readonly string[] = ["ROLE", "TARGET_TYPE"];

/** The cells the ENGINE computes for every round — no round can leave one empty, so they
 *  are outside the empty-value domain by structure, not by omission. */
const ENGINE_COMPUTED: readonly string[] = [
  "OUTPUT_REPORT",
  "OUTPUT_EVIDENCE",
  "OUTPUT_HANDOFF",
  "WORKSPACE_DIR",
  "WORKSPACE_ID",
];

/** One row's declarations as the assembler selects them (the two row selectors only —
 *  `layoutOf` selects, it resolves nothing). */
const layoutOf = (role: WorkMode, type: TargetType): readonly ContextLine[] =>
  new TemplateAssembler().layoutOf({ ROLE: role, TARGET_TYPE: type });

/** The token a declared line carries (undefined for the value-less lines). */
const tokenOf = (decl: ContextLine): string | undefined => TemplateAssembler.slotOf(decl.line);

/** The DECLARATION-ANSWERED cells — every token some row declares `written: "engine"`.
 *  The engine writes those files itself, so the declaration is the whole answer on both
 *  legs and an empty value never earns a word (P40 T5 retired the preview-only half of
 *  this rule: the gate now runs before the engine writes, so the rule is unconditional).
 *  Read off the declarations, never listed: a renamed cell would otherwise leave a stale
 *  exemption behind. */
const DECLARATION_ANSWERED: ReadonlySet<string> = (() => {
  const answered = new Set<string>();
  for (const [role, type] of ROWS) {
    for (const decl of layoutOf(role, type)) {
      const token = tokenOf(decl);
      if (token !== undefined && decl.written === "engine") answered.add(token);
    }
  }
  return answered;
})();

/** Whether one arm is exigible for a type under the given declarations. */
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

/** Every slot some row's layout carries. */
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
    for (const tokens of [
      exigibleTokens(role, type, { program: true, identity: true }),
      exigibleTokens(role, type, { program: false, identity: false }),
    ]) {
      for (const token of tokens) required.add(token);
    }
  }
  return required;
})();

/** The cells no row requires under either declaration set — computed, never listed. */
const NEVER_CELLS: ReadonlySet<string> = new Set(
  [...CARRIED].filter((token) => !REQUIRED_CELLS.has(token)),
);

describe("the dispatch-input row over a real layout — the declaration sweep", () => {
  it("(P38 h) names every exigible cell that can be emptied, one cell per arm", () => {
    // The sweep's domain is the DECLARATION itself: every slot a row's layout carries must
    // be a row selector, an engine-computed cell, a `never` cell or a recipe.
    for (const [role, type] of ROWS) {
      for (const decl of layoutOf(role, type)) {
        const token = tokenOf(decl);
        if (token === undefined) continue;
        const known =
          ROW_SELECTORS.includes(token) ||
          ENGINE_COMPUTED.includes(token) ||
          NEVER_CELLS.has(token) ||
          DECLARATION_ANSWERED.has(token) ||
          token in EMPTY_RECIPES;
        expect(known, `${role}/${type} carries an unclassified cell ${token}`).toBe(true);
      }
    }
    // And every recipe is live: a recipe no row requires is a stale arm, and a recipe
    // beside a declaration-answered cell names a refusal the judgment can never print.
    for (const token of Object.keys(EMPTY_RECIPES)) {
      expect(REQUIRED_CELLS.has(token), `recipe ${token} is required by no row`).toBe(true);
      expect(
        DECLARATION_ANSWERED.has(token),
        `recipe ${token} is a declaration-answered cell — the judgment never refuses it`,
      ).toBe(false);
    }
    // The declaration-answered class is live the other way round: every cell on it is a
    // slot some row carries, and none of them may sit in the emptyable set.
    for (const token of DECLARATION_ANSWERED) {
      expect(CARRIED.has(token), `a declaration writes ${token}, which no row carries`).toBe(true);
    }

    for (const [role, type] of ROWS) {
      for (const token of exigibleTokens(role, type, { program: true, identity: true })) {
        if (ROW_SELECTORS.includes(token) || ENGINE_COMPUTED.includes(token)) continue;
        if (DECLARATION_ANSWERED.has(token)) continue;
        const recipe = EMPTY_RECIPES[token];
        if (recipe === undefined) continue;
        const details = detailsOf(judged(role, type, recipe));
        expect(details.join("; "), `${role}/${type}/${token} was not reported`).toContain(
          `${role} · ${token} · `,
        );
      }
    }
  });

  it("(P38 h2) the engine-computed exemption is live and no recipe can empty it", () => {
    // A hand list is only honest while every token on it is still carried by a row and
    // still unemptyable: a renamed or retired cell left sitting here is a hole in the
    // sweep, and a cell that BECOMES emptyable is an input cell (the only way in is a
    // recipe, so a recipe beside an exemption is exactly the demotion this pin refuses).
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
// (P38 o) the reason set's ONE declaration
// ---------------------------------------------------------------------------

describe("the closed reason set", () => {
  it("(P38 o) keeps the two words declared in the declaration module alone", () => {
    const declarations = stripComments(
      readFileSync(fileURLToPath(new URL("../context-declarations.ts", import.meta.url)), "utf8"),
    );
    // The declared union IS the set: a third word would have to be declared here first.
    expect(declarations).toContain('export type ExigibleReason = "target-absent" | "empty-value";');
    expect(declarations).not.toContain("missing-line");
    expect(declarations).not.toContain("undeclared-cell");
  });
});
