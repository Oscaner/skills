// scripts/__tests__/monitor-dispatch.test.ts
// The dispatch monitor's fixtures — the ONLY home of them. Every prompt here is SYNTHETIC,
// hand-written to the real shape: no fragment of a real session enters this tree, because a
// session file is a whole conversation (assistant turns and tool results included) and this
// repository is public.
//
// The arms, in the order the monitor judges them:
//   · one healthy prompt per band family, reading `OK`;
//   · four pathological prompts, one per rule — no user record (①), a blank body (②), the
//     round-context heading left as a prose mention (③), and a comparable cell disagreeing
//     with the ledger (④);
//   · four "legitimate absence" prompts that must read `OK` — a `docs-fix` round without
//     `WAVE`, a review without `OUTPUT_EVIDENCE`, and the two fix faces whose `INPUT_RULINGS`
//     reads the literal `none`. A roster of cell names copied by hand has failed on exactly
//     the `INPUT_RULINGS` row before, which is why these are arms and not prose;
//   · the `docs-fix` fold: `ROLE: docs-fix` against a recorded `op: "fix"` — plus the red arm
//     that a literal comparison would go red on, since most rounds of this phase have it;
//   · the two `when` arms: a `fix` round carrying no `INPUT_OVERALL` reads `OK` (that cell's
//     only arm is a frame precondition), while a `phase-spec` `docs-fix` round carrying no
//     `INPUT_SPEC` reads `MISSING` (its plain arm still bites — this is not a blanket
//     exemption);
//   · `INPUT_REVIEWS` compared only against the review record on the same line and cycle, and
//     reading `not-applicable` when the ledger holds none;
//   · one older-band prompt reading `not-applicable` — the scope's own red arm.
//
// The ledger is a synthetic document too: the real one lives under `.kairos/` and is ignored
// by git, so it cannot be committed, and rule ④'s whole object is "the prompt disagrees with
// the ledger of its round".
//
// Zero module-level bare functions — every helper is a `const` arrow.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DispatchMonitor,
  type DispatchReading,
  LedgerFacts,
  SessionLog,
} from "../monitor-dispatch.ts";

/** The repository basis the path cells resolve on — a fixture tree, never this repo's docs. */
const ROOT = mkdtempSync(path.join(tmpdir(), "cdd-monitor-"));

/** The three documents the fixtures' path cells name. */
const PLAN = "docs/kairos/plans/demo.md";
const SPEC = "docs/kairos/specs/demo-design.md";
const OVERALL = "docs/kairos/overalls/demo-overall.md";

