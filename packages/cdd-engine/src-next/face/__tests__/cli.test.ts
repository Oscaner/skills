// packages/cdd-engine/src-next/face/__tests__/cli.test.ts
// T11 Cli + composition-root suite (design spec §3.3):
//   · the command face — the eight steady subcommand words (implement / review / fix /
//     base / schema / issue / board / init with their nested leaves) and the usage lines the
//     consumers read (T20: the base command face — `cdd base set|get` — converges
//     the command surface; T5 adds the board observability command; P20 adds the init
//     harness bootstrap);
//   · parse — the commander-native parse pipeline (the projection's program): the
//     value-domain validation (int-list tasks, enum type / source, sha base/head,
//     int round) + the unknown-flag rejection (the
//     acceptance's unknown-flag BLOCK) and the program scopes (--dry-run / --help)
//     — the parse-level assertions ride runArgv (the retired tokenizer and its
//     guard never return to the tree);
//   · the work-command E2E — implement / review / fix compose the lifecycle,
//     the capsule and the ledger in a hermetic temp repo, advance the requested phase
//     and land the canonical artifacts (brief / handoffs / progress); the phase gate
//     refuses an unreachable round without dispatching a phantom;
//   · the pure-command E2E — schema get (the merged D19 single leaf: the shared
//     schema-type vocabulary — the primary doc-key spellings — under the default
//     --output json; the --output skeleton face
//     rendering the derived doc skeleton DIRECTLY into the target document, the
//     legacy phaseSpec alias normalized to the kebab key, §5.3), issue render
//     (stdin body — the subcommand face; the
//     renderer's own suite lives in render/__tests__/render.test.ts, its T19
//     home), base set/get (the single → artifact);
//   · the composition root + HarnessDispatch — host detection, the dispatch prompt
//     (template data plane), the handoff-draft readback into the outcome.
// Fixtures are hermetic mkdtemp repos (git-inited — the engine resolves the repo
// root from the git top level and the review binds its `next:` base there); the io is
// captured, never the process.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Command } from "commander";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { ProcessFacts } from "../../infra/proc.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { BriefRenderer } from "../../render/brief.ts";
import type { RouteTarget } from "../../session/faces.ts";
import type { InFlightRecord } from "../../session/inflight.ts";
import { type CrashRecord, Ledger, type SampleRecord } from "../../session/ledger.ts";
import type { Route } from "../../session/next.ts";
import { FIX_READBACK_SUFFIX } from "../../session/next.ts";
import type { DispatchStep, OpenFrame } from "../../session/run.ts";
import { Capsule } from "../capsule.ts";
import type { CliIo, CliOptions, DispatchScene } from "../cli.ts";
import { Cli, HarnessDispatch } from "../cli.ts";
import { CLI_COMMANDS, type CliVerb } from "../declare.ts";
import { HOSTS } from "../host.ts";
import type { StepRunner } from "../init.ts";
import { PLUGINS, type PluginRow } from "../plugins.ts";
import { CommandTreeBuilder } from "../projection.ts";
import type { ChildOutcome, ChildRun, ChildRunner, Termination } from "../termination.ts";
import { Words } from "../words.ts";
import { negatedOf } from "./negation.ts";

// The retired usage corpus — the pre-T2 usage product's bytes for the two verbs
// whose old rows still run as negative anchors (the survivors assert the old
// self-built face is gone from the commander-native output; the review/fix/
// schema/issue retired rows are deleted outright — no dead bytes stay pinned).
const RETIRED_USAGE = {
  implement:
    "usage: cdd implement --tasks <n|n,n,…> --plan <path> [--root <path>] — implement the plan wave's task group",
  base: "usage: cdd base <set|get> --plan <path> [set: --base <branch> --source <source>] [--force] — read/write the base.json artifact",
} as const;

/** The engine's source planes — the destroy-list sweep's scan set (zero non-test
 *  residue is asserted across every plane and the src-next root, never a single
 *  file). */
const ENGINE_SOURCE_PLANES = ["contract", "face", "infra", "render", "session"] as const;

/** Every engine source file's (src-next-qualified name, text) — the plane enum +
 *  the src-next root's own .ts files (bin.ts — the shipped CLI entry, the engine's
 *  sole source file outside the planes). The .ts-suffix filter drops the __tests__
 *  dirs and the plane subdirectories (a directory never ends with .ts), so the
 *  swept set IS the engine's non-test source tree — the planes' root company
 *  included, the guard's closure over the 'zero residual across the engine source'
 *  claim. */
const engineSourceTexts = (): [string, string][] => {
  return [
    ...ENGINE_SOURCE_PLANES.flatMap((plane) =>
      readdirSync(new URL(`../../${plane}/`, import.meta.url))
        .filter((name) => name.endsWith(".ts"))
        .map(
          (name) =>
            [
              `${plane}/${name}`,
              readFileSync(new URL(`../../${plane}/${name}`, import.meta.url), "utf8"),
            ] as [string, string],
        ),
    ),
    ...readdirSync(new URL("../../", import.meta.url))
      .filter((name) => name.endsWith(".ts"))
      .map(
        (name) =>
          [name, readFileSync(new URL(`../../${name}`, import.meta.url), "utf8")] as [
            string,
            string,
          ],
      ),
  ];
};

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

/** The captured io — the CLI's stdout/stderr seam (never the process). */
class CaptureIo implements CliIo {
  stdoutText = "";
  stderrText = "";
  stdout(text: string): void {
    this.stdoutText += text;
  }
  stderr(text: string): void {
    this.stderrText += text;
  }
}

interface CliFixture {
  command: Cli;
  io: CaptureIo;
  repoRoot: string;
  cleanup: () => void;
}

/** The process cwd before any fixture chdir — restored after every test so the
 *  isolation never leaks across tests (§2.12: the engine resolves the repo root
 *  from the working directory, so the fixture isolates by chdir). */
const ORIGINAL_CWD = process.cwd();

/** The ambient host-environment pin — the CLI resolves the harness from `process.env`
 *  at the delivery face (`HostDetect.detect`), so an inherited marker would make every
 *  rendered `next:` skill-ref depend on the harness this suite happens to run under
 *  (a pi session exports `AI_AGENT=pi` → the flat `/skill:*` form, a claude session
 *  `CLAUDE_CODE_SESSION_ID` → the `/kairos:*` form, a CI shell neither mark). The
 *  markers are therefore cleared before every test — the CI ambient, which resolves to
 *  the documented `""` → claude fallback (`route-render.ts`) — and a test that pins a
 *  marker itself (the real-dispatch host cases) still sees its own value for its own
 *  duration; the suite's start-up ambient is restored once at the end. */
class HostEnvironment {
  readonly #markers = ["CLAUDE_CODE_SESSION_ID", "AI_AGENT"] as const;
  readonly #ambient = new Map<string, string | undefined>();

  /** Drop the host markers, remembering the start-up values exactly once. */
  clear(): void {
    for (const marker of this.#markers) {
      if (!this.#ambient.has(marker)) this.#ambient.set(marker, process.env[marker]);
      delete process.env[marker];
    }
  }

  /** Put the start-up ambient back (the suite never leaks its pin). */
  restore(): void {
    for (const [marker, value] of this.#ambient) {
      if (value === undefined) delete process.env[marker];
      else process.env[marker] = value;
    }
  }
}

const hostEnvironment = new HostEnvironment();
beforeEach(() => {
  hostEnvironment.clear();
});
afterAll(() => {
  hostEnvironment.restore();
});
afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

/** The hermetic approving dispatch — the real-run stand-in for the retired
 *  `--dry-run` synthetic approval (P11 · §2.2/§2.4): a work round lands APPROVED
 *  (a findings-free work carrier), a findings round lands zero findings (its
 *  conclusion derives APPROVED at judgment time). The E2E tests inject it and drop
 *  `--dry-run`, so the lifecycle (bookkeep · capsule · next hop) runs for real
 *  without spawning a child. */
const APPROVING: DispatchStep = async () => ({ status: "APPROVED", findings: [] });

/** A hermetic CLI fixture — a fresh temp repo, the io captured, the cwd isolated
 *  into the temp root (the engine resolves the repo root from `process.cwd()`, so
 *  the fixture chdirs rather than injecting a root — §2.12). The temp root is taken
 *  through `realpathSync` because the engine's git-top-level resolution returns the
 *  REAL path (macOS `/var` is a symlink to `/private/var`), so the fixture's paths
 *  must speak the same basis the engine resolves. */
const fixture = (opts: CliOptions = {}): CliFixture => {
  const repoRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "cli-")));
  process.chdir(repoRoot);
  const io = new CaptureIo();
  const command = Cli.create({ io, ...opts });
  return {
    command,
    io,
    repoRoot,
    cleanup: () => {
      process.chdir(ORIGINAL_CWD);
      rmSync(repoRoot, { recursive: true, force: true });
    },
  };
};

/** Init a git repo with one commit — the repo root the engine resolves from the
 *  working directory, and the review `next:` base. The fixture .gitignore keeps the
 *  dispatch's own writes (the `.kairos` workspace) and the fixture's synthetic docs
 *  (`/docs/`) out of the tree — the working tree stays clean across multi-dispatch
 *  flows (the P4.1 clean-tree dispatch gate). Pass an explicit ignore content to
 *  shape it (the no-`.kairos`-ignore consumer regression). */
const gitInit = (repoRoot: string, ignore = ".kairos\n/docs/\n"): string => {
  spawnSync("git", ["init", "-q"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.email", "cli@test"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.name", "cli-test"], { cwd: repoRoot });
  writeFileSync(path.join(repoRoot, ".gitignore"), ignore, "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  return spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot }).stdout.toString().trim();
};

/** A plan document — the head + N task blocks (task 1 no-dep; loop tasks depend on task 1). */
const planFor = (repoRoot: string, count = 1, name = "p3.md"): string => {
  const file = path.join(repoRoot, "docs", "kairos", "plans", name);
  mkdirSync(path.dirname(file), { recursive: true });
  const blocks: string[] = [];
  for (let id = 1; id <= count; id += 1) {
    blocks.push(
      `### Task ${id}: task ${id}`,
      "- **Objective**: objective",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - step — checkable: green",
      "- **Acceptance**: ok",
      `- **DependsOn**: ${id === 1 ? "none" : "1"}`,
      "",
    );
  }
  writeFileSync(
    file,
    [
      "---",
      "title: Test Plan",
      "doc-type: plan",
      "version: v1.0",
      "date: 2026-10-09",
      "slug: p3",
      "---",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      ...blocks,
    ].join("\n"),
    "utf8",
  );
  return file;
};

/** Read a JSON file (the workspace artifact assertions). */
const readJson = <T>(file: string): T => {
  return JSON.parse(readFileSync(file, "utf8")) as T;
};

/** The D30 wave-line reviewed identity — the brief-revision ref a wave row binds:
 *  the plan it renders FROM + the RENDERED brief's sha1 (the wave gate binds the
 *  brief, never the whole plan). */
const briefRevision = (repoRoot: string, plan: string, tasks: string) => {
  const brief = new BriefRenderer().render(
    readFileSync(plan, "utf8"),
    tasks.split(",").map(Number),
  );
  return {
    kind: "brief-revision" as const,
    // The persisted shape is the canonical repoRoot-relative form (P9 T4 §2.7):
    // the rendered-from plan field lands relative to repoRoot, never absolute.
    plan: path.relative(repoRoot, plan),
    brief_hash: createHash("sha1").update(brief).digest("hex"),
  };
};

/** A doc-contract-clean plan — every registered plan element present (the header
 *  tuple + the version lineage + a Change-history table + the task fields), chain
 *  links resolving into existing same-family siblings. The P4.1 doc-contract
 *  dispatch gate (the spec/plan faces) requires it — a plain task-fixture plan is
 *  structurally defective and never dispatches a doc round. */
const conformingPlan = (repoRoot: string): string => {
  const file = path.join(repoRoot, "docs", "kairos", "plans", "p3.md");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    [
      "---",
      "title: Test Plan",
      "doc-type: plan",
      "version: v1.0",
      "date: 2026-10-09",
      "slug: p3",
      "base: develop",
      "---",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "### Task 1:",
      "- **Objective**: objective",
      "- **Files**: a.ts",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - step — checkable: green",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
      "",
      "## Change history",
      "",
      "| Version | date | summary | author |",
      "|---|---|---|---|",
      "| v1.0 | 2026-10-09 | initial | [human] |",
    ].join("\n"),
    "utf8",
  );
  // The same-slug spec and the program overall — minimal identity documents the
  // SlugIndex reads (`slug:` + `doc-type:`, the phase-spec carrying `program:`).
  const specPath = path.join(repoRoot, "docs", "kairos", "specs", "p3-design.md");
  mkdirSync(path.dirname(specPath), { recursive: true });
  writeFileSync(
    specPath,
    "---\ntitle: S\ndoc-type: phase-spec\nslug: p3\nprogram: p3-overall\n---\n",
    "utf8",
  );
  const overallPath = path.join(repoRoot, "docs", "kairos", "specs", "p3-overall.md");
  writeFileSync(overallPath, "---\ntitle: O\ndoc-type: overall\nslug: p3-overall\n---\n", "utf8");
  return file;
};

/** A doc-contract-clean overall — every registered overall element present (the
 *  header tuple + the ten-element charter + the inventory tables), its chain links
 *  resolving into existing same-family siblings. The overall charter is the
 *  GOOD_OVERALL judge fixture shape (judge.test.ts:19-71) with the `o1-` names
 *  the temp repo actually holds — the review face's doc-contract gate must judge it
 *  under the overall key (zero phase-spec misreport on the doc-key derivation). */
const conformingOverall = (repoRoot: string): string => {
  const file = path.join(repoRoot, "docs", "kairos", "specs", "o1-overall.md");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    [
      "---",
      "title: Test Overall",
      "doc-type: overall",
      "version: v1.21",
      "date: 2026-10-07",
      "slug: o1-overall",
      "status: Approved",
      'author: "[human]"',
      "---",
      "",
      "## Document scope",
      "scope prose",
      "",
      "## File paths",
      "| Artifact | Path |",
      "| --- | --- |",
      "| overall | docs/kairos/specs/o1-overall.md |",
      "",
      "## Program charter",
      "### Goal",
      "- goal text",
      "",
      "### Non-goals",
      "- non-goal text",
      "",
      "### Cross-cutting",
      "- cross text",
      "",
      "## Issue inventory",
      "| Phase | Issue (ref) | Title summary |",
      "| --- | --- | --- |",
      "| P1 | #123 | issue one |",
      "| P2 | none | issue two |",
      "",
      "## Phase inventory",
      "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| P1 | doc-type derivation | scope a | [P1-design](docs/kairos/specs/o1-p1-design.md) | [P1 plan](docs/kairos/plans/o1-p1.md) | criteria a |  |",
      "| P2 | document surface | scope b | P2-design | [P2 plan](docs/kairos/plans/o1-p2.md) | criteria b |  |",
      "",
      "## Dependency graph",
      "P1 -> P2",
      "- `->` = hard block",
      "",
      "## Boundary rules",
      "- boundary rule",
      "",
      "## Constraints",
      "",
      "- 全部约定自动生效",
      "",
      "## Maintenance",
      "- maintenance note",
      "",
      "## Change history",
      "| Version | Date | Summary |",
      "| --- | --- | --- |",
      "| v1.20 | 2026-10-06 | prior change |",
      "| v1.21 | 2026-10-07 | merged change |",
    ].join("\n"),
    "utf8",
  );
  for (const sibling of ["o1-p1-design.md", "o1-p2-design.md"]) {
    const siblingPath = path.join(repoRoot, "docs", "kairos", "specs", sibling);
    mkdirSync(path.dirname(siblingPath), { recursive: true });
    writeFileSync(siblingPath, `# ${sibling}\n`, "utf8");
  }
  for (const sibling of ["o1-p1.md", "o1-p2.md"]) {
    const siblingPath = path.join(repoRoot, "docs", "kairos", "plans", sibling);
    mkdirSync(path.dirname(siblingPath), { recursive: true });
    writeFileSync(siblingPath, `# ${sibling}\n`, "utf8");
  }
  return file;
};

/** A plan with N independent tasks (no deps — a single root wave of N members). */
const independentPlan = (repoRoot: string, name: string, count: number, slug = "p3"): string => {
  const file = path.join(repoRoot, "docs", "kairos", "plans", name);
  mkdirSync(path.dirname(file), { recursive: true });
  const blocks: string[] = [];
  for (let id = 1; id <= count; id += 1) {
    blocks.push(
      `### Task ${id}: task ${id}`,
      "- **Objective**: objective",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - step — checkable: green",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
      "",
    );
  }
  writeFileSync(
    file,
    [
      "---",
      "title: Test Plan",
      "doc-type: plan",
      "version: v1.0",
      "date: 2026-10-09",
      `slug: ${slug}`,
      "---",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      ...blocks,
    ].join("\n"),
    "utf8",
  );
  return file;
};

/** A doc-contract-clean phase-spec — every registered phase-spec element present
 *  (the head tuple + the version lineage + a Change-history table + the design
 *  skeleton), carrying the `doc-type:` head key (spec §12 · D34) the capsule's
 *  doc-class discrimination reads (zero filename inference). */
const conformingSpec = (repoRoot: string, name = "s1-design.md"): string => {
  const file = path.join(repoRoot, "docs", "kairos", "specs", name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    [
      "---",
      "title: Test Spec",
      "doc-type: phase-spec",
      "version: v1.0",
      "date: 2026-10-09",
      "slug: s1",
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
      "### 1. Data plane",
      "#### 1.1 Registry",
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
    ].join("\n"),
    "utf8",
  );
  // The program overall — a minimal identity document the SlugIndex reads (the
  // phase-spec's `program:` reference target). Its `version:` carries the lineage
  // the fixture's `parent-version: v1.0` claims.
  const sibling = path.join(repoRoot, "docs", "kairos", "specs", "x-overall.md");
  mkdirSync(path.dirname(sibling), { recursive: true });
  writeFileSync(
    sibling,
    "---\ntitle: O\ndoc-type: overall\nslug: x-overall\nversion: v1.0\n---\n",
    "utf8",
  );
  return file;
};

// ---------------------------------------------------------------------------
// the command face — the steady subcommand words
// ---------------------------------------------------------------------------

describe("the command face — the eight steady subcommand words", () => {
  it("declares exactly the eight subcommands of the steady command face", () => {
    expect(CLI_COMMANDS.map((command) => command.name)).toEqual([
      "implement",
      "review",
      "fix",
      "base",
      "schema",
      "issue",
      "board",
      "init",
    ]);
  });

  it("the retired usage corpus never returns to the declaration rows — the usage face is the commander-native projection (Task 2; the byte re-pins land at Task 5)", () => {
    // The retired corpus is gone from the declaration surface — the command rows
    // carry the description/keys/positionals/leaves face, never a usage corpus.
    const declarationText = JSON.stringify(CLI_COMMANDS);
    for (const line of Object.values(RETIRED_USAGE)) {
      expect(declarationText, line).not.toContain(line);
    }
  });

  it("declares the nested leaf surfaces — base set|get · schema get · issue render", () => {
    const leavesOf = (verb: string) =>
      CLI_COMMANDS.find((c) => c.name === verb)!.leaves!.map((l) => l.name);
    expect(leavesOf("base")).toEqual(["set", "get"]);
    // D19 — the schema leaf set is the single `get` leaf (gen merged into
    // `get --output skeleton`).
    expect(leavesOf("schema")).toEqual(["get"]);
    expect(leavesOf("issue")).toEqual(["render"]);
  });
});

// ---------------------------------------------------------------------------
// cdd init — the repo-independent harness bootstrap (P20)
// ---------------------------------------------------------------------------

