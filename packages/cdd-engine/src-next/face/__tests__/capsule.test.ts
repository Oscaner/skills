// packages/cdd-engine/src-next/face/__tests__/capsule.test.ts
// P4.1 T7 — find #7 closeout (design §5.6): the complete-executable next literal's
// required-flag coverage. One literal per verb × type must secondary-parse with zero
// errors (T4) AND carry every runtime-required flag of its type — the design §5.6
// "parse green ⇒ full required-flag coverage" rule. The regression the suite pins: #routeText's review→wave
// branch rendered `review --type wave --tasks <n>` WITHOUT the runtime-required
// `--plan` (the implement/next-wave and fix→wave branches both carried it — a
// composition-face inconsistency), so the literal parsed green yet BLOCKED the
// dispatch at run time (`missing required --plan <path>`), as first observed in the
// W3 task-5 review dispatch.
//
// Module-level: the literals come from the Capsule face over the ROUTE + the frame's
// own facts (type + id + plan — the RouteTarget), then re-parse through the CLI's
// own parse gate (the same channel the dispatch reads).

import { describe, expect, it } from "vitest";
import type { RouteTarget } from "../../session/faces.ts";
import type { Route } from "../../session/next.ts";
import { FIX_READBACK_SUFFIX, PIPELINE_NEXT } from "../../session/next.ts";
import { Capsule } from "../capsule.ts";
import { CommandTreeBuilder } from "../projection.ts";
import { Words } from "../words.ts";

/** The commander parse gate — the same channel the CLI dispatch reads (P3 T3: the
 *  composition root parses through the projection's program; `Cli#parse()` retired). */
const parseGate = new CommandTreeBuilder().program;

/** The next-text of a capsule emit (the second line, the station prefix stripped). */
const literalOf = (route: Route, target?: RouteTarget): string => {
  const lines = new Capsule(new Words()).emit("APPROVED", "0", "/h.json", route, target);
  return lines[1]!.slice("next: ".length);
};

/** The parseable argv of a literal — the fix readback suffix is prompt prose, never
 *  argv (the parse gate strips the declared suffix before feeding). */
const argvOf = (literal: string): string[] => {
  return literal
    .replace(new RegExp(`\\s*\\(${FIX_READBACK_SUFFIX.slice(1, -1)}\\)$`), "")
    .split(/\s+/);
};

/** The frame-fact targets of the four types (the dispatch frame's own identity). */
const wave = { type: "wave", id: "1,2", plan: "docs/kairos/plans/p3.md" } as const;
const spec = { type: "spec", id: "docs/kairos/specs/p3-design.md" } as const;
const planT = { type: "plan", id: "docs/kairos/plans/p3.md" } as const;
// find #9 — the branch target carries the workspace --plan · the id is the branch
// line's stable key `"branch"` (the range shas retired engine-wide · spec §6.6)
const branch = {
  type: "branch",
  id: "branch",
  plan: "docs/kairos/plans/p3.md",
} as const;

/** One verb × type row of the coverage table — the route + the frame facts + the
 *  runtime-required flags of the type (the flags the CLI run would demand: the
 *  declared required keys + the type's scene rules — wave demands --plan, spec/plan
 *  their doc flags, branch the workspace --plan/--findings face). */
interface CoverageRow {
  label: string;
  route: Route;
  target?: RouteTarget;
  required: readonly string[];
}

const COVERAGE: readonly CoverageRow[] = [
  {
    label: "implement",
    route: { kind: "next-wave", tasks: "1,2" },
    target: wave,
    required: ["--tasks", "--plan"],
  },
  {
    label: "review wave",
    route: { kind: "review" },
    target: wave,
    required: ["--type", "--tasks", "--plan"],
  },
  {
    label: "review spec",
    route: { kind: "review" },
    target: spec,
    required: ["--type", "--spec"],
  },
  {
    label: "review plan",
    route: { kind: "review" },
    target: planT,
    required: ["--type", "--plan"],
  },
  {
    label: "review branch",
    route: { kind: "review" },
    target: branch,
    required: ["--type", "--plan"],
  },
  {
    label: "fix wave",
    route: { kind: "fix", findings: "tasks-1-review-1.json" },
    target: wave,
    required: ["--type", "--tasks", "--plan", "--findings"],
  },
  {
    label: "fix spec",
    route: { kind: "fix", findings: "s1-review-1.json" },
    target: spec,
    required: ["--type", "--spec", "--findings"],
  },
  {
    label: "fix plan",
    route: { kind: "fix", findings: "p1-review-1.json" },
    target: planT,
    required: ["--type", "--plan", "--findings"],
  },
  {
    // find #8 F1b — the branch fix carries the workspace-identity `--plan` plus the
    // source review handoff `--findings` (the review judges the live tree — no
    // re-declared base/head on the CLI)
    label: "fix branch",
    route: { kind: "fix", findings: "br1-review-1.json" },
    target: branch,
    required: ["--type", "--findings", "--plan"],
  },
];

