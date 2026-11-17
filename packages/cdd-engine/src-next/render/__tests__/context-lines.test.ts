// packages/cdd-engine/src-next/render/__tests__/context-lines.test.ts
// P38 T1 — the round-context declarations (design spec §1.1 · §1.3 · §1.4 · §4.2).
//
// Two faces under test, and they must stay two: the CONSTRUCTION-time criteria
// (a dead cell · a shell naming a cell its layout never carries · an unregistered
// slot · a registered round-context token no row carries) and the RENDER-time truth
// table (a value renders; an absent `drop` cell disappears whole; an absent `none`
// cell renders the bare literal `none`). The rendering layer has three states, never
// a fourth: exigibility is judged upstream by the dispatch-input gate, so the
// "empty but required" branch is not representable here.
//
// The `never` form is a legal declaration, not a missing one: `{ types: [] }` names
// no type at all, and the two cells that carry it (the fix rows' `INPUT_RULINGS` and
// docs-fix's `WAVE`) are exactly the cells that can truly be absent.

import { describe, expect, it } from "vitest";
import type { TemplateValues } from "../templates.ts";
import {
  type ContextLine,
  type ModePromptRow,
  TEMPLATE_PROMPT,
  TemplateAssembler,
  type TemplatePrompt,
} from "../templates.ts";

/** The six target types — the review rows' key domain. */
const TARGET_TYPES: readonly string[] = [
  "wave",
  "branch",
  "phase-spec",
  "overall",
  "plan",
  "single-spec",
];

/** One row under test, with the ROLE / TARGET_TYPE pair that selects it. */
interface RowCase {
  readonly label: string;
  readonly row: ModePromptRow;
  readonly role: string;
  readonly type: string;
}

/** Every row the assembler can render — the three work rows plus the six review rows. */
const ROW_CASES: readonly RowCase[] = [
  { label: "implement", row: TEMPLATE_PROMPT.modes.implement, role: "implement", type: "" },
  { label: "fix", row: TEMPLATE_PROMPT.modes.fix, role: "fix", type: "wave" },
  {
    label: "docs-fix",
    row: TEMPLATE_PROMPT.modes["docs-fix"],
    role: "docs-fix",
    type: "plan",
  },
  ...TARGET_TYPES.map((type) => ({
    label: `review/${type}`,
    row: TEMPLATE_PROMPT.reviews[type as keyof typeof TEMPLATE_PROMPT.reviews],
    role: "review",
    type,
  })),
];

/** A complete value frame for one row — every declared token carries a placeholder,
 *  so a probe can empty exactly the cell it studies (the gate refuses a missing
 *  token, never an empty one). */
const frameOf = (role: string, type: string): TemplateValues => {
  const values: Record<string, string> = {};
  for (const token of TEMPLATE_PROMPT.tokens) values[token.name] = `<${token.name}>`;
  return { ...values, ROLE: role, TARGET_TYPE: type };
};

/** The rendered `## Round context` zone of a full prompt — the section the
 *  declarations own (the shell mentions the heading in prose, so the LAST
 *  occurrence is the section itself). */
const roundContextOf = (out: string): readonly string[] =>
  out.slice(out.lastIndexOf("## Round context")).split("\n");

/** The row-selection discriminants — emptying one of these is not a rendering state:
 *  the gate refuses an unknown ROLE / TARGET_TYPE (or a missing one) before a single
 *  line is resolved. Their `drop` face is therefore never exercised. */
const SELECTION_SLOTS = new Set<string>(["ROLE", "TARGET_TYPE"]);

/** The `{{TOKEN}}` slot of a declared line, or undefined for a slot-less line. */
const slotOf = (decl: ContextLine): string | undefined =>
  /\{\{([A-Z0-9_]+)\}\}/.exec(decl.line)?.[1];

/** A mutable row — the layout as a push-able array, so a case can add one cell. */
interface MutableRow extends Omit<ModePromptRow, "roundContext"> {
  roundContext: ContextLine[];
}

/** A mutable copy of the declared contract — one row per key, its layout cloned, so a
 *  case can mutate one declaration without leaking into the module's own data. */
interface ContractDraft {
  readonly modes: Record<string, MutableRow>;
  readonly reviews: Record<string, MutableRow>;
  readonly tokens: { name: string; zone: string }[];
}