describe("cdd init — the harness bootstrap wiring", () => {
  /** The stand-in runner — records every argv, returns 0 (the wiring's concern). */
  class RecordingRunner implements StepRunner {
    readonly calls: (readonly string[])[] = [];
    async run(argv: readonly string[]): Promise<number> {
      this.calls.push(argv);
      return 0;
    }
  }

  it("runs the harness sequence through the injected runner — zero FS reads off a git repo", async () => {
    const runner = new RecordingRunner();
    const headers: string[] = [];
    // The bare fixture is a temp dir OUTSIDE any git repo — `init` never resolves
    // the repo root, so the run succeeds where every repo-bound verb would exit 1.
    const { command, io, repoRoot, cleanup } = fixture({
      initRunner: runner,
      initHeader: (line) => headers.push(line),
    });
    try {
      const code = await command.runArgv(["init", "--harness=pi"]);
      expect(code).toBe(0);
      expect(io.stderrText).toBe("");
      const roster: readonly PluginRow[] = PLUGINS;
      expect(runner.calls).toEqual(roster.flatMap((row) => row.pi.install));
      expect(headers.at(-1)).toBe("init: 3 steps ok (pi · install)");
      // §2.4's second half — the cwd is left untouched: no workspace, no ledger.
      expect(existsSync(path.join(repoRoot, ".kairos"))).toBe(false);
      expect(readdirSync(repoRoot)).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("derives the update column from the parsed --update — zero install argv rides the run", async () => {
    const runner = new RecordingRunner();
    const headers: string[] = [];
    const { command, io, cleanup } = fixture({
      initRunner: runner,
      initHeader: (line) => headers.push(line),
    });
    try {
      expect(await command.runArgv(["init", "--harness=claude", "--update"])).toBe(0);
      const roster: readonly PluginRow[] = PLUGINS;
      expect(runner.calls).toEqual(roster.flatMap((row) => row.claude.update));
      // The install column is a distinct argv set, so a dropped or inverted update
      // derivation shows up here as install commands riding an update request.
      const installs = new Set(
        roster.flatMap((row) => row.claude.install).map((argv) => argv.join(" ")),
      );
      expect(runner.calls.filter((argv) => installs.has(argv.join(" ")))).toEqual([]);
      expect(headers.at(-1)).toBe("init: 6 steps ok (claude · update)");
      expect(io.stderrText).toBe("");
    } finally {
      cleanup();
    }
  });

  it("a missing --harness is a usage rejection (exit 2, zero spawn)", async () => {
    const runner = new RecordingRunner();
    const { command, cleanup } = fixture({ initRunner: runner });
    try {
      expect(await command.runArgv(["init"])).toBe(2);
      expect(runner.calls).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("an out-of-vocabulary --harness is refused by the HOST_IDS value domain (exit 2, zero spawn)", async () => {
    const runner = new RecordingRunner();
    const { command, io, cleanup } = fixture({ initRunner: runner });
    try {
      expect(await command.runArgv(["init", "--harness=cursor"])).toBe(2);
      expect(io.stderrText).toContain("must be one of claude | pi");
      expect(runner.calls).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("--dry-run renders the step plan — exit 0, the would-run lines on the header face, zero spawn", async () => {
    const runner = new RecordingRunner();
    const headers: string[] = [];
    const { command, io, cleanup } = fixture({
      initRunner: runner,
      initHeader: (line) => headers.push(line),
    });
    try {
      expect(await command.runArgv(["init", "--harness=claude", "--dry-run"])).toBe(0);
      // the preview rides the same header seam as a real run: one would-run line per
      // step (the roster's argv), then the summary — and the runner is never reached
      expect(headers).toHaveLength(7);
      expect(headers[0]).toBe(
        "would run: claude plugin marketplace add obra/superpowers-marketplace",
      );
      expect(headers.at(-1)).toBe("init: 6 steps (claude · install) — dry run, nothing executed");
      expect(runner.calls).toEqual([]);
      expect(io.stderrText).toBe("");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// parse — the component-value validation + the unknown-flag guard (the safety
// semantics — value-domain rejection / unknown-flag narrowing / unknown command /
// pre-verb scope / help position — assert through command.runArgv, the public
// face `Cli#parse()` retired to at T3; the projection's parse PRODUCTS — the
// normalized values/positionals the thin shells consume — stay on the composed
// commander program, the same tree runArgv dispatches through)

describe("parse — the component-value validation + the unknown-flag guard", () => {
  /** The composed parse gate — the projection's commander program (the same tree
   *  runArgv dispatches through); the parse-PRODUCT assertions only (the safety
   *  semantics ride the runArgv face below). */
  const gate = new CommandTreeBuilder().program;
  /** The parsed node of one verb — commander's parse() returns the PROGRAM; the
   *  parsed opts/arguments live on the dispatched subcommand node (the same read
   *  the runArgv thin shell consumes). */
  function nodeOf(verb: CliVerb): Command {
    const node = gate.commands.find((c) => c.name() === verb);
    expect(node, `the ${verb} command node exists`).toBeDefined();
    return node!;
  }
  /** The parsed leaf node of one parent command. */
  function leafOf(parent: CliVerb, name: string): Command {
    const node = nodeOf(parent).commands.find((c) => c.name() === name);
    expect(node, `the ${parent}.${name} leaf exists`).toBeDefined();
    return node!;
  }

  it("parses implement with the normalized int-list tasks + the plan + the dry-run scope", () => {
    const implement = nodeOf("implement");
    gate.parse(["implement", "--tasks", "2,1,2", "--plan", "docs/x.md", "--dry-run"], {
      from: "user",
    });
    expect(implement.opts().tasks).toBe("1,2");
    expect(implement.opts().plan).toBe("docs/x.md");
    expect((implement.optsWithGlobals() as Record<string, unknown>).dryRun).toBe(true);
  });

  it("rejects a non-integer --tasks token (the int-list value shape)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["implement", "--tasks", "1,x", "--plan", "x"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "error: option '--tasks <n|n,n,…>' argument '1,x' is invalid",
      );
      expect(io.stderrText).toContain("must be comma-separated integers: x");
    } finally {
      cleanup();
    }
  });

  it("rejects an out-of-enum --type and --source", async () => {
    const { command, io, cleanup } = fixture();
    try {
      let code = await command.runArgv(["review", "--type", "bogus"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "error: option '--type <wave|branch|spec|plan>' argument 'bogus' is invalid",
      );
      expect(io.stderrText).toContain("must be one of wave | branch | spec | plan");
      io.stderrText = "";
      code = await command.runArgv([
        "base",
        "set",
        "--plan",
        "p",
        "--base",
        "d",
        "--source",
        "nope",
      ]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "must be one of plan-field | branch-upstream | conversation-context | user-confirmed",
      );
    } finally {
      cleanup();
    }
  });

  it("rejects a non-integer --round (the sha value type retired with the commit-sha surface)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv([
        "review",
        "--type",
        "plan",
        "--plan",
        "x",
        "--round",
        "x",
      ]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("must be an integer");
    } finally {
      cleanup();
    }
  });

  it("the fix face declares NO branch refs — the review judges the live tree (no re-declared range)", () => {
    // fix --type branch parses with --plan + --reviews alone (no base/head)
    const fix = nodeOf("fix");
    gate.parse(["fix", "--type", "branch", "--plan", "p.md", "--reviews", "branch-review-x.json"], {
      from: "user",
    });
    expect((fix.opts() as Record<string, unknown>).base).toBeUndefined();
    expect((fix.opts() as Record<string, unknown>).head).toBeUndefined();
    // re-declaring the range on the fix CLI is rejected — the unknown-option
    // face lands on the undeclared-flag runArgv test below
  });

  it("an undeclared flag is an unknown option — the unknown-flag semantics (a typo never runs a dispatch)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // the required flags must be satisfied first — the missing-required check
      // fires before the unknown-option scan (probe-verified)
      let code = await command.runArgv(["implement", "--tasks", "1", "--plan", "x", "--taks"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown option '--taks'");
      expect(io.stderrText).toContain("(Did you mean --tasks?)");
      io.stderrText = "";
      // the fix face re-declares no branch refs — --base/--head are unknown to fix
      code = await command.runArgv([
        "fix",
        "--type",
        "branch",
        "--base",
        "a".repeat(8),
        "--head",
        "b".repeat(8),
      ]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown option '--base'");
      io.stderrText = "";
      // a typo with a required flag missing surfaces the required byte — the
      // missing-required check wins over the unknown-option scan
      code = await command.runArgv(["implement", "--taks", "1"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: required option '--tasks <n|n,n,…>' not specified");
    } finally {
      cleanup();
    }
  });

  it("rejects a non-program flag before the verb and an unknown command", async () => {
    const { command, io, cleanup } = fixture();
    try {
      let code = await command.runArgv(["--root", "x", "implement"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown option '--root'");
      io.stderrText = "";
      // the unknown-command face carries commander's native name suggestion — the
      // command-name near-miss never self-built before (the T5 new surface)
      code = await command.runArgv(["implementt", "--tasks", "1"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown command 'implementt'");
      expect(io.stderrText).toContain("(Did you mean implement?)");
    } finally {
      cleanup();
    }
  });

  it("rejects a missing required flag", async () => {
    const { command, io, cleanup } = fixture();
    try {
      let code = await command.runArgv(["implement", "--plan", "x"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: required option '--tasks <n|n,n,…>' not specified");
      io.stderrText = "";
      code = await command.runArgv(["review", "--tasks", "1"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "error: required option '--type <wave|branch|spec|plan>' not specified",
      );
    } finally {
      cleanup();
    }
  });

  it("parses the nested leaves — base set|get · schema get · issue render", () => {
    gate.parse(["base", "set", "--plan", "p.md", "--base", "dev", "--source", "plan-field"], {
      from: "user",
    });
    expect((leafOf("base", "set").opts() as Record<string, unknown>).base).toBe("dev");
    gate.parse(
      ["base", "set", "--plan", "p.md", "--base", "dev", "--source", "plan-field", "--force"],
      { from: "user" },
    );
    expect((leafOf("base", "set").opts() as Record<string, unknown>).force).toBe(true);
    gate.parse(["base", "get", "--plan", "p.md"], { from: "user" });
    expect(leafOf("base", "get").args).toEqual([]);
    gate.parse(["schema", "get", "plan"], { from: "user" });
    // commander fills every declared positional — the missing optional <target>
    // rides as undefined; the consumed <type> is the first slot
    expect(leafOf("schema", "get").processedArgs[0]).toBe("plan");
    leafOf("issue", "render");
    expect(leafOf("issue", "render").name()).toBe("render");
  });

  it("rejects an unknown schema type against the shared schema-type vocabulary", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "get", "bogus"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "unknown schema type: bogus (available: overall, plan, phase-spec, single-spec)",
      );
    } finally {
      cleanup();
    }
  });

  it("parses the merged get leaf — the shared vocabulary with the phaseSpec alias normalized to the kebab key + the optional <target> positional", () => {
    const get = leafOf("schema", "get");
    gate.parse(["schema", "get", "phase-spec"], { from: "user" });
    expect(get.processedArgs[0]).toBe("phase-spec");
    // the legacy camel alias normalizes to the same kebab key
    gate.parse(["schema", "get", "phaseSpec"], { from: "user" });
    expect(get.processedArgs[0]).toBe("phase-spec");
    gate.parse(["schema", "get", "plan"], { from: "user" });
    expect(get.processedArgs[0]).toBe("plan");
    gate.parse(["schema", "get", "overall"], { from: "user" });
    expect(get.processedArgs[0]).toBe("overall");
    // D19 — the target positional rides the merged leaf (mandatory only under
    // --output skeleton, an engine-declared parameter rather than a shell redirect)
    gate.parse(["schema", "get", "phase-spec", "--output", "skeleton", "/tmp/demo.md"], {
      from: "user",
    });
    expect(get.processedArgs).toEqual(["phase-spec", "/tmp/demo.md"]);
    expect(get.opts().output).toBe("skeleton");
  });

  it("the skeleton render face — a missing <target> and a non-doc-key <type> exit 2 at the run face; a bogus --output rejects at parse", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // --output skeleton makes <target> conditionally required — the missing
      // target surfaces at the domain run (exit 2 · the D19 conditional-required
      // face — never a static commander requirement)
      let code = await command.runArgv(["schema", "get", "phase-spec", "--output", "skeleton"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("cdd schema get --output skeleton: missing <target>");
      io.stderrText = "";
      // a command word (board) is not a schema type — the schema vocabulary and
      // the command vocabulary are separate; the unknown type exits 2 at the run
      // face (the shared vocabulary's rejection face)
      code = await command.runArgv([
        "schema",
        "get",
        "board",
        "--output",
        "skeleton",
        "/tmp/demo.md",
      ]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("unknown schema type: board");
      io.stderrText = "";
      // the --output enum rejects an out-of-domain value at parse
      code = await command.runArgv(["schema", "get", "plan", "--output", "bogus"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("must be one of json | skeleton");
    } finally {
      cleanup();
    }
  });

  it("rejects a missing leaf, an unknown leaf and an extra positional", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // a missing subcommand shows the OWNING node's help (exit 2) — the base
      // node's own set/get face, never the top-level program
      let code = await command.runArgv(["base"]);
      expect(code).toBe(2);
      const out = io.stdoutText + io.stderrText;
      expect(out).toContain("Usage: cdd base [options] [command]");
      expect(out).toContain("set [options]");
      expect(out).toContain("get [options]");
      expect(out).not.toContain("Usage: cdd [options] [command]");
      io.stdoutText = "";
      io.stderrText = "";
      // an unknown leaf carries commander's native subcommand suggestion
      code = await command.runArgv(["base", "reset"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown command 'reset'");
      expect(io.stderrText).toContain("(Did you mean set?)");
      io.stderrText = "";
      // a spurious target under the json render face rides the run-body usage —
      // the target is the skeleton face's engine-declared parameter, never a
      // shell-redirect slot (D19)
      code = await command.runArgv(["schema", "get", "plan", "extra"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "cdd schema get: unexpected <target> — the json render takes no target",
      );
    } finally {
      cleanup();
    }
  });

  it("accepts --help / -h and the dry-run scope at any position — the program scopes ride the runArgv face (exit 0)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // --help anywhere pre-empts the scan — the helpDisplayed face (exit 0)
      let code = await command.runArgv(["review", "--type", "wave", "--help"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("Usage: cdd review [options]");
      io.stdoutText = "";
      // -h before the verb resolves to the PROGRAM face, exit 0 (the pre-verb
      // scope shows the top-level help, never the would-be command's)
      code = await command.runArgv(["-h", "implement", "--tasks", "1"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("Usage: cdd [options] [command]");
    } finally {
      cleanup();
    }
  });

  it("a pre-verb --dry-run reaches the program scope — the flag merges into the run as the read-only preview (exit 0)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv([
        "--dry-run",
        "implement",
        "--tasks",
        "1",
        "--plan",
        plan,
      ]);
      expect(code).toBe(0);
      // the merged program-scope flag drives the preview — the next step forecast
      // with zero repo writes (the retired synthetic bookkeeping is gone)
      expect(io.stdoutText.startsWith("cdd implement: preview (no repo changes)\n")).toBe(true);
      expect(existsSync(path.join(repoRoot, ".kairos"))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("a help flag on a leaf command pre-empts the required leaf word — base --help exits 0", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["base", "--help"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("Usage: cdd base [options] [command]");
    } finally {
      cleanup();
    }
  });

  it("the bool negation spellings are retired — a negated bool flag is an unknown option with the back-spelling hint", async () => {
    const { command, io, cleanup } = fixture();
    // the negated spellings are composed via the shared synthesizer — the
    // literal tokens never appear in the tree (the zero-consumption pin)
    const negatedDryRun = negatedOf("--dry-run");
    const negatedForce = negatedOf("--force");
    try {
      // the hidden negations are never registered — commander's native near-miss
      // still hints the real flag
      let code = await command.runArgv(["implement", negatedDryRun, "--tasks", "1", "--plan", "x"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(`error: unknown option '${negatedDryRun}'`);
      expect(io.stderrText).toContain("(Did you mean --dry-run?)");
      io.stderrText = "";
      code = await command.runArgv([
        "base",
        "set",
        "--plan",
        "p",
        "--base",
        "d",
        "--source",
        "plan-field",
        negatedForce,
      ]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(`error: unknown option '${negatedForce}'`);
      expect(io.stderrText).toContain("(Did you mean --force?)");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the help/--help display face — the overview · the per-command native render ·
// the error-path bytes (T5 re-pin onto the commander-native surface; the old
// self-built rendering + smart-hint corpus retired with the T2 projection)
// ---------------------------------------------------------------------------

describe("the help/--help display face — the command overview", () => {
  it("bare `cdd` renders the commander program face, exit 2 — no custom missing-command text (spec §3.3)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv([]);
      expect(code).toBe(2);
      // the bare run's help rides commander's error channel (exit 2 = the usage
      // domain) — the native program face: Usage/Options/Commands + the help row.
      const out = io.stdoutText + io.stderrText;
      expect(out).toContain("Usage: cdd [options] [command]");
      expect(out).toContain("Commands:");
      // the eight-command table + the built-in help [command] row (native layout)
      for (const name of [
        "implement",
        "review",
        "fix",
        "base",
        "schema",
        "issue",
        "board",
        "init",
      ]) {
        expect(out).toContain(name);
      }
      expect(out).toContain("help [command]");
      // the retired custom missing-command byte is gone — the bare run never
      // renders a self-built message over the native face
      expect(out).not.toContain("missing command");
      expect(out).not.toContain(RETIRED_USAGE.implement);
    } finally {
      cleanup();
    }
  });

  it("a verb-less --help renders the same native program face with the flip to exit 0 (§3.4)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["--help"]);
      expect(code).toBe(0);
      // the helpDisplayed face — the help lands on the stdout channel, exit 0
      expect(io.stdoutText).toContain("Usage: cdd [options] [command]");
      expect(io.stdoutText).toContain("Commands:");
      expect(io.stdoutText).not.toContain("missing command");
      expect(io.stderrText).toBe("");
    } finally {
      cleanup();
    }
  });
});

describe("the help/--help display face — the per-command render", () => {
  it("cdd implement --help — the native command face: the flag tokens + value domains + the example, exit 0", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["implement", "--help"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("Usage: cdd implement [options]");
      expect(io.stdoutText).toContain("--tasks <n|n,n,…>");
      expect(io.stdoutText).toContain("--plan <path>");
      // `--root` is retired (T2 · §2.5 — the deliberate command-declaration byte
      // break): the help face no longer carries the option.
      expect(io.stdoutText).not.toContain("--root <path>");
      expect(io.stdoutText).toContain("the task ids of the wave group (comma-separated)");
      expect(io.stdoutText).toContain("(required)");
      expect(io.stdoutText).toContain("run the task implement phase");
      expect(io.stdoutText).toContain("Examples:");
      expect(io.stdoutText).toContain("cdd implement --tasks 1,2 --plan docs/kairos/plans/p3.md");
    } finally {
      cleanup();
    }
  });

  it("cdd review --help — the --type enum + the per-flag value domains + the example, exit 0", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["review", "--help"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("--type <wave|branch|spec|plan>");
      expect(io.stdoutText).toContain("--tasks <n|n,n,…>");
      expect(io.stdoutText).toContain("--round <n>");
      expect(io.stdoutText).toContain("--spec <path>");
      // the branch range flags retired with the commit-sha surface (P7)
      expect(io.stdoutText).not.toContain("--base");
      expect(io.stdoutText).not.toContain("--head");
      expect(io.stdoutText).toContain("the target face of the round");
      expect(io.stdoutText).toContain(
        "cdd review --type spec --spec docs/kairos/specs/p3-design.md",
      );
    } finally {
      cleanup();
    }
  });

  it("cdd fix --help — the findings flag + the example, exit 0", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["fix", "--help"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("--reviews <path>");
      expect(io.stdoutText).toContain("the source review handoff JSON path");
      expect(io.stdoutText).toContain(
        "cdd fix --type wave --tasks 1 --reviews tasks-1-review-1.json",
      );
    } finally {
      cleanup();
    }
  });

  it("cdd base --help — the native sub-command table (set | get) without the leaf option tokens, exit 0", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["base", "--help"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("Usage: cdd base [options] [command]");
      expect(io.stdoutText).toContain("Commands:");
      expect(io.stdoutText).toContain("set [options]");
      expect(io.stdoutText).toContain("get [options]");
      expect(io.stdoutText).toContain("write the base artifact");
      expect(io.stdoutText).toContain("read the base artifact");
      // the leaf option rows stay off the parent face — base set's --force (never
      // mentioned on the parent) and the --source <…> row's token form (the written
      // example sentence legitimately carries the bare `--source plan-field` value)
      expect(io.stdoutText).not.toContain("--force");
      expect(io.stdoutText).not.toContain("--source <");
      expect(io.stdoutText).toContain(
        "cdd base set --plan docs/kairos/plans/p3.md --base develop --source plan-field",
      );
    } finally {
      cleanup();
    }
  });

  it("cdd schema --help — the native Commands table (the merged get leaf) + the example, exit 0", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "--help"]);
      expect(code).toBe(0);
      // whitespace-normalized — commander wraps the long description onto
      // continuation lines; the assertion reads the token stream
      const help = io.stdoutText.replace(/\s+/g, " ");
      expect(help).toContain("Usage: cdd schema [options] [command]");
      expect(help).toContain("Commands:");
      expect(help).toContain("get [options] <type> [target]");
      expect(help).toContain("print the derived doc-structure schema for <type>");
      expect(help).toContain("or render the derived doc skeleton into <target>");
      // D19 — the gen leaf is gone; the single get leaf's rows ride the Commands table
      expect(help).not.toContain("gen [options]");
      expect(help).toContain("cdd schema get phase-spec");
    } finally {
      cleanup();
    }
  });

  it("cdd issue --help — the native Commands table (render) + the example, exit 0", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["issue", "--help"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("Usage: cdd issue [options] [command]");
      expect(io.stdoutText).toContain("Commands:");
      expect(io.stdoutText).toContain("render [options]");
      expect(io.stdoutText).toContain("render the aggregate issue body");
      expect(io.stdoutText).toContain("cdd issue render < findings.json");
    } finally {
      cleanup();
    }
  });

  it("a help flag on a leaf command renders the LEAF's own face (base set --help), exit 0", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["base", "set", "--help"]);
      expect(code).toBe(0);
      // the leaf's own native help — its usage line + its own option rows (set's
      // --force face), never the parent base node's subcommand table
      expect(io.stdoutText).toContain("Usage: cdd base set [options]");
      expect(io.stdoutText).toContain("write the base artifact");
      expect(io.stdoutText).toContain("--force");
      expect(io.stdoutText).not.toContain("Commands:");
    } finally {
      cleanup();
    }
  });

  it("every per-command --help carries the program-flag tail note (--dry-run alone)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      for (const verb of [
        "implement",
        "review",
        "fix",
        "base",
        "schema",
        "issue",
        "board",
        "init",
      ]) {
        expect(await command.runArgv([verb, "--help"])).toBe(0);
      }
      // the tail note rides the commander afterAll surface — one line per help
      // face, listing --dry-run ALONE (the -h/--help redundant column unwritten)
      const legend =
        /program flags \(accepted at any position\): --dry-run \(implement\/review\/fix\/init\)/g;
      expect(io.stdoutText.match(legend) ?? []).toHaveLength(8);
      expect(io.stdoutText).not.toContain("· --help / -h");
    } finally {
      cleanup();
    }
  });
});

describe("the T4 commander-native help acceptance — the projected help face (§5)", () => {
  /** Normalize the whitespace runs — commander wraps long texts onto a continuation
   *  line with the table padding; the projection assertions read the description
   *  token stream through single spaces, never a wrapped byte literal. */
  const norm = (text: string): string => text.replace(/\s+/g, " ");

  it("cdd --help — the native program face: Usage · the eight-command table (short descriptions = the CLI_COMMANDS projection) · Examples heading · the --dry-run-only footer", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["--help"]);
      expect(code).toBe(0);
      const help = norm(io.stdoutText);
      // The commander-native layout — the Usage line + the capital-C section
      // headings (the §5.1 Usage/Options/Commands section heads).
      expect(help).toContain("Usage: cdd [options] [command]");
      expect(help).toContain("Commands:");
      expect(help).toContain("Options:");
      // The eight command rows — the command names + their short descriptions
      // SINGLE-SOURCED at the CLI_COMMANDS declaration rows (the projection test,
      // never a hand-typed byte list).
      for (const spec of CLI_COMMANDS) {
        expect(help).toContain(spec.name);
        expect(help).toContain(spec.description);
      }
      // The Examples section heading + a P1 example sentence in the stream.
      expect(help).toContain("Examples:");
      expect(help).toContain("cdd review --type spec --spec docs/kairos/specs/p3-design.md");
      // The program-flag tail note: --dry-run listed ALONE — the -h/--help
      // redundant column is not written (the built-in helpOption faces Options).
      const footer = io.stdoutText.split("\n").find((line) => line.startsWith("program flags"));
      expect(footer).toBe(
        "program flags (accepted at any position): --dry-run (implement/review/fix/init)",
      );
      expect(footer).not.toContain("--help");
      expect(footer).not.toContain("-h");
    } finally {
      cleanup();
    }
  });

  it("cdd review --help — the option descriptions carry the value-domain tokens, in the declared registration order (the §5.2 registration order)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["review", "--help"]);
      expect(code).toBe(0);
      const help = norm(io.stdoutText);
      // The §5.2 value domains ride the option descriptions.
      expect(help).toContain("--type <wave|branch|spec|plan>");
      expect(help).toContain("--tasks <n|n,n,…>");
      expect(help).toContain("--plan <path>");
      // the branch range flags retired with the commit-sha surface (P7)
      expect(help).not.toContain("--base");
      expect(help).not.toContain("--head");
      // The description order = the ARGV_CHANNEL row order of the review node's
      // declared keys (the registration order never a sorted/derived one).
      expect(help.indexOf("--type")).toBeLessThan(help.indexOf("--tasks"));
      expect(help.indexOf("--plan")).toBeLessThan(help.indexOf("--spec"));
      // `--root` is retired (T2) — it no longer appears on the review node's help.
      expect(help).not.toContain("--root");
    } finally {
      cleanup();
    }
  });

  it("cdd schema --help — the leaf subcommand table rides the native Commands face (the single get leaf)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "--help"]);
      expect(code).toBe(0);
      const help = norm(io.stdoutText);
      expect(help).toContain("Commands:");
      expect(help).toContain("get [options] <type>");
      // D19 — the gen leaf is gone, so its Commands row never rides the face.
      expect(help).not.toContain("gen [options]");
    } finally {
      cleanup();
    }
  });

  it("cdd base get --help — the leaf face binds its OWN keys: --plan present, set's --force NOT leaked (leaf granularity)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["base", "get", "--help"]);
      expect(code).toBe(0);
      const help = norm(io.stdoutText);
      expect(help).toContain("--plan <path>");
      expect(help).not.toContain("--force");
    } finally {
      cleanup();
    }
  });
});