beforeAll(() => {
  for (const rel of [PLAN, SPEC, OVERALL]) {
    const absolute = path.join(ROOT, rel);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, "# fixture\n", "utf8");
  }
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

/** The workspace identity every fixture declares. */
const WORKSPACE_DIR = ".kairos/cdd/demo";
const WORKSPACE_ID = "demo";

/** One fixture prompt's cells — written out, never derived from the band's table, so a cell
 *  can be omitted on purpose. */
type Cells = readonly (readonly [string, string])[];

/** The fixed prose every band carries above the round context. The backticked mention of the
 *  heading is deliberate: rule ③ must not mistake it for the line. */
const INSTRUCTIONS = [
  "## Instructions",
  "",
  "**Fixed contract:** everything above `## Round context` is this mode's fixed text.",
];

/** One synthetic prompt, rendered to the shape a dispatch produces. */
interface Fixture {
  readonly heading: string;
  readonly cells: Cells;
  /** Omit the round-context HEADING line, keeping its prose mention (rule ③'s arm). */
  readonly dropContextHeading?: boolean;
  readonly version?: number;
  /** Replace the whole prompt — the blank-body arm. */
  readonly body?: string;
}

/** One fixture's bytes. */
const promptOf = (fixture: Fixture): string => {
  if (fixture.body !== undefined) return fixture.body;
  const lines = [`$version ${fixture.version ?? 27}`, fixture.heading, "", ...INSTRUCTIONS, ""];
  if (fixture.dropContextHeading !== true) lines.push("## Round context", "");
  for (const [token, value] of fixture.cells) lines.push(`- \`${token}\`: ${value}`);
  lines.push("", "## Handoff schema", "", "{…}");
  return lines.join("\n");
};

/** One message record, in the harness's own jsonl shape. */
const recordOf = (role: "user" | "assistant", text: string): string =>
  JSON.stringify({
    type: "message",
    id: `m-${role}-${text.length}`,
    parentId: null,
    timestamp: "2026-01-01T00:00:00.000Z",
    message: { role, content: [{ type: "text", text }] },
  });

/** One session log holding the given records. */
const logOf = (records: readonly string[]): SessionLog =>
  SessionLog.of(
    [JSON.stringify({ type: "session", version: 1, cwd: ROOT }), ...records].join("\n"),
  );

/** One prompt as the log of a session whose only user turn is that dispatch. */
const logOfPrompt = (fixture: Fixture): SessionLog => logOf([recordOf("user", promptOf(fixture))]);

/** The synthetic ledger — the rounds these fixtures claim, in the workspace file's shape. */
const LEDGER = LedgerFacts.of(
  {
    timeoutCount: 0,
    engineSelfWrittenCount: 0,
    engineRecoveryCount: 0,
    harnessAbortCount: 0,
    waves: [
      { wave: "19", rounds: [{ op: "implement", cycle: 1, attempt: 1 }] },
      {
        wave: "plan",
        rounds: [
          { op: "review", cycle: 57, attempt: 1 },
          { op: "fix", cycle: 57, attempt: 1 },
          { op: "implement", cycle: 1, attempt: 1 },
        ],
      },
      {
        wave: "branch",
        rounds: [
          { op: "review", cycle: 2, attempt: 1 },
          { op: "fix", cycle: 2, attempt: 1 },
        ],
      },
      { wave: "phase-spec", rounds: [{ op: "fix", cycle: 1, attempt: 1 }] },
    ],
  },
  "synthetic ledger",
);

/** The monitor every arm reads through: the synthetic ledger over the fixture tree. */
const MONITOR = new DispatchMonitor({ ledger: LEDGER, repoRoot: ROOT });

/** Read one fixture. */
const read = (fixture: Fixture): DispatchReading => MONITOR.judge(logOfPrompt(fixture));

/** The healthy implement prompt of wave 19. */
const IMPLEMENT: Fixture = {
  heading: "# CDD dispatch — implement round",
  cells: [
    ["ROLE", "implement"],
    ["WAVE", "19"],
    ["INPUT_WAVE_BRIEF", `${WORKSPACE_DIR}/tasks-19-brief.md`],
    ["OUTPUT_REPORT", "tasks-19-implement-1-report.md"],
    ["OUTPUT_EVIDENCE", `${WORKSPACE_DIR}/tasks-19-implement-1-test-evidence.json`],
    ["OUTPUT_HANDOFF", "tasks-19-implement-1.c1.json"],
    ["WORKSPACE_DIR", WORKSPACE_DIR],
    ["WORKSPACE_ID", WORKSPACE_ID],
  ],
};

/** The healthy `docs-fix` prompt of the plan line — no `WAVE` cell, the literal `none` ruling. */
const DOCS_FIX_PLAN: Fixture = {
  heading: "# CDD dispatch — docs-fix round",
  cells: [
    ["ROLE", "docs-fix"],
    ["TARGET_TYPE", "plan"],
    ["INPUT_PLAN", PLAN],
    ["INPUT_SPEC", SPEC],
    ["INPUT_REVIEWS", `${WORKSPACE_DIR}/plan-review-57.c57.json`],
    ["INPUT_RULINGS", "none"],
    ["OUTPUT_REPORT", "plan-fix-57-report.md"],
    ["OUTPUT_HANDOFF", "plan-fix-57.c57.json"],
    ["WORKSPACE_DIR", WORKSPACE_DIR],
    ["WORKSPACE_ID", WORKSPACE_ID],
  ],
};

describe("the monitor reads a healthy dispatch as OK", () => {
  it("accepts the implement band, including the scenario cells it cannot compare", () => {
    const reading = read(IMPLEMENT);
    expect(reading.verdict).toBe("OK");
    expect(reading.rule).toBeNull();
    // The scenario cells are printed as not-applicable, never folded into the green.
    const holes = reading.cells
      .filter((cell) => cell.state === "not-applicable")
      .map((cell) => cell.token);
    expect(holes.sort()).toEqual(["INPUT_WAVE_BRIEF", "WAVE"]);
  });

  it("accepts a `docs-fix` round without `WAVE`, its rulings line reading `none`", () => {
    const reading = read(DOCS_FIX_PLAN);
    expect(reading.verdict).toBe("OK");
    // The ruling sidecar is PRESENT and not owed: the declared `none` form, not a green cell
    // and not a red one.
    const rulings = reading.cells.find((cell) => cell.token === "INPUT_RULINGS");
    expect(rulings?.state).toBe("not-applicable");
  });

  it("accepts a review round that carries no evidence cell at all", () => {
    const review: Fixture = {
      heading: "# CDD dispatch — review round",
      cells: [
        ["ROLE", "review"],
        ["TARGET_TYPE", "plan"],
        ["INPUT_PLAN", PLAN],
        ["OUTPUT_REPORT", "plan-review-57-report.md"],
        ["OUTPUT_HANDOFF", "plan-review-57.c57.json"],
        ["WORKSPACE_DIR", WORKSPACE_DIR],
        ["WORKSPACE_ID", WORKSPACE_ID],
      ],
    };
    expect(read(review).verdict).toBe("OK");
  });

  it("accepts a `fix` round whose `INPUT_RULINGS` is `none` and which carries no `INPUT_OVERALL`", () => {
    const fix: Fixture = {
      heading: "# CDD dispatch — fix round",
      cells: [
        ["ROLE", "fix"],
        ["TARGET_TYPE", "branch"],
        ["INPUT_PLAN", PLAN],
        ["INPUT_REVIEWS", `${WORKSPACE_DIR}/branch-review-2.c2.json`],
        ["INPUT_RULINGS", "none"],
        ["OUTPUT_REPORT", "branch-fix-2-report.md"],
        ["OUTPUT_EVIDENCE", `${WORKSPACE_DIR}/branch-fix-2-test-evidence.json`],
        ["OUTPUT_HANDOFF", "branch-fix-2.c2.json"],
        ["WORKSPACE_DIR", WORKSPACE_DIR],
        ["WORKSPACE_ID", WORKSPACE_ID],
      ],
    };
    const reading = read(fix);
    expect(reading.verdict).toBe("OK");
    // `INPUT_OVERALL`'s only arm on this row is a `program` precondition, which the prompt
    // does not carry: the cell reads not-applicable rather than owed.
    const overall = reading.cells.find((cell) => cell.token === "INPUT_OVERALL");
    expect(overall?.state).toBe("not-applicable");
  });
});

describe("each of the four rules is independently red", () => {
  it("① finds no user record when the prompt never arrived", () => {
    const reading = MONITOR.judge(logOf([recordOf("assistant", "hello")]));
    expect(reading.verdict).toBe("MISSING");
    expect(reading.rule).toBe("record");
  });

  it("② refuses a blank body", () => {
    const reading = read({ ...IMPLEMENT, body: "   \n\n" });
    expect(reading.verdict).toBe("MISSING");
    expect(reading.rule).toBe("body");
  });

  it("③ refuses a heading left as a prose mention instead of a line", () => {
    const reading = read({ ...IMPLEMENT, dropContextHeading: true });
    expect(reading.verdict).toBe("MISSING");
    expect(reading.rule).toBe("structure");
    expect(reading.detail).toContain("## Round context");
  });

  it("④ refuses a comparable cell whose value disagrees with the ledger", () => {
    const cells: Cells = IMPLEMENT.cells.map(([token, value]) =>
      token === "OUTPUT_REPORT" ? [token, "tasks-19-implement-2-report.md"] : [token, value],
    );
    const reading = read({ ...IMPLEMENT, cells });
    expect(reading.verdict).toBe("MISSING");
    expect(reading.rule).toBe("cells");
    expect(reading.detail).toContain("tasks-19-implement-1-report.md");
  });

  it("④ refuses a path cell whose file the workspace does not hold", () => {
    const cells: Cells = DOCS_FIX_PLAN.cells.map(([token, value]) =>
      token === "INPUT_PLAN" ? [token, "docs/kairos/plans/absent.md"] : [token, value],
    );
    const reading = read({ ...DOCS_FIX_PLAN, cells });
    expect(reading.rule).toBe("cells");
    expect(reading.detail).toContain("INPUT_PLAN names no file on disk");
  });

  it("④ refuses an owed cell the prompt does not carry", () => {
    // `INPUT_SPEC`'s plain arm covers a `phase-spec` target, so the omission is owed, not a
    // legal absence: the `when` exemption is per-cell, never per-row.
    const phaseSpec: Fixture = {
      heading: "# CDD dispatch — docs-fix round",
      cells: [
        ["ROLE", "docs-fix"],
        ["TARGET_TYPE", "phase-spec"],
        ["INPUT_REVIEWS", `${WORKSPACE_DIR}/phase-spec-review-1.c1.json`],
        ["INPUT_RULINGS", "none"],
        ["OUTPUT_REPORT", "phase-spec-fix-1-report.md"],
        ["OUTPUT_HANDOFF", "phase-spec-fix-1.c1.json"],
        ["WORKSPACE_DIR", WORKSPACE_DIR],
        ["WORKSPACE_ID", WORKSPACE_ID],
      ],
    };
    const reading = read(phaseSpec);
    expect(reading.rule).toBe("cells");
    expect(reading.detail).toContain("INPUT_SPEC");
  });
});

describe("the identity cell goes through the engine's one fold", () => {
  it('reads `ROLE: docs-fix` against a recorded `op: "fix"` as the same cell', () => {
    expect(read(DOCS_FIX_PLAN).verdict).toBe("OK");
  });

  it("goes red when the recorded op is not the folded one — a literal comparison's own arm", () => {
    // The same prompt against a ledger that recorded the round as an implement: the fold is
    // right and the record is wrong, so a literal `docs-fix === op` comparison is what this
    // arm proves is NOT the criterion.
    const ledger = LedgerFacts.of(
      { waves: [{ wave: "plan", rounds: [{ op: "implement", cycle: 57, attempt: 1 }] }] },
      "synthetic ledger",
    );
    const reading = new DispatchMonitor({ ledger, repoRoot: ROOT }).judge(
      logOfPrompt(DOCS_FIX_PLAN),
    );
    expect(reading.rule).toBe("cells");
    expect(reading.detail).toContain("docs-fix");
  });
});

describe("INPUT_REVIEWS names the requesting round, never its own", () => {
  it("reads not-applicable when the ledger holds no review on that cycle", () => {
    const ledger = LedgerFacts.of(
      { waves: [{ wave: "branch", rounds: [{ op: "fix", cycle: 2, attempt: 1 }] }] },
      "synthetic ledger",
    );
    const fix: Fixture = {
      heading: "# CDD dispatch — fix round",
      cells: [
        ["ROLE", "fix"],
        ["TARGET_TYPE", "branch"],
        ["INPUT_PLAN", PLAN],
        ["INPUT_REVIEWS", `${WORKSPACE_DIR}/branch-review-2.c2.json`],
        ["INPUT_RULINGS", "none"],
        ["OUTPUT_REPORT", "branch-fix-2-report.md"],
        ["OUTPUT_EVIDENCE", `${WORKSPACE_DIR}/branch-fix-2-test-evidence.json`],
        ["OUTPUT_HANDOFF", "branch-fix-2.c2.json"],
        ["WORKSPACE_DIR", WORKSPACE_DIR],
        ["WORKSPACE_ID", WORKSPACE_ID],
      ],
    };
    const reading = new DispatchMonitor({ ledger, repoRoot: ROOT }).judge(logOfPrompt(fix));
    expect(reading.verdict).toBe("OK");
    expect(reading.cells.find((cell) => cell.token === "INPUT_REVIEWS")?.state).toBe(
      "not-applicable",
    );
  });
});

describe("the read face is one band", () => {
  it("answers an older band's prompt not-applicable, neither OK nor MISSING", () => {
    const reading = read({ ...IMPLEMENT, version: 26 });
    expect(reading.verdict).toBe("not-applicable");
    expect(reading.rule).toBeNull();
    expect(reading.detail).toContain("26");
  });

  it("judges this band's prompt — a missing heading is MISSING, not not-applicable", () => {
    expect(read({ ...IMPLEMENT, dropContextHeading: true }).verdict).toBe("MISSING");
  });
});

describe("the monitor itself", () => {
  it("reads a session file from disk the way it reads a log", () => {
    const file = path.join(ROOT, "session.jsonl");
    writeFileSync(
      file,
      `${JSON.stringify({ type: "session", version: 1 })}\n${recordOf("user", promptOf(IMPLEMENT))}`,
      "utf8",
    );
    expect(MONITOR.judgeFile(file).verdict).toBe("OK");
  });

  it("survives a truncated tail line — the log may end mid-write", () => {
    const log = SessionLog.of(`${recordOf("user", promptOf(IMPLEMENT))}\n{"type":"mess`);
    expect(MONITOR.judge(log).verdict).toBe("OK");
  });
});
