// packages/cdd-engine/src-next/face/__tests__/capsule.test.ts
// P4.1 T7 — find #7 closeout (design §5.6): the complete-executable next literal's
// required-flag coverage. One literal per verb × type must secondary-parse with zero
// errors (T4) AND carry every runtime-required flag of its type — the design §5.6
// "parse green ⇒ full required-flag coverage" rule. The regression the suite pins: the retired route-text
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
import type { DocClassVerdict, NextHop, Route } from "../../session/next.ts";
import { FIX_READBACK_SUFFIX, NextStepRouter, PIPELINE_NEXT } from "../../session/next.ts";
import { BoardView } from "../board-view.ts";
import { Capsule } from "../capsule.ts";
import { CommandTreeBuilder } from "../projection.ts";
import { Words } from "../words.ts";

/** The commander parse gate — the same channel the CLI dispatch reads (P3 T3: the
 *  composition root parses through the projection's program; `Cli#parse()` retired). */
const parseGate = new CommandTreeBuilder().program;

/** One `NextHop` from the ONE derivation — the capsule's input object, never a
 *  hand-built shape. The station discrimination is injectable per case. */
const hopOf = (
  route: Route,
  target: RouteTarget | null = null,
  docClassOf: (candidate: RouteTarget) => DocClassVerdict = () => "phase-spec",
): NextHop =>
  new NextStepRouter().nextHop({
    target,
    gate: { docDrift: false, briefDrift: false },
    route,
    verdict: target === null ? "terminal" : docClassOf(target),
  });