describe("the error-path face — commander's native suggestion bytes (T5 re-pin)", () => {
  it("an unknown flag exits 2 with commander's unknown-option byte + the native did-you-mean", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // the required flags must be satisfied first — commander's missing-required
      // check fires before the unknown-option scan (probe-verified)
      const code = await command.runArgv(["implement", "--tasks", "2", "--plan", "p.md", "--taks"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown option '--taks'");
      expect(io.stderrText).toContain("(Did you mean --tasks?)");
      // the self-built usage line + the suggestion hint never ride the error face
      expect(io.stderrText).not.toContain(RETIRED_USAGE.implement);
    } finally {
      cleanup();
    }
  });

  it("an unknown flag never suggests a flag the same command also rejects", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // `--spec` (the SPEL→SPEC near-miss) is a review/fix flag, not an
      // implement one — the did-you-mean candidates stay inside the errored
      // command's own declared flags, so a foreign flag the same verb would
      // reject is never suggested (the three-ID negative pin).
      const code = await command.runArgv(["implement", "--tasks", "2", "--plan", "p.md", "--spel"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown option '--spel'");
      expect(io.stderrText).not.toContain("(Did you mean --spec?)");
      expect(io.stderrText).not.toContain(RETIRED_USAGE.implement);
    } finally {
      cleanup();
    }
  });

  it("a pre-verb unknown flag narrows to the program scopes — no command-flag suggestion (the §5.3 side-selection)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // `--taks` before the verb hits the PROGRAM node — its candidate set is the
      // program scopes alone (--dry-run/help), so the command-scoped `--tasks`
      // near-miss is never suggested (the program face never leaks a leaf flag).
      const code = await command.runArgv(["--taks", "implement"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown option '--taks'");
      expect(io.stderrText).not.toContain("(Did you mean --tasks?)");
    } finally {
      cleanup();
    }
  });

  it("a leaf's unknown flag stays inside the leaf's own candidates (base get never suggests set's --force)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // --force / --source are set-only flags: the get leaf's candidate set is
      // its own declared options — `--forc` hints nothing (the three-ID pin).
      const code = await command.runArgv(["base", "get", "--forc", "--plan", "p.md"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown option '--forc'");
      expect(io.stderrText).not.toContain("(Did you mean");
      expect(io.stderrText).not.toContain(RETIRED_USAGE.base);
    } finally {
      cleanup();
    }
  });

  it("the dead-end suggestion chain is gone — get hints nothing on set-only flags, set still hints its own", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // Following an old-style hint (`base get --forc` → `--force`) would land on
      // another set-only flag the get face rejects — the get surface hints nothing.
      const dead = await command.runArgv(["base", "get", "--force", "--plan", "p.md"]);
      expect(dead).toBe(2);
      expect(io.stderrText).toContain("error: unknown option '--force'");
      expect(io.stderrText).not.toContain("(Did you mean");

      // The native hint survives on the set surface — --force IS set-declared.
      const alive = await command.runArgv([
        "base",
        "set",
        "--forc",
        "--plan",
        "p.md",
        "--base",
        "develop",
        "--source",
        "plan-field",
      ]);
      expect(alive).toBe(2);
      expect(io.stderrText).toContain("error: unknown option '--forc'");
      expect(io.stderrText).toContain("(Did you mean --force?)");
    } finally {
      cleanup();
    }
  });

  it("a missing required flag exits 2 with the .requiredOption() byte (no suggestion)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["implement", "--plan", "p.md"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: required option '--tasks <n|n,n,…>' not specified");
      expect(io.stderrText).not.toContain(RETIRED_USAGE.implement);
    } finally {
      cleanup();
    }
  });

  it("an unknown subcommand exits 2 with commander's unknown-command byte + the native subcommand suggestion", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["base", "reset"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown command 'reset'");
      expect(io.stderrText).toContain("(Did you mean set?)");
      expect(io.stderrText).not.toContain(RETIRED_USAGE.base);
    } finally {
      cleanup();
    }
  });

  it("the D19 schema leaf merge — `schema g` exits 2 as an unknown command (the prefix resolves to the single get face, never a phantom dispatch)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // The `g` prefix's closest candidate is the single get leaf, but commander's
      // suggestion floor (similarity > 0.4) stays silent for a one-character guess —
      // the candidate set updated with the tree (gen gone); the leak face is exit 2,
      // never a dispatch.
      const code = await command.runArgv(["schema", "g"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown command 'g'");
      expect(io.stderrText).not.toContain("(Did you mean get?)");
      expect(io.stderrText).not.toContain("gen");
    } finally {
      cleanup();
    }
  });

  it("the D19 --output option enters the get leaf's option candidates — a near-miss flags it", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "get", "--otput", "json", "phase-spec"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown option '--otput'");
      expect(io.stderrText).toContain("(Did you mean --output?)");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the work commands — the lifecycle/capsule/ledger composition (the real run
// with a hermetic injected dispatch; the retired `--dry-run` synthetic approval)
// ---------------------------------------------------------------------------

describe("the work commands run the lifecycle/capsule/ledger — injected-dispatch E2E", () => {
  it("implement — one dispatch, the capsule face, the ledger record + the rendered brief", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED · blocker: 0 · handoff: ");
      expect(io.stdoutText).toContain(`next: review --type wave --tasks 1`);
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      const progress = readJson<{ waves: unknown[] }>(path.join(workspace, "progress.json"));
      expect(progress.waves).toContainEqual({ wave: "1", rounds: { implement: [1] } });
      expect(existsSync(path.join(workspace, "tasks-1-implement.json"))).toBe(true);
      expect(existsSync(path.join(workspace, "tasks-1-brief.md"))).toBe(true);
      const brief = readFileSync(path.join(workspace, "tasks-1-brief.md"), "utf8");
      expect(brief).toContain("### Task 1:");
      expect(brief).not.toContain("WAVE_BASE:");
    } finally {
      cleanup();
    }
  });

  it("every wave-face dispatch re-extracts the brief from the CURRENT plan — the complete plan mirror (task + Constraints), never an exists→reuse copy (§4.1/§5)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const briefPath = path.join(repoRoot, ".kairos", "cdd", "p3", "tasks-1-brief.md");
      expect(await command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(0);
      const firstBrief = readFileSync(briefPath, "utf8");
      // the complete plan mirror — the wave's task section AND the plan's
      // `## Constraints` section (both faces of the mirror, not the task block alone)
      expect(firstBrief).toContain("### Task 1:");
      expect(firstBrief).toContain("## Constraints");
      expect(firstBrief).toContain("- delta");
      // The plan's Constraints section moves between dispatches (the plan write
      // authority amends mid-run): the review dispatch re-extracts the brief from the
      // CURRENT plan — no "exists → leave it" reuse.
      writeFileSync(
        plan,
        readFileSync(plan, "utf8").replace("- delta", "- delta (amended)"),
        "utf8",
      );
      io.stdoutText = "";
      expect(
        await command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", plan]),
      ).toBe(0);
      const secondBrief = readFileSync(briefPath, "utf8");
      // the mirrored Constraints reflect the CURRENT plan (fresh-extracted at the
      // review dispatch), the task section still present
      expect(secondBrief).toContain("- delta (amended)");
      expect(secondBrief).toContain("### Task 1:");
      expect(secondBrief).not.toBe(firstBrief);
    } finally {
      cleanup();
    }
  });

  it("implement — strict-wave dispatch: one derived wave per invocation (the C5 closure advances the wave)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot, 2);
      // The root wave {1} first (task 2's dep sits in wave 1). Implementing task 1 does
      // NOT close it (implement rounds are never a closure — v1.20 closedWaves), so the
      // wave advances only through the review's C5 closure: review 1 must land before
      // task 2 becomes dispatchable.
      expect(await command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(0);
      io.stdoutText = "";
      expect(
        await command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", plan]),
      ).toBe(0);
      io.stdoutText = "";
      const code = await command.runArgv(["implement", "--tasks", "2", "--plan", plan]);
      expect(code).toBe(0);
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      const progress = readJson<{ waves: unknown[] }>(path.join(workspace, "progress.json"));
      // the wave-1 row carries its D30 revision record — the completed wave review
      // bound the BRIEF it judged to ITS line (the row's reviewedRevision is a
      // brief-revision: the plan it renders from + the RENDERED brief's sha1 — the
      // wave-gate reopen basis: a plan edit outside this wave's tasks must not void it)
      expect(progress.waves).toContainEqual({
        wave: "1",
        rounds: { implement: [1], review: [1] },
        reviewedRevision: briefRevision(repoRoot, plan, "1"),
        // P21 §5.1 — the closure-time plan-task snapshot (both plan tasks existed).
        planTasks: [1, 2],
      });
      expect(progress.waves).toContainEqual({ wave: "2", rounds: { implement: [1] } });
      // the invocation's single stdout face — only the LAST step's capsule
      expect(io.stdoutText.split("status: APPROVED").length - 1).toBe(1);
      expect(existsSync(path.join(workspace, "tasks-2-implement.json"))).toBe(true);
      // the strict-wave gate (T24): a `--tasks` splitting the derived wave BLOCKs
      io.stderrText = "";
      const split = await command.runArgv(["implement", "--tasks", "1,2", "--plan", plan]);
      expect(split).toBe(1);
      expect(io.stderrText).toContain("derived wave");
      // T18 (§2.13) — the graph title's embedded plan path is repoRoot-relative
      // (the argv plan is relativized before it reaches the `graph:` line; the
      // absolute argv form never renders).
      expect(io.stderrText).toContain("graph: docs/kairos/plans/p3.md");
      expect(io.stderrText).not.toContain(`graph: ${repoRoot}`);
    } finally {
      cleanup();
    }
  });

  it("review — the phase derives from the ledger (implement then review), a clean review closes", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      expect(await command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(0);
      io.stdoutText = "";
      const code = await command.runArgv([
        "review",
        "--type",
        "wave",
        "--tasks",
        "1",
        "--plan",
        plan,
      ]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED · blocker: 0 · handoff: ");
      // T3 deliberate pin break (the constraints' registered next: break): the wave
      // closure renders the wave→branch wiring literal (PIPELINE_NEXT.wave), never
      // the bare terminal word.
      expect(io.stdoutText).toContain("next: review --type branch --plan ");
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      expect(existsSync(path.join(workspace, "tasks-1-review-1.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("review with findings — the fix-route next: line carries the readback suffix", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: async (frame: OpenFrame) =>
        frame.phase === "review"
          ? {
              status: "CHANGES_REQUESTED",
              findings: [{ severity: "blocker", summary: "drift" }],
            }
          : { status: "APPROVED" },
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      expect(await command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(0);
      io.stdoutText = "";
      const code = await command.runArgv([
        "review",
        "--type",
        "wave",
        "--tasks",
        "1",
        "--plan",
        plan,
      ]);
      expect(code).toBe(0);
      // the review's findings route the one-way fix hop — the capsule next: line
      // names the review handoff (the resolved workspace path) and rides the
      // readback suffix (the cli face checkable)
      expect(io.stdoutText).toContain("status: CHANGES_REQUESTED · blocker: 1 · handoff: ");
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      // D47 — the next: literal's embedded paths are repoRoot-relative (the ONE shape).
      expect(io.stdoutText).toContain(
        `next: fix --type wave --tasks 1 --plan ${path.relative(repoRoot, plan)} --reviews ${path.relative(repoRoot, path.join(workspace, "tasks-1-review-1.json"))} ${FIX_READBACK_SUFFIX}`,
      );
    } finally {
      cleanup();
    }
  });

  it("fix — the source review's blocker findings drive the re-review next (C5-1)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      // Seed the implement + a blocker review round (the fix's C5-1 input).
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      ledger.recordRound(1, "implement");
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "1", round: 1 },
        {
          tasks: [1],
          phase: "review",
          findings: [{ severity: "blocker", summary: "drift" }],
        },
      );
      ledger.recordRound(1, "review");
      const code = await command.runArgv(["fix", "--type", "wave", "--tasks", "1", "--plan", plan]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED · blocker: 0 · handoff: ");
      expect(io.stdoutText).toContain(`next: review --type wave --tasks 1`);
      expect(existsSync(path.join(workspace.path, "tasks-1-fix-1.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("fix — the branch re-review next: carries the workspace --plan and re-dispatches through the runtime gate (find #8/#9)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: async (frame: OpenFrame) =>
        frame.phase === "fix" ? { status: "APPROVED" } : { status: "APPROVED", findings: [] },
    });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      // Seed the branch line: a blocker branch-review round (the fix's C5-1 input)
      // whose handoff carries the reviewed findings (the fix's --reviews single
      // carrier).
      // find #9 — the branch line's workspace is the plan-slug (the fix dispatch's
      // --plan); the handoff file is the spine name `branch-review-{round}.json`.
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      const params = { round: 1 };
      ledger.persistHandoff("review", "branch", params, {
        phase: "branch-review",
        findings: [{ severity: "blocker", summary: "drift" }],
      });
      // find #9 — the line key is the stable "branch" (round accumulates across
      // re-reviews; the old range-short key reset to 1 on every head move).
      ledger.recordRound("branch", "branch-review");
      const reviewsPath = workspace.resolve("branch-review-1.json");
      const code = await command.runArgv([
        "fix",
        "--type",
        "branch",
        "--plan",
        plan,
        "--reviews",
        reviewsPath,
      ]);
      expect(code).toBe(0);
      // the re-review literal carries the workspace --plan only — the review judges
      // the live tree (the scope anchor BASE_BRANCH is engine-injected at dispatch);
      // D47 — the embedded path is repoRoot-relative
      expect(io.stdoutText).toContain(
        `next: review --type branch --plan ${path.relative(repoRoot, plan)}`,
      );
      // the runtime gate, not parse-only: re-feeding the literal's argv through the CLI
      // dispatches a real branch review — exit 0, never a missing-refs refusal
      const reExit = await command.runArgv(["review", "--type", "branch", "--plan", plan]);
      expect(reExit).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("review --type branch — the live-tree branch face", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      const code = await command.runArgv(["review", "--type", "branch", "--plan", plan]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED · blocker: 0 ·");
      // T3 deliberate pin break: the branch closure routes the cdd-close ref
      // (PIPELINE_NEXT.branch through REFS[ref][host]).
      expect(io.stdoutText).toContain("next: /kairos:cdd-close");
      // the branch line's workspace is the plan-slug (the fix dispatch's --plan) and
      // the handoff is the spine `branch-review-1.json` (no range token in the name)
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      expect(existsSync(path.join(workspace, "branch-review-1.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("review --type branch — the CLI injects the base artifact's branch as BASE_BRANCH (the scope anchor value source)", async () => {
    const sync = new StubRunner();
    sync.stdout = "status: APPROVED\n";
    const { command, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      // the base artifact the CLI reads (the same `base set` write-through source);
      // the leaf carries no basis flag — the engine resolves the repo root from the
      // fixture's working directory (T2 · §2.12).
      expect(
        await command.runArgv([
          "base",
          "set",
          "--plan",
          plan,
          "--base",
          "develop",
          "--source",
          "plan-field",
        ]),
      ).toBe(0);
      // A REAL branch-review dispatch (the production HarnessDispatch — no injected
      // seam). The host is injected ambiently (the CLI's production dispatch reads
      // process.env), so mark it and restore it.
      const saved = process.env.CLAUDE_CODE_SESSION_ID;
      process.env.CLAUDE_CODE_SESSION_ID = "s";
      let code: number;
      try {
        code = await command.runArgv(["review", "--type", "branch", "--plan", plan]);
      } finally {
        if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
        else process.env.CLAUDE_CODE_SESSION_ID = saved;
      }
      // the child is a fake (no draft written → the round reads back BLOCKED), but the
      // dispatch itself ran — the prompt is the assertion surface
      expect(code).toBe(1);
      const prompt = sync.calls[0]!.args[sync.calls[0]!.args.length - 1];
      // the base artifact's branch name rides the round context — the wave/branch
      // review's scope anchor resolves (never an empty, dropped slot)
      expect(prompt).toContain("- `BASE_BRANCH`: develop");
    } finally {
      cleanup();
    }
  });

  it("BASE_BRANCH injection — the wave/branch tree-review faces carry the anchor; the spec/plan doc faces never do (§3.2)", async () => {
    const sync = new StubRunner();
    sync.stdout = "status: APPROVED\n";
    const { command, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      // the base artifact the CLI reads back at dispatch (the scope anchor source) —
      // the same `base set` write-through the wave/branch faces resolve.
      expect(
        await command.runArgv([
          "base",
          "set",
          "--plan",
          plan,
          "--base",
          "develop",
          "--source",
          "plan-field",
        ]),
      ).toBe(0);
      // seed the wave's implement round so the review face is dispatchable (the wave
      // line advances implement → review as ONE train)
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      ledger.recordRound("1", "implement");
      ledger.persistHandoff(
        "implement",
        "wave",
        { tasks: "1" },
        {
          status: "APPROVED",
          artifacts: {},
        },
      );
      // A REAL dispatch (the production HarnessDispatch — no injected seam). The
      // host is injected ambiently (the CLI's production dispatch reads
      // process.env), so mark it and restore it.
      const saved = process.env.CLAUDE_CODE_SESSION_ID;
      process.env.CLAUDE_CODE_SESSION_ID = "s";
      const promptOf = async (argv: readonly string[]): Promise<string> => {
        await command.runArgv([...argv]);
        const call = sync.calls[sync.calls.length - 1]!;
        return call.args[call.args.length - 1];
      };
      try {
        // the wave tree-review face carries the anchor
        const wave = await promptOf(["review", "--type", "wave", "--tasks", "1", "--plan", plan]);
        expect(wave).toContain("- `BASE_BRANCH`: develop");
        // the branch tree-review face carries the anchor
        const branch = await promptOf(["review", "--type", "branch", "--plan", plan]);
        expect(branch).toContain("- `BASE_BRANCH`: develop");
        // the spec + plan doc faces never carry the anchor (the slot stays empty and
        // the assembler drops it — only the tree-review faces resolve a scope axis)
        const spec = await promptOf([
          "review",
          "--type",
          "spec",
          "--spec",
          conformingSpec(repoRoot),
        ]);
        expect(spec).not.toContain("BASE_BRANCH");
        // the spec review's judged doc IS the spec — the kind-named anchor carries it
        expect(spec).toContain("- `INPUT_SPEC`: docs/kairos/specs/s1-design.md");
        const planReview = await promptOf(["review", "--type", "plan", "--plan", plan]);
        expect(planReview).not.toContain("BASE_BRANCH");
        // the plan-review round context carries the same-slug identity document
        // as its INPUT_SPEC anchor so the reviewer judges the plan against its
        // design spec (the index resolves it — no plan-header path scalar)
        expect(planReview).toContain("- `INPUT_SPEC`: docs/kairos/specs/p3-design.md");
      } finally {
        if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
        else process.env.CLAUDE_CODE_SESSION_ID = saved;
      }
    } finally {
      cleanup();
    }
  });

  it("D61-4 — INPUT_OVERALL carries the parent charter the spec's `program:` names", async () => {
    const sync = new StubRunner();
    sync.stdout = "status: APPROVED\n";
    const { command, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      // A phase-spec names its parent program via `program:`; the fixture's overall
      // (`x-overall`) is on disk, so the spec-line review carries the charter path
      // beside INPUT_SPEC — both on the one repoRoot-relative basis.
      const spec = conformingSpec(repoRoot);
      const saved = process.env.CLAUDE_CODE_SESSION_ID;
      process.env.CLAUDE_CODE_SESSION_ID = "s";
      try {
        await command.runArgv(["review", "--type", "spec", "--spec", spec]);
      } finally {
        if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
        else process.env.CLAUDE_CODE_SESSION_ID = saved;
      }
      const prompt =
        sync.calls[sync.calls.length - 1]!.args[sync.calls[sync.calls.length - 1]!.args.length - 1];
      expect(prompt).toContain("- `INPUT_SPEC`: docs/kairos/specs/s1-design.md");
      expect(prompt).toContain("- `INPUT_OVERALL`: docs/kairos/specs/x-overall.md");
      // the shared review fixed prefix names the token's existence condition
      expect(prompt).toContain("the parent charter at `INPUT_OVERALL`");
    } finally {
      cleanup();
    }
  });

  it("D61-4 — a single-spec names no `program:`: the INPUT_OVERALL line is dropped", async () => {
    const sync = new StubRunner();
    sync.stdout = "status: APPROVED\n";
    const { command, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      // A doc-contract-clean single-spec — the independent document class that names
      // no parent overall (no `program:` key), so the slot stays empty.
      const file = path.join(repoRoot, "docs", "kairos", "specs", "ss1-design.md");
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(
        file,
        [
          "---",
          "title: Test Single Spec",
          "doc-type: single-spec",
          "version: v1.0",
          "date: 2026-10-09",
          "slug: ss1",
          "status: Draft",
          "author: x",
          "---",
          "",
          "## Background & root cause",
          "",
          "Text.",
          "",
          "## Design decisions",
          "",
          "Text.",
          "",
          "## Acceptance",
          "",
          "Text.",
          "",
          "## Constraints",
          "",
          "Text.",
          "",
          "## Change history",
          "",
          "| Version | date | summary | author |",
          "|---|---|---|---|",
          "| v1.0 | 2026-10-09 | initial | [human] |",
        ].join("\n"),
        "utf8",
      );
      const saved = process.env.CLAUDE_CODE_SESSION_ID;
      process.env.CLAUDE_CODE_SESSION_ID = "s";
      try {
        await command.runArgv(["review", "--type", "spec", "--spec", file]);
      } finally {
        if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
        else process.env.CLAUDE_CODE_SESSION_ID = saved;
      }
      const prompt =
        sync.calls[sync.calls.length - 1]!.args[sync.calls[sync.calls.length - 1]!.args.length - 1];
      expect(prompt).toContain("- `INPUT_SPEC`: docs/kairos/specs/ss1-design.md");
      // empty slot → the assembler drops the line (only present facts land)
      expect(prompt).not.toContain("- `INPUT_OVERALL`");
      // the fixed prefix still names the existence condition
      expect(prompt).toContain("the parent charter at `INPUT_OVERALL`");
    } finally {
      cleanup();
    }
  });

  it("D46 — INPUT_SPEC is resolved to a repoRoot-relative token from the plan's same-slug identity document", async () => {
    const sync = new StubRunner();
    sync.stdout = "status: APPROVED\n";
    const { command, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      // The plan header carries NO path scalar: the design-spec anchor is the
      // same-slug identity document the SlugIndex finds. The reviewer is spawned
      // at cwd = repoRoot, and the scene emits the repoRoot-relative token (the
      // one basis every round-context path token speaks).
      const plan = conformingPlan(repoRoot);
      const saved = process.env.CLAUDE_CODE_SESSION_ID;
      process.env.CLAUDE_CODE_SESSION_ID = "s";
      try {
        await command.runArgv(["review", "--type", "plan", "--plan", plan]);
      } finally {
        if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
        else process.env.CLAUDE_CODE_SESSION_ID = saved;
      }
      const prompt =
        sync.calls[sync.calls.length - 1]!.args[sync.calls[sync.calls.length - 1]!.args.length - 1];
      // The token is the repoRoot-relative path (never the raw `../specs/p3-design.md`)
      // and it points at an existing file the reviewer can open from cwd = repoRoot.
      expect(prompt).toContain("- `INPUT_SPEC`: docs/kairos/specs/p3-design.md");
      expect(prompt).not.toContain("- `INPUT_SPEC`: ../specs/p3-design.md");
      expect(existsSync(path.join(repoRoot, "docs/kairos/specs/p3-design.md"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("T4 — the round-context prompt's path tokens are ALL repoRoot-relative (one basis, zero absolute)", async () => {
    // §2.7 — every path token injected into the child speaks ONE basis (repoRoot-
    // relative): the child is spawned at cwd = repoRoot (T2), so a relative token
    // resolves identically for every token, input or output alike. Across the modes
    // the 8-token set is WORKSPACE_DIR · INPUT_PLAN · INPUT_SPEC · INPUT_REVIEWS ·
    // INPUT_WAVE_BRIEF · OUTPUT_REPORT · OUTPUT_EVIDENCE · OUTPUT_HANDOFF (the
    // non-path tokens excluded); each mode emits its own subset. This pin drives an
    // implement dispatch (the wave line's work face) and asserts EVERY emitted path
    // token is relative — no absolute prefix, no `..` escape.
    const sync = new StubRunner();
    sync.stdout = "status: APPROVED\n";
    const { command, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      const saved = process.env.CLAUDE_CODE_SESSION_ID;
      process.env.CLAUDE_CODE_SESSION_ID = "s";
      try {
        await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
      } finally {
        if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
        else process.env.CLAUDE_CODE_SESSION_ID = saved;
      }
      const call = sync.calls[sync.calls.length - 1]!;
      const prompt = call.args[call.args.length - 1];
      // The child is spawned at the repo root — the load-bearing fact a relative
      // token relies on.
      expect(call.cwd).toBe(repoRoot);
      // Every emitted path token is repoRoot-relative: no absolute prefix, no escape.
      const PATH_TOKENS = [
        "WORKSPACE_DIR",
        "INPUT_PLAN",
        "INPUT_SPEC",
        "INPUT_REVIEWS",
        "INPUT_WAVE_BRIEF",
        "OUTPUT_REPORT",
        "OUTPUT_EVIDENCE",
        "OUTPUT_HANDOFF",
      ];
      const emitted = [...prompt.matchAll(/^- `([A-Z0-9_]+)`: (.+)$/gm)].flatMap((m) =>
        PATH_TOKENS.includes(m[1]!) ? [[m[1]!, m[2]!.trim()]] : [],
      );
      // The implement-mode work face carries its path tokens (the wave brief + the
      // prescribed write paths + the workspace dir) — never an empty assertion.
      expect(emitted.length).toBeGreaterThanOrEqual(5);
      for (const [token, value] of emitted) {
        expect(path.isAbsolute(value), `${token} is repoRoot-relative`).toBe(false);
        expect(value.startsWith(".."), `${token} carries no parent-escape prefix`).toBe(false);
      }
      // The absolute repo root never appears on any path-token line.
      expect(prompt).not.toMatch(/^- `[A-Z0-9_]+`: \/.*repoRoot/m);
    } finally {
      cleanup();
    }
  });

  it("T3 — an out-of-repo path is accepted with a stderr warning (shape judged, never location)", async () => {
    // §2.10 — a `..`-carrying relativized value lies outside the repo; the engine
    // still reads it (the shape is what is judged), but the fact rides the stderr
    // CDD_WARN channel so the caller is not surprised.
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const outside = realpathSync(mkdtempSync(path.join(tmpdir(), "cli-outside-")));
      const plan = conformingPlan(outside);
      try {
        // a plan OUTSIDE the fixture repo (the absolute path relativizes to `../…`);
        // the injected dispatch keeps the run hermetic (no child spawn).
        const code = await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
        expect(code).toBe(0);
        expect(io.stderrText).toContain("CDD_WARN:");
        expect(io.stderrText).toContain("outside the repository");
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    } finally {
      cleanup();
    }
  });

  it("review --type spec/plan — the doc-path face (the doc-derived workspace slug)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      // The declared, contract-clean spec doc — the `doc-type:` head key
      // (spec §12 · D34) the capsule's doc-class discrimination reads
      // (zero filename inference).
      const spec = conformingSpec(repoRoot);
      const specCode = await command.runArgv(["review", "--type", "spec", "--spec", spec]);
      expect(specCode).toBe(0);
      // T3 deliberate pin break: the phase-spec closure routes the cdd-plan ref (PIPELINE_NEXT.phase-spec).
      expect(io.stdoutText).toContain("next: /kairos:cdd-plan");
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "s1", "spec-review-1.json"))).toBe(
        true,
      );
      io.stdoutText = "";
      // The plan face is doc-contract-gated (P4.1 T1): a contract-clean plan (the
      // header tuple + version lineage + Change-history table + the chain siblings)
      // dispatches its review round.
      const plan = conformingPlan(repoRoot);
      const planCode = await command.runArgv(["review", "--type", "plan", "--plan", plan]);
      expect(planCode).toBe(0);
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3", "plan-review-1.json"))).toBe(
        true,
      );
    } finally {
      cleanup();
    }
  });

  it("review --type plan on a declaration-less plan BLOCKs — the plan face reads the declaration, zero command-type carve-out (spec §12 · D34)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      // A structurally contract-clean plan with its `doc-type:` key stripped:
      // the plan face keys the doc-contract target by the DECLARED type alone, never
      // by the command verb — a missing key reads null and the seam BLOCKs.
      const plan = conformingPlan(repoRoot);
      const stripped = readFileSync(plan, "utf8").replace("doc-type: plan\n", "");
      writeFileSync(plan, stripped, "utf8");
      const code = await command.runArgv(["review", "--type", "plan", "--plan", plan]);
      expect(code).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
      expect(io.stderrText).toContain("the doc declares no `doc-type:` key");
      // no phantom round lands — the BLOCK precedes any child dispatch
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3", "plan-review-1.json"))).toBe(
        false,
      );
    } finally {
      cleanup();
    }
  });

  it("review --type spec of an -overall.md — the overall doc-key face (zero phase-spec misreport)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const overall = conformingOverall(repoRoot);
      const overallCode = await command.runArgv(["review", "--type", "spec", "--spec", overall]);
      expect(overallCode).toBe(0);
      expect(io.stdoutText).toContain("next: done");
      // The overall was judged under the overall key (its declared
      // `doc-type:` key, spec §12 · D34) — a phase-spec misjudge would trip
      // the doc-contract gate: the charter fails the phase-spec face, the pre-flight
      // refuses over CDD_BLOCKED and no round lands. The exit 0 + round +
      // empty-findings carrier pin the zero misreport; the stderr stays free of the
      // blocked channel.
      const round = path.join(repoRoot, ".kairos", "cdd", "o1-overall", "spec-review-1.json");
      expect(existsSync(round)).toBe(true);
      expect(io.stderrText).not.toContain("CDD_BLOCKED");
      expect(readJson<{ findings: unknown[] }>(round).findings).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("a closed doc line REOPENS on doc-revision drift — the identity-aware line gate (T7)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      // Round 1: the initial clean review closes the doc line AND records the
      // reviewed doc revision (the line's identity — the T7 write-back at bookkeep).
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan])).toBe(0);
      // T3 deliberate pin break: the plan closure routes the cdd-dev ref (PIPELINE_NEXT.plan).
      expect(io.stdoutText).toContain("next: /kairos:cdd-dev");
      // The target doc then DRIFTS (a backfill edits the plan — the pre-T7 flow
      // froze the closed doc at "reviewed" with no reopen entry: the line held no
      // open round). The target identity moved — review is the requested phase and
      // the drifted doc reopens the line (round continuation, no flag).
      const driftedSource = readFileSync(plan, "utf8").replace(
        "- **Acceptance**: ok",
        "- **Acceptance**: ok (drifted)",
      );
      writeFileSync(plan, driftedSource, "utf8");
      io.stdoutText = "";
      const reopen = await command.runArgv(["review", "--type", "plan", "--plan", plan]);
      expect(reopen).toBe(0);
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3", "plan-review-2.json"))).toBe(
        true,
      );
    } finally {
      cleanup();
    }
  });

  it("an UNCHANGED closed doc line stays blocked — the revision-aware BLOCK message (T7)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan])).toBe(0);
      expect(io.stdoutText).toContain("next: /kairos:cdd-dev");
      // The doc did NOT move — the line gate compares the current revision to the
      // reviewed one and BLOCKs with the identity-aware message (the old "no open
      // round" text retires on the doc face).
      io.stderrText = "";
      const unchanged = await command.runArgv(["review", "--type", "plan", "--plan", plan]);
      expect(unchanged).toBe(1);
      expect(io.stderrText).toContain("already reviewed at v1.0");
      expect(io.stderrText).toContain("target revision unchanged");
      // no phantom round files land on the unchanged line
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3", "plan-review-2.json"))).toBe(
        false,
      );
    } finally {
      cleanup();
    }
  });

  it("a closed doc line with an unbound target revision keeps the generic BLOCK — the null-verdict face (T7)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const specPath = conformingSpec(repoRoot);
      // Seed a CLOSED spec line: a clean completed review round keyed under the
      // line-type constant (§3.7), zero reviewed revision bound. The line's identity
      // is the line type, never the argv path.
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "s1").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      ledger.persistHandoff("review", "spec", { round: 1 }, { phase: "review", findings: [] });
      ledger.recordRound("spec", "review");
      // The closed round bound no reviewed revision, so the ledger verdict is null,
      // not "same": the "target revision unchanged" claim would be fabricated (only
      // present facts land). The gate keeps the generic closed-line message.
      io.stderrText = "";
      const blocked = await command.runArgv([
        "review",
        "--type",
        "spec",
        "--spec",
        specPath,
        "--dry-run",
      ]);
      expect(blocked).toBe(1);
      expect(io.stderrText).toContain("the line holds no open round");
      expect(io.stderrText).not.toContain("target revision unchanged");
      // no phantom round files land on the null-verdict line
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "s1", "spec-review-2.json"))).toBe(
        false,
      );
    } finally {
      cleanup();
    }
  });

  it("an UNREADABLE dispatch target has no workspace key — CDD_BLOCKED with the `slug:` wording, exit 1", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      // The spec path never lands on disk: the identity read has no source, so the
      // dispatch face refuses on the slug carrier (never a filename-derived key).
      io.stderrText = "";
      const code = await command.runArgv([
        "review",
        "--type",
        "spec",
        "--spec",
        path.join(repoRoot, "docs", "kairos", "specs", "ghost-design.md"),
        "--dry-run",
      ]);
      expect(code).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
      expect(io.stderrText).toContain("slug:");
    } finally {
      cleanup();
    }
  });

  it("T8 — after an ABORTED fix the drifted doc re-reviews directly — the doc revision is the gate's primary criterion (judgment order = doc revision first)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: async (frame: OpenFrame) =>
        frame.phase === "fix"
          ? { status: "BLOCKED" } // the aborted fix — its round never records
          : {
              status: "CHANGES_REQUESTED",
              findings: [{ severity: "blocker", summary: "drift" }],
            },
    });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      // Review round 1 with blockers — the line awaits its fix (fixes < reviews:
      // the pre-T8 gate read the fix-awaited route and froze the re-review at
      // "the next round is fix" even after the doc moved).
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan])).toBe(0);
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      expect(existsSync(path.join(workspace, "plan-review-1.json"))).toBe(true);
      // The aborted fix — the pre-T8 stuck path's origin: the fix attempt BLOCKS,
      // records no fix round, and the line stays fix-awaited with the OLD review's
      // findings binding the reviewed doc revision.
      io.stdoutText = "";
      io.stderrText = "";
      expect(await command.runArgv(["fix", "--type", "plan", "--plan", plan])).toBe(1);
      // The doc then moves (fix applied · backfill · user decision are the SAME
      // case — the doc revision is the gate's primary criterion): the review runs
      // directly, whatever the fix-awaited round state says, and the old findings
      // are auto-invalid (bound to the superseded doc revision).
      const driftedSource = readFileSync(plan, "utf8").replace(
        "- **Acceptance**: ok",
        "- **Acceptance**: ok (drifted)",
      );
      writeFileSync(plan, driftedSource, "utf8");
      io.stderrText = "";
      io.stdoutText = "";
      const reopen = await command.runArgv(["review", "--type", "plan", "--plan", plan]);
      expect(reopen).toBe(0);
      expect(io.stderrText).not.toContain("cannot dispatch");
      expect(io.stderrText).not.toContain("the next round is fix");
      expect(existsSync(path.join(workspace, "plan-review-2.json"))).toBe(true);
      // The completion counts stay preserved (the re-review books the next round
      // increment) and the progress row's key set carries zero new fields (the
      // pending fix is derived, never a stored state).
      const progress = readJson<{
        waves: Array<{ wave: string; rounds?: Record<string, number[]> }>;
      }>(path.join(workspace, "progress.json"));
      // §3.7 — the doc line keys by its line-type constant, never the argv path
      const row = progress.waves.find((entry) => entry.wave === "plan");
      expect(row?.rounds?.review).toEqual([1, 2]);
      expect(row?.rounds?.fix).toBeUndefined();
      expect(JSON.stringify(progress)).not.toContain("pending");
    } finally {
      cleanup();
    }
  });

  it("dogfood §3.7 — the same doc via an ABSOLUTE then a RELATIVE argv path lands ONE ledger line (the doc line keys by its line-type constant, never the argv string)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    const savedCwd = process.cwd();
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      // the RELATIVE spelling `docs/kairos/plans/p3.md` (readText resolves it against
      // the process cwd — the same file the absolute path names)
      const relativePlan = path.relative(repoRoot, plan);
      expect(
        await command.runArgv([
          "review",
          "--type",
          "plan",
          "--plan",
          plan, // the ABSOLUTE argv spelling
        ]),
      ).toBe(0);
      expect(io.stdoutText).toContain("next: /kairos:cdd-dev");
      // The doc DRIFTS (a backfill edits the plan) so the second review reopens the
      // line at the NEXT round rather than being refused as an unchanged doc.
      writeFileSync(
        plan,
        readFileSync(plan, "utf8").replace("- delta", "- delta (drifted)"),
        "utf8",
      );
      process.chdir(repoRoot); // the relative argv path resolves to the same file
      io.stdoutText = "";
      io.stderrText = "";
      const relative = await command.runArgv([
        "review",
        "--type",
        "plan",
        "--plan",
        relativePlan, // the RELATIVE argv spelling — the same file
      ]);
      expect(relative).toBe(0);
      expect(io.stdoutText).toContain("next: /kairos:cdd-dev");
      // ONE line under the line-type key `"plan"` — the two argv spellings did NOT
      // fork a second row keyed by the other spelling; the round CONTINUED (2), it
      // did not reset to 1 (the §3.7 dogfood fix)
      const progress = readJson<{
        waves: Array<{ wave: string; rounds?: Record<string, number> }>;
      }>(path.join(repoRoot, ".kairos", "cdd", "p3", "progress.json"));
      const planRows = progress.waves.filter((row) => row.wave.startsWith("plan"));
      expect(planRows).toHaveLength(1);
      expect(planRows[0]!.wave).toBe("plan");
      expect(planRows[0]!.rounds?.review).toEqual([1, 2]);
    } finally {
      process.chdir(savedCwd);
      cleanup();
    }
  });

  it("T8 — an UNCHANGED fix-awaited doc stays rejected — the pending fix is derived (doc same + not APPROVED), never an independent field", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: async (frame: OpenFrame) =>
        frame.phase === "review"
          ? {
              status: "CHANGES_REQUESTED",
              findings: [{ severity: "blocker", summary: "drift" }],
            }
          : { status: "APPROVED" },
    });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan])).toBe(0);
      // The SAME doc (no drift) — the repeat review stays REFUSED (Review
      // Convergence anti-spin): the pending fix derives from the doc-same +
      // non-APPROVED face (the review's own fix is still outstanding), and the
      // message names the derived hop.
      io.stderrText = "";
      const repeat = await command.runArgv(["review", "--type", "plan", "--plan", plan]);
      expect(repeat).toBe(1);
      expect(io.stderrText).toContain("the pending fix applies to the unchanged doc");
      expect(io.stderrText).toContain("— run cdd fix first");
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      // no phantom re-review lands on the unchanged line
      expect(existsSync(path.join(workspace, "plan-review-2.json"))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("T8 — a COMPLETED fix on an UNCHANGED doc reopens the review through its C5-1 route — the doc-same face keeps the legacy rounds/routes judgment (the gate and the frame agree)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: async (frame: OpenFrame) =>
        frame.phase === "fix"
          ? { status: "APPROVED" }
          : {
              status: "CHANGES_REQUESTED",
              findings: [{ severity: "blocker", summary: "drift" }],
            },
    });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      // Review round 1 with blockers, then the fix round COMPLETES on the SAME doc
      // (fixes === reviews). The unchanged doc's "same" verdict carries NO pending
      // fix — the no-pending face falls back to the legacy rounds/routes judgment,
      // and the fix round's C5-1 route (blockers → re-review the fix delta) opens
      // the review lead. The lifecycle already dispatches this face; the CLI gate
      // must agree (an open gate and a dispatchable frame — the run.ts JSDoc
      // invariant) instead of the revision-aware "amend body/version" rejection.
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan])).toBe(0);
      io.stdoutText = "";
      io.stderrText = "";
      expect(await command.runArgv(["fix", "--type", "plan", "--plan", plan])).toBe(0);
      io.stdoutText = "";
      io.stderrText = "";
      const reopen = await command.runArgv(["review", "--type", "plan", "--plan", plan]);
      expect(reopen).toBe(0);
      // no revision-aware rejection on the completed-fix face — the delta has moved
      expect(io.stderrText).not.toContain("already reviewed");
      expect(io.stderrText).not.toContain("cannot dispatch");
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      expect(existsSync(path.join(workspace, "plan-review-2.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("the phase gate refuses an unreachable round without dispatching a phantom", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv([
        "review",
        "--type",
        "wave",
        "--tasks",
        "1",
        "--plan",
        plan,
      ]);
      expect(code).toBe(1);
      expect(io.stderrText).toContain("the open wave is at implement");
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      expect(existsSync(path.join(workspace, "tasks-1-implement.json"))).toBe(false);
      expect(existsSync(path.join(workspace, "progress.json"))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("a BLOCKED dispatch exits 1 with the capsule (the round outcome rides the face)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: async () => ({ status: "BLOCKED" }),
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
      expect(code).toBe(1);
      expect(io.stdoutText).toContain("status: BLOCKED");
    } finally {
      cleanup();
    }
  });

  it("a TIMEOUT dispatch — the failure face: exit 1, NO next: line, and progress's timeoutCount increments (§4.2/§4.3)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: async () => ({
        status: "TIMEOUT",
        termination: { cause: "stalled", idleMs: 1, lastSample: null },
      }),
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      expect(ledger.counterOf("timeoutCount")).toBe(0);
      const code = await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
      // The failure face — exit 1 with the capsule naming the TIMEOUT status…
      expect(code).toBe(1);
      expect(io.stdoutText).toContain("status: TIMEOUT");
      // …and NO next: line (the frozen failure face — a hung round never auto-retries).
      expect(io.stdoutText).not.toContain("next:");
      // §4.2 — the terminated round landed, the counter's only writer fired.
      expect(ledger.counterOf("timeoutCount")).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("a terminated round concluding non-failed still increments timeoutCount and exits 0 — the counter reads the termination fact, not the status word", async () => {
    const { command, repoRoot, cleanup } = fixture({
      dispatch: async () => ({
        status: "APPROVED",
        termination: { cause: "over-budget", idleMs: 5, lastSample: null },
      }),
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      const code = await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
      expect(code).toBe(0);
      expect(ledger.counterOf("timeoutCount")).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("dogfood §2.8 — a rejected fix round with a leftover APPROVED draft renders NO next: line (the verdict is single-sourced; a stale draft is never read back)", async () => {
    // The round-verdict single-source pin: the child's fix write is REJECTED (the
    // round stays BLOCKED and unrecorded), yet a stale APPROVED draft sits on disk
    // at the fix path. The pre-fix engine re-read that draft from disk and rendered
    // the self-contradictory `status: BLOCKED · next: done`; the gated round-read
    // (§2.8) returns null for the unrecorded round → no next: line.
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: async () => ({ status: "BLOCKED" }),
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      // a recorded implement + blocker review round → the line awaits its fix
      ledger.recordRound(1, "implement");
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "1", round: 1 },
        {
          tasks: [1],
          phase: "review",
          findings: [{ severity: "blocker", summary: "drift" }],
        },
      );
      ledger.recordRound(1, "review");
      // the stale "successful-looking" fix draft the rejected child left behind — it
      // must NOT be read back as the round's verdict
      writeFileSync(
        path.join(workspace.path, "tasks-1-fix-1.json"),
        JSON.stringify({ status: "APPROVED", findings: [] }),
        "utf8",
      );
      const code = await command.runArgv(["fix", "--type", "wave", "--tasks", "1", "--plan", plan]);
      expect(code).toBe(1);
      expect(io.stdoutText).toContain("status: BLOCKED");
      // the verdict single-source face — zero next: line (the unrecorded round holds
      // no route; the stale draft is never consulted)
      expect(io.stdoutText).not.toContain("next: done");
      expect(io.stdoutText).not.toMatch(/^next:/m);
    } finally {
      cleanup();
    }
  });

  it("the WaveGate blocks the three verbs against a split/subset request (v1.21)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      // Two no-dependency tasks open the single root wave {1,2} — a half-wave request
      // (review 1 alone / fix 2 alone) is the structural subset the gate refuses.
      const planPath = independentPlan(repoRoot, "two.md", 2);
      io.stderrText = "";
      // review of a subset {1} while the wave sits at {1,2} → the split BLOCK (review is
      // gated like implement — the half-wave review is structurally refused)
      expect(
        await command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", planPath]),
      ).toBe(1);
      expect(io.stderrText).toContain("splits/mismatches the derived wave");
      io.stderrText = "";
      // fix of a subset {2} before its implement → the split BLOCK (fix shares the gate)
      expect(
        await command.runArgv(["fix", "--type", "wave", "--tasks", "2", "--plan", planPath]),
      ).toBe(1);
      expect(io.stderrText).toContain("splits/mismatches the derived wave");
    } finally {
      cleanup();
    }
  });

  it("a multi-task wave's phase reads the WAVE row — review passes, re-implement wrong-phases (v1.28)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const planPath = independentPlan(repoRoot, "two.md", 2, "two");
      // the WAVE row carries the implement round — review is the open phase for the whole
      // wave (the retired per-task build could never hold a mixed-phase wave-unitary row).
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "two").ensure();
      new Ledger(workspace, new ConfigLoader()).recordRound("1,2", "implement");
      io.stderrText = "";
      // review on the implemented multi-task wave passes the gate (the preview renders).
      expect(
        await command.runArgv([
          "review",
          "--type",
          "wave",
          "--tasks",
          "1,2",
          "--plan",
          planPath,
          "--dry-run",
        ]),
      ).toBe(0);
      // a re-implement on the at-review wave is the wrong-phase BLOCK, not a silent split.
      io.stderrText = "";
      expect(
        await command.runArgv(["implement", "--tasks", "1,2", "--plan", planPath, "--dry-run"]),
      ).toBe(1);
      expect(io.stderrText).toContain("at review");
    } finally {
      cleanup();
    }
  });

  it("an approved implement round routes its review hop — no commit identity gates the next: line", async () => {
    // The sha era gated the implement→review route on the round's commits (`commits?.base
    // === undefined → null`), so an approved-without-commits round produced a null route
    // and tripped the v1.20 no-next hard error. The commit carrier is retired (spec §2.6):
    // implement now ALWAYS routes `{ kind: "review" }` — the live tree needs no sha — so
    // the same approved round yields its review hop, exit 0.
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: APPROVING,
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED");
      expect(io.stdoutText).toContain(
        `next: review --type wave --tasks 1 --plan ${path.relative(repoRoot, plan)}`,
      );
      expect(io.stderrText).not.toContain("CDD_BLOCKED:");
    } finally {
      cleanup();
    }
  });

  it("the clean-tree gate blocks the three verbs on a dirty tree — CDD_BLOCKED · guidance · child zero (P4.1 T1)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: APPROVING, // a spy — must never run on a dirty tree
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      // Dirty the fixture tree — a tracked change + an untracked file.
      writeFileSync(path.join(repoRoot, "seed.txt"), "modified\n", "utf8");
      for (const verb of ["implement", "review", "fix"] as const) {
        io.stderrText = "";
        io.stdoutText = "";
        const args =
          verb === "implement"
            ? ["implement", "--tasks", "1", "--plan", plan]
            : verb === "review"
              ? ["review", "--type", "wave", "--tasks", "1", "--plan", plan]
              : ["fix", "--type", "wave", "--tasks", "1", "--plan", plan];
        const code = await command.runArgv([...args, "--dry-run"]);
        expect(code).toBe(1);
        // the CDD_BLOCKED channel + the commit/discard guidance
        expect(io.stderrText).toContain("CDD_BLOCKED:");
        expect(io.stderrText).toContain("commit or discard");
        // child zero dispatch — no round artifacts ever land
        const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
        expect(existsSync(path.join(workspace, "progress.json"))).toBe(false);
        expect(existsSync(path.join(workspace, "tasks-1-brief.md"))).toBe(false);
      }
    } finally {
      cleanup();
    }
  });

  it("renders the checked face on BOTH pre-flight paths — approved and refused (P21 §3.4)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      // ① the approved path: the heading, the gates that ran in order, then one row
      //    per declared rule — "which rule ran" is on the dispatch face, not a test field.
      expect(await command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(0);
      expect(io.stderrText.startsWith("checked:\n  tree-clean\n  graph\n  plan-ledger\n")).toBe(
        true,
      );
      expect(io.stderrText).toContain("  plan-ledger: info (plan leads ledger by 1 tasks)\n");
      expect(io.stderrText).toContain("  wave\n  presence: skipped (no doc target)\n");
      expect(io.stderrText).toContain("  planned-tasks-vs-recorded-tasks: passed\n");
      expect(
        io.stderrText.split("\n").filter((line) => line.endsWith(": skipped (no doc target)")),
      ).toHaveLength(19);

      // ② the refused path: the same face after the BLOCK wording + its details
      writeFileSync(path.join(repoRoot, "seed.txt"), "modified\n", "utf8");
      io.stderrText = "";
      expect(await command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED:");
      expect(
        io.stderrText.includes("checked:\n  tree-clean\n  presence: skipped (no doc target)\n"),
      ).toBe(true);
      expect(io.stderrText).toContain(
        "  closed-wave-fits-depends-on-layers: skipped (no ledger facts)\n",
      );
    } finally {
      cleanup();
    }
  });

  it("P4.1 F1 (real run) — a consumer repo WITHOUT a .kairos gitignore does not self-BLOCK the clean-tree gate across dispatches", async () => {
    // The consumer-repo shape: no `.kairos` entry in the fixture .gitignore — the
    // real run's workspace ensure self-publishes `.kairos/cdd/.gitignore` (content
    // `*`) at its first write point, BEFORE the next dispatch's gate reads the tree,
    // so the engine's own writes (the workspace + the round artifacts) land under
    // its keep-out marker — git's judgment stays clean, and the gate refuses only
    // genuinely dirty user work (never the engine's own outputs).
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot, "/docs/\n");
      const plan = conformingPlan(repoRoot);
      const implement = await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
      expect(implement).toBe(0);
      // the first dispatch landed the engine workspace + its self-published keep-out
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3"))).toBe(true);
      expect(readFileSync(path.join(repoRoot, ".kairos", ".gitignore"), "utf8")).toBe("*\n");
      // the brief the first dispatch rendered from the current plan is on disk
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3", "tasks-1-brief.md"))).toBe(
        true,
      );
      io.stderrText = "";
      // the SECOND dispatch must not self-BLOCK on the engine's own artifacts
      const review = await command.runArgv([
        "review",
        "--type",
        "wave",
        "--tasks",
        "1",
        "--plan",
        plan,
      ]);
      expect(review).toBe(0);
      expect(io.stderrText).not.toContain("CDD_BLOCKED:");
    } finally {
      cleanup();
    }
  });

  it("P4.1 F1 (preview leg) — the `--dry-run` chain writes nothing and consumes no round, so the review preview is never refused", async () => {
    // The preview's zero-write face on the same consumer-repo shape: `.kairos/` never
    // appears, the tree stays byte-identical, and because the implement preview books
    // no round the review preview still renders (no round consumed — the chained
    // command is not refused by the phase gate).
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot, "/docs/\n");
      const plan = conformingPlan(repoRoot);
      const implement = await command.runArgv([
        "implement",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
      ]);
      expect(implement).toBe(0);
      expect(io.stdoutText.startsWith("cdd implement: preview (no repo changes)\n")).toBe(true);
      expect(existsSync(path.join(repoRoot, ".kairos"))).toBe(false);
      io.stdoutText = "";
      // the review preview: the implement preview left no ledger row, so the same
      // wave is still open at implement — the real run's phase gate would refuse it,
      // and the preview reports that refusal verbatim (pre-flight gates still run).
      const review = await command.runArgv([
        "review",
        "--type",
        "wave",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
      ]);
      expect(review).toBe(1);
      expect(io.stderrText).toContain("the open wave is at implement");
      expect(io.stdoutText).toBe("");
      // zero writes across both previews — the chain never materialized the workspace
      expect(existsSync(path.join(repoRoot, ".kairos"))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("the materialized implement carrier on disk carries zero findings keys — the work face's zero-findings write path (T2)", async () => {
    const { command, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
      expect(code).toBe(0);
      const carrier = JSON.parse(
        readFileSync(path.join(repoRoot, ".kairos", "cdd", "p3", "tasks-1-implement.json"), "utf8"),
      ) as Record<string, unknown>;
      expect("findings" in carrier).toBe(false);
      expect(Object.keys(carrier)).not.toContain("findings");
    } finally {
      cleanup();
    }
  });

  it("T6 — probe A: the end-to-end implement + fix final carriers carry zero findings keys — both work-face materialization legs (implement + wave fix)", async () => {
    const { command, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      // the implement leg — the injected dispatch persists the work-face final carrier
      expect(await command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(0);
      const implementCarrier = JSON.parse(
        readFileSync(path.join(repoRoot, ".kairos", "cdd", "p3", "tasks-1-implement.json"), "utf8"),
      ) as Record<string, unknown>;
      expect("findings" in implementCarrier).toBe(false);
      expect(Object.keys(implementCarrier)).not.toContain("findings");
      // the fix leg — seed the blocker source review (the C5-1 fix input) so the fix
      // dispatch reads a finding-bearing review carrier back and still lands its
      // final carrier on the work face (the fix-will-not-mirror-findings probe)
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "1", round: 1 },
        {
          tasks: [1],
          phase: "review",
          findings: [{ severity: "blocker", summary: "drift" }],
        },
      );
      ledger.recordRound(1, "review");
      expect(await command.runArgv(["fix", "--type", "wave", "--tasks", "1", "--plan", plan])).toBe(
        0,
      );
      const fixCarrier = JSON.parse(
        readFileSync(path.join(repoRoot, ".kairos", "cdd", "p3", "tasks-1-fix-1.json"), "utf8"),
      ) as Record<string, unknown>;
      expect("findings" in fixCarrier).toBe(false);
      expect(Object.keys(fixCarrier)).not.toContain("findings");
    } finally {
      cleanup();
    }
  });

  it("a command word is not a schema type — `schema get board` carries no route and no vocabulary row", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "get", "board"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("unknown schema type: board");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P4.1 T4 — the complete executable next literal (v1.39 semantic reversal):
// the `next:` line IS the dispatch (zero-error second parse · done never fed to parse ·
// routeWords sync · implement without --type)
// ---------------------------------------------------------------------------

describe("P4.1 T4 — the next literal is a complete executable command (zero-error second parse)", () => {
  /** The next text of a capsule emit (the second line, station prefix stripped). */
  function literalOf(route: Route, target?: RouteTarget): string {
    const lines = new Capsule(new Words()).emit("APPROVED", "0", "/h.json", route, target);
    return lines[1]!.slice("next: ".length);
  }

  /** The parseable argv of a literal — the fix readback suffix is prompt prose,
   *  never argv (the parse gate strips the declared suffix before feeding). */
  function argvOf(literal: string): string[] {
    return literal
      .replace(new RegExp(`\\s*\\(${FIX_READBACK_SUFFIX.slice(1, -1)}\\)$`), "")
      .split(/\s+/);
  }

  /** The secondary-parse gate — the literal's argv must parse with zero errors
   *  (the same commander program the runArgv dispatch reads; `Cli#parse()`
   *  retired at T3). */
  function parses(literal: string): void {
    expect(() =>
      new CommandTreeBuilder().program.parse(argvOf(literal), { from: "user" }),
    ).not.toThrow();
  }

  const wave = { type: "wave", id: "1,2", plan: "docs/kairos/plans/p3.md" } as const;
  const spec = { type: "spec", id: "docs/kairos/specs/p3-design.md" } as const;
  const planT = { type: "plan", id: "docs/kairos/plans/p3.md" } as const;
  // the branch target carries the workspace --plan only — the review judges the
  // live tree, so no range rides the command (spec §2.3/§2.6)
  const branch = {
    type: "branch",
    id: "branch",
    plan: "docs/kairos/plans/p3.md",
  } as const;

  it("implement — the literal is `implement --plan <path> --tasks <n>` with NO --type", () => {
    const literal = literalOf({ kind: "next-wave", tasks: "1,2" }, wave);
    expect(literal).toBe("implement --plan docs/kairos/plans/p3.md --tasks 1,2");
    expect(literal).not.toContain("--type");
    parses(literal);
    // the declaration needs no new `--type` key — the default-type semantics stand
    const specOf = CLI_COMMANDS.find((command) => command.name === "implement")!;
    expect(specOf.keys.some((key) => key.key === "type")).toBe(false);
  });

  it("review × 4 types — `review --type <type> <type-arg>` parses", () => {
    // find #7 (P4.1 T7): the wave review literal carries its runtime-required `--plan`
    // (the W3 dispatch gap — `review --type wave --tasks 5` parsed green yet refused
    // at run time with `required option '--plan <path>' not specified`); the full
    // coverage table lives in capsule.test.ts (the design §5.6 parse-green ⇒ full
    // required-flag coverage rule).
    const waveLiteral = literalOf({ kind: "review" }, wave);
    expect(waveLiteral).toBe("review --type wave --tasks 1,2 --plan docs/kairos/plans/p3.md");
    parses(waveLiteral);
    const specLiteral = literalOf({ kind: "review" }, spec);
    expect(specLiteral).toBe("review --type spec --spec docs/kairos/specs/p3-design.md");
    parses(specLiteral);
    const planLiteral = literalOf({ kind: "review" }, planT);
    expect(planLiteral).toBe("review --type plan --plan docs/kairos/plans/p3.md");
    parses(planLiteral);
    const branchLiteral = literalOf({ kind: "review" }, branch);
    // the branch review literal carries the workspace --plan only — the live tree
    // needs no SHA range (spec §2.3/§2.6)
    expect(branchLiteral).toBe("review --type branch --plan docs/kairos/plans/p3.md");
    parses(branchLiteral);
  });

  it("fix × 4 types — `fix --type <type> <type-arg> --reviews <handoff>` parses", () => {
    const waveLiteral = literalOf({ kind: "fix", reviews: "tasks-1-review-1.json" }, wave);
    expect(waveLiteral).toBe(
      "fix --type wave --tasks 1,2 --plan docs/kairos/plans/p3.md --reviews tasks-1-review-1.json " +
        FIX_READBACK_SUFFIX,
    );
    parses(waveLiteral);
    const specLiteral = literalOf({ kind: "fix", reviews: "s1-review-1.json" }, spec);
    expect(specLiteral).toBe(
      "fix --type spec --spec docs/kairos/specs/p3-design.md --reviews s1-review-1.json " +
        FIX_READBACK_SUFFIX,
    );
    parses(specLiteral);
    const planLiteral = literalOf({ kind: "fix", reviews: "p1-review-1.json" }, planT);
    expect(planLiteral).toBe(
      `fix --type plan --plan docs/kairos/plans/p3.md --reviews p1-review-1.json ${FIX_READBACK_SUFFIX}`,
    );
    parses(planLiteral);
    const branchLiteral = literalOf({ kind: "fix", reviews: "br1-review-1.json" }, branch);
    // find #8 F1b — the branch fix literal carries the workspace --plan
    // (user-decided; the orchestrator provides zero fallback · spec §5.7 fix (2))
    expect(branchLiteral).toBe(
      `fix --type branch --plan docs/kairos/plans/p3.md --reviews br1-review-1.json ${FIX_READBACK_SUFFIX}`,
    );
    parses(branchLiteral);
  });

  it("done — the bare terminal word, never fed to parse (a bare `done` is not a command)", async () => {
    expect(literalOf({ kind: "done" })).toBe("done");
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["done"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: unknown command 'done'");
    } finally {
      cleanup();
    }
  });

  it("routeWords sync — the four literal verbs ARE the four route classifier words", () => {
    const words = new Words();
    expect(literalOf({ kind: "next-wave", tasks: "1" }, wave)).toMatch(
      new RegExp(`^${words.routeWord("implement")} `),
    );
    expect(literalOf({ kind: "review" }, wave)).toMatch(
      new RegExp(`^${words.routeWord("review")} `),
    );
    expect(literalOf({ kind: "fix", reviews: "f.json" }, wave)).toMatch(
      new RegExp(`^${words.routeWord("fix")} `),
    );
    expect(literalOf({ kind: "done" })).toBe(words.routeWord("done"));
  });
});

describe("P4.1 T4 — the real chain: next literals dispatch the next round (rev1→implement wave 2 · rev2→done)", () => {
  it("implement→review(fix)→fix(closure)→implement wave 2→review→done — every next literal re-dispatches", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: async (frame: OpenFrame) => {
        // the first review finds a warn (one-way fix hop); everything else approves
        return frame.phase === "review" && frame.params.tasks === "1"
          ? {
              status: "CHANGES_REQUESTED",
              findings: [{ severity: "warn", summary: "drift" }],
            }
          : { status: "APPROVED" };
      },
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot, 2);
      const planRel = path.relative(repoRoot, plan);
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      const nextOf = (): string | null => {
        const m = io.stdoutText.match(/^next: (.+)$/m);
        return m === null ? null : m[1]!;
      };

      // rev 1 — implement wave 1 → the review literal
      expect(await command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(0);
      expect(nextOf()).toBe(`review --type wave --tasks 1 --plan ${planRel}`);
      io.stdoutText = "";

      // the review finds a warn → the fix literal
      expect(
        await command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", plan]),
      ).toBe(0);
      expect(nextOf()).toBe(
        `fix --type wave --tasks 1 --plan ${planRel} --reviews ${path.relative(repoRoot, path.join(workspace, "tasks-1-review-1.json"))} ${FIX_READBACK_SUFFIX}`,
      );
      io.stdoutText = "";

      // the fix closes (warn-only input) → rev1 lands on the NEXT WAVE's implement literal
      expect(await command.runArgv(["fix", "--type", "wave", "--tasks", "1", "--plan", plan])).toBe(
        0,
      );
      expect(nextOf()).toBe(`implement --plan ${planRel} --tasks 2`);
      io.stdoutText = "";

      // rev 2 — implement wave 2 → the review literal
      expect(await command.runArgv(["implement", "--tasks", "2", "--plan", plan])).toBe(0);
      expect(nextOf()).toBe(`review --type wave --tasks 2 --plan ${planRel}`);
      io.stdoutText = "";

      // the final review closes the run → rev2 lands on the wave→branch wiring
      // literal (T3 deliberate pin break — the PIPELINE_NEXT.wave route)
      expect(
        await command.runArgv(["review", "--type", "wave", "--tasks", "2", "--plan", plan]),
      ).toBe(0);
      expect(nextOf()).toBe(`review --type branch --plan ${planRel}`);

      const progress = readJson<{ waves: unknown[] }>(path.join(workspace, "progress.json"));
      // the wave-2 row carries its own D30 revision record — the final APPROVED
      // review bound wave 2's BRIEF to its line (the same brief-revision write-back)
      expect(progress.waves).toContainEqual({
        wave: "2",
        rounds: { implement: [1], review: [1] },
        reviewedRevision: briefRevision(repoRoot, plan, "2"),
        // P21 §5.1 — the closure-time plan-task snapshot (the append-vs-stall fact).
        planTasks: [1, 2],
      });
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the pure commands — schema / issue / base (the dry-run E2E surface)
// ---------------------------------------------------------------------------

describe("the pure commands — schema / issue / base", () => {
  it("schema get <plan> — the derived doc-structure schema to stdout", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "get", "plan"]);
      expect(code).toBe(0);
      const schema = JSON.parse(io.stdoutText) as {
        docType: string;
        properties: Record<string, unknown>;
        required: string[];
      };
      expect(schema.docType).toBe("plan");
      expect(schema.properties["### Task N:"]).toBeDefined();
      expect(schema.required).toContain("### Task N:");
      expect(schema.required.length).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  it("schema get — an unknown type exits 2 with the derived vocabulary", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "get", "bogus"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "unknown schema type: bogus (available: overall, plan, phase-spec, single-spec)",
      );
    } finally {
      cleanup();
    }
  });

  it("schema get phase-spec --output skeleton <target> — the derived doc skeleton written directly into the target document", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const target = path.join(repoRoot, "docs", "skeleton.md");
      mkdirSync(path.dirname(target), { recursive: true });
      const code = await command.runArgv([
        "schema",
        "get",
        "phase-spec",
        "--output",
        "skeleton",
        target,
      ]);
      expect(code).toBe(0);
      // the D19 in-place scaffold — the target doc carries the structural bytes
      // (headings, numeric truths, fills, the version row, the change-history
      // first row) the old stdout face emitted, and the path prints to stdout
      const text = readFileSync(target, "utf8");
      expect(text).toContain("## Design");
      expect(text).toContain("### 1. :::fill group-title");
      expect(text).toContain("- `:::fill acceptance-entry`");
      // the front-matter head — the doc-type/version/status truth keys
      expect(text).toContain("doc-type: phase-spec");
      expect(text).toContain("version: v0.1");
      expect(text).toContain("status: Draft");
      expect(text).toContain("| v0.1 | ");
      // the written doc ends with exactly one newline — the EOF rule (render()
      // never appends; the D19 write path appends the single `\n`)
      expect(text.endsWith("\n")).toBe(true);
      expect(text.endsWith("\n\n")).toBe(false);
      // the echoed path is the repoRoot-relative shape (D47 · §2.13)
      expect(io.stdoutText.trim()).toBe(path.relative(repoRoot, target));
    } finally {
      cleanup();
    }
  });

  it("schema get single-spec — the fourth doc-type channel: the json render without a target, the skeleton render into a required target", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      // the json render face — the derived single-spec declaration, no target
      let code = await command.runArgv(["schema", "get", "single-spec"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain('"docType": "single-spec"');
      expect(io.stdoutText).toContain('"## Background & root cause"');
      io.stdoutText = "";
      // the skeleton render face — the lightweight scaffold written DIRECTLY into
      // the target (the P5 conditional-required target mechanism)
      const target = path.join(repoRoot, "docs", "single-spec-skeleton.md");
      mkdirSync(path.dirname(target), { recursive: true });
      code = await command.runArgv([
        "schema",
        "get",
        "single-spec",
        "--output",
        "skeleton",
        target,
      ]);
      expect(code).toBe(0);
      const text = readFileSync(target, "utf8");
      // the head key set without the phase-spec's `program:` key
      expect(text).toContain("---");
      expect(text).toContain("doc-type: single-spec");
      expect(text).toContain("version: v0.1");
      expect(text).toContain("slug: ':::fill slug'");
      expect(text).toContain("status: Draft");
      expect(text).toContain("author: ':::fill author'");
      expect(text).not.toContain("program:");
      // the prose `:::fill` body + the change-history lineage — no `### N.` outline
      expect(text).toContain("## Background & root cause");
      expect(text).toContain(":::fill background-root-cause");
      expect(text).toContain("## Design decisions");
      expect(text).toContain("## Acceptance");
      expect(text).toContain("## Constraints");
      expect(text).not.toContain("### N.");
      expect(text).toContain("## Change history");
      expect(text).toContain("| v0.1 | ");
      // the written doc ends with exactly one newline — the EOF rule
      expect(text.endsWith("\n")).toBe(true);
      expect(text.endsWith("\n\n")).toBe(false);
      // the echoed path is the repoRoot-relative shape (D47 · §2.13)
      expect(io.stdoutText.trim()).toBe(path.relative(repoRoot, target));
      // a missing <target> under --output skeleton exits 2 with the conditional-required byte
      io.stderrText = "";
      code = await command.runArgv(["schema", "get", "single-spec", "--output", "skeleton"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("cdd schema get --output skeleton: missing <target>");
    } finally {
      cleanup();
    }
  });

  it("schema get --output skeleton — the phaseSpec alias renders byte-identical to the DocType literal", async () => {
    const dash = fixture();
    const camel = fixture();
    try {
      gitInit(dash.repoRoot);
      gitInit(camel.repoRoot);
      const dashTarget = path.join(dash.repoRoot, "dash.md");
      const camelTarget = path.join(camel.repoRoot, "camel.md");
      expect(
        await dash.command.runArgv([
          "schema",
          "get",
          "phase-spec",
          "--output",
          "skeleton",
          dashTarget,
        ]),
      ).toBe(0);
      expect(
        await camel.command.runArgv([
          "schema",
          "get",
          "phaseSpec",
          "--output",
          "skeleton",
          camelTarget,
        ]),
      ).toBe(0);
      expect(readFileSync(camelTarget, "utf8")).toBe(readFileSync(dashTarget, "utf8"));
    } finally {
      dash.cleanup();
      camel.cleanup();
    }
  });

  it("schema get — the bare call keeps its missing-type byte; the kebab spelling and the legacy alias render the same derived JSON; the default --output is json", async () => {
    const bare = fixture();
    expect(await bare.command.runArgv(["schema", "get"])).toBe(2);
    // the get leaf's missing-type byte is unchanged — the parse-level required
    // positional face (commander's native missing-required-argument error)
    expect(bare.io.stderrText).toContain("error: missing required argument 'type'");
    bare.cleanup();
    const literal = fixture();
    expect(await literal.command.runArgv(["schema", "get", "phase-spec"])).toBe(0);
    expect(JSON.parse(literal.io.stdoutText).docType).toBe("phase-spec");
    // the legacy alias normalizes to the same kebab key — byte-identical output
    const alias = fixture();
    expect(await alias.command.runArgv(["schema", "get", "phaseSpec"])).toBe(0);
    expect(alias.io.stdoutText).toBe(literal.io.stdoutText);
    alias.cleanup();
    // D19 — the --output default is json: a bare `schema get <type>` (no --output)
    // stays legal and byte-identical to the explicit json render face
    const json = fixture();
    expect(await json.command.runArgv(["schema", "get", "phase-spec", "--output", "json"])).toBe(0);
    expect(json.io.stdoutText).toBe(literal.io.stdoutText);
    json.cleanup();
    literal.cleanup();
  });

  it("issue render — stdin findings JSON → the aggregate body on stdout (the subcommand face)", async () => {
    const input = {
      harness: "claude",
      findings: [
        {
          type: "bug",
          lang: "en",
          context: "c",
          problem: "p",
          impact: "i",
          suggestedFix: "f",
          meta: { skill: "cdd-dev", step: "implement" },
        },
      ],
      related: {
        open: [{ issue: 1, component: "cdd", reason: "dup" }],
        closed: [{ issue: 9 }],
        program: { issue: 2 },
      },
    };
    const { command, io, cleanup } = fixture({ stdinRead: () => JSON.stringify(input) });
    try {
      const code = await command.runArgv(["issue", "render"]);
      expect(code).toBe(0);
      // the subcommand face — the body and a label land on stdout (the renderer's
      // own deep suite — labels/langs/dedup — lives in render/__tests__/render.test.ts)
      expect(io.stdoutText).toContain("# CDD aggregate issue");
      expect(io.stdoutText).toContain("- Harness: claude");
      expect(io.stdoutText).toContain("## Context\n\nc");
    } finally {
      cleanup();
    }
  });

  it("issue render — malformed / invalid input exits 1 with the field path", async () => {
    const bad = fixture({ stdinRead: () => "not-json" });
    expect(await bad.command.runArgv(["issue", "render"])).toBe(1);
    expect(bad.io.stderrText).toContain("invalid input JSON");
    bad.cleanup();
    const invalid = fixture({
      stdinRead: () => JSON.stringify({ harness: "claude", findings: [] }),
    });
    expect(await invalid.command.runArgv(["issue", "render"])).toBe(1);
    expect(invalid.io.stderrText).toContain("findings");
    invalid.cleanup();
  });

  it("base set/get — the single --plan artifact write-through + the force gate (T20 face)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const setCode = await command.runArgv([
        "base",
        "set",
        "--plan",
        plan,
        "--base",
        "develop",
        "--source",
        "plan-field",
      ]);
      expect(setCode).toBe(0);
      expect(io.stdoutText).toContain("base.json");
      // T18 (§2.13) — the `base set` echo is the repoRoot-relative shape, never the
      // absolute artifact path the write used.
      expect(io.stdoutText).not.toContain(repoRoot);
      expect(io.stdoutText.trim()).toBe(
        path.join(".kairos", "cdd", "p3", "base.json").replaceAll(path.sep, "/"),
      );
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      const artifact = readJson<{ base: string; source: string }>(
        path.join(workspace, "base.json"),
      );
      expect(artifact.base).toBe("develop");
      expect(artifact.source).toBe("plan-field");
      io.stdoutText = "";
      const getCode = await command.runArgv(["base", "get", "--plan", plan]);
      expect(getCode).toBe(0);
      expect(io.stdoutText).toContain('"base": "develop"');
      const conflict = await command.runArgv([
        "base",
        "set",
        "--plan",
        plan,
        "--base",
        "main",
        "--source",
        "plan-field",
      ]);
      expect(conflict).toBe(2);
      expect(io.stderrText).toContain("--force");
      io.stderrText = "";
      const forced = await command.runArgv([
        "base",
        "set",
        "--plan",
        plan,
        "--base",
        "main",
        "--source",
        "user-confirmed",
        "--force",
      ]);
      expect(forced).toBe(0);
      const getMissing = await command.runArgv([
        "base",
        "get",
        "--plan",
        "docs/kairos/plans/missing.md",
      ]);
      // An unreadable plan carries no identity: the key has no source, so `base`
      // refuses on the dispatch carrier (CDD_BLOCKED + exit 1) — never a
      // filename-derived key. The artifact-side missing/corrupt face (exit 2) is
      // pinned separately, over a plan document that IS on disk.
      expect(getMissing).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P11 T3 — the write-point single authority: scene assembly never builds the
// workspace (the first real write owns it) and the base artifact read rides the
// SAME normalization path as its write.
// ---------------------------------------------------------------------------

describe("P11 T3 — the workspace write-point + the base read normalization", () => {
  it("a READ-ONLY `cdd base get` on a fresh repo writes nothing (no .kairos/)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv(["base", "get", "--plan", plan]);
      // the artifact is absent — the read reports it (exit 2) and builds nothing
      expect(code).toBe(2);
      expect(io.stderrText).toContain("missing or corrupt base artifact");
      expect(existsSync(path.join(repoRoot, ".kairos"))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("`cdd base get` reports a legacy ABSOLUTE `plan` field in the repoRoot-relative shape (the read normalization covers base.json)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const absolutePlan = path.join(repoRoot, "docs", "kairos", "plans", "p3.md");
      writeFileSync(
        path.join(workspace.path, "base.json"),
        `${JSON.stringify(
          { base: "develop", source: "plan-field", plan: absolutePlan, recordedAt: "t" },
          null,
          2,
        )}\n`,
        "utf8",
      );
      const code = await command.runArgv(["base", "get", "--plan", plan]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain('"plan": "docs/kairos/plans/p3.md"');
      expect(io.stdoutText).not.toContain(repoRoot);
    } finally {
      cleanup();
    }
  });

  it("`cdd base get` treats a non-object base.json as corrupt (exit 2, never a throw)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      // the literal `null` is valid JSON but no base artifact — the read stays total
      writeFileSync(path.join(workspace.path, "base.json"), "null\n", "utf8");
      const code = await command.runArgv(["base", "get", "--plan", plan]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("missing or corrupt base artifact");
    } finally {
      cleanup();
    }
  });

  it("a fresh repo's first REAL dispatch builds `.kairos/<slug>/` + publishes `.kairos/.gitignore` BEFORE the child spawns — every face (wave / spec / plan / branch)", async () => {
    const cases: { face: string; slug: string; argv: (plan: string, spec: string) => string[] }[] =
      [
        {
          face: "wave",
          slug: "p3",
          argv: (plan) => ["implement", "--tasks", "1", "--plan", plan],
        },
        {
          face: "branch",
          slug: "p3",
          argv: (plan) => ["review", "--type", "branch", "--plan", plan],
        },
        {
          face: "spec",
          slug: "s1",
          argv: (_plan, spec) => ["review", "--type", "spec", "--spec", spec],
        },
        {
          face: "plan",
          slug: "p3",
          argv: (plan) => ["review", "--type", "plan", "--plan", plan],
        },
      ];
    for (const entry of cases) {
      // The spawn-time observations — read INSIDE the dispatch seam, before the
      // round's bookkeeping could build anything. An after-the-run existsSync
      // cannot discriminate (the bookkeep's own writeJson ensures internally), so
      // the assertion has to sit at the child-spawn boundary itself.
      let workspaceAtSpawn = false;
      let keepOutAtSpawn = false;
      const { command, repoRoot, cleanup } = fixture({
        dispatch: async () => {
          workspaceAtSpawn = existsSync(path.join(repoRoot, ".kairos", "cdd", entry.slug));
          const keepOut = path.join(repoRoot, ".kairos", ".gitignore");
          keepOutAtSpawn = existsSync(keepOut) && readFileSync(keepOut, "utf8") === "*\n";
          return { status: "APPROVED" };
        },
      });
      try {
        gitInit(repoRoot);
        const plan = conformingPlan(repoRoot);
        const spec = conformingSpec(repoRoot);
        // scene assembly builds nothing — the workspace is absent before the run
        expect(existsSync(path.join(repoRoot, ".kairos")), `${entry.face}: pre-run`).toBe(false);
        const code = await command.runArgv(entry.argv(plan, spec));
        expect(code, `${entry.face}: dispatch exited ${code}`).toBe(0);
        expect(workspaceAtSpawn, `${entry.face}: workspace absent at spawn`).toBe(true);
        expect(keepOutAtSpawn, `${entry.face}: keep-out marker absent at spawn`).toBe(true);
      } finally {
        cleanup();
      }
    }
  });

  it("a fresh repo's first REAL dispatch builds the workspace + renders the brief (zero ENOENT)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: APPROVING,
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      // scene assembly builds nothing — the workspace is absent before the run
      expect(existsSync(path.join(repoRoot, ".kairos"))).toBe(false);
      const code = await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
      expect(code).toBe(0);
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      expect(existsSync(workspace)).toBe(true);
      expect(existsSync(path.join(workspace, "tasks-1-brief.md"))).toBe(true);
      expect(io.stderrText).not.toContain("ENOENT");
      // the namespace keep-out marker is published at the first write point
      expect(readFileSync(path.join(repoRoot, ".kairos", ".gitignore"), "utf8")).toBe("*\n");
    } finally {
      cleanup();
    }
  });
});

