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
import { FIX_READBACK_SUFFIX } from "../../session/next.ts";
import { Capsule } from "../capsule.ts";
import { cli } from "../cli.ts";
import { Words } from "../words.ts";

/** The next-text of a capsule emit (the second line, the station prefix stripped). */
function literalOf(route: Route, target?: RouteTarget): string {
  const lines = new Capsule(new Words()).emit("APPROVED", "0", "/h.json", route, target);
  return lines[1]!.slice("next: ".length);
}

/** The parseable argv of a literal — the fix readback suffix is prompt prose, never
 *  argv (the parse gate strips the declared suffix before feeding). */
function argvOf(literal: string): string[] {
  return literal
    .replace(new RegExp(`\\s*\\(${FIX_READBACK_SUFFIX.slice(1, -1)}\\)$`), "")
    .split(/\s+/);
}

/** The frame-fact targets of the four types (the dispatch frame's own identity). */
const wave = { type: "wave", id: "1,2", plan: "docs/kairos/plans/p3.md" } as const;
const spec = { type: "spec", id: "docs/kairos/specs/p3-design.md" } as const;
const planT = { type: "plan", id: "docs/kairos/plans/p3.md" } as const;
const branch = { type: "branch", id: "aaaaaaa..bbbbbbb" } as const;
const base = "a".repeat(40);
const head = "b".repeat(40);

/** One verb × type row of the coverage table — the route + the frame facts + the
 *  runtime-required flags of the type (the flags the CLI run would demand: the
 *  declared required keys + the type's scene rules — wave demands --plan, spec/plan
 *  their doc flags, branch the range/--findings face). */
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
    route: { kind: "review", base },
    target: wave,
    required: ["--type", "--tasks", "--plan"],
  },
  {
    label: "review spec",
    route: { kind: "review", base },
    target: spec,
    required: ["--type", "--spec"],
  },
  {
    label: "review plan",
    route: { kind: "review", base },
    target: planT,
    required: ["--type", "--plan"],
  },
  {
    // find #8 (P4.1 T7): the branch re-review literal carries the FULL range — the
    // fix-with-blockers route composes base + head from the fix carrier's commits (the
    // re-review's span = the fix's delta); the runtime missing-refs gate refuses a
    // --base-only literal, so `--head` is a required flag of the branch review face.
    label: "review branch",
    route: { kind: "review", base, head },
    target: branch,
    required: ["--type", "--base", "--head"],
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
    // ⑦ — the branch fix derives the range from the source review handoff, never a
    // re-declared base/head on the CLI: `--findings` is the face's runtime-required flag.
    label: "fix branch",
    route: { kind: "fix", findings: "br1-review-1.json" },
    target: branch,
    required: ["--type", "--findings"],
  },
];

describe("P4.1 T7 (find #7) — the next literal's required-flag coverage (parse green ⇒ the type's required flags fully covered)", () => {
  it("review→wave renders `--plan {path}` — the find #7 regression (the missing --plan previously parsed green yet refused the dispatch at runtime)", () => {
    const literal = literalOf({ kind: "review", base }, wave);
    expect(literal).toBe("review --type wave --tasks 1,2 --plan docs/kairos/plans/p3.md");
    expect(() => cli().parse(argvOf(literal))).not.toThrow();
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
      expect(() => cli().parse(argvOf(literal))).not.toThrow();
      // … and the type's required flags are all present in the same arg domain (find #7)
      for (const flag of row.required) {
        expect(literal, `${row.label} must carry ${flag}`).toContain(flag);
      }
    }
  });
});