/** The next-text of a capsule emit (the second line, the station prefix stripped). */
const literalOf = (route: Route, target?: RouteTarget): string => {
  const lines = new Capsule(new Words()).emit("APPROVED", "/h.json", hopOf(route, target));
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
const spec = { type: "phase-spec", id: "docs/kairos/specs/p3-design.md" } as const;
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
    expect(specLiteral).toBe("review --type phase-spec --spec docs/kairos/specs/p3-design.md");
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
      `${repo}/.kairos/cdd/p3/tasks-1-review-1.json`,
      hopOf(
        { kind: "fix", reviews: `${repo}/.kairos/cdd/p3/tasks-1-review-1.json` },
        { type: "plan", id: `${repo}/docs/kairos/plans/p3.md` },
      ),
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
    return { type: "phase-spec", id: name } as const;
  };

  /** The done-text of a capsule emit for a host-injected capsule over the repo —
   *  the hop is derived with the declaration-reading discrimination, so a spec's
   *  declared `doc-type:` picks its pipeline station (the production seam). */
  const doneOf = (target?: RouteTarget, host = ""): string => {
    const root = new RepoRoot(repo);
    const lines = new Capsule(new Words(), {}, host, root).emit(
      "APPROVED",
      "/h.json",
      hopOf({ kind: "done" }, target ?? null, (candidate) => BoardView.docClassOf(root, candidate)),
    );
    return lines[1]!.slice("next: ".length);
  };

  it("PIPELINE_NEXT carries exactly one row per target type (six — the CLI's `--type` domain)", () => {
    expect(Object.keys(PIPELINE_NEXT).sort()).toEqual(
      ["branch", "overall", "phase-spec", "plan", "single-spec", "wave"].sort(),
    );
  });

  it("an overall target closes the pipeline — the terminal word", () => {
    const overall = declareSpec("docs/kairos/overalls/prog-overall.md", "overall");
    expect(doneOf(overall)).toBe("done");
  });

  it("a single-spec target hands off to cdd-plan per host — never the terminal word (P26 T3)", () => {
    const single = declareSpec("docs/kairos/specs/prog-single-spec.md", "single-spec");
    expect(doneOf(single)).toBe("route to /kairos:cdd-plan skill");
    expect(doneOf(single, "claude")).toBe("route to /kairos:cdd-plan skill");
    expect(doneOf(single, "pi")).toBe("route to /skill:cdd-plan skill");
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
    const nextLine = (host: string): string => {
      const root = new RepoRoot(repo);
      return new Capsule(new Words(), {}, host, root).emit(
        "APPROVED",
        "/h.json",
        hopOf({ kind: "done" }, phaseSpec, (candidate) => BoardView.docClassOf(root, candidate)),
      )[1]!;
    };
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

  it("a single-spec-declared target resolves the SAME row as phase-spec — the handoff, not a terminus", () => {
    const single = declareSpec("docs/kairos/specs/prog-single-spec.md", "single-spec");
    expect(PIPELINE_NEXT["single-spec"]).toEqual(PIPELINE_NEXT["phase-spec"]);
    expect(doneOf(single)).toBe("route to /kairos:cdd-plan skill");
    expect(doneOf(single)).not.toBe("done");
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

// ---------------------------------------------------------------------------
// P22 §5.2 — the six-row `next:` render freeze. The capsule renders the ONE injected
// `NextHop`; the table's rows are byte-frozen, and `hop: null` is NOT the "no next
// line" gate — only the ABSENT object is (the BLOCKED / TIMEOUT failure face).
// ---------------------------------------------------------------------------

describe("P22 §5.2 — the six-row render freeze", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "capsule-rows-"));
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  /** A spec doc on disk declaring (or omitting) its `doc-type:`. */
  const declare = (name: string, docType: string | null): RouteTarget => {
    const head =
      docType === null
        ? ["---", "title: The doc", "version: v1.0", "---"]
        : ["---", "title: The doc", "version: v1.0", `doc-type: ${docType}`, "---"];
    mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
    writeFileSync(path.join(repo, name), [...head, ""].join("\n"), "utf8");
    return { type: "phase-spec", id: name } as const;
  };

  /** The next line of a capsule over the injected hop (null = the second line). */
  const nextOf = (hop: NextHop | null): string | null => {
    const root = new RepoRoot(repo);
    const lines = new Capsule(new Words(), {}, "", root).emit("APPROVED", "/h.json", hop);
    return lines[1] ?? null;
  };

  const derived = (route: Route, target: RouteTarget | null): NextHop => {
    const root = new RepoRoot(repo);
    return hopOf(route, target, (candidate) => BoardView.docClassOf(root, candidate));
  };

  it("① a NextHop ABSENT (BLOCKED / TIMEOUT) prints no next line — the two keys stay byte-identical", () => {
    expect(new Capsule(new Words()).emit("BLOCKED", "/h.json", null)).toEqual(["status: BLOCKED"]);
    expect(nextOf(null)).toBeNull();
    // the success face's two keys are untouched by the converged render
    expect(new Capsule(new Words()).emit("APPROVED", "/h.json", null)[0]).toBe(
      "status: APPROVED · handoff: /h.json",
    );
  });

  it("② an in-line hop renders the route payload verbatim (--tasks / --reviews)", () => {
    const wave = { type: "wave", id: "1,2", plan: "docs/kairos/plans/p.md" } as const;
    expect(nextOf(derived({ kind: "next-wave", tasks: "7,9" }, wave))).toBe(
      "next: implement --plan docs/kairos/plans/p.md --tasks 7,9",
    );
    expect(nextOf(derived({ kind: "fix", reviews: "tasks-1-review-1.json" }, wave))).toBe(
      `next: fix --type wave --tasks 1,2 --plan docs/kairos/plans/p.md --reviews tasks-1-review-1.json ${FIX_READBACK_SUFFIX}`,
    );
  });

  it("③ `hop: null` + a soft-cap payload renders the declared suggestion verbatim", () => {
    const hop = derived(
      { kind: "soft-cap", message: "BLOCKED: review-cycle-cap — user adjudicates" },
      {
        type: "wave",
        id: "1",
        plan: "docs/kairos/plans/p.md",
      },
    );
    expect(hop.hop).toBeNull();
    expect(nextOf(hop)).toBe("next: BLOCKED: review-cycle-cap — user adjudicates");
  });

  it("④ `done` + a station renders `next: <to>` — overall lands on the `done` entry, phase-spec on its ref", () => {
    const overall = derived(
      { kind: "done" },
      declare("docs/kairos/specs/prog-overall.md", "overall"),
    );
    expect(overall.to).toEqual({ kind: "done" });
    expect(nextOf(overall)).toBe("next: done");

    const phaseSpec = derived(
      { kind: "done" },
      declare("docs/kairos/specs/prog-p1-design.md", "phase-spec"),
    );
    expect(phaseSpec.to).toEqual(PIPELINE_NEXT["phase-spec"]);
    expect(nextOf(phaseSpec)).toBe("next: route to /kairos:cdd-plan skill");
  });

  it("⑤ a closed single-spec hands off to cdd-plan — `reason: closed-line`, never a terminus (P26 T3)", () => {
    const hop = derived(
      { kind: "done" },
      declare("docs/kairos/specs/prog-single.md", "single-spec"),
    );
    expect([hop.hop, hop.reason]).toEqual([null, "closed-line"]);
    expect(hop.to).toEqual(PIPELINE_NEXT["single-spec"]);
    expect(hop.to).toEqual({ kind: "ref", ref: "kairos:cdd-plan" });
    // the claude spelling (this fixture's word table), and the pi spelling by hand
    expect(nextOf(hop)).toBe("next: route to /kairos:cdd-plan skill");
    const pi = new Capsule(new Words(), {}, "pi");
    expect(pi.emit("APPROVED", "/h.json", hop)[1]).toBe("next: route to /skill:cdd-plan skill");
  });

  it("⑥ a missing `doc-type:` renders the CDD_BLOCKED docType line (hop null, to null)", () => {
    const hop = derived({ kind: "done" }, declare("docs/kairos/specs/prog-p9-design.md", null));
    expect(hop.reason).toBe("doc-class-blocked");
    expect(nextOf(hop)).toBe(
      "next: CDD_BLOCKED: the doc declares no `doc-type:` key — add `doc-type: <overall|phase-spec|single-spec|plan>` to the doc's front-matter (spec §12 · D34) and re-run",
    );
  });

  it("⑦ P25 §6 — the unentered wave face's plan handoff: `next: cdd-dev` + `reason: closed-line`", () => {
    // The assembly's verdict for the fresh-plan window (rule 3): the route belongs to the
    // anchor (plan) face, so the capsule's closing pair is the handoff ref and the
    // closed-line reason — the SAME two values the board renders
    // (`board-view.test.ts` "P25 §6 — the fresh-plan window").
    const hop = derived(
      { kind: "handoff", entry: PIPELINE_NEXT.plan },
      {
        type: "plan",
        id: "docs/kairos/plans/p.md",
      },
    );
    expect(hop.hop).toBeNull();
    expect(hop.reason).toBe("closed-line");
    const lines = new Capsule(new Words(), {}, "pi", new RepoRoot(repo)).emit(
      "APPROVED",
      "/h.json",
      hop,
    );
    expect(lines[lines.length - 2]).toBe("next: route to /skill:cdd-dev skill");
    expect(lines[lines.length - 1]).toBe("reason: closed-line");
  });

  it("(j) reading `hop: null` as 'no next line' would turn rows ③/④/⑤ red — the counterexample", () => {
    // Every row below carries `hop: null` yet MUST print a line; the absent-object
    // gate is the only no-line condition (row ①).
    const rows = [
      derived({ kind: "soft-cap", message: "BLOCKED: review-cycle-cap — user adjudicates" }, null),
      derived({ kind: "done" }, declare("docs/kairos/specs/prog-overall.md", "overall")),
      derived({ kind: "done" }, declare("docs/kairos/specs/prog-single.md", "single-spec")),
    ];
    for (const hop of rows) {
      expect(hop.hop).toBeNull();
      expect(nextOf(hop)).not.toBeNull();
    }
  });
});

describe("P22 §10 — the two-key capsule and the `next:` + `reason:` close", () => {
  it("① a success round renders `status · handoff` — the blocker cell is gone", () => {
    const lines = new Capsule(new Words()).emit("APPROVED", "/h.json");
    expect(lines).toEqual(["status: APPROVED · handoff: /h.json"]);
    expect(lines[0]).not.toContain("blocker:");
  });

  it("② the fix round's summary sits between the status line and the `next:` + `reason:` close", () => {
    const lines = new Capsule(new Words()).emit(
      "APPROVED",
      "/h.json",
      hopOf({ kind: "done" }),
      false,
      "fixed 1 · rejected 0",
    );
    expect(lines).toEqual([
      "status: APPROVED · handoff: /h.json",
      "fixed 1 · rejected 0",
      "next: done",
      "reason: face-closed",
    ]);
  });

  it("③ the failure face is byte-unchanged — it never printed a blocker cell", () => {
    expect(new Capsule(new Words()).emit("BLOCKED", "/h.json")).toEqual(["status: BLOCKED"]);
    expect(new Capsule(new Words()).emit("TIMEOUT", "/h.json", null, true)).toEqual([
      "status: TIMEOUT · handoff: /h.json",
    ]);
  });

  it("④ a non-fix round carries no summary line — the plain three-line shape", () => {
    const lines = new Capsule(new Words()).emit("APPROVED", "/h.json", hopOf({ kind: "done" }));
    expect(lines).toEqual([
      "status: APPROVED · handoff: /h.json",
      "next: done",
      "reason: face-closed",
    ]);
  });
});