describe("P4.1 T7 (find #7) — the next literal's required-flag coverage (parse green ⇒ the type's required flags fully covered)", () => {
  it("review→wave renders `--plan {path}` — the find #7 regression (the missing --plan previously parsed green yet refused the dispatch at runtime)", () => {
    const literal = literalOf({ kind: "review" }, wave);
    expect(literal).toBe("review --type wave --tasks 1,2 --plan docs/kairos/plans/p3.md");
    expect(() => parseGate.parse(argvOf(literal), { from: "user" })).not.toThrow();
    // the ready-to-dispatch wave review must carry its runtime-required --plan — the
    // same argv domain as the W3 task-5 dispatch that exposed the gap
    expect(argvOf(literal)).toEqual([
      "review",
      "--type",
      "wave",
      "--tasks",
      "1,2",
      "--plan",
      "docs/kairos/plans/p3.md",
    ]);
  });

  it("coverage table — every verb × type literal parses green AND carries its type's runtime-required flags", () => {
    for (const row of COVERAGE) {
      const literal = literalOf(row.route, row.target);
      // parse green (T4) …
      expect(() => parseGate.parse(argvOf(literal), { from: "user" })).not.toThrow();
      // … and the type's required flags are all present in the same arg domain (find #7)
      for (const flag of row.required) {
        expect(literal, `${row.label} must carry ${flag}`).toContain(flag);
      }
    }
  });

  it("review four-type literals carry zero sha — the live-tree review, no commit range", () => {
    // §2.6 — every review literal is the live-tree judgment: the wave face carries
    // `--tasks` + `--plan`, the branch/spec/plan faces their single doc arg; none
    // carries a `--base`/`--head` range or a sha token.
    const waveLiteral = literalOf({ kind: "review" }, wave);
    const branchLiteral = literalOf({ kind: "review" }, branch);
    const specLiteral = literalOf({ kind: "review" }, spec);
    const planLiteral = literalOf({ kind: "review" }, planT);
    expect(waveLiteral).toBe("review --type wave --tasks 1,2 --plan docs/kairos/plans/p3.md");
    expect(branchLiteral).toBe("review --type branch --plan docs/kairos/plans/p3.md");
    expect(specLiteral).toBe("review --type spec --spec docs/kairos/specs/p3-design.md");
    expect(planLiteral).toBe("review --type plan --plan docs/kairos/plans/p3.md");
    for (const literal of [waveLiteral, branchLiteral, specLiteral, planLiteral]) {
      expect(literal).not.toContain("--base");
      expect(literal).not.toContain("--head");
      expect(literal).not.toMatch(/\b[0-9a-f]{8}\.\./);
    }
  });

  it("the fix route keeps the FIX_READBACK_SUFFIX verbatim", () => {
    const literal = literalOf({ kind: "fix", findings: "tasks-1-review-1.json" }, wave);
    expect(literal).toContain(FIX_READBACK_SUFFIX);
  });
});

// ---------------------------------------------------------------------------
// T3 — the unified next face: the `done` route's PIPELINE_NEXT doc-class lookup
// ---------------------------------------------------------------------------

/** The done-text of a capsule emit for a host-injected capsule. */
const doneOf = (target?: RouteTarget, host = ""): string => {
  const lines = new Capsule(new Words(), {}, host).emit(
    "APPROVED",
    "0",
    "/h.json",
    { kind: "done" },
    target,
  );
  return lines[1]!.slice("next: ".length);
};

describe("Capsule — the `done` route's PIPELINE_NEXT doc-class lookup (D33 · the unified next face)", () => {
  it("PIPELINE_NEXT carries exactly the five pipeline keys", () => {
    expect(Object.keys(PIPELINE_NEXT).sort()).toEqual(
      ["branch", "overall-spec", "phase-spec", "plan", "wave"].sort(),
    );
  });

  it("no target renders the bare terminal word (the byte-pinned fallback)", () => {
    expect(doneOf()).toBe("done");
  });

  it("a phase-spec target routes the cdd-plan ref per host (claude / pi / empty)", () => {
    const phaseSpec: RouteTarget = { type: "spec", id: "docs/kairos/specs/prog-p8-design.md" };
    expect(doneOf(phaseSpec, "claude")).toBe("/kairos:cdd-plan");
    expect(doneOf(phaseSpec, "pi")).toBe("/skill:cdd-plan");
    expect(doneOf(phaseSpec)).toBe("/kairos:cdd-plan");
  });

  it("an overall-spec target renders the bare terminal word (the pipeline terminal)", () => {
    const overall: RouteTarget = { type: "spec", id: "docs/kairos/specs/prog-overall.md" };
    expect(doneOf(overall)).toBe("done");
  });

  it("a plan target routes the cdd-dev ref; a branch target the cdd-close ref", () => {
    expect(doneOf({ type: "plan", id: "docs/kairos/plans/prog-p8.md" })).toBe("/kairos:cdd-dev");
    expect(doneOf({ type: "branch", id: "branch", plan: "docs/kairos/plans/prog-p8.md" })).toBe(
      "/kairos:cdd-close",
    );
  });

  it("a wave target renders the wiring literal with the plan slot filled", () => {
    expect(doneOf({ type: "wave", id: "1,2", plan: "docs/kairos/plans/prog-p8.md" })).toBe(
      "review --type branch --plan docs/kairos/plans/prog-p8.md",
    );
  });
});