describe("T9 — the composition-root entry is the Cli.create static factory (deliberate pin)", () => {
  it("the module's composition root is the class static factory — zero bare-function entry", () => {
    // The P5 zero-bare-function closure locked the composition root's class form:
    // the sole entry is the Cli.create static factory, never a module-level `cli`
    // function (a regression trips this source-level pin — the deliberate T9 break).
    const src = readFileSync(new URL("../cli.ts", import.meta.url), "utf8");
    expect(src).toContain("static create(opts: CliOptions = {}): Cli");
    expect(src).not.toContain("export function cli");
    expect(src).not.toMatch(/^(export )?(async )?function /m);
  });

  it("Cli.create is a live factory — the default construction resolves a working Cli", async () => {
    const command = Cli.create();
    const exit = await command.runArgv([]);
    expect(exit).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// T6 — the dispatch surface: the workspace key is the target document's declared
// `slug:` (never a filename derivation); the plan/branch `INPUT_SPEC` is the
// same-slug identity document; a missing / illegal / duplicated slug is the
// CDD_BLOCKED dispatch face (exit 1) on `implement` / `review` / `fix` and on
// `base` (which carries no pre-flight gate — the same key, the same carrier).
// ---------------------------------------------------------------------------

describe("T6 — the dispatch surface reads the workspace key from `slug:`", () => {
  const writeDoc = (repoRoot: string, rel: string, lines: readonly string[]): string => {
    const file = path.join(repoRoot, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
    return file;
  };

  /** A dispatchable plan (head + one no-dep task) whose `slug:` is caller-chosen. */
  const slugPlan = (repoRoot: string, opts: { name?: string; slug?: string | null }): string => {
    const head = [
      "---",
      "title: Test Plan",
      "doc-type: plan",
      "version: v1.0",
      "date: 2026-10-09",
      ...(opts.slug === undefined || opts.slug === null ? [] : [`slug: ${opts.slug}`]),
      "---",
    ];
    return writeDoc(repoRoot, `docs/kairos/plans/${opts.name ?? "x-p1.md"}`, [
      ...head,
      "",
      "## Constraints",
      "",
      "- c",
      "",
      "### Task 1: a",
      "- **Objective**: o",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - s — checkable: g",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
    ]);
  };

  it("the workspace key is the declared `slug:`, not the file name (x-p1.md → custom-key)", async () => {
    const { command, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = slugPlan(repoRoot, { slug: "custom-key" });
      // A real run (the injected approving dispatch) — the workspace write is the
      // assertion surface (`--dry-run` is read-only by contract).
      await command.runArgv(["implement", "--tasks", "1", "--plan", plan]);
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "custom-key"))).toBe(true);
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "x-p1"))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("a plan without `slug:` is a dispatch BLOCK — exit 1, CDD_BLOCKED with the `slug:` wording", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const plan = slugPlan(repoRoot, { slug: null });
      io.stderrText = "";
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan])).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
      expect(io.stderrText).toContain("slug:");
    } finally {
      cleanup();
    }
  });

  it("a spec without `slug:` is a dispatch BLOCK — exit 1, CDD_BLOCKED with the `slug:` wording", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const spec = writeDoc(repoRoot, "docs/kairos/specs/no-slug-design.md", [
        "---",
        "title: S",
        "doc-type: phase-spec",
        "program: x-overall",
        "---",
      ]);
      io.stderrText = "";
      expect(await command.runArgv(["review", "--type", "spec", "--spec", spec])).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
      expect(io.stderrText).toContain("slug:");
    } finally {
      cleanup();
    }
  });

  it("two identity documents on one slug are a dispatch BLOCK — exit 1 on both --spec and --plan", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      const spec = writeDoc(repoRoot, "docs/kairos/specs/dup-design.md", [
        "---",
        "title: S",
        "doc-type: phase-spec",
        "slug: dup",
        "program: x-overall",
        "---",
      ]);
      writeDoc(repoRoot, "docs/kairos/specs/dup-copy.md", [
        "---",
        "title: Copy",
        "doc-type: phase-spec",
        "slug: dup",
        "program: x-overall",
        "---",
      ]);
      const plan = slugPlan(repoRoot, { name: "dup.md", slug: "dup" });
      io.stderrText = "";
      expect(await command.runArgv(["review", "--type", "spec", "--spec", spec])).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
      expect(io.stderrText.toLowerCase()).toContain("dup");
      io.stderrText = "";
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan])).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
      expect(io.stderrText.toLowerCase()).toContain("dup");
    } finally {
      cleanup();
    }
  });

  it("two plans on one slug are a dispatch BLOCK — exit 1, CDD_BLOCKED", async () => {
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: APPROVING });
    try {
      gitInit(repoRoot);
      writeDoc(repoRoot, "docs/kairos/specs/dup-design.md", [
        "---",
        "title: S",
        "doc-type: phase-spec",
        "slug: dup",
        "program: x-overall",
        "---",
      ]);
      const plan = slugPlan(repoRoot, { name: "dup-a.md", slug: "dup" });
      slugPlan(repoRoot, { name: "dup-b.md", slug: "dup" });
      io.stderrText = "";
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan])).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
    } finally {
      cleanup();
    }
  });

  it("a plan with NO `spec:` scalar still resolves INPUT_SPEC from the same-slug identity doc", async () => {
    const sync = new StubRunner();
    sync.stdout = "status: APPROVED\n";
    const { command, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      // A doc-contract-clean plan (it must pass the plan doc gate to dispatch),
      // renamed so the FILE NAME carries no relation to the slug: the plan header
      // carries no `spec:` scalar, so the anchor can only come from the index.
      const original = conformingPlan(repoRoot);
      const plan = path.join(repoRoot, "docs", "kairos", "plans", "unrelated-name.md");
      writeFileSync(plan, readFileSync(original, "utf8"), "utf8");
      rmSync(original);
      expect(readFileSync(plan, "utf8")).not.toContain("spec:");
      const saved = process.env.CLAUDE_CODE_SESSION_ID;
      process.env.CLAUDE_CODE_SESSION_ID = "s";
      try {
        await command.runArgv(["review", "--type", "plan", "--plan", plan]);
      } finally {
        if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
        else process.env.CLAUDE_CODE_SESSION_ID = saved;
      }
      const prompt =
        sync.calls[sync.calls.length - 1]!.args[sync.calls[sync.calls.length - 1]!.args.length - 1];
      expect(prompt).toContain("- `INPUT_SPEC`: docs/kairos/specs/p3-design.md");
    } finally {
      cleanup();
    }
  });

  it("base set/get share the workspace key — a declared `slug:` wins over the file name", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = slugPlan(repoRoot, { slug: "custom-key" });
      expect(
        await command.runArgv([
          "base",
          "set",
          "--plan",
          plan,
          "--base",
          "develop",
          "--source",
          "plan-field",
        ]),
      ).toBe(0);
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "custom-key", "base.json"))).toBe(
        true,
      );
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "x-p1"))).toBe(false);
      io.stdoutText = "";
      expect(await command.runArgv(["base", "get", "--plan", plan])).toBe(0);
      expect(io.stdoutText).toContain('"base": "develop"');
    } finally {
      cleanup();
    }
  });

  it("base set on a plan without `slug:` is a CDD_BLOCK — exit 1 (base carries no pre-flight gate)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = slugPlan(repoRoot, { slug: null });
      io.stderrText = "";
      expect(
        await command.runArgv([
          "base",
          "set",
          "--plan",
          plan,
          "--base",
          "develop",
          "--source",
          "plan-field",
        ]),
      ).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
      expect(io.stderrText).toContain("slug:");
      io.stderrText = "";
      expect(await command.runArgv(["base", "get", "--plan", plan])).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
    } finally {
      cleanup();
    }
  });

  it("base on an illegal `slug:` value is a CDD_BLOCK — exit 1", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = slugPlan(repoRoot, { slug: "../x" });
      io.stderrText = "";
      expect(
        await command.runArgv([
          "base",
          "set",
          "--plan",
          plan,
          "--base",
          "develop",
          "--source",
          "plan-field",
        ]),
      ).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
      expect(io.stderrText).toContain("slug:");
    } finally {
      cleanup();
    }
  });

  it("base on an unreadable plan is a CDD_BLOCK — exit 1, never a filename-derived key", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const ghost = path.join(repoRoot, "docs", "kairos", "plans", "ghost-plan.md");
      io.stderrText = "";
      expect(
        await command.runArgv([
          "base",
          "set",
          "--plan",
          ghost,
          "--base",
          "develop",
          "--source",
          "plan-field",
        ]),
      ).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
      expect(io.stderrText).toContain("unreadable");
      // The workspace key has no source — no filename-derived directory appears.
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "ghost-plan"))).toBe(false);
      io.stderrText = "";
      expect(await command.runArgv(["base", "get", "--plan", ghost])).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// T5 — `cdd board --plan/--spec <path>`: the pure-read observability command
