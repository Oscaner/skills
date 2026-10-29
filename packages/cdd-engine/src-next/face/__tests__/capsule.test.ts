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

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RepoRoot } from "../../infra/root.ts";
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
 *  their doc flags, branch the workspace --plan/--reviews face). */
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
    route: { kind: "fix", reviews: "tasks-1-review-1.json" },
    target: wave,
    required: ["--type", "--tasks", "--plan", "--reviews"],
  },
  {
    label: "fix spec",
    route: { kind: "fix", reviews: "s1-review-1.json" },
    target: spec,
    required: ["--type", "--spec", "--reviews"],
  },
  {
    label: "fix plan",
    route: { kind: "fix", reviews: "p1-review-1.json" },
    target: planT,
    required: ["--type", "--plan", "--reviews"],
  },
  {
    // find #8 F1b — the branch fix carries the workspace-identity `--plan` plus the
    // source review handoff `--reviews` (the review judges the live tree — no
    // re-declared base/head on the CLI)
    label: "fix branch",
    route: { kind: "fix", reviews: "br1-review-1.json" },
    target: branch,
    required: ["--type", "--reviews", "--plan"],
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
    const literal = literalOf({ kind: "fix", reviews: "tasks-1-review-1.json" }, wave);
    expect(literal).toContain(FIX_READBACK_SUFFIX);
  });

  it("D47 — the next: literal's embedded paths render repoRoot-relative (absolute target + findings)", () => {
    // §2.13 — the ONE renderer normalizes every embedded path value to the repoRoot-
    // relative shape; an absolute target path and an absolute review path both come
    // out relative, and the repo root never appears in the literal.
    const repo = "/tmp/d47-repo";
    const capsule = new Capsule(new Words(), {}, "", new RepoRoot(repo));
    const lines = capsule.emit(
      "CHANGES_REQUESTED",
      "1",
      `${repo}/.kairos/cdd/p3/tasks-1-review-1.json`,
      { kind: "fix", reviews: `${repo}/.kairos/cdd/p3/tasks-1-review-1.json` },
      { type: "plan", id: `${repo}/docs/kairos/plans/p3.md` },
    );
    const literal = lines[1]!.slice("next: ".length);
    expect(literal).toBe(
      `fix --type plan --plan docs/kairos/plans/p3.md --reviews .kairos/cdd/p3/tasks-1-review-1.json ${FIX_READBACK_SUFFIX}`,
    );
    expect(literal).not.toContain(repo);
    // The handoff: cell is the same basis — repoRoot-relative, never absolute.
    expect(lines[0]).toContain("handoff: .kairos/cdd/p3/tasks-1-review-1.json");
    expect(lines[0]).not.toContain(repo);
  });
});

// ---------------------------------------------------------------------------
// T3 — the unified next face: the `done` route's PIPELINE_NEXT doc-class lookup
// ---------------------------------------------------------------------------

/** The hermetic declaration repo — the spec docs the doc-class discrimination reads
 *  (spec §12 · D34: the declared front-matter `doc-type:` key, never the filename). */
describe("Capsule — the `done` route's PIPELINE_NEXT doc-class lookup (D33 · the unified next face)", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "capsule-done-"));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  /** A spec doc on disk declaring its doc type (the front-matter head key). */
  const declareSpec = (name: string, docType: string | null): RouteTarget => {
    mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
    const head =
      docType === null
        ? ["---", "title: The doc", "version: v1.0", "status: Draft", "---"]
        : [
            "---",
            "title: The doc",
            "version: v1.0",
            "status: Draft",
            `doc-type: ${docType}`,
            "---",
          ];
    writeFileSync(path.join(repo, name), [...head, ""].join("\n"), "utf8");
    return { type: "spec", id: name } as const;
  };

  /** The done-text of a capsule emit for a host-injected capsule over the repo. */
  const doneOf = (target?: RouteTarget, host = ""): string => {
    const lines = new Capsule(new Words(), {}, host, new RepoRoot(repo)).emit(
      "APPROVED",
      "0",
      "/h.json",
      { kind: "done" },
      target,
    );
    return lines[1]!.slice("next: ".length);
  };

  it("PIPELINE_NEXT carries exactly the five pipeline keys", () => {
    expect(Object.keys(PIPELINE_NEXT).sort()).toEqual(
      ["branch", "overall", "phase-spec", "plan", "wave"].sort(),
    );
  });

  it("no target renders the bare terminal word (the byte-pinned fallback)", () => {
    expect(doneOf()).toBe("done");
  });

  it("a phase-spec-declared target routes the cdd-plan ref per host (claude / pi / empty)", () => {
    const phaseSpec = declareSpec("docs/kairos/specs/prog-p8-design.md", "phase-spec");
    expect(doneOf(phaseSpec, "claude")).toBe("route to /kairos:cdd-plan skill");
    expect(doneOf(phaseSpec, "pi")).toBe("route to /skill:cdd-plan skill");
    expect(doneOf(phaseSpec)).toBe("route to /kairos:cdd-plan skill");
  });

  it("the closing round's `next:` line renders the skill-ref instruction phrase byte-exactly", () => {
    // §8 — a pipeline skill-ref is an INSTRUCTION (route to a skill), never a
    // pseudo-command: the line names the per-host ref inside `route to … skill`.
    const phaseSpec = declareSpec("docs/kairos/specs/prog-p8-design.md", "phase-spec");
    const nextLine = (host: string): string =>
      new Capsule(new Words(), {}, host, new RepoRoot(repo)).emit(
        "APPROVED",
        "0",
        "/h.json",
        { kind: "done" },
        phaseSpec,
      )[1]!;
    expect(nextLine("pi")).toBe("next: route to /skill:cdd-plan skill");
    expect(nextLine("claude")).toBe("next: route to /kairos:cdd-plan skill");
  });

  it("an overall-declared target renders the bare terminal word (the pipeline terminal)", () => {
    const overall = declareSpec("docs/kairos/specs/prog-overall.md", "overall");
    expect(doneOf(overall)).toBe("done");
  });

  it("a spec target declaring no doc-type renders the BLOCKED face — zero filename-suffix fallback", () => {
    const undeclared = declareSpec("docs/kairos/specs/prog-p8-design.md", null);
    expect(doneOf(undeclared)).toBe(
      "CDD_BLOCKED: the doc declares no `doc-type:` key — add `doc-type: <overall|phase-spec|single-spec|plan>` to the doc's front-matter (spec §12 · D34) and re-run",
    );
  });

  it("a single-spec-declared target renders the bare terminal word — no pipeline seam carries it", () => {
    const single = declareSpec("docs/kairos/specs/prog-single-spec.md", "single-spec");
    expect(doneOf(single)).toBe("done");
  });

  it("a plan target routes the cdd-dev ref; a branch target the cdd-close ref", () => {
    expect(doneOf({ type: "plan", id: "docs/kairos/plans/prog-p8.md" })).toBe(
      "route to /kairos:cdd-dev skill",
    );
    expect(doneOf({ type: "branch", id: "branch", plan: "docs/kairos/plans/prog-p8.md" })).toBe(
      "route to /kairos:cdd-close skill",
    );
  });

  it("a wave target renders the wiring literal with the plan slot filled", () => {
    expect(doneOf({ type: "wave", id: "1,2", plan: "docs/kairos/plans/prog-p8.md" })).toBe(
      "review --type branch --plan docs/kairos/plans/prog-p8.md",
    );
  });
});