const cloneRow = (row: ModePromptRow): MutableRow => ({
  ...row,
  roundContext: [...row.roundContext],
});

const draftOf = (): ContractDraft => ({
  modes: Object.fromEntries(
    Object.entries(TEMPLATE_PROMPT.modes).map(([key, row]) => [key, cloneRow(row)]),
  ),
  reviews: Object.fromEntries(
    Object.entries(TEMPLATE_PROMPT.reviews).map(([key, row]) => [key, cloneRow(row)]),
  ),
  tokens: TEMPLATE_PROMPT.tokens.map((token) => ({ name: token.name, zone: token.zone })),
});

/** The mutated draft as the injected contract. */
const contractOf = (draft: ContractDraft): TemplatePrompt =>
  ({ ...TEMPLATE_PROMPT, ...draft }) as unknown as TemplatePrompt;

describe("TemplateAssembler — the construction-time declaration criteria (§1.1 · §1.3)", () => {
  it("(a) refuses a dead cell — a type the row never serves, named with the token and the type", () => {
    const draft = draftOf();
    draft.modes.fix.roundContext.push({
      line: "- `INPUT_PLAN`: {{INPUT_PLAN}}",
      path: true,
      absent: "drop",
      requiredOn: [{ types: ["overall"] }],
    });
    const contract = contractOf(draft);
    // `overall` is a document face: the fix row renders `docs-fix` there, so a `fix`
    // declaration naming it describes a state this row is never asked about.
    expect(() => new TemplateAssembler(contract)).toThrow(/INPUT_PLAN/);
    expect(() => new TemplateAssembler(contract)).toThrow(/overall/);
  });

  it("(b) refuses a shell that names a cell its own layout no longer carries", () => {
    const draft = draftOf();
    draft.reviews["phase-spec"].roundContext = draft.reviews["phase-spec"].roundContext.filter(
      (decl) => !decl.line.includes("INPUT_SPEC"),
    ); // the review shell still names `INPUT_SPEC` — a claimed-but-not-carried cell
    expect(() => new TemplateAssembler(contractOf(draft))).toThrow(/INPUT_SPEC/);
  });

  it("(c) refuses a layout slot that no round-context token registers", () => {
    const draft = draftOf();
    draft.modes.implement.roundContext.push({
      line: "- `BOGUS_CELL`: {{BOGUS_CELL}}",
      absent: "drop",
      requiredOn: [{ types: "always" }],
    });
    expect(() => new TemplateAssembler(contractOf(draft))).toThrow(/BOGUS_CELL/);
  });

  it("(d) refuses a registered round-context token that no row layout carries", () => {
    const draft = draftOf();
    draft.tokens.push({ name: "INPUT_BOGUS", zone: "round-context" });
    // the inverse direction of (c): the token is registered, but nothing carries it.
    // Written as its own arm so neither direction can pass as the other's negation.
    expect(() => new TemplateAssembler(contractOf(draft))).toThrow(/INPUT_BOGUS/);
  });

  it("(e) accepts the `never` form — one arm whose type set is empty names no type at all", () => {
    const rulings = TEMPLATE_PROMPT.modes.fix.roundContext.find((decl) =>
      decl.line.includes("INPUT_RULINGS"),
    );
    const wave = TEMPLATE_PROMPT.modes["docs-fix"].roundContext.find((decl) =>
      decl.line.includes("`WAVE`"),
    );
    expect(rulings?.requiredOn).toEqual([{ types: [] }]);
    expect(wave?.requiredOn).toEqual([{ types: [] }]);
    expect(() => new TemplateAssembler()).not.toThrow();
  });

  it("(f) accepts the registered contract — every row is declaratively self-consistent", () => {
    expect(() => new TemplateAssembler(TEMPLATE_PROMPT)).not.toThrow();
    for (const rowCase of ROW_CASES) {
      expect(() =>
        new TemplateAssembler().layoutOf(frameOf(rowCase.role, rowCase.type)),
      ).not.toThrow();
    }
  });
});

