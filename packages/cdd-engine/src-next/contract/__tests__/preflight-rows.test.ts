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

import { describe, expect, it } from "vitest";
import { Words } from "../../face/words.ts";
import { RepoRoot } from "../../infra/root.ts";
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

  constructor(present: readonly string[] = []) {
    this.#present = new Set(present);
  }

  exists(p: string): boolean {
    this.asked.push(p);
    return this.#present.has(p);
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
  naming: { answered: false },
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

  it("(f) takes zero existence reads — named or not, empty value or not", () => {
    const fs = new RecordingFs();
    const named = inputOf({
      values: { ROLE: "review", INPUT_WAVE_BRIEF: "" },
      declarations: [ENGINE],
      fs,
      naming: { answered: true },
    });
    expect(PreFlightRows.judge(named)).toEqual([]);
    // A non-empty value still takes no read: the engine guarantees the file.
    const filled = inputOf({
      values: { ROLE: "review", INPUT_WAVE_BRIEF: ".kairos/cdd/p/tasks-1-brief.md" },
      declarations: [ENGINE],
      fs,
    });
    expect(PreFlightRows.judge(filled)).toEqual([]);
    expect(fs.asked).toEqual([]);
  });

  it("(f') without the naming answer the empty engine-written cell is the omission it is", () => {
    const input = inputOf({
      values: { ROLE: "review", INPUT_WAVE_BRIEF: "" },
      declarations: [ENGINE],
      naming: { answered: false },
    });
    expect(detailsOf(input)).toEqual(["dispatch-input · review · INPUT_WAVE_BRIEF · empty-value"]);
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