// (no preflight gate, zero side effects). Three reject faces, all exit 2 and all
// distinguishable: argument conflict (two slugs), unresolvable entry (not-found,
// zero doc reads, zero BLOCKED markers), document violation (a line-level
// `(BLOCKED)` marker). The legal `(none)` degradations stay exit 0.
// ---------------------------------------------------------------------------

describe("T5 — cdd board --plan/--spec: the pure-read board command", () => {
  /** Write one doc under the fixture repo (created on demand). */
  const writeDoc = (repoRoot: string, rel: string, lines: readonly string[]): void => {
    const file = path.join(repoRoot, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
  };

  /** The canonical program fixture: overall, phase spec, and same-slug plan. */
  const seedPhaseDocs = (repoRoot: string): void => {
    writeDoc(repoRoot, "docs/kairos/specs/prog-overall.md", [
      "---",
      "title: O",
      "doc-type: overall",
      "slug: prog-overall",
      "---",
    ]);
    writeDoc(repoRoot, "docs/kairos/specs/prog-p1-design.md", [
      "---",
      "title: S",
      "doc-type: phase-spec",
      "slug: prog-p1",
      "program: prog-overall",
      "---",
    ]);
    writeDoc(repoRoot, "docs/kairos/plans/prog-p1.md", [
      "---",
      "title: Plan",
      "doc-type: plan",
      "slug: prog-p1",
      "---",
    ]);
  };

  const PLAN = "docs/kairos/plans/prog-p1.md";
  const SPEC = "docs/kairos/specs/prog-p1-design.md";
  const OVERALL = "docs/kairos/specs/prog-overall.md";

  it("a --plan path renders the node board to stdout and exits 0", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot);
      const code = await command.runArgv(["board", "--plan", PLAN]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("cdd board: prog-p1");
      expect(io.stdoutText).toContain("  spec     docs/kairos/specs/prog-p1-design.md");
      expect(io.stdoutText.split("\n").at(-2)).toBe("progress: ✔ done · ▶ current · ○ pending");
    } finally {
      cleanup();
    }
  });

  it("an overall --spec path renders the program board", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot);
      const code = await command.runArgv(["board", "--spec", OVERALL]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("cdd board: prog-overall");
      expect(io.stdoutText).toContain("  phase prog-p1  Pending");
      expect(io.stdoutText).toContain("  next:    done");
    } finally {
      cleanup();
    }
  });

  it("missing both path flags is a usage error — exit 2", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["board"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("--plan and/or --spec");
    } finally {
      cleanup();
    }
  });

  it("a ghost path matches nothing on disk — exit 2, not-found face, zero BLOCKED", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot);
      const code = await command.runArgv(["board", "--plan", "docs/kairos/plans/ghost.md"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("no docs match --plan docs/kairos/plans/ghost.md");
      expect(io.stdoutText).not.toContain("(BLOCKED)");
    } finally {
      cleanup();
    }
  });

  it("a path outside the docRoots is the SAME not-found face — zero BLOCKED", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      writeDoc(repoRoot, "notes.md", [
        "---",
        "title: Notes",
        "doc-type: plan",
        "slug: notes",
        "---",
      ]);
      const code = await command.runArgv(["board", "--spec", "notes.md"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("no docs match --spec notes.md");
      expect(io.stdoutText).not.toContain("(BLOCKED)");
    } finally {
      cleanup();
    }
  });

  it("both flags on one slug render ONE board shaped by the --spec document", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot);
      const code = await command.runArgv(["board", "--plan", PLAN, "--spec", SPEC]);
      expect(code).toBe(0);
      // one header, one board — the node shape taken from the phase-spec entry
      expect(io.stdoutText.match(/^cdd board: /gm)).toHaveLength(1);
      expect(io.stdoutText).toContain("cdd board: prog-p1");
    } finally {
      cleanup();
    }
  });

  it("two flags on different slugs are an argument conflict — exit 2, both values on stderr", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot);
      writeDoc(repoRoot, "docs/kairos/specs/prog-p2-design.md", [
        "---",
        "title: Other",
        "doc-type: phase-spec",
        "slug: prog-p2",
        "program: prog-overall",
        "---",
      ]);
      const code = await command.runArgv([
        "board",
        "--plan",
        PLAN,
        "--spec",
        "docs/kairos/specs/prog-p2-design.md",
      ]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain('"prog-p1"');
      expect(io.stderrText).toContain('"prog-p2"');
    } finally {
      cleanup();
    }
  });

  it("a node doc without `slug:` renders `slug: missing (BLOCKED)` and exits 2", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot);
      writeDoc(repoRoot, "docs/kairos/specs/prog-p1-design.md", [
        "---",
        "title: S",
        "doc-type: phase-spec",
        "program: prog-overall",
        "---",
      ]);
      const code = await command.runArgv(["board", "--spec", SPEC]);
      expect(code).toBe(2);
      expect(io.stdoutText).toContain("slug: missing (BLOCKED)");
    } finally {
      cleanup();
    }
  });

  it("an illegal `slug:` value renders `slug: invalid (BLOCKED)` and exits 2", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot);
      writeDoc(repoRoot, "docs/kairos/specs/prog-p1-design.md", [
        "---",
        "title: S",
        "doc-type: phase-spec",
        "slug: ../x",
        "program: prog-overall",
        "---",
      ]);
      const code = await command.runArgv(["board", "--spec", SPEC]);
      expect(code).toBe(2);
      expect(io.stdoutText).toContain("slug: invalid (BLOCKED)");
    } finally {
      cleanup();
    }
  });

  it("two identity docs on one slug render `slug: duplicated (BLOCKED)` and exit 2", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot);
      writeDoc(repoRoot, "docs/kairos/specs/prog-p1-copy.md", [
        "---",
        "title: Copy",
        "doc-type: phase-spec",
        "slug: prog-p1",
        "program: prog-overall",
        "---",
      ]);
      const code = await command.runArgv(["board", "--spec", SPEC]);
      expect(code).toBe(2);
      expect(io.stdoutText).toContain("slug: duplicated (BLOCKED)");
    } finally {
      cleanup();
    }
  });

  it("a phase spec whose `program:` names no overall renders `program: missing (BLOCKED)` and exits 2", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot);
      writeDoc(repoRoot, "docs/kairos/specs/prog-p1-design.md", [
        "---",
        "title: S",
        "doc-type: phase-spec",
        "slug: prog-p1",
        "program: ghost-overall",
        "---",
      ]);
      const code = await command.runArgv(["board", "--spec", SPEC]);
      expect(code).toBe(2);
      expect(io.stdoutText).toContain("program: missing (BLOCKED)");
    } finally {
      cleanup();
    }
  });

  it("a zero-plan node renders `plan (none)` and exits 0", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot);
      rmSync(path.join(repoRoot, PLAN));
      const code = await command.runArgv(["board", "--spec", SPEC]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("  plan     (none)");
    } finally {
      cleanup();
    }
  });

  it("a single-spec entry renders `overall (none)` and exits 0", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      writeDoc(repoRoot, "docs/kairos/specs/single.md", [
        "---",
        "title: Single",
        "doc-type: single-spec",
        "slug: single",
        "---",
      ]);
      const code = await command.runArgv(["board", "--spec", "docs/kairos/specs/single.md"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("  overall  (none)");
    } finally {
      cleanup();
    }
  });

  it("a plan without a paired spec renders `spec (none)` and exits 0", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      writeDoc(repoRoot, "docs/kairos/plans/lonely.md", [
        "---",
        "title: Lonely",
        "doc-type: plan",
        "slug: lonely",
        "---",
      ]);
      const code = await command.runArgv(["board", "--plan", "docs/kairos/plans/lonely.md"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("  spec     (none)");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// T3 — the commander-native composition root (behavior probes): runArgv parses
// through the projection's commander program (face/projection.ts), the domain-run
// thin shells dispatch the parsed commands, and the exit-code discriminator maps
// the CommanderError surface (§3.1: `commander.help` + exit 0 → 0 · non-zero →
// 2 · `commander.helpDisplayed` → 0 · usage-class codes → 2). Every probe below
// pins commander's own bytes (probe-verified — the discrimination face, never a
// self-built rerender).
// ---------------------------------------------------------------------------

describe("T3 — the commander-native composition root: program parse + .action shells + the exit-code discriminator", () => {
  it("bare `cdd` → commander program help + exit 2, no custom missing-command text (§3.3)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv([]);
      expect(code).toBe(2);
      // the commander program face — Usage/Options/Commands (the error-context
      // help lands on the io stderr channel, commander's own byte choice)
      const out = io.stdoutText + io.stderrText;
      expect(out).toContain("Usage: cdd [options] [command]");
      expect(out).toContain("implement");
      expect(out).toContain("review");
      expect(out).not.toContain("missing command");
    } finally {
      cleanup();
    }
  });

  it("a missing subcommand shows the OWNING node's help, exit 2 (base set/get, never the top program face)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["base"]);
      expect(code).toBe(2);
      const out = io.stdoutText + io.stderrText;
      // the base node's own helpInformation — its subcommand table, not the
      // top-level program face
      expect(out).toContain("Usage: cdd base [options] [command]");
      expect(out).toContain("set [options]");
      expect(out).toContain("get [options]");
      expect(out).not.toContain("Usage: cdd [options] [command]");
    } finally {
      cleanup();
    }
  });

  it("the built-in help [command] reuse — `cdd help` and `cdd base help` exit 0 with the owning face (v0.9)", async () => {
    const program = fixture();
    const base = fixture();
    try {
      const programCode = await program.command.runArgv(["help"]);
      expect(programCode).toBe(0);
      expect(program.io.stdoutText).toContain("Usage: cdd [options] [command]");
      const baseCode = await base.command.runArgv(["base", "help"]);
      expect(baseCode).toBe(0);
      expect(base.io.stdoutText).toContain("Usage: cdd base [options] [command]");
    } finally {
      program.cleanup();
      base.cleanup();
    }
  });

  it("a leaf's help positional → the excess-arguments usage face, exit 2 (`implement help`)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // bare `implement help` — commander's required-option check fires first
      // (implement requires --tasks/--plan), still the usage face → 2
      expect(await command.runArgv(["implement", "help"])).toBe(2);
      io.stderrText = "";
      // with the required options present the excess-arguments byte surfaces
      const code = await command.runArgv(["implement", "--tasks", "1", "--plan", "p", "help"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("too many arguments for 'implement'");
      expect(io.stderrText).toContain("Expected 0 arguments but got 1: help");
    } finally {
      cleanup();
    }
  });

  it("`cdd help <bogus>` → the program help + exit 2 (invalid target, exit 1 → 2)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["help", "bogus"]);
      expect(code).toBe(2);
      expect(io.stdoutText + io.stderrText).toContain("Usage: cdd [options] [command]");
    } finally {
      cleanup();
    }
  });

  it("verb-less `--help` flips to exit 0 (§3.4) — the helpDisplayed face", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["--help"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("Usage: cdd [options] [command]");
      expect(io.stdoutText).toContain("Commands:");
    } finally {
      cleanup();
    }
  });

  it("a commander-native value-domain rejection exits 2 with commander's own bytes", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["review", "--type", "bogus"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "error: option '--type <wave|branch|spec|plan>' argument 'bogus' is invalid",
      );
    } finally {
      cleanup();
    }
  });

  it("the preAction conditional-required group exits 2 with the group message (§4.2)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["review", "--type", "wave"]);
      expect(code).toBe(2);
      // the REQUIRED_GROUPS InvalidArgumentError rides the same commander pipeline
      expect(io.stderrText).toContain("--plan required when --type wave");
    } finally {
      cleanup();
    }
  });

  it("the schema <type> vocabulary rejects an unknown type through the argument parseArg", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "get", "bogus"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "unknown schema type: bogus (available: overall, plan, phase-spec, single-spec)",
      );
    } finally {
      cleanup();
    }
  });

  it("the schema get <type> domain read — a valid type exits 0 with the derived schema", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "get", "phase-spec"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain('"docType": "phase-spec"');
    } finally {
      cleanup();
    }
  });

  it("the domain-run usage faces surface the owning node's commander-native usage line before the error byte (Task 3)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // a run-body usage rejection emits the owning node's helpInformation() first
      // line — the commander-native usage byte — then the error byte (review's
      // preAction passes --plan; the run body refuses the missing --tasks)
      expect(await command.runArgv(["review", "--type", "wave", "--plan", "p"])).toBe(2);
      expect(io.stderrText).toContain("Usage: cdd review [options]");
      expect(io.stderrText).toContain(
        "error: cdd review --type wave: missing required --tasks <n|n,n,…>",
      );
      io.stderrText = "";
      // the schema face — the --output skeleton missing-target byte rides its own
      // commander-native usage line
      expect(await command.runArgv(["schema", "get", "phase-spec", "--output", "skeleton"])).toBe(
        2,
      );
      expect(io.stderrText).toContain("Usage: cdd schema get [options] <type>");
      expect(io.stderrText).toContain("cdd schema get --output skeleton: missing <target>");
    } finally {
      cleanup();
    }
  });

  it("the shared text-read's unreadable-file refusal rides the work face's native usage line", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      // The text-read face the work commands share (readText) — its unreadable-file
      // refusal surfaces through the wave face's --plan read (the same artifacts
      // face; the owning node's usage line).
      const missing = path.join(repoRoot, "no-such-plan.md");
      const code = await command.runArgv(["implement", "--tasks", "1", "--plan", missing]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("Usage: cdd implement [options]");
      // the refusal byte echoes the repoRoot-relative shape (D47 · §2.13)
      expect(io.stderrText).toContain(
        `error: cannot read file: ${path.relative(repoRoot, missing)}`,
      );
    } finally {
      cleanup();
    }
  });

  it("the base get domain read — a set artifact exits 0 over the write-through path", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      expect(
        await command.runArgv([
          "base",
          "set",
          "--plan",
          plan,
          "--base",
          "develop",
          "--source",
          "plan-field",
        ]),
      ).toBe(0);
      io.stdoutText = "";
      const code = await command.runArgv(["base", "get", "--plan", plan]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain('"base": "develop"');
    } finally {
      cleanup();
    }
  });

  it("review --type spec --dry-run — the preview forecasts the spec round at zero writes", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      // The declared, contract-clean spec doc — the `doc-type:` head key
      // (spec §12 · D34) the capsule's doc-class discrimination reads
      // (zero filename inference).
      const spec = conformingSpec(repoRoot);
      const code = await command.runArgv(["review", "--type", "spec", "--spec", spec, "--dry-run"]);
      expect(code).toBe(0);
      // the preview names the spec round's step + its prescribed write set, and
      // fabricates neither a conclusion nor a next hop (P11 §3.3)
      expect(io.stdoutText.startsWith("cdd review: preview (no repo changes)\n")).toBe(true);
      expect(io.stdoutText).toContain("  step:        review round 1 — spec");
      expect(io.stdoutText).toContain(
        "  would write: .kairos/cdd/s1/spec-review-1.json · .kairos/cdd/s1/spec-review-1-report.md",
      );
      expect(io.stdoutText).not.toContain("next:");
      expect(existsSync(path.join(repoRoot, ".kairos"))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("an underivable repo root BLOCKs (exit 1, never a usage 2) — a work verb from outside any git repo (§2.6)", async () => {
    // The repo root is the ONE conversion point (T2): the working directory's git
    // top level. A cwd outside any git repository cannot derive it — a missing
    // run-environment fact, so the command rides the CDD_BLOCKED channel and exits 1
    // (never a usage error — exit 2, zero new message surface).
    const nonRepo = realpathSync(mkdtempSync(path.join(tmpdir(), "cli-nonrepo-")));
    const savedCwd = process.cwd();
    process.chdir(nonRepo);
    const io = new CaptureIo();
    const command = Cli.create({ io, dispatch: APPROVING });
    try {
      const code = await command.runArgv(["implement", "--tasks", "1", "--plan", "p3.md"]);
      expect(code).toBe(1);
      expect(io.stderrText).toContain("CDD_BLOCKED:");
      expect(io.stderrText).toContain("not inside a git repository");
    } finally {
      process.chdir(savedCwd);
      rmSync(nonRepo, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// the HarnessDispatch — host detection · the template prompt · the return read-back
// ---------------------------------------------------------------------------

describe("the HarnessDispatch — the production dispatch default", () => {
  /** A hermetic harness scene (workspace + ledger) for frame dispatch tests. */
  function harnessScene(repoRoot: string, slug = "p3"): DispatchScene {
    const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), slug).ensure();
    const ledger = new Ledger(workspace, new ConfigLoader());
    return { workspace, ledger, planPath: null, briefPath: null };
  }

  const implementFrame: OpenFrame = {
    type: "wave",
    phase: "implement",
    round: 1,
    target: { kind: "wave", tasks: [1] },
    params: { tasks: "1" },
    key: "1",
  };

  const specReviewFrame: OpenFrame = {
    type: "spec",
    phase: "review",
    round: 1,
    target: { kind: "spec", doc: "docs/kairos/specs/s1-design.md" },
    params: { round: 1 },
    key: "docs/kairos/specs/s1-design.md",
  };

  const taskReviewFrame: OpenFrame = {
    type: "wave",
    phase: "review",
    round: 1,
    target: { kind: "wave", tasks: [1] },
    params: { tasks: "1", round: 1 },
    key: "1",
  };

  const fixFrame: OpenFrame = {
    type: "wave",
    phase: "fix",
    round: 1,
    target: { kind: "wave", tasks: [1] },
    params: { tasks: "1", round: 1 },
    key: "1",
  };

  it("detects the host from the harness-contract detect markers (claude > pi)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const dispatch = new HarnessDispatch({ scene, io, env: {} });
      expect(dispatch.detectHost({})).toBe("");
      expect(dispatch.detectHost({ CLAUDE_CODE_SESSION_ID: "s" })).toBe("claude");
      expect(dispatch.detectHost({ AI_AGENT: "pi" })).toBe("pi");
      expect(dispatch.detectHost({ AI_AGENT: "claude-code" })).toBe("claude");
      expect(dispatch.detectHost({ CURSOR_TRACE_ID: "t" })).toBe("");
    } finally {
      cleanup();
    }
  });

  it("dispatches through the harness rows — the skill-ref slash form + the prompt, the draft read back into the outcome", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      // the child's Return is prose (P11 · §2.1) — the engine never parses it; the
      // round's content is the OUTPUT_HANDOFF draft read back below.
      sync.stdout = "Implemented the task. All checks green.\n";
      // The child's write-back: the implement draft at OUTPUT_HANDOFF per the injected
      // `delivery` schema + the canonical test-evidence file (the v1.9 read-back inputs).
      const draft = path.join(scene.workspace.path, "tasks-1-implement.json");
      // The compliant child follows the prescribed OUTPUT_* names (find #5): the
      // artifacts it declares are the canonical {family}-{key}-{artifact} paths (the
      // report at tasks-1-implement-report.md · the evidence at
      // tasks-1-test-evidence.json); a free-named deviation is corrected in the
      // reconstruct (the path-deviation test below).
      writeFileSync(
        draft,
        JSON.stringify({
          status: "APPROVED",
          artifacts: {
            brief: "/b",
            report: path.join(scene.workspace.path, "tasks-1-implement-report.md"),
            test_evidence: path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
          },
        }),
        "utf8",
      );
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        JSON.stringify({
          command: "npx vitest run",
          exit_code: 0,
          passed: true,
          warnings_count: 0,
          typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      expect(sync.calls.length).toBe(1);
      const call = sync.calls[0];
      expect(call.command).toBe("claude");
      expect(call.env).toEqual(HOSTS.claude.env);
      expect(call.args).toContain("-p");
      // D46 — the child is spawned at cwd = repoRoot: the round-context path tokens
      // are repoRoot-relative, so a relative token only resolves correctly when the
      // child's cwd IS the repoRoot (the coupled invariant — pin both together).
      expect(call.cwd).toBe(repoRoot);
      // The skill ref is NOT a standalone positional (the harness CLI consumes the
      // first positional as the whole prompt — a split prompt loses everything after
      // the ref). It prefixes the single prompt argument instead.
      expect(call.args).not.toContain("/mattpocock-skills:implement");
      const prompt = call.args[call.args.length - 1];
      expect(prompt.startsWith("/mattpocock-skills:implement ")).toBe(true);
      // v1.8 — the mode dispatch table + the normalized naming grammar (ROLE/WAVE · INPUT_/OUTPUT_/WORKSPACE_).
      // D46 — every round-context path token is repoRoot-RELATIVE (the child is spawned
      // at cwd = repoRoot): the tokens carry the workspace path minus the repoRoot prefix.
      const wsRel = path.relative(repoRoot, scene.workspace.path);
      expect(prompt).toContain("- `ROLE`: implement");
      expect(prompt).toContain("- `WAVE`: 1");
      expect(prompt).toContain(`- \`WORKSPACE_DIR\`: ${wsRel}`);
      expect(prompt).toContain(`- \`OUTPUT_HANDOFF\`: ${wsRel}/tasks-1-implement.json`);
      // find #4 — INPUT_RULES is gone: the implement child reads the plan's
      // `## Constraints` through the wave brief mirror (zero materialized rules file,
      // zero dead pointer — the round context carries no rules channel).
      expect(prompt).not.toContain("INPUT_RULES");
      // find #5 — the artifact write paths are prescribed (OUTPUT_* · {family}-{key}-
      // prefix): the brief is a pure read input (INPUT_WAVE_BRIEF) with no write slot
      // (only present facts ride the prompt), while report + evidence are prescribed.
      expect(prompt).not.toContain("OUTPUT_BRIEF");
      expect(prompt).toContain(`- \`OUTPUT_REPORT\`: ${wsRel}/tasks-1-implement-report.md`);
      expect(prompt).toContain(`- \`OUTPUT_EVIDENCE\`: ${wsRel}/tasks-1-test-evidence.json`);
      // the per-mode trimming: this scene carries no brief (briefPath null) — the empty
      // INPUT_TASK key is NOT emitted (empty keys are never emitted)
      expect(prompt).not.toContain("- `INPUT_TASK`");
      // v1.9 — the injected writable-subset schema rides the shell's fixed tail (the
      // ```json fence + the evidence fence — the task-family work round's two files)
      expect(prompt).toContain("## Handoff schema");
      expect(prompt).toContain("```json");
      expect(prompt).toContain("The evidence file");
      expect(prompt).not.toContain("HANDOFF_WRITE_GATE");
      // the read-back reconstruct — the final carrier (the schema's declared fields
      // only: identity rides the file name, never phase/tasks inline — v1.30) rides
      // the outcome; the child's stdout prose is never parsed
      expect(outcome.status).toBe("APPROVED");
      // The prescribed slots book the canonical repoRoot-RELATIVE paths (§2.7) even
      // when the child declared them absolute; the non-prescribed `brief` passes verbatim.
      expect(outcome.carrier).toEqual({
        artifacts: {
          brief: "/b",
          report: path.relative(
            repoRoot,
            path.join(scene.workspace.path, "tasks-1-implement-report.md"),
          ),
          test_evidence: path.relative(
            repoRoot,
            path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
          ),
        },
        status: "APPROVED",
      });
      // T2 — the materialized work carrier is the work face: zero findings key (the
      // face-aware write path never injects the work-carrier findings byte bridge)
      expect("findings" in outcome.carrier!).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("dispatches through the pi row — the detected host's own child env reaches the child", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "Implemented the task.\n";
      const dispatch = new HarnessDispatch({ scene, io, sync, env: { AI_AGENT: "pi" } });
      await dispatch.step()(implementFrame);
      expect(sync.calls.length).toBe(1);
      // The child env is the detected row's data, never a dispatcher branch: a
      // claude-row mix-up would forward FORCE_PROMPT_CACHING_5M and surface here.
      expect(sync.calls[0]?.command).toBe("pi");
      expect(sync.calls[0]?.env).toEqual(HOSTS.pi.env);
    } finally {
      cleanup();
    }
  });

  it("prescribes the implement artifact paths — REPORT/EVIDENCE carry the canonical {family}-{key}- names (find #5)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      const scene: DispatchScene = {
        workspace,
        ledger,
        planPath: null,
        briefPath: path.join(workspace.path, "tasks-1-brief.md"),
      };
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      await dispatch.step()(implementFrame);
      const prompt = sync.calls[0]!.args[sync.calls[0]!.args.length - 1];
      // the brief is a pure read input (INPUT_WAVE_BRIEF — no OUTPUT_BRIEF · spec §4.2);
      // the prescribed write paths ride the round context (report + evidence = the
      // report/verify write paths — zero free naming, cross-round zero overwrite).
      // D46 — every round-context path token is repoRoot-relative (the child spawned at
      // cwd = repoRoot), so the tokens carry the workspace minus the repoRoot prefix.
      const wsRel = path.relative(repoRoot, workspace.path);
      expect(prompt).toContain(`- \`INPUT_WAVE_BRIEF\`: ${wsRel}/tasks-1-brief.md`);
      expect(prompt).not.toContain("OUTPUT_BRIEF");
      expect(prompt).toContain(`- \`OUTPUT_REPORT\`: ${wsRel}/tasks-1-implement-report.md`);
      expect(prompt).toContain(`- \`OUTPUT_EVIDENCE\`: ${wsRel}/tasks-1-test-evidence.json`);
    } finally {
      cleanup();
    }
  });

  it("§4.2 — every wave frame (implement/review/fix) carries the scene's brief as INPUT_WAVE_BRIEF, never a disk-existence read", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      const briefPath = path.join(workspace.path, "tasks-1-brief.md");
      // The scene carries the brief path but NO brief file is written to disk — the
      // read is the scene's fact, not the filesystem's (the retired existsSync guard).
      const scene: DispatchScene = {
        workspace,
        ledger,
        planPath: null,
        briefPath,
      };
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      // the review + fix frames both carry the ONE scene brief (not implement-only).
      // D46 — the token is repoRoot-relative (the child spawned at cwd = repoRoot).
      const briefRel = path.relative(repoRoot, briefPath);
      await dispatch.step()(taskReviewFrame);
      await dispatch.step()(fixFrame);
      for (const call of sync.calls) {
        const prompt = call.args[call.args.length - 1];
        expect(prompt).toContain(`- \`INPUT_WAVE_BRIEF\`: ${briefRel}`);
      }
    } finally {
      cleanup();
    }
  });

  it("the doc-family artifacts are round-keyed — a second review round prescribes a different report path, never an overwrite (find #5)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      const scene: DispatchScene = {
        workspace,
        ledger,
        planPath: null,
        briefPath: null,
      };
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      await dispatch.step()(specReviewFrame);
      const first = sync.calls[0]!.args[sync.calls[0]!.args.length - 1];
      await dispatch.step()({ ...specReviewFrame, round: 2, params: { round: 2 } });
      const second = sync.calls[1]!.args[sync.calls[1]!.args.length - 1];
      // D46 — the token is repoRoot-relative (the child spawned at cwd = repoRoot).
      const wsRel = path.relative(repoRoot, workspace.path);
      expect(first).toContain(`- \`OUTPUT_REPORT\`: ${wsRel}/spec-review-1-report.md`);
      expect(second).toContain(`- \`OUTPUT_REPORT\`: ${wsRel}/spec-review-2-report.md`);
      // the round-keyed names never collide — a re-review cannot overwrite its predecessor
      expect(path.join(workspace.path, "spec-review-1-report.md")).not.toBe(
        path.join(workspace.path, "spec-review-2-report.md"),
      );
    } finally {
      cleanup();
    }
  });

  it("a free-named declared artifact path is corrected to the canonical OUTPUT_* path + surfaced on the notes (find #5 self-derivation)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      const draftPath = path.join(scene.workspace.path, "tasks-1-implement.json");
      writeFileSync(
        draftPath,
        JSON.stringify({
          status: "APPROVED",
          artifacts: { report: "/r", test_evidence: "/t" },
        }),
        "utf8",
      );
      // the evidence file at the canonical name makes the evidence gate pass — this
      // test isolates the artifact-path correction from the evidence read-back
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        JSON.stringify({
          command: "npx vitest run",
          exit_code: 0,
          passed: true,
          warnings_count: 0,
          typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      expect(outcome.status).toBe("APPROVED");
      // the engine books the canonical names — a child-reported free path never lands;
      // both deviations ride the carrier's notes (the review scope axis reads them).
      // The booked canonical paths are the repoRoot-RELATIVE shape (P9 T4 §2.7 —
      // persisted path fields carry zero absolute strings).
      expect(outcome.carrier).toEqual({
        artifacts: {
          report: path.relative(
            repoRoot,
            path.join(scene.workspace.path, "tasks-1-implement-report.md"),
          ),
          test_evidence: path.relative(
            repoRoot,
            path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
          ),
        },
        status: "APPROVED",
        notes: [
          expect.stringContaining("artifact report"),
          expect.stringContaining("artifact test_evidence"),
        ],
      });
      // T2 — the materialized work carrier is the work face: zero findings key
      expect("findings" in outcome.carrier!).toBe(false);
      // P14 — a successful round never ticks contractViolationCount.
      expect(scene.ledger.counterOf("contractViolationCount")).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("D39 — a trailing-comma draft reconstructs cleanly (the lenient read face; the round is not voided)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      // The child LLM writes a draft with a routine slip — a trailing comma in the
      // notes array (the W3 {5,11} block shape). The reconstruct's draft read is the
      // LENIENT face (D39): the slip must not void the whole round.
      const draftPath = path.join(scene.workspace.path, "tasks-1-implement.json");
      writeFileSync(
        draftPath,
        '{\n  "status": "APPROVED",\n  "artifacts": {\n    "report": "' +
          path.join(scene.workspace.path, "tasks-1-implement-report.md") +
          '",\n    "test_evidence": "' +
          path.join(scene.workspace.path, "tasks-1-test-evidence.json") +
          '"\n  },\n  "notes": [\n    "a",\n    "b",\n  ]\n}\n',
        "utf8",
      );
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        JSON.stringify({
          command: "npx vitest run",
          exit_code: 0,
          passed: true,
          warnings_count: 0,
          typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      // The trailing comma is tolerated — the round lands APPROVED, never a malformed
      // reject; the notes the child wrote survive into the carrier.
      expect(outcome.status).toBe("APPROVED");
      expect(io.stderrText).toBe("");
      expect((outcome.carrier as { notes?: string[] }).notes).toEqual(["a", "b"]);
    } finally {
      cleanup();
    }
  });

  it("§8.7 — a non-declared / engine-reserved draft field is dropped with a single WARN, never a BLOCK (materialize and the validator judge the same way)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      // A work draft carrying engine-reserved keys (commits — retired) + a child extra
      // (phase). The read-back validator drops them (never a refusal); materialize
      // drops them from the carrier and books ONE WARN on the notes.
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-implement.json"),
        JSON.stringify({
          status: "APPROVED",
          artifacts: {
            report: path.join(scene.workspace.path, "tasks-1-implement-report.md"),
            test_evidence: path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
          },
          commits: { base: "a".repeat(8), head: "b".repeat(8) },
          phase: "implement",
        }),
        "utf8",
      );
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        JSON.stringify({
          command: "npx vitest run",
          exit_code: 0,
          passed: true,
          warnings_count: 0,
          typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      // the round is NOT blocked (a non-declared extra field is not a semantic error)
      expect(outcome.status).toBe("APPROVED");
      expect(io.stderrText).toBe("");
      const carrier = outcome.carrier as Record<string, unknown>;
      // the non-declared keys never land on the carrier
      expect("commits" in carrier).toBe(false);
      expect("phase" in carrier).toBe(false);
      // exactly ONE WARN names the dropped keys (sorted-stable order is not required,
      // only that both keys are surfaced in a single note)
      const notes = carrier.notes as string[];
      expect(notes).toHaveLength(1);
      expect(notes[0]).toContain("dropped non-declared draft field(s)");
      expect(notes[0]).toContain("commits");
      expect(notes[0]).toContain("phase");
    } finally {
      cleanup();
    }
  });

  it("§8.7 — a findings-face draft carrying a stray `status` (+ another key) is dropped with a single WARN, never a BLOCK (the exact dogfood crash face)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      // The §2.8/§8.7 dogfood crash face: a child-authored `status` (non-declared on
      // the judge plane — the judge carrier holds no status; the conclusion derives
      // at judgment time) on a review draft, plus a stray extra key. The read-back
      // validator drops both (never a refusal); materialize drops them from the carrier
      // and books ONE WARN on the notes.
      sync.stdout = "status: APPROVED\n";
      writeFileSync(
        path.join(scene.workspace.path, "spec-review-1.json"),
        JSON.stringify({
          findings: [{ severity: "nit", lens: "spec", summary: "drift" }],
          status: "APPROVED",
          phase: "review",
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(specReviewFrame);
      // the round is NOT blocked (a non-declared field is not a semantic error) — the
      // conclusion derives from the draft's findings (nit → REVIEW_FIX), never the
      // dropped child status
      expect(outcome.status).toBe("REVIEW_FIX");
      expect(io.stderrText).toBe("");
      const carrier = outcome.carrier as Record<string, unknown>;
      // the findings carrier holds NO status field (the conclusion is derived, never
      // persisted on the findings plane · D27); the dropped keys never land either
      expect("phase" in carrier).toBe(false);
      expect("status" in carrier).toBe(false);
      // exactly ONE WARN names both dropped keys
      const notes = carrier.notes as string[];
      expect(notes).toHaveLength(1);
      expect(notes[0]).toContain("dropped non-declared draft field(s)");
      expect(notes[0]).toContain("status");
      expect(notes[0]).toContain("phase");
    } finally {
      cleanup();
    }
  });

  it("the docs review — the block + draft face: findings flow back from the file, the status rolls up", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      // The review child states `status: APPROVED` in the block (its conclusion is the
      // draft's findings — never printed); the engine derives the capsule status.
      sync.stdout = "status: APPROVED\n";
      writeFileSync(
        path.join(scene.workspace.path, "spec-review-1.json"),
        JSON.stringify({
          findings: [{ severity: "blocker", lens: "spec", summary: "drift" }],
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(specReviewFrame);
      // the rollup (v1.9: a review never declares its own status) + the findings from
      // the FILE — the read-back is the fix loop's only content channel
      expect(outcome.status).toBe("CHANGES_REQUESTED");
      expect(outcome.findings).toEqual([{ severity: "blocker", summary: "drift" }]);
      // the persisted findings carrier holds NO status field (D27 — the conclusion is
      // derived at judgment time, never stored on the findings plane); the conclusion
      // still rides the outcome.status above, derived from the findings
      expect(outcome.carrier).toEqual({
        artifacts: {},
        findings: [{ severity: "blocker", lens: "spec", summary: "drift" }],
      });
      expect("status" in (outcome.carrier as Record<string, unknown>)).toBe(false);
      // the URC criteria ride the review prompt's fixed prefix (the spec review has
      // no slash ref) — the criteria/lens are folded in, never round-context values
      const call = sync.calls[0];
      expect(call.args).not.toContain("/mattpocock-skills:code-review");
      const prompt = call.args[call.args.length - 1];
      expect(prompt).toContain("Follow URC:");
      expect(prompt).toContain("- `ROLE`: review");
      expect(prompt).toContain("- `INPUT_SPEC`: docs/kairos/specs/s1-design.md");
      // the v1.8 per-mode trimming: a review context carries no fix/work keys
      expect(prompt).not.toContain("- `INPUT_REVIEWS`");
      expect(prompt).not.toContain("- `INPUT_CRITERIA`");
    } finally {
      cleanup();
    }
  });

  it("a task review appends the review skill ref — the object {ref} row's slash form", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-review-1.json"),
        JSON.stringify({
          findings: [{ severity: "warn", lens: "buildability", summary: "dual evidence" }],
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(taskReviewFrame);
      // the finding flows back from the FILE; the status rolls up from its severity
      // (blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · none → APPROVED) — a
      // review never declares its own status, so the block's `status: APPROVED` is
      // not what the round concludes
      expect(outcome.status).toBe("REVIEW_FIX");
      expect(outcome.findings).toEqual([{ severity: "warn", summary: "dual evidence" }]);
      const call = sync.calls[0];
      // the task/branch review rows are object-shaped {ref} (the P5 note deletion) — the
      // slash form prefixes the single prompt argument (not a standalone positional —
      // the harness CLI consumes the first positional as the whole prompt), and the
      // task variant's fixed prefix carries the typed axes guide inside the same prompt
      expect(call.args).not.toContain("/mattpocock-skills:code-review");
      const prompt = call.args[call.args.length - 1];
      expect(prompt.startsWith("/mattpocock-skills:code-review ")).toBe(true);
      expect(prompt).toContain("Standards axis");
      expect(prompt).toContain("dual evidence");
      expect(prompt).not.toContain("parallel sub-agents");
    } finally {
      cleanup();
    }
  });

  it("the fix face carries no skill ref — the prompt opens with the template header, never a slash ref (T1)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-fix-1.json"),
        JSON.stringify({
          status: "APPROVED",
          artifacts: {
            report: path.join(scene.workspace.path, "tasks-1-fix-1-report.md"),
            test_evidence: path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
          },
        }),
        "utf8",
      );
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        JSON.stringify({
          command: "npx vitest run",
          exit_code: 0,
          passed: true,
          warnings_count: 0,
          typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(fixFrame);
      expect(outcome.status).toBe("APPROVED");
      const call = sync.calls[0];
      const prompt = call.args[call.args.length - 1];
      // the fix face resolves NO skill ref (the reference-less doc faces' face) —
      // the single prompt argument opens with the template header, never a slash form
      expect(prompt.startsWith("/mattpocock-skills:")).toBe(false);
      expect(prompt.startsWith("# CDD dispatch — fix round")).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("T6 — probe B: the fix dispatch prompt carries the strict-schema single sentence — the declaration is the field source, zero extra keys (the child-facing fix shell)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-fix-1.json"),
        JSON.stringify({
          status: "APPROVED",
          artifacts: {
            report: path.join(scene.workspace.path, "tasks-1-fix-1-report.md"),
            test_evidence: path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
          },
        }),
        "utf8",
      );
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        JSON.stringify({
          command: "npx vitest run",
          exit_code: 0,
          passed: true,
          warnings_count: 0,
          typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(fixFrame);
      expect(outcome.status).toBe("APPROVED");
      const call = sync.calls[0];
      const prompt = call.args[call.args.length - 1];
      // the ONE strict-schema sentence lands in the child-facing fix shell — the
      // declared properties are the draft's single field source (the T5 bytes riding
      // the rendered prompt; probe B's checkable)
      expect(prompt).toContain(
        "every top-level field of the draft comes from the `## Handoff schema` declared `properties`",
      );
      expect(prompt).toContain("zero extra keys");
    } finally {
      cleanup();
    }
  });

  it("D62 — a docs-fix round writes a WORK carrier with `status` (no residual findings, no evidence gate)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      // the docs-fix draft reports its outcome in `status`; the child's leftover
      // `findings` key is a non-declared work-plane field — dropped by materialize,
      // never written (the residual-findings dead path is gone)
      writeFileSync(
        path.join(scene.workspace.path, "spec-fix-1.json"),
        JSON.stringify({
          status: "APPROVED",
          artifacts: { doc: "docs/kairos/specs/s1-design.md" },
          findings: [],
        }),
        "utf8",
      );
      const docsFixFrame: OpenFrame = {
        type: "spec",
        phase: "fix",
        round: 1,
        target: { kind: "spec", doc: "docs/kairos/specs/s1-design.md" },
        params: { round: 1 },
        key: "docs/kairos/specs/s1-design.md",
      };
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      // NO test-evidence file: the docs-fix round rides the work plane's status, and
      // the evidence gate scopes to the wave / branch rounds only
      const outcome = await dispatch.step()(docsFixFrame);
      expect(outcome.status).toBe("APPROVED");
      expect(outcome.carrier?.status).toBe("APPROVED");
      expect("findings" in (outcome.carrier ?? {})).toBe(false);
      expect(Object.keys(outcome.carrier ?? {}).sort()).toEqual(["artifacts", "notes", "status"]);
      expect(((outcome.carrier?.notes ?? []) as string[]).join("\n")).toContain(
        "dropped non-declared draft field(s): findings",
      );
      // the docs-fix prefix tells the child to report the round in `status`
      const call = sync.calls[0];
      const prompt = call.args[call.args.length - 1];
      expect(prompt).toContain("report the round in `status`");
    } finally {
      cleanup();
    }
  });

  it("D46/§2.9 — the BEHAVIOR pin: every work face spawns the child at cwd = repoRoot (implement · review · fix)", async () => {
    // The behavior pin guards the SPAWN cwd, the fact the round-context tokens'
    // repoRoot-relative basis rests on: a child spawned anywhere but the repo root
    // would resolve every relative token off-root. It stands apart from the
    // structural pin (repo-root.guard.test.ts — which guards the conversion point);
    // the two pins cover different facts. This test drives all three work faces and
    // pins `call.cwd === repoRoot` on each — the review/fix faces had no such read,
    // so the pin now covers the whole work surface, not implement alone.
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      // Deterministic read-back inputs per face (the spawn precedes the read-back,
      // so the cwd pin holds regardless — the drafts keep the outcome clean too).
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-implement.json"),
        JSON.stringify({
          status: "APPROVED",
          artifacts: {
            report: path.join(scene.workspace.path, "tasks-1-implement-report.md"),
            test_evidence: path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
          },
        }),
        "utf8",
      );
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        JSON.stringify({
          command: "npx vitest run",
          exit_code: 0,
          passed: true,
          warnings_count: 0,
          typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
        }),
        "utf8",
      );
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-review-1.json"),
        JSON.stringify({ findings: [] }),
        "utf8",
      );
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-fix-1.json"),
        JSON.stringify({
          status: "APPROVED",
          artifacts: {
            report: path.join(scene.workspace.path, "tasks-1-fix-1-report.md"),
            test_evidence: path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
          },
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      for (const frame of [implementFrame, taskReviewFrame, fixFrame]) {
        await dispatch.step()(frame);
        const call = sync.calls[sync.calls.length - 1]!;
        // the load-bearing spawn fact: cwd IS the repo root, the basis every
        // repoRoot-relative round-context token resolves against.
        expect(call.cwd, `the ${frame.phase} face spawns at cwd = repoRoot`).toBe(repoRoot);
      }
      // all three work faces were exercised (never a vacuous single-face pin)
      expect(sync.calls).toHaveLength(3);
    } finally {
      cleanup();
    }
  });

  it("no host harness → BLOCKED over the CDD_BLOCKED channel; a broken child → BLOCKED too", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const noHost = new HarnessDispatch({ scene, io, env: {} });
      expect(await noHost.step()(implementFrame)).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("CDD_BLOCKED: no host harness detected");
      // P14 — no-crash BLOCKED (host missing) never ticks contractViolationCount.
      expect(scene.ledger.counterOf("contractViolationCount")).toBe(0);
      const failed = new HarnessDispatch({
        scene,
        io,
        sync: {
          run: async () => ({ code: 1, stdout: "", stderr: "boom", termination: null }),
        },
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      expect(await failed.step()(implementFrame)).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("child");
    } finally {
      cleanup();
    }
  });

  it("a child that exits 0 without the handoff → BLOCKED + CDD_BLOCKED + crash record (nothing clobbered)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "done — the handoff draft is written\n";
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      // no carrier → the bookkeep persists nothing: the read-back rejection face
      expect(outcome).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("CDD_BLOCKED: the handoff draft was not written");
      // the crash record — the same-command resume's decision source
      const crash = readJson<{
        attemptedHandoff: string;
        next: string;
        cause: string;
        stdoutTail: readonly string[];
      }>(path.join(scene.workspace.path, "crash-tasks-1-implement-1.json"));
      // the persisted attempted-handoff path is the canonical repoRoot-RELATIVE
      // shape (P9 T4 §2.7 — the absolute handoffPath syscall form never lands).
      expect(crash.attemptedHandoff).toBe(
        path.relative(repoRoot, path.join(scene.workspace.path, "tasks-1-implement.json")),
      );
      expect(crash.next).toBe("cdd implement --tasks 1 --plan <plan>");
      // P14 — exit 0 + missing draft is handoff-absent (not the schema-violation cause).
      expect(crash.cause).toBe("handoff-absent");
      expect(scene.ledger.counterOf("contractViolationCount")).toBe(1);
      // the child's stdout tail rides the crash record (P11 T2 — the diagnostic channel;
      // the child's Return is prose, never parsed for the round's content).
      expect(crash.stdoutTail).toEqual(["done — the handoff draft is written"]);
    } finally {
      cleanup();
    }
  });

  it("a child that exits NON-ZERO → BLOCKED + the crash record reports the real death (exitCode / cause / stdoutTail)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      // the child died with code 7 and wrote no draft — the death facts, not the
      // read-back face's exit-0/contract-violation shape, ride the crash record
      sync.code = 7;
      sync.stdout = "boom — the child died before writing\n";
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      expect(outcome).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("child");
      const crash = readJson<{
        exitCode: number;
        cause: string;
        stdoutTail: readonly string[];
        lastSample: SampleRecord | null;
      }>(path.join(scene.workspace.path, "crash-tasks-1-implement-1.json"));
      // the record tells the truth: the dead child's OWN exit code and the child-exit
      // cause — never the read-back face's 0 / contract-violation (T2 misreport fix).
      expect(crash.exitCode).toBe(7);
      expect(crash.cause).toBe("child-exit");
      expect(crash.stdoutTail).toEqual(["boom — the child died before writing"]);
      // the child-exit face explicitly passes `termination: null` — its crash record
      // carries no last sample (§4.2: the sample rides WITH the termination).
      expect(crash.lastSample).toBeNull();
      // P14 — child-exit is not a contract-violation face; the counter stays at 0.
      expect(scene.ledger.counterOf("contractViolationCount")).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("a TERMINATED round → TIMEOUT + the crash record carries the termination facts (cause / last sample / null exitCode)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      // The stub mimes the stalled kill exactly as the terminator reports it: the
      // killed child's exit code is null, and the termination fact rides whole
      // (cause + the in-memory last sample — zero in-flight-record re-read).
      const lastSample: SampleRecord = {
        sampledAt: 1_700_000_000,
        groupCpuMs: 120,
        newestMtimeMs: 1_700_000_500,
        verdict: "stalled",
      };
      sync.code = null;
      sync.termination = { cause: "stalled", idleMs: 1_800_000, lastSample };
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      // §4.3 — the derived status: a termination ⇒ TIMEOUT (never BLOCKED).
      expect(outcome.status).toBe("TIMEOUT");
      expect(outcome.termination).toEqual({ cause: "stalled", idleMs: 1_800_000, lastSample });
      // The reason rides the CDD_BLOCKED channel with its cause.
      expect(io.stderrText).toContain("CDD_BLOCKED:");
      expect(io.stderrText).toContain("stalled");
      const crash = readJson<{
        exitCode: number | null;
        cause: string;
        stdoutTail: readonly string[];
        stderrTail: readonly string[];
        lastSample: SampleRecord | null;
        promoted: boolean;
        idleMs: number | null;
        next: string;
      }>(path.join(scene.workspace.path, "crash-tasks-1-implement-1.json"));
      // The record tells the truth: the killed child has NO exit code (null verbatim,
      // never folded to 1), the derived cause, and the last sample riding in memory.
      expect(crash.exitCode).toBeNull();
      expect(crash.cause).toBe("stalled");
      expect(crash.lastSample).toEqual(lastSample);
      expect(crash.promoted).toBe(false);
      expect(crash.idleMs).toBe(1_800_000);
      expect(crash.next).toBe("cdd implement --tasks 1 --plan <plan>");
      // P14 — TIMEOUT still only moves timeoutCount; contractViolationCount stays 0.
      expect(scene.ledger.counterOf("contractViolationCount")).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("the termination leg is judged BEFORE the child-exit leg — a killed child with a non-zero-null code never folds into `child-exit`", async () => {
    // The judging-order hard rule (§4.3): a terminated round's outcome carries
    // code null AND termination non-null — the termination check must win, or the
    // crash cause would be falsified to `child-exit`. The pin below drives the
    // aliasing case: even a stub that reports BOTH a non-zero code and a
    // termination still concludes by the termination fact.
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.code = 143;
      sync.termination = { cause: "over-budget", idleMs: 42, lastSample: null };
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      expect(outcome.status).toBe("TIMEOUT");
      expect(outcome.termination).toEqual({ cause: "over-budget", idleMs: 42, lastSample: null });
      const crash = readJson<{ exitCode: number | null; cause: string }>(
        path.join(scene.workspace.path, "crash-tasks-1-implement-1.json"),
      );
      expect(crash.cause).toBe("over-budget");
    } finally {
      cleanup();
    }
  });

  it("the read-back rejection face keeps its BLOCKED conclusion verbatim — the death-facts default carries `termination: null`", async () => {
    // §4.3 — the status derives from the death facts (no status parameter): the
    // read-back caller passes the defaults (termination null) ⇒ BLOCKED, byte-for-
    // byte today's behavior.
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "done — the handoff draft is written\n";
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      expect(outcome).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("CDD_BLOCKED: the handoff draft was not written");
      const crash = readJson<{ cause: string; lastSample: SampleRecord | null }>(
        path.join(scene.workspace.path, "crash-tasks-1-implement-1.json"),
      );
      // P14 — the absent-draft pin (same face as the exit-0 no-handoff case).
      expect(crash.cause).toBe("handoff-absent");
      expect(crash.lastSample).toBeNull();
      expect(scene.ledger.counterOf("contractViolationCount")).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("a MALFORMED draft → BLOCKED reporting the true cause (malformed JSON), never the misleading 'not written' (D27)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      // the child wrote an unparseable draft at OUTPUT_HANDOFF — present but corrupt.
      // The tri-state read reports the true cause; a corrupt draft is never misreported
      // as absent (the "not written" path would hide the real defect).
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-implement.json"),
        "{ not json",
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      expect(outcome).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("CDD_BLOCKED: the handoff draft at");
      expect(io.stderrText).toContain("is malformed JSON");
      expect(io.stderrText).not.toContain("was not written");
      // P14 — present-but-bad draft stays contract-violation; the counter still ticks.
      const crash = readJson<{ cause: string }>(
        path.join(scene.workspace.path, "crash-tasks-1-implement-1.json"),
      );
      expect(crash.cause).toBe("contract-violation");
      expect(scene.ledger.counterOf("contractViolationCount")).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("a schema-violating draft → BLOCKED with the draft preserved untouched (no-overwrite on failure)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      // the child wrote a draft MISSING the required `status` — the `delivery` subset's
      // read-back refuses it
      const draftPath = path.join(scene.workspace.path, "tasks-1-implement.json");
      writeFileSync(draftPath, JSON.stringify({ artifacts: { report: "/r" } }), "utf8");
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      expect(outcome).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("violates the work schema");
      expect(io.stderrText).toContain("status: required");
      // the draft is preserved byte-identically — the engine never clobbers the
      // child's work; the resume re-runs the same command and the child rewrites it
      expect(readJson<{ artifacts: { report: string } }>(draftPath)).toEqual({
        artifacts: { report: "/r" },
      });
      // P14 — schema-violating draft is contract-violation with the counter tick.
      const crash = readJson<{ cause: string }>(
        path.join(scene.workspace.path, "crash-tasks-1-implement-1.json"),
      );
      expect(crash.cause).toBe("contract-violation");
      expect(scene.ledger.counterOf("contractViolationCount")).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("a missing/violating test-evidence file rewrites the draft to BLOCKED (the evidence read-back)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      // the implement draft is valid, but NO evidence file was written — the evidence
      // gate (v1.9) turns the round BLOCKED with the carrier preserved
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-implement.json"),
        JSON.stringify({
          status: "APPROVED",
          artifacts: { brief: "/b", report: "/r", test_evidence: "/t" },
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      expect(outcome.status).toBe("BLOCKED");
      // the carrier is materialized (the child's work preserved) but rewritten BLOCKED.
      // The free-named declared paths are corrected to the canonical OUTPUT_* names
      // (find #5 — the engine derives, never books a child-reported path): the report
      // and evidence book their canonical tasks-1- names (repoRoot-RELATIVE — §2.7)
      // with the deviations surfaced; the non-prescribed `brief` slot passes verbatim.
      expect(outcome.carrier).toEqual({
        artifacts: {
          brief: "/b",
          report: path.relative(
            repoRoot,
            path.join(scene.workspace.path, "tasks-1-implement-report.md"),
          ),
          test_evidence: path.relative(
            repoRoot,
            path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
          ),
        },
        status: "BLOCKED",
        notes: [
          expect.stringContaining("artifact report"),
          expect.stringContaining("artifact test_evidence"),
          expect.stringContaining("the test evidence at"),
        ],
      });
      // T2 — the materialized work carrier is the work face: zero findings key (the
      // evidence-contract rewrite never re-injects the work-carrier findings bridge)
      expect("findings" in outcome.carrier!).toBe(false);
      // P14 — evidence-gate rewrite BLOCKED has no crash cause; counter stays 0.
      expect(scene.ledger.counterOf("contractViolationCount")).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("a MALFORMED test-evidence file → BLOCKED reporting the true cause (malformed JSON), never the misleading 'missing' (D27)", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      sync.stdout = "status: APPROVED\n";
      // a VALID draft + a PRESENT-but-corrupt evidence file — the tri-state read
      // reports the true cause; a corrupt file is never misreported as absent
      // (the "missing" path would hide the real defect on the evidence leg, the
      // exact true-cause misreport D27 exists to eliminate).
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-implement.json"),
        JSON.stringify({
          status: "APPROVED",
          artifacts: { brief: "/b", report: "/r", test_evidence: "/t" },
        }),
        "utf8",
      );
      writeFileSync(
        path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        "{ not json",
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = await dispatch.step()(implementFrame);
      expect(outcome.status).toBe("BLOCKED");
      expect(outcome.carrier?.status).toBe("BLOCKED");
      const notes = (outcome.carrier?.notes ?? []) as string[];
      expect(notes.join("\n")).toContain("is malformed JSON");
      // the true cause, never the misleading "missing" the collapsed read produced
      expect(notes.join("\n")).not.toContain("the evidence file is missing");
    } finally {
      cleanup();
    }
  });

  it("find #9 — the branch fix's OUTPUT_* artifacts are the line-keyed names (report `branch-fix-{round}-report.md` · evidence `branch-test-evidence.json`), never the range", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new StubRunner();
      // the child returns prose — the engine zero-parses stdout (the draft
      // written below is the round's machine-readable result)
      sync.stdout = "Implemented the branch fix; the handoff draft is written.\n";
      writeFileSync(
        path.join(scene.workspace.path, "branch-fix-1.json"),
        JSON.stringify({
          status: "APPROVED",
          artifacts: {
            brief: "/b",
            report: path.join(scene.workspace.path, "branch-fix-1-report.md"),
            test_evidence: path.join(scene.workspace.path, "branch-test-evidence.json"),
          },
        }),
        "utf8",
      );
      writeFileSync(
        path.join(scene.workspace.path, "branch-test-evidence.json"),
        JSON.stringify({
          command: "npx vitest run",
          exit_code: 0,
          passed: true,
          warnings_count: 0,
          typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
        }),
        "utf8",
      );
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const frame: OpenFrame = {
        type: "branch",
        phase: "fix",
        round: 1,
        // the branch target carries no commit identity — the artifact names are
        // line-keyed (the spine wins · find #9)
        target: { kind: "branch" },
        params: { round: 1 },
        key: "branch",
      };
      const outcome = await dispatch.step()(frame);
      expect(io.stderrText).toBe("");
      expect(outcome.status).toBe("APPROVED");
      const prompt = sync.calls[0]!.args[sync.calls[0]!.args.length - 1];
      // find #9 — the prescribed artifact names are line-keyed: the round rides the
      // name (branch-fix-1-report.md), the evidence is the line's single file
      // (branch-test-evidence.json); the range token appears NOWHERE in the paths.
      // D46 — the token is repoRoot-relative (the child spawned at cwd = repoRoot).
      const wsRel = path.relative(repoRoot, scene.workspace.path);
      expect(prompt).toContain(`- \`OUTPUT_REPORT\`: ${wsRel}/branch-fix-1-report.md`);
      expect(prompt).toContain(`- \`OUTPUT_EVIDENCE\`: ${wsRel}/branch-test-evidence.json`);
      expect(prompt).not.toContain("aaaaaaaa..bbbbbbbb");
    } finally {
      cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // P13 T3 — the terminated review round's promotion (the one termination ⊥
  // conclusion exception): a valid findings draft is the round's work, so it is
  // read back normally; every other terminated round keeps the TIMEOUT face.
  // -------------------------------------------------------------------------

  /** A hermetic workspace + ledger for the CLI E2E dispatch cases. */
  function cliScene(repoRoot: string): { workspace: Workspace; ledger: Ledger } {
    const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
    return { workspace, ledger: new Ledger(workspace, new ConfigLoader()) };
  }

  /** Seed the wave's review phase — the implement round recorded on the wave line. */
  function seedImplement(ledger: Ledger): void {
    ledger.recordRound(1, "implement");
    ledger.persistHandoff(
      "implement",
      "wave",
      { tasks: "1" },
      { status: "APPROVED", artifacts: {} },
    );
  }

  /** Seed the wave's fix phase — the implement + blocker review rounds recorded. */
  function seedReview(ledger: Ledger): void {
    seedImplement(ledger);
    ledger.persistHandoff(
      "review",
      "wave",
      { tasks: "1", round: 1 },
      { findings: [{ severity: "blocker", lens: "code", summary: "drift" }] },
    );
    ledger.recordRound(1, "review");
  }

  /** Run one CLI invocation with the ambient host marker the production dispatch
   *  detects (the CLI reads process.env — restored after the call). */
  async function withHost(run: () => Promise<number>): Promise<number> {
    const saved = process.env.CLAUDE_CODE_SESSION_ID;
    process.env.CLAUDE_CODE_SESSION_ID = "s";
    try {
      return await run();
    } finally {
      if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
      else process.env.CLAUDE_CODE_SESSION_ID = saved;
    }
  }

  /** The stalled-kill termination fact the stub child reports. */
  const stalled = (): { termination: Termination; lastSample: SampleRecord } => {
    const lastSample: SampleRecord = {
      sampledAt: 1_700_000_000,
      groupCpuMs: 120,
      newestMtimeMs: 1_700_000_500,
      verdict: "stalled",
    };
    return { termination: { cause: "stalled", idleMs: 1_800_000, lastSample }, lastSample };
  };

  it("promotes a terminated review round whose draft is valid and has findings", async () => {
    const sync = new StubRunner();
    const fact = stalled();
    sync.code = null;
    sync.termination = fact.termination;
    const { command, io, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const { workspace, ledger } = cliScene(repoRoot);
      seedImplement(ledger);
      // the killed review child had already written its findings draft
      writeFileSync(
        path.join(workspace.path, "tasks-1-review-1.json"),
        JSON.stringify({
          findings: [{ severity: "blocker", lens: "code", summary: "drift" }],
        }),
        "utf8",
      );
      const code = await withHost(() =>
        command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", plan]),
      );
      // the conclusion derives from the handoff — exit 0, a real blocker count, a
      // next hop, and the round on record (the normal read-back path).
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: CHANGES_REQUESTED");
      expect(io.stdoutText).toContain("blocker: 1");
      expect(io.stdoutText).toMatch(/^next:/m);
      expect(ledger.roundCount(1, "review")).toBe(1);
      expect(ledger.counterOf("timeoutCount")).toBe(1);
      // the ONE promoted WARN — never a CDD_BLOCKED (the failure channel stays silent)
      expect(io.stderrText.match(/CDD_WARN:/g)).toHaveLength(1);
      expect(io.stderrText).not.toContain("CDD_BLOCKED");
      expect(io.stderrText).toContain("stalled");
      expect(io.stderrText).toContain("1800000");
      expect(io.stderrText).toContain("findings recovered: 1");
      // the crash record lands with the promotion fact + the termination's idle time
      const crash = readJson<{
        promoted: boolean;
        idleMs: number | null;
        cause: string;
        lastSample: SampleRecord | null;
      }>(path.join(workspace.path, "crash-tasks-1-review-1.json"));
      expect(crash.promoted).toBe(true);
      expect(crash.idleMs).toBe(1_800_000);
      expect(crash.cause).toBe("stalled");
      expect(crash.lastSample).toEqual(fact.lastSample);
    } finally {
      cleanup();
    }
  });

  it("terminated round reports idle duration and last sample on stderr and in the crash record", async () => {
    const sync = new StubRunner();
    const fact = stalled();
    sync.code = null;
    sync.termination = fact.termination;
    const { command, io, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const { workspace } = cliScene(repoRoot);
      const code = await withHost(() =>
        command.runArgv(["implement", "--tasks", "1", "--plan", plan]),
      );
      expect(code).toBe(1);
      // the ONE extended CDD_BLOCKED line carries the cause, idle time and last sample
      // (the approved path's `checked:` face is a separate block on the same channel)
      const lines = io.stderrText.split("\n").filter((line) => line.includes("CDD_BLOCKED:"));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("CDD_BLOCKED:");
      expect(lines[0]).toContain("stalled");
      expect(lines[0]).toContain("idleMs: 1800000");
      expect(lines[0]).toContain("last sample verdict: stalled");
      const crash = readJson<{ idleMs: number | null; lastSample: SampleRecord | null }>(
        path.join(workspace.path, "crash-tasks-1-implement-1.json"),
      );
      expect(crash.idleMs).toBe(1_800_000);
      expect(crash.lastSample).toEqual(fact.lastSample);
    } finally {
      cleanup();
    }
  });

  describe("does not promote", () => {
    it("an implement round — the terminated work face keeps TIMEOUT", async () => {
      const sync = new StubRunner();
      sync.code = null;
      sync.termination = stalled().termination;
      const { command, io, repoRoot, cleanup } = fixture({ sync });
      try {
        gitInit(repoRoot);
        const plan = planFor(repoRoot);
        const { workspace, ledger } = cliScene(repoRoot);
        // even a valid work draft never promotes — the review face is the sole domain
        writeFileSync(
          path.join(workspace.path, "tasks-1-implement.json"),
          JSON.stringify({ status: "APPROVED", artifacts: {} }),
          "utf8",
        );
        const code = await withHost(() =>
          command.runArgv(["implement", "--tasks", "1", "--plan", plan]),
        );
        expect(code).toBe(1);
        expect(io.stdoutText).toContain("status: TIMEOUT");
        expect(io.stdoutText).not.toMatch(/^next:/m);
        expect(ledger.roundCount(1, "implement")).toBe(0);
        expect(ledger.counterOf("timeoutCount")).toBe(1);
        const crash = readJson<{ promoted: boolean; cause: string }>(
          path.join(workspace.path, "crash-tasks-1-implement-1.json"),
        );
        expect(crash.promoted).toBe(false);
        // the true death cause, never the read-back `contract-violation`
        expect(crash.cause).toBe("stalled");
      } finally {
        cleanup();
      }
    });

    it("a fix round — the terminated fix face keeps TIMEOUT", async () => {
      const sync = new StubRunner();
      sync.code = null;
      sync.termination = stalled().termination;
      const { command, io, repoRoot, cleanup } = fixture({ sync });
      try {
        gitInit(repoRoot);
        const plan = planFor(repoRoot);
        const { workspace, ledger } = cliScene(repoRoot);
        seedReview(ledger);
        const reviews = path.join(workspace.path, "tasks-1-review-1.json");
        const code = await withHost(() =>
          command.runArgv([
            "fix",
            "--type",
            "wave",
            "--tasks",
            "1",
            "--plan",
            plan,
            "--reviews",
            reviews,
          ]),
        );
        expect(code).toBe(1);
        expect(io.stdoutText).toContain("status: TIMEOUT");
        expect(io.stdoutText).not.toMatch(/^next:/m);
        expect(ledger.roundCount(1, "fix")).toBe(0);
        expect(ledger.counterOf("timeoutCount")).toBe(1);
        const crash = readJson<{ promoted: boolean; cause: string }>(
          path.join(workspace.path, "crash-tasks-1-fix-1.json"),
        );
        expect(crash.promoted).toBe(false);
        expect(crash.cause).toBe("stalled");
      } finally {
        cleanup();
      }
    });

    it("a review round whose draft is missing — TIMEOUT", async () => {
      const sync = new StubRunner();
      sync.code = null;
      sync.termination = stalled().termination;
      const { command, io, repoRoot, cleanup } = fixture({ sync });
      try {
        gitInit(repoRoot);
        const plan = planFor(repoRoot);
        const { workspace, ledger } = cliScene(repoRoot);
        seedImplement(ledger);
        const code = await withHost(() =>
          command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", plan]),
        );
        expect(code).toBe(1);
        expect(io.stdoutText).toContain("status: TIMEOUT");
        expect(io.stdoutText).not.toMatch(/^next:/m);
        expect(ledger.roundCount(1, "review")).toBe(0);
        expect(ledger.counterOf("timeoutCount")).toBe(1);
        const crash = readJson<{ promoted: boolean; cause: string }>(
          path.join(workspace.path, "crash-tasks-1-review-1.json"),
        );
        expect(crash.promoted).toBe(false);
        expect(crash.cause).toBe("stalled");
        // the failure summary carries the crash record as its handoff cell
        expect(io.stdoutText).toContain("handoff: .kairos/cdd/p3/crash-tasks-1-review-1.json");
      } finally {
        cleanup();
      }
    });

    it("a review round whose draft is truncated (invalid JSON) — TIMEOUT", async () => {
      const sync = new StubRunner();
      sync.code = null;
      sync.termination = stalled().termination;
      const { command, io, repoRoot, cleanup } = fixture({ sync });
      try {
        gitInit(repoRoot);
        const plan = planFor(repoRoot);
        const { workspace, ledger } = cliScene(repoRoot);
        seedImplement(ledger);
        // a truncated draft is an invalid draft — never a promotion
        writeFileSync(
          path.join(workspace.path, "tasks-1-review-1.json"),
          '{"findings": [{"severity": "blocker", "lens": "code", "summary": "drift"',
          "utf8",
        );
        const code = await withHost(() =>
          command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", plan]),
        );
        expect(code).toBe(1);
        expect(io.stdoutText).toContain("status: TIMEOUT");
        expect(io.stdoutText).not.toMatch(/^next:/m);
        expect(ledger.roundCount(1, "review")).toBe(0);
        expect(ledger.counterOf("timeoutCount")).toBe(1);
        const crash = readJson<{ promoted: boolean; cause: string }>(
          path.join(workspace.path, "crash-tasks-1-review-1.json"),
        );
        expect(crash.promoted).toBe(false);
        expect(crash.cause).toBe("stalled");
      } finally {
        cleanup();
      }
    });

    it("a review round whose draft is valid but has zero findings — TIMEOUT", async () => {
      const sync = new StubRunner();
      sync.code = null;
      sync.termination = stalled().termination;
      const { command, io, repoRoot, cleanup } = fixture({ sync });
      try {
        gitInit(repoRoot);
        const plan = planFor(repoRoot);
        const { workspace, ledger } = cliScene(repoRoot);
        seedImplement(ledger);
        writeFileSync(
          path.join(workspace.path, "tasks-1-review-1.json"),
          JSON.stringify({ findings: [] }),
          "utf8",
        );
        const code = await withHost(() =>
          command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", plan]),
        );
        expect(code).toBe(1);
        expect(io.stdoutText).toContain("status: TIMEOUT");
        expect(io.stdoutText).not.toMatch(/^next:/m);
        expect(ledger.roundCount(1, "review")).toBe(0);
        expect(ledger.counterOf("timeoutCount")).toBe(1);
        const crash = readJson<{ promoted: boolean; cause: string }>(
          path.join(workspace.path, "crash-tasks-1-review-1.json"),
        );
        expect(crash.promoted).toBe(false);
        expect(crash.cause).toBe("stalled");
      } finally {
        cleanup();
      }
    });
  });

  it("a promoted round makes cdd fix --reviews accepted", async () => {
    // The promotion records the review round (`roundCount(review) > 0`), which is
    // exactly the fix gate's readiness fact — the fix verb no longer refuses.
    const sync = new StubRunner();
    sync.code = null;
    sync.termination = stalled().termination;
    const { command, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const { workspace, ledger } = cliScene(repoRoot);
      seedImplement(ledger);
      writeFileSync(
        path.join(workspace.path, "tasks-1-review-1.json"),
        JSON.stringify({
          findings: [{ severity: "blocker", lens: "code", summary: "drift" }],
        }),
        "utf8",
      );
      const promoted = await withHost(() =>
        command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", plan]),
      );
      expect(promoted).toBe(0);
      // the fix gate accepts — an injected approving dispatch isolates the gate face
      const fixIo = new CaptureIo();
      const fixCommand = Cli.create({ io: fixIo, dispatch: APPROVING });
      const fixCode = await fixCommand.runArgv([
        "fix",
        "--type",
        "wave",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--reviews",
        path.join(workspace.path, "tasks-1-review-1.json"),
      ]);
      expect(fixIo.stderrText).not.toContain("cannot dispatch a fix round");
      expect(fixCode).toBe(0);
    } finally {
      cleanup();
    }
  });
});

describe("T9 — the destroy-list zero-residual sweep (spec §6.3 cross-reference)", () => {
  it("the hand-written parse monoliths + the destroyed write-plane table carry zero residual across the engine source", () => {
    // The destroy list (spec §6.3 + the T3 parallel-table destroy): the four
    // hand-written value-domain monoliths (destroyed at T7 — the rules live in
    // declare.ts VALUE_SHAPES) and the HANDOFF_WRITE_PLANE parallel table
    // (destroyed at T3 — the write plane derives from the declared properties).
    // The retained pair (#parseTypeKey/SCHEMA_TYPE_KEYS — the schema <type>
    // doc-key vocabulary, orthogonal to the value-shape table) is NOT swept here —
    // its retention is pinned in projection.test.ts.
    const destroyed = [
      "#parseEnum",
      "#parseInts",
      "#parseSha8",
      "#parseInt",
      "HANDOFF_WRITE_PLANE",
    ] as const;
    for (const [file, text] of engineSourceTexts()) {
      for (const name of destroyed) {
        expect(text, `${name} must not survive in ${file}`).not.toContain(name);
      }
    }
  });

  it("the retired commit-sha vocabulary carries zero residual across the engine source (spec §7.4)", () => {
    // The sha surface retired engine-wide (§2): no source file names the retired
    // scope tokens (WAVE_BASE / FIX_BASE / INPUT_RANGE) or the retired git/BranchRef
    // members (revParseHead / BranchRef) — the GitClient holds only topLevel +
    // isClean, the review carries the kind-named doc anchors (INPUT_PLAN / INPUT_SPEC,
    // resurrected as the semantic round-context tokens), and the branch scope rides
    // the base artifact's BASE_BRANCH. The pin is construction-establishment-level:
    // it fails if any retired name resurfaces in a non-test source file.
    const retiredShaVocab = [
      "WAVE_BASE",
      "FIX_BASE",
      "INPUT_RANGE",
      "revParseHead",
      "BranchRef",
    ] as const;
    for (const [file, text] of engineSourceTexts()) {
      for (const name of retiredShaVocab) {
        expect(text, `${name} must not survive in ${file}`).not.toContain(name);
      }
    }
  });

  it("the retired process-seam + dead-cause vocabulary carries zero residual across the engine source", () => {
    // The child seam is asynchronous and value-shaped (P12 T1): the synchronous
    // process face (SyncProcess/SyncRunner) and execa's synchronous entry
    // (execaSync) are retired whole — the terminator holds the process lifecycle.
    // The three dead crash causes (`engine-timeout` / `engine-over-budget` /
    // `child-signal`) had zero writers and are retired in favour of the single
    // termination-cause vocabulary. The user-facing `detached` option is never set
    // (it would short-circuit execa's parent-exit cleanup — group kill rides
    // `killDescendants` alone), so the option-key form must not appear either.
    const retiredProcessVocab = [
      "execaSync",
      "SyncProcess",
      "SyncRunner",
      "engine-timeout",
      "engine-over-budget",
      "child-signal",
      "detached:",
    ] as const;
    for (const [file, text] of engineSourceTexts()) {
      for (const name of retiredProcessVocab) {
        expect(text, `${name} must not survive in ${file}`).not.toContain(name);
      }
    }
  });
});

/** The stub child-runner seam — records every dispatch's `ChildRun`, and answers a
 *  canned stdout. */
class StubRunner implements ChildRunner {
  calls: ChildRun[] = [];
  stdout = "";
  /** The canned child exit code (default 0 = success; null = the child was killed
   *  and has no exit code) — drives the crash-record face's death facts. */
  code: number | null = 0;
  /** The canned termination fact (default null = the round ended by itself) — a
   *  non-null value drives the terminated-round face's TIMEOUT + crash facts. */
  termination: Termination | null = null;

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    return { code: this.code, stdout: this.stdout, stderr: "", termination: this.termination };
  }
}

// ---------------------------------------------------------------------------
// P21 — the in-flight record · the crash identity · the crash's git facts
// ---------------------------------------------------------------------------

/** A scene over a temp repo's default namespace (the HarnessDispatch fixture). */
const sceneOf = (
  repoRoot: string,
  planPath: string | null = null,
  briefPath: string | null = null,
): DispatchScene => {
  const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
  const ledger = new Ledger(workspace, new ConfigLoader());
  return { workspace, ledger, planPath, briefPath };
};

const P21_IMPLEMENT: OpenFrame = {
  type: "wave",
  phase: "implement",
  round: 1,
  target: { kind: "wave", tasks: [1] },
  params: { tasks: "1" },
  key: "1",
};

const P21_REVIEW: OpenFrame = {
  type: "wave",
  phase: "review",
  round: 1,
  target: { kind: "wave", tasks: [1] },
  params: { tasks: "1", round: 1 },
  key: "1",
};

const P21_EVIDENCE = {
  command: "npx vitest run",
  exit_code: 0,
  passed: true,
  warnings_count: 0,
  typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
};

/** The dispatch that reports the in-flight record's bytes at the spawn instant and
 *  plants the implement round's write-back (draft + evidence). */
class RecordProbeRunner implements ChildRunner {
  calls: ChildRun[] = [];
  /** The in-flight record's bytes seen inside `run` (i.e. after the spawn was asked
   *  for) — null when no record stood, which would be the defect. */
  recordAtSpawn: string | null = null;
  /** The dispatch's workspace directory (where the child's write-back lands). */
  readonly #workspace: string;

  constructor(workspace: string) {
    this.#workspace = workspace;
  }

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    const recordPath = run.inflight.path();
    this.recordAtSpawn = existsSync(recordPath) ? readFileSync(recordPath, "utf8") : null;
    writeFileSync(
      path.join(this.#workspace, "tasks-1-implement.json"),
      JSON.stringify({ status: "APPROVED", artifacts: {} }),
      "utf8",
    );
    writeFileSync(
      path.join(this.#workspace, "tasks-1-test-evidence.json"),
      JSON.stringify(P21_EVIDENCE),
      "utf8",
    );
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

/** The dispatch that crashes AFTER making one real commit — the `commitsSince` shape. */
class CommittingCrashRunner implements ChildRunner {
  calls: ChildRun[] = [];
  /** The commit subject the child writes before dying. */
  static readonly SUBJECT = "child work before the crash";

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    writeFileSync(path.join(run.cwd, "child.txt"), "work\n", "utf8");
    spawnSync("git", ["add", "-A"], { cwd: run.cwd });
    spawnSync("git", ["commit", "-q", "-m", CommittingCrashRunner.SUBJECT], { cwd: run.cwd });
    return { code: 1, stdout: "", stderr: "", termination: null };
  }
}

describe("P21 — the in-flight record (the intent before the spawn, the release at the end)", () => {
  it("publishes the record before the child is spawned and releases it at the normal end", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      planFor(repoRoot);
      const scene = sceneOf(repoRoot);
      const io = new CaptureIo();
      const runner = new RecordProbeRunner(scene.workspace.path);
      const dispatch = new HarnessDispatch({ scene, io, sync: runner, env: { AI_AGENT: "pi" } });
      const outcome = await dispatch.step()(P21_IMPLEMENT);
      expect(outcome.status).toBe("APPROVED");
      // The record existed INSIDE run() — i.e. before the child was spawned.
      expect(runner.recordAtSpawn).not.toBeNull();
      const atSpawn = JSON.parse(runner.recordAtSpawn as string) as InFlightRecord;
      expect(atSpawn.pid).toBe(process.pid);
      expect(atSpawn.slug).toBe("p3");
      expect(atSpawn.phase).toBe("implement");
      expect(atSpawn.wave).toBe("1");
      // The record's instant is the pid's OWN start time — the instant the
      // pid-reuse guard compares against, never the dispatch instant.
      expect(atSpawn.startedAt).toBe(await ProcessFacts.startOf(process.pid));
      // The normal end released BOTH the record and the lock.
      const recordPath = path.join(scene.workspace.root.path, "in-flight.json");
      expect(existsSync(recordPath)).toBe(false);
      expect(existsSync(`${recordPath}.lock`)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("survives a session older than the guard's tolerance — the record describes the pid", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      planFor(repoRoot);
      const scene = sceneOf(repoRoot);
      const io = new CaptureIo();
      const runner = new RecordProbeRunner(scene.workspace.path);
      // A six-hour-old session (the implement budget): the dispatch instant sits far
      // outside the liveness guard's 60 s start-time tolerance, so a record carrying
      // the dispatch instant would read a LIVE holder dead and authorize a takeover.
      const startedAt = Date.now() - 6 * 60 * 60 * 1000;
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync: runner,
        env: { AI_AGENT: "pi" },
        proc: { startOf: async () => startedAt },
      });
      await dispatch.step()(P21_IMPLEMENT);
      const record = JSON.parse(runner.recordAtSpawn as string) as InFlightRecord;
      expect(record.startedAt).toBe(startedAt);
    } finally {
      cleanup();
    }
  });

  it("keeps the record standing when the child crashes — zero release on a non-normal end", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      planFor(repoRoot);
      const scene = sceneOf(repoRoot);
      const io = new CaptureIo();
      const runner = new StubRunner();
      runner.code = 1;
      const dispatch = new HarnessDispatch({ scene, io, sync: runner, env: { AI_AGENT: "pi" } });
      const outcome = await dispatch.step()(P21_IMPLEMENT);
      expect(outcome.status).toBe("BLOCKED");
      // The crash's postmortem fact survives: the record is not the loop's to remove.
      const recordPath = path.join(scene.workspace.root.path, "in-flight.json");
      expect(existsSync(recordPath)).toBe(true);
      const record = JSON.parse(readFileSync(recordPath, "utf8")) as InFlightRecord;
      expect(record.phase).toBe("implement");
      // …and the crash record was named from the frame's identity.
      expect(existsSync(path.join(scene.workspace.path, "crash-tasks-1-implement-1.json"))).toBe(
        true,
      );
    } finally {
      cleanup();
    }
  });

  it("computes the brief hash at acquire time — the ledger's ONE hash face, non-null on a wave's FIRST dispatch", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const planPath = planFor(repoRoot);
      const briefPath = path.join(repoRoot, ".kairos", "brief.md");
      mkdirSync(path.dirname(briefPath), { recursive: true });
      const brief = new BriefRenderer().render(readFileSync(planPath, "utf8"), [1]);
      writeFileSync(briefPath, brief, "utf8");
      const scene = sceneOf(repoRoot, planPath, briefPath);
      // The ledger carries NO `brief-revision` record yet (the wave's first dispatch).
      expect(scene.ledger.reviewedRevisionOf("1")).toBeNull();
      const io = new CaptureIo();
      const runner = new RecordProbeRunner(scene.workspace.path);
      const dispatch = new HarnessDispatch({ scene, io, sync: runner, env: { AI_AGENT: "pi" } });
      await dispatch.step()(P21_IMPLEMENT);
      const record = JSON.parse(runner.recordAtSpawn as string) as InFlightRecord;
      const expected = scene.ledger
        .refs()
        .briefRevision(path.relative(repoRoot, planPath), brief).brief_hash;
      expect(record.briefHash).toBe(expected);
      // The SAME hash the ledger binds when the review completes (same hash face).
      expect(record.briefHash).toBe(briefRevision(repoRoot, planPath, "1").brief_hash);
    } finally {
      cleanup();
    }
  });

  it("leaves the brief hash null off the wave face — a doc review carries no brief", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const planPath = planFor(repoRoot);
      const briefPath = path.join(repoRoot, ".kairos", "brief.md");
      mkdirSync(path.dirname(briefPath), { recursive: true });
      writeFileSync(briefPath, "### Task 1: x\n", "utf8");
      const scene = sceneOf(repoRoot, planPath, briefPath);
      const io = new CaptureIo();
      // The probe captures the record INSIDE run() — the normal end releases it, so the
      // post-run file is (correctly) gone.
      const runner = new RecordProbeRunner(scene.workspace.path);
      const dispatch = new HarnessDispatch({ scene, io, sync: runner, env: { AI_AGENT: "pi" } });
      const planReview: OpenFrame = {
        type: "plan",
        phase: "review",
        round: 1,
        target: { kind: "plan", doc: planPath },
        params: { round: 1 },
        key: path.relative(repoRoot, planPath),
      };
      await dispatch.step()(planReview);
      const record = JSON.parse(runner.recordAtSpawn as string) as InFlightRecord;
      expect(record.briefHash).toBeNull();
      expect(record.wave).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("keeps the brief hash's ONLY derivation in ReviewRefs — zero new hash surface", () => {
    const carriers = engineSourceTexts()
      .filter(([, text]) => text.includes("createHash"))
      .map(([file]) => file);
    expect(carriers).toEqual(["session/ledger.ts"]);
  });
});

describe("P21 — the crash record's identity and git facts", () => {
  it("names the crash after the frame's wave key and round — the ledger row's key, the frame's handoff", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      planFor(repoRoot);
      const scene = sceneOf(repoRoot);
      // The wave row exists in progress.json (its implement round landed normally).
      scene.ledger.recordRound("1", "implement");
      const io = new CaptureIo();
      const runner = new StubRunner();
      runner.code = 1;
      const dispatch = new HarnessDispatch({ scene, io, sync: runner, env: { AI_AGENT: "pi" } });
      const outcome = await dispatch.step()(P21_REVIEW);
      expect(outcome.status).toBe("BLOCKED");
      const crashPath = path.join(scene.workspace.path, "crash-tasks-1-review-1.json");
      expect(existsSync(crashPath)).toBe(true);
      const crash = readJson<CrashRecord>(crashPath);
      // The name parses back to the SAME wave key the ledger row carries…
      const progress = readJson<{ waves: { wave: string; rounds?: Record<string, number[]> }[] }>(
        path.join(scene.workspace.path, "progress.json"),
      );
      const row = progress.waves.find((entry) => entry.wave === "1");
      expect(row?.rounds?.implement).toEqual([1]);
      expect(path.basename(crashPath)).toBe("crash-tasks-1-review-1.json");
      // …and the attempted handoff is THIS frame's own path.
      expect(crash.attemptedHandoff).toBe(
        path.relative(repoRoot, path.join(scene.workspace.path, "tasks-1-review-1.json")),
      );
    } finally {
      cleanup();
    }
  });

  it("records the dispatch base and the commits the crashed child left behind", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const base = gitInit(repoRoot);
      planFor(repoRoot);
      const scene = sceneOf(repoRoot);
      const io = new CaptureIo();
      const runner = new CommittingCrashRunner();
      const dispatch = new HarnessDispatch({ scene, io, sync: runner, env: { AI_AGENT: "pi" } });
      const outcome = await dispatch.step()(P21_IMPLEMENT);
      expect(outcome.status).toBe("BLOCKED");
      const crash = readJson<CrashRecord>(
        path.join(scene.workspace.path, "crash-tasks-1-implement-1.json"),
      );
      expect(crash.dispatchBase).toBe(base);
      expect(crash.commitsSince.length).toBe(1);
      expect(crash.commitsSince[0]).toContain(CommittingCrashRunner.SUBJECT);
      const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot })
        .stdout.toString()
        .trim();
      expect(crash.commitsSince[0]).toBe(`${head} ${CommittingCrashRunner.SUBJECT}`);
    } finally {
      cleanup();
    }
  });

  it("leaves commitsSince empty when the crashed child committed nothing", async () => {
    const { repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      planFor(repoRoot);
      const scene = sceneOf(repoRoot);
      const io = new CaptureIo();
      const runner = new StubRunner();
      runner.code = 1;
      const dispatch = new HarnessDispatch({ scene, io, sync: runner, env: { AI_AGENT: "pi" } });
      await dispatch.step()(P21_IMPLEMENT);
      const crash = readJson<CrashRecord>(
        path.join(scene.workspace.path, "crash-tasks-1-implement-1.json"),
      );
      expect(crash.commitsSince).toEqual([]);
      expect(crash.dispatchBase).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  it("appends the late-landing hint to all three cut-short terminal faces — kill · timeout · crash", async () => {
    const cases: { label: string; code: number | null; termination: Termination | null }[] = [
      {
        label: "kill",
        code: null,
        termination: { cause: "signal", idleMs: 5, lastSample: null },
      },
      {
        label: "timeout",
        code: null,
        termination: { cause: "over-budget", idleMs: 5, lastSample: null },
      },
      { label: "crash", code: 1, termination: null },
    ];
    const words = new Words();
    for (const entry of cases) {
      const { repoRoot, cleanup } = fixture();
      try {
        gitInit(repoRoot);
        planFor(repoRoot);
        const scene = sceneOf(repoRoot);
        const io = new CaptureIo();
        const runner = new StubRunner();
        runner.code = entry.code;
        runner.termination = entry.termination;
        const dispatch = new HarnessDispatch({ scene, io, sync: runner, env: { AI_AGENT: "pi" } });
        await dispatch.step()(P21_IMPLEMENT);
        expect(io.stderrText, `${entry.label}: the late-landing hint`).toContain(
          words.lateLandingHint(),
        );
      } finally {
        cleanup();
      }
    }
  });
});

describe("P21 — the in-flight word rows", () => {
  it("carries the three canonical recovery sentences verbatim", () => {
    const words = new Words();
    expect(words.inFlightWords().recovery).toEqual([
      "look at the working tree first",
      "commit the changes that work",
      "discard the ones that are broken",
    ]);
  });

  it("renders the held report from the holder's facts — pid, command, startedAt, uptime, wave, slug", () => {
    const words = new Words();
    const startedAt = Date.now() - 90 * 60_000;
    const held = words.inFlightHeld({
      pid: 4242,
      command: "cdd implement --tasks 3,4 --plan docs/p3.md",
      startedAt,
      wave: "3,4",
      slug: "p3",
    });
    expect(held).toContain("pid 4242");
    expect(held).toContain("cdd implement --tasks 3,4 --plan docs/p3.md");
    expect(held).toContain(new Date(startedAt).toISOString());
    expect(held).toContain("running for 90m");
    expect(held).toContain("3,4");
    expect(held).toContain("p3");
    expect(words.inFlightWords().stealable).toContain("--steal-stale");
    expect(words.inFlightWords().corruptLocked).toContain("--steal-stale");
    expect(words.inFlightWords().corruptUnlocked).toContain("--steal-stale");
  });

  it("declares --steal-stale on the implement / review / fix help faces — the command face stays eight", async () => {
    const { command, io, cleanup } = fixture();
    try {
      for (const verb of ["implement", "review", "fix"] as const) {
        io.stdoutText = "";
        const code = await command.runArgv([verb, "--help"]);
        expect(code).toBe(0);
        expect(io.stdoutText, `${verb}: --steal-stale`).toContain("--steal-stale");
        expect(io.stdoutText, `${verb}: the takeover help row`).toContain(
          "take over a standing in-flight record",
        );
      }
      expect(CLI_COMMANDS.length).toBe(8);
    } finally {
      cleanup();
    }
  });
});