describe("TemplateAssembler — the rendering truth table (§1.1 · §2.3)", () => {
  it('renders the bare literal `none` for an absent `absent: "none"` cell, on both fix rows', () => {
    const assembler = new TemplateAssembler();
    const fix = assembler.render({ ...frameOf("fix", "wave"), INPUT_RULINGS: "" });
    expect(fix).toContain("- `INPUT_RULINGS`: none");
    expect(fix.match(/^- `INPUT_RULINGS`: .*$/gm)).toHaveLength(1);
    const docsFix = assembler.render({ ...frameOf("docs-fix", "plan"), INPUT_RULINGS: "" });
    expect(docsFix).toContain("- `INPUT_RULINGS`: none");
  });

  it("drops an absent `drop` cell whole — and only that line", () => {
    const assembler = new TemplateAssembler();
    for (const rowCase of ROW_CASES) {
      for (const decl of rowCase.row.roundContext) {
        const slot = slotOf(decl);
        if (slot === undefined || decl.absent !== "drop" || SELECTION_SLOTS.has(slot)) continue;
        const frame = frameOf(rowCase.role, rowCase.type);
        const baseline = roundContextOf(assembler.render(frame));
        const dropped = roundContextOf(assembler.render({ ...frame, [slot]: "" }));
        const rendered = decl.line.replace(`{{${slot}}}`, frame[slot]);
        const expected = baseline.filter((line) => line !== rendered);
        expect(dropped, `${rowCase.label}/${slot}`).toEqual(expected);
      }
    }
  });

  it("carries no `INPUT_SPEC` line at all on the overall face (the cell does not exist there)", () => {
    const out = new TemplateAssembler().render({
      ...frameOf("review", "overall"),
      INPUT_SPEC: "",
    });
    expect(out).not.toContain("- `INPUT_SPEC`:");
    // ... while the same face does carry the charter it judges
    expect(out).toContain("- `INPUT_OVERALL`: <INPUT_OVERALL>");
  });
});

describe("TemplateAssembler — the declaration table's own shape (§1.4)", () => {
  /** Every declared cell across every row — the table's cell set. */
  const CELLS: readonly { readonly row: string; readonly decl: ContextLine }[] = ROW_CASES.flatMap(
    (rowCase) =>
      rowCase.row.roundContext
        .filter((decl) => slotOf(decl) !== undefined)
        .map((decl) => ({ row: rowCase.label, decl })),
  );

  it("names six read paths with `path: true` — declared, never inferred from the prefix", () => {
    const paths = new Set(
      CELLS.filter((cell) => cell.decl.path === true).map((cell) => slotOf(cell.decl)),
    );
    expect([...paths].sort()).toEqual([
      "INPUT_OVERALL",
      "INPUT_PLAN",
      "INPUT_REVIEWS",
      "INPUT_RULINGS",
      "INPUT_SPEC",
      "INPUT_WAVE_BRIEF",
    ]);
    // the branch name and the provenance words are not paths
    for (const notPath of ["BASE_BRANCH", "ROLE", "TARGET_TYPE", "WAVE", "WORKSPACE_DIR"]) {
      expect(paths.has(notPath), notPath).toBe(false);
    }
  });

  it("keeps `INPUT_RULINGS` the only `none` cell and `INPUT_WAVE_BRIEF` the only preview", () => {
    const noneCells = new Set(
      CELLS.filter((cell) => cell.decl.absent === "none").map((cell) => slotOf(cell.decl)),
    );
    expect([...noneCells]).toEqual(["INPUT_RULINGS"]);
    const previews = new Set(
      CELLS.filter((cell) => cell.decl.preview === "satisfied").map((cell) => slotOf(cell.decl)),
    );
    expect([...previews]).toEqual(["INPUT_WAVE_BRIEF"]);
  });

  it("hangs the `never` form on `INPUT_RULINGS` (both fix rows) and docs-fix's `WAVE` — nowhere else", () => {
    const neverCells = CELLS.filter(
      (cell) =>
        cell.decl.requiredOn.length === 1 &&
        cell.decl.requiredOn[0].types !== "always" &&
        cell.decl.requiredOn[0].types.length === 0,
    ).map((cell) => `${cell.row}:${slotOf(cell.decl)}`);
    // one token line, not one row: `INPUT_RULINGS` rides both fix rows, `WAVE` only
    // the docs-fix row (the review `WAVE` cell is narrowed to `[wave]`, not `never`)
    expect([...new Set(neverCells)].sort()).toEqual([
      "docs-fix:INPUT_RULINGS",
      "docs-fix:WAVE",
      "fix:INPUT_RULINGS",
    ]);
  });
});
