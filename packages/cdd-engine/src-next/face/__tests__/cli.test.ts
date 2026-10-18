// packages/cdd-engine/src-next/face/__tests__/cli.test.ts
// T11 Cli + composition-root suite (design spec §3.3):
//   · the command face — the seven steady subcommand words (implement / review / fix /
//     schema / issue / base / board with their nested leaves) and the usage lines the
//     consumers read (T20: the base command face — `cdd base set|get` — converges
//     the command surface; T5 adds the board observability command);
//   · parse — the commander-native parse pipeline (the projection's program): the
//     value-domain validation (int-list tasks, enum type / source, sha base/head,
//     int round) + the unknown-flag rejection (the
//     acceptance's unknown-flag BLOCK) and the program scopes (--dry-run / --help)
//     — the parse-level assertions ride runArgv (the retired tokenizer and its
//     guard never return to the tree);
//   · the work-command E2E (dry-run) — implement / review / fix compose the lifecycle,
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
//     (template data plane), the child return-block parse (block + JSON).
// Fixtures are hermetic mkdtemp repos (git-inited for the dry-run HEAD); the io is
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
import { afterEach, describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { BriefRenderer } from "../../render/brief.ts";
import type { RouteTarget } from "../../session/faces.ts";
import { Ledger } from "../../session/ledger.ts";
import type { Route } from "../../session/next.ts";
import { FIX_READBACK_SUFFIX } from "../../session/next.ts";
import type { OpenFrame } from "../../session/run.ts";
import { Capsule } from "../capsule.ts";
import type { CliIo, CliOptions, DispatchScene, SyncProcess } from "../cli.ts";
import { Cli, HarnessDispatch } from "../cli.ts";
import { CLI_COMMANDS, type CliVerb } from "../declare.ts";
import { CommandTreeBuilder } from "../projection.ts";
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
afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

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

/** Init a git repo with one commit — the dry-run's HEAD (the review `next:` base).
 *  The fixture .gitignore keeps the dispatch's own writes (the `.kairos` workspace)
 *  and the fixture's synthetic docs (`/docs/`) out of the tree — the working tree
 *  stays clean across multi-dispatch flows (the P4.1 clean-tree dispatch gate).
 *  Pass an explicit ignore content to shape it (the no-`.kairos`-ignore consumer
 *  regression). */
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
      "spec: docs/kairos/specs/p3-design.md",
      "parent-program: docs/kairos/specs/p3-overall.md",
      "parent-version: v1.0",
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
const conformingPlan = (
  repoRoot: string,
  specTarget = "docs/kairos/specs/p3-design.md",
): string => {
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
      `spec: ${specTarget}`,
      "parent-program: docs/kairos/specs/p3-overall.md",
      "parent-version: v1.0",
      "depends-on: P1",
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
  for (const sibling of ["p3-design.md", "p3-overall.md"]) {
    const siblingPath = path.join(repoRoot, "docs", "kairos", "specs", sibling);
    mkdirSync(path.dirname(siblingPath), { recursive: true });
    writeFileSync(siblingPath, `# ${sibling}\n`, "utf8");
  }
  return file;
};

/** A doc-contract-clean overall — every registered overall element present (the
 *  header tuple + the ten-element charter + the inventory tables), its chain links
 *  resolving into existing same-family siblings. The overall charter is the
 *  GOOD_OVERALL judge fixture shape (judge.test.ts:19-71) with the `o1-` names
 *  the temp repo actually holds — the review face's doc-contract gate must judge it
 *  under the overall-spec key (zero phase-spec misreport on the doc-key derivation). */
const conformingOverall = (repoRoot: string): string => {
  const file = path.join(repoRoot, "docs", "kairos", "specs", "o1-overall.md");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    [
      "---",
      "title: Test Overall",
      "doc-type: overall-spec",
      "version: v1.21",
      "date: 2026-10-07",
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
      "| overall-spec | docs/kairos/specs/o1-overall.md |",
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
const independentPlan = (repoRoot: string, name: string, count: number): string => {
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
      "spec: docs/kairos/specs/p3-design.md",
      "parent-program: docs/kairos/specs/p3-overall.md",
      "parent-version: v1.0",
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
      "status: Draft",
      "author: x",
      "parent-program: docs/kairos/specs/x-overall.md",
      "parent-version: v1.0",
      "depends-on: P1",
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
  // The chain sibling — the `parent-program:` link resolves into the specs dir.
  const sibling = path.join(repoRoot, "docs", "kairos", "specs", "x-overall.md");
  mkdirSync(path.dirname(sibling), { recursive: true });
  writeFileSync(sibling, "# x-overall\n", "utf8");
  return file;
};

// ---------------------------------------------------------------------------
// the command face — the steady subcommand words
// ---------------------------------------------------------------------------

describe("the command face — the seven steady subcommand words", () => {
  it("declares exactly the seven subcommands of the steady command face", () => {
    expect(CLI_COMMANDS.map((command) => command.name)).toEqual([
      "implement",
      "review",
      "fix",
      "base",
      "schema",
      "issue",
      "board",
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
        "unknown schema type: bogus (available: overall-spec, plan, phase-spec, single-spec)",
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
    gate.parse(["schema", "get", "overall-spec"], { from: "user" });
    expect(get.processedArgs[0]).toBe("overall-spec");
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

  it("a pre-verb --dry-run dispatches through the program scope — the flag merges into the run (exit 0)", async () => {
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
      expect(io.stdoutText).toContain("status: APPROVED");
      expect(
        existsSync(path.join(repoRoot, ".kairos", "cdd", "p3", "tasks-1-implement.json")),
      ).toBe(true);
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
      // the seven-command table + the built-in help [command] row (native layout)
      for (const name of ["implement", "review", "fix", "base", "schema", "issue", "board"]) {
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
      for (const verb of ["implement", "review", "fix", "base", "schema", "issue", "board"]) {
        expect(await command.runArgv([verb, "--help"])).toBe(0);
      }
      // the tail note rides the commander afterAll surface — one line per help
      // face, listing --dry-run ALONE (the -h/--help redundant column unwritten)
      const legend = /program flags \(accepted at any position\): --dry-run/g;
      expect(io.stdoutText.match(legend) ?? []).toHaveLength(7);
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

  it("cdd --help — the native program face: Usage · the seven-command table (short descriptions = the CLI_COMMANDS projection) · Examples heading · the --dry-run-only footer", async () => {
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
      // The seven command rows — the command names + their short descriptions
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
      expect(footer).toBe("program flags (accepted at any position): --dry-run");
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
// the work commands — the lifecycle/capsule/ledger composition (dry-run E2E)
// ---------------------------------------------------------------------------

describe("the work commands run the lifecycle/capsule/ledger — dry-run E2E", () => {
  it("implement — one dispatch, the capsule face, the ledger record + the rendered brief", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv([
        "implement",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
      ]);
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
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const briefPath = path.join(repoRoot, ".kairos", "cdd", "p3", "tasks-1-brief.md");
      expect(
        await command.runArgv(["implement", "--tasks", "1", "--plan", plan, "--dry-run"]),
      ).toBe(0);
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
        await command.runArgv([
          "review",
          "--type",
          "wave",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
        ]),
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
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot, 2);
      // The root wave {1} first (task 2's dep sits in wave 1). Implementing task 1 does
      // NOT close it (implement rounds are never a closure — v1.20 closedWaves), so the
      // wave advances only through the review's C5 closure: review 1 must land before
      // task 2 becomes dispatchable.
      expect(
        await command.runArgv(["implement", "--tasks", "1", "--plan", plan, "--dry-run"]),
      ).toBe(0);
      io.stdoutText = "";
      expect(
        await command.runArgv([
          "review",
          "--type",
          "wave",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
        ]),
      ).toBe(0);
      io.stdoutText = "";
      const code = await command.runArgv([
        "implement",
        "--tasks",
        "2",
        "--plan",
        plan,
        "--dry-run",
      ]);
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
      });
      expect(progress.waves).toContainEqual({ wave: "2", rounds: { implement: [1] } });
      // the invocation's single stdout face — only the LAST step's capsule
      expect(io.stdoutText.split("status: APPROVED").length - 1).toBe(1);
      expect(existsSync(path.join(workspace, "tasks-2-implement.json"))).toBe(true);
      // the strict-wave gate (T24): a `--tasks` splitting the derived wave BLOCKs
      io.stderrText = "";
      const split = await command.runArgv([
        "implement",
        "--tasks",
        "1,2",
        "--plan",
        plan,
        "--dry-run",
      ]);
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
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      expect(
        await command.runArgv(["implement", "--tasks", "1", "--plan", plan, "--dry-run"]),
      ).toBe(0);
      io.stdoutText = "";
      const code = await command.runArgv([
        "review",
        "--type",
        "wave",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
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
      dispatch: (frame: OpenFrame) =>
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
      expect(
        await command.runArgv(["implement", "--tasks", "1", "--plan", plan, "--dry-run"]),
      ).toBe(0);
      io.stdoutText = "";
      const code = await command.runArgv([
        "review",
        "--type",
        "wave",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
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
    const { command, io, repoRoot, cleanup } = fixture();
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
      const code = await command.runArgv([
        "fix",
        "--type",
        "wave",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
      ]);
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
      dispatch: (frame: OpenFrame) =>
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
      const workspace = new Workspace(
        new WorkspaceRoot(repoRoot, ".kairos/cdd"),
        Workspace.slugFromDoc(plan),
      ).ensure();
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
        "--dry-run",
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
      const reExit = await command.runArgv([
        "review",
        "--type",
        "branch",
        "--plan",
        plan,
        "--dry-run",
      ]);
      expect(reExit).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("review --type branch — the live-tree branch face", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      const code = await command.runArgv([
        "review",
        "--type",
        "branch",
        "--plan",
        plan,
        "--dry-run",
      ]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED · blocker: 0 ·");
      // T3 deliberate pin break: the branch closure routes the cdd-close ref
      // (PIPELINE_NEXT.branch through REFS[ref][host]).
      expect(io.stdoutText).toContain("next: /kairos:cdd-close");
      // the branch line's workspace is the plan-slug (the fix dispatch's --plan) and
      // the handoff is the spine `branch-review-1.json` (no range token in the name)
      const workspace = path.join(repoRoot, ".kairos", "cdd", Workspace.slugFromDoc(plan));
      expect(existsSync(path.join(workspace, "branch-review-1.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("review --type branch — the CLI injects the base artifact's branch as BASE_BRANCH (the scope anchor value source)", async () => {
    const sync = new FakeSync();
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
      // A REAL branch-review dispatch (not --dry-run — the dry-run synthetic approval
      // never reaches the lifecycle). The host is injected ambiently (the CLI's
      // production dispatch reads process.env), so mark it and restore it.
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
    const sync = new FakeSync();
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
      // A REAL dispatch (not --dry-run — the synthetic approval never reaches the
      // lifecycle). The host is injected ambiently (the CLI's production dispatch
      // reads process.env), so mark it and restore it.
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
          path.join(repoRoot, "docs", "kairos", "specs", "s1-design.md"),
        ]);
        expect(spec).not.toContain("BASE_BRANCH");
        // the spec review's judged doc IS the spec — the kind-named anchor carries it
        expect(spec).toContain("- `INPUT_SPEC`: docs/kairos/specs/s1-design.md");
        const planReview = await promptOf(["review", "--type", "plan", "--plan", plan]);
        expect(planReview).not.toContain("BASE_BRANCH");
        // the plan-review round context carries the plan's `spec:` anchor
        // (INPUT_SPEC) so the reviewer judges the plan against its design spec
        expect(planReview).toContain("- `INPUT_SPEC`: docs/kairos/specs/p3-design.md");
      } finally {
        if (saved === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
        else process.env.CLAUDE_CODE_SESSION_ID = saved;
      }
    } finally {
      cleanup();
    }
  });

  it("D46 — INPUT_SPEC is rebased to a repoRoot-relative token from the plan's plan-dir-relative `spec:` scalar", async () => {
    const sync = new FakeSync();
    sync.stdout = "status: APPROVED\n";
    const { command, repoRoot, cleanup } = fixture({ sync });
    try {
      gitInit(repoRoot);
      // The live plan header form: the `spec:` front-matter scalar may carry a
      // plan-dir-relative value (`../specs/X.md`, relative to the plan's OWN dir) —
      // the actual form every in-repo plan P6+ uses. The reviewer is spawned at
      // cwd = repoRoot, so the raw plan-dir-relative form would resolve OUTSIDE
      // the repo; the scene rebases it to the repoRoot-relative token (the one
      // basis every round-context path token speaks).
      const plan = conformingPlan(repoRoot, "../specs/p3-design.md");
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
    const sync = new FakeSync();
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
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const outside = realpathSync(mkdtempSync(path.join(tmpdir(), "cli-outside-")));
      const plan = conformingPlan(outside);
      try {
        // a plan OUTSIDE the fixture repo (the absolute path relativizes to `../…`);
        // --dry-run keeps the dispatch synthetic (no child spawn).
        const code = await command.runArgv([
          "--dry-run",
          "implement",
          "--tasks",
          "1",
          "--plan",
          plan,
        ]);
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
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      // The declared, contract-clean spec doc — the `doc-type:` head key
      // (spec §12 · D34) the capsule's doc-class discrimination reads
      // (zero filename inference).
      const spec = conformingSpec(repoRoot);
      const specCode = await command.runArgv([
        "review",
        "--type",
        "spec",
        "--spec",
        spec,
        "--dry-run",
      ]);
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
      const planCode = await command.runArgv([
        "review",
        "--type",
        "plan",
        "--plan",
        plan,
        "--dry-run",
      ]);
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
      const code = await command.runArgv(["review", "--type", "plan", "--plan", plan, "--dry-run"]);
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

  it("review --type spec of an -overall.md — the overall-spec doc-key face (zero phase-spec misreport)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const overall = conformingOverall(repoRoot);
      const overallCode = await command.runArgv([
        "review",
        "--type",
        "spec",
        "--spec",
        overall,
        "--dry-run",
      ]);
      expect(overallCode).toBe(0);
      expect(io.stdoutText).toContain("next: done");
      // The overall was judged under the overall-spec key (its declared
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
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      // Round 1: the initial clean review closes the doc line AND records the
      // reviewed doc revision (the line's identity — the T7 write-back at bookkeep).
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan, "--dry-run"])).toBe(
        0,
      );
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
      const reopen = await command.runArgv([
        "review",
        "--type",
        "plan",
        "--plan",
        plan,
        "--dry-run",
      ]);
      expect(reopen).toBe(0);
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3", "plan-review-2.json"))).toBe(
        true,
      );
    } finally {
      cleanup();
    }
  });

  it("an UNCHANGED closed doc line stays blocked — the revision-aware BLOCK message (T7)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan, "--dry-run"])).toBe(
        0,
      );
      expect(io.stdoutText).toContain("next: /kairos:cdd-dev");
      // The doc did NOT move — the line gate compares the current revision to the
      // reviewed one and BLOCKs with the identity-aware message (the old "no open
      // round" text retires on the doc face).
      io.stderrText = "";
      const unchanged = await command.runArgv([
        "review",
        "--type",
        "plan",
        "--plan",
        plan,
        "--dry-run",
      ]);
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

  it("a closed doc line with an UNREADABLE target keeps the generic BLOCK — the null-verdict face (T7)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const specPath = path.join(repoRoot, "docs", "kairos", "specs", "s1-design.md");
      // Seed a CLOSED spec line: a clean completed review round keyed under the
      // line-type constant (§3.7), zero reviewed revision bound. The line's identity
      // is the line type, never the argv path.
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "s1").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      ledger.persistHandoff("review", "spec", { round: 1 }, { phase: "review", findings: [] });
      ledger.recordRound("spec", "review");
      // The target doc is unreadable (never written) — the doc-contract gate skips
      // an absent doc and the ledger verdict is null, not "same": the "target
      // revision unchanged" claim would be fabricated (only present facts land).
      // The gate keeps the generic closed-line message.
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

  it("T8 — after an ABORTED fix the drifted doc re-reviews directly — the doc revision is the gate's primary criterion (judgment order = doc revision first)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: (frame: OpenFrame) =>
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
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan, "--dry-run"])).toBe(
        0,
      );
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      expect(existsSync(path.join(workspace, "plan-review-1.json"))).toBe(true);
      // The aborted fix — the pre-T8 stuck path's origin: the fix attempt BLOCKS,
      // records no fix round, and the line stays fix-awaited with the OLD review's
      // findings binding the reviewed doc revision.
      io.stdoutText = "";
      io.stderrText = "";
      expect(await command.runArgv(["fix", "--type", "plan", "--plan", plan, "--dry-run"])).toBe(1);
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
      const reopen = await command.runArgv([
        "review",
        "--type",
        "plan",
        "--plan",
        plan,
        "--dry-run",
      ]);
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
    const { command, io, repoRoot, cleanup } = fixture();
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
          "--dry-run",
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
        "--dry-run",
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
      dispatch: (frame: OpenFrame) =>
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
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan, "--dry-run"])).toBe(
        0,
      );
      // The SAME doc (no drift) — the repeat review stays REFUSED (Review
      // Convergence anti-spin): the pending fix derives from the doc-same +
      // non-APPROVED face (the review's own fix is still outstanding), and the
      // message names the derived hop.
      io.stderrText = "";
      const repeat = await command.runArgv([
        "review",
        "--type",
        "plan",
        "--plan",
        plan,
        "--dry-run",
      ]);
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
      dispatch: (frame: OpenFrame) =>
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
      expect(await command.runArgv(["review", "--type", "plan", "--plan", plan, "--dry-run"])).toBe(
        0,
      );
      io.stdoutText = "";
      io.stderrText = "";
      expect(await command.runArgv(["fix", "--type", "plan", "--plan", plan, "--dry-run"])).toBe(0);
      io.stdoutText = "";
      io.stderrText = "";
      const reopen = await command.runArgv([
        "review",
        "--type",
        "plan",
        "--plan",
        plan,
        "--dry-run",
      ]);
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
        "--dry-run",
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
    const { command, io, repoRoot, cleanup } = fixture({ dispatch: () => ({ status: "BLOCKED" }) });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv([
        "implement",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
      ]);
      expect(code).toBe(1);
      expect(io.stdoutText).toContain("status: BLOCKED");
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
      dispatch: () => ({ status: "BLOCKED" }),
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
      const code = await command.runArgv([
        "fix",
        "--type",
        "wave",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
      ]);
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
        await command.runArgv([
          "review",
          "--type",
          "wave",
          "--tasks",
          "1",
          "--plan",
          planPath,
          "--dry-run",
        ]),
      ).toBe(1);
      expect(io.stderrText).toContain("splits/mismatches the derived wave");
      io.stderrText = "";
      // fix of a subset {2} before its implement → the split BLOCK (fix shares the gate)
      expect(
        await command.runArgv([
          "fix",
          "--type",
          "wave",
          "--tasks",
          "2",
          "--plan",
          planPath,
          "--dry-run",
        ]),
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
      const planPath = independentPlan(repoRoot, "two.md", 2);
      // the WAVE row carries the implement round — review is the open phase for the whole
      // wave (the retired per-task build could never hold a mixed-phase wave-unitary row).
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "two").ensure();
      new Ledger(workspace, new ConfigLoader()).recordRound("1,2", "implement");
      io.stderrText = "";
      // review on the implemented multi-task wave passes the gate (dispatch proceeds).
      expect(
        await command.runArgv(["review", "--tasks", "1,2", "--plan", planPath, "--dry-run"]),
      ).not.toBe(1);
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
      dispatch: () => ({ status: "APPROVED" }),
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv([
        "implement",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
      ]);
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
      dispatch: () => ({ status: "APPROVED" }), // a spy — must never run on a dirty tree
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

  it("a consumer repo WITHOUT a .kairos gitignore — the engine workspace does not self-BLOCK the clean-tree gate across dispatches (P4.1 F1 regression)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      // The consumer-repo shape: no `.kairos` entry in the fixture .gitignore — the
      // workspace ensure self-publishes `.kairos/cdd/.gitignore` (content `*`)
      // BEFORE the gate reads the tree, so the first dispatch's own writes (the
      // scene's workspace ensure + the round artifacts) land under the engine's own
      // keep-out marker — git's judgment stays clean, and the gate refuses only
      // genuinely dirty user work (never the engine's own outputs).
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
      // the first dispatch landed the engine workspace + its self-published keep-out
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3"))).toBe(true);
      expect(readFileSync(path.join(repoRoot, ".kairos", ".gitignore"), "utf8")).toBe("*\n");
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
        "--dry-run",
      ]);
      expect(review).toBe(0);
      expect(io.stderrText).not.toContain("CDD_BLOCKED:");
    } finally {
      cleanup();
    }
  });

  it("the materialized implement carrier on disk carries zero findings keys — the work face's zero-findings write path (T2)", async () => {
    const { command, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const code = await command.runArgv([
        "implement",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
      ]);
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

  it("T6 — probe A: the end-to-end dry-run implement + fix final carriers carry zero findings keys — both work-face materialization legs (implement + wave fix)", async () => {
    const { command, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      // the implement leg — the dry-run dispatch persists the work-face final carrier
      expect(
        await command.runArgv(["implement", "--tasks", "1", "--plan", plan, "--dry-run"]),
      ).toBe(0);
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
      expect(
        await command.runArgv([
          "fix",
          "--type",
          "wave",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
        ]),
      ).toBe(0);
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

describe("P4.1 T4 — the dry-run real chain: next literals dispatch the next round (rev1→implement wave 2 · rev2→done)", () => {
  it("implement→review(fix)→fix(closure)→implement wave 2→review→done — every next literal re-dispatches", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: (frame: OpenFrame) => {
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
      expect(
        await command.runArgv(["implement", "--tasks", "1", "--plan", plan, "--dry-run"]),
      ).toBe(0);
      expect(nextOf()).toBe(`review --type wave --tasks 1 --plan ${planRel}`);
      io.stdoutText = "";

      // the review finds a warn → the fix literal
      expect(
        await command.runArgv([
          "review",
          "--type",
          "wave",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
        ]),
      ).toBe(0);
      expect(nextOf()).toBe(
        `fix --type wave --tasks 1 --plan ${planRel} --reviews ${path.relative(repoRoot, path.join(workspace, "tasks-1-review-1.json"))} ${FIX_READBACK_SUFFIX}`,
      );
      io.stdoutText = "";

      // the fix closes (warn-only input) → rev1 lands on the NEXT WAVE's implement literal
      expect(
        await command.runArgv([
          "fix",
          "--type",
          "wave",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
        ]),
      ).toBe(0);
      expect(nextOf()).toBe(`implement --plan ${planRel} --tasks 2`);
      io.stdoutText = "";

      // rev 2 — implement wave 2 → the review literal
      expect(
        await command.runArgv(["implement", "--tasks", "2", "--plan", plan, "--dry-run"]),
      ).toBe(0);
      expect(nextOf()).toBe(`review --type wave --tasks 2 --plan ${planRel}`);
      io.stdoutText = "";

      // the final review closes the run → rev2 lands on the wave→branch wiring
      // literal (T3 deliberate pin break — the PIPELINE_NEXT.wave route)
      expect(
        await command.runArgv([
          "review",
          "--type",
          "wave",
          "--tasks",
          "2",
          "--plan",
          plan,
          "--dry-run",
        ]),
      ).toBe(0);
      expect(nextOf()).toBe(`review --type branch --plan ${planRel}`);

      const progress = readJson<{ waves: unknown[] }>(path.join(workspace, "progress.json"));
      // the wave-2 row carries its own D30 revision record — the final APPROVED
      // review bound wave 2's BRIEF to its line (the same brief-revision write-back)
      expect(progress.waves).toContainEqual({
        wave: "2",
        rounds: { implement: [1], review: [1] },
        reviewedRevision: briefRevision(repoRoot, plan, "2"),
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
        "unknown schema type: bogus (available: overall-spec, plan, phase-spec, single-spec)",
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
      // the head key set without the phase-spec's parent-program key
      expect(text).toContain("---");
      expect(text).toContain("doc-type: single-spec");
      expect(text).toContain("version: v0.1");
      expect(text).toContain("status: Draft");
      expect(text).toContain("author: ':::fill author'");
      expect(text).toContain("depends-on: ':::fill depends-on'");
      expect(text).not.toContain("parent-program");
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
      expect(getMissing).toBe(2);
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

  it("a fresh repo's first REAL dispatch builds the workspace + renders the brief (zero ENOENT)", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: () => ({ status: "APPROVED" }),
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
// T5 — `cdd board <slug>`: the pure-read observability command (no preflight
// gate, zero side effects; missing slug → usage exit 2 · a ghost slug → exit 2 ·
// a valid slug → the board to stdout, exit 0).
// ---------------------------------------------------------------------------

describe("T5 — cdd board <slug>: the pure-read board command", () => {
  /** Seed a minimal phase's docs + overall (declared doc-types) in a fixture repo. */
  const seedPhaseDocs = (repoRoot: string, program: string): void => {
    mkdirSync(path.join(repoRoot, "docs/kairos/specs"), { recursive: true });
    mkdirSync(path.join(repoRoot, "docs/kairos/plans"), { recursive: true });
    writeFileSync(
      path.join(repoRoot, `docs/kairos/specs/${program}-overall.md`),
      "---\ntitle: O\ndoc-type: overall-spec\n---\n",
      "utf8",
    );
    writeFileSync(
      path.join(repoRoot, `docs/kairos/specs/${program}-p1-design.md`),
      "---\ntitle: S\ndoc-type: phase-spec\n---\n",
      "utf8",
    );
    writeFileSync(
      path.join(repoRoot, `docs/kairos/plans/${program}-p1.md`),
      "---\ntitle: Plan\ndoc-type: plan\n---\n",
      "utf8",
    );
  };

  it("a valid slug renders the board to stdout and exits 0", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      seedPhaseDocs(repoRoot, "prog");
      const code = await command.runArgv(["board", "prog-p1"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("cdd board: prog-p1");
      expect(io.stdoutText.split("\n").at(-2)).toBe("progress: ✔ done · ▶ current · ○ pending");
    } finally {
      cleanup();
    }
  });

  it("a missing slug is a usage error — exit 2 (commander's required positional)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["board"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("missing required argument 'slug'");
    } finally {
      cleanup();
    }
  });

  it("a ghost slug matches nothing on disk — exit 2, no wall", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const code = await command.runArgv(["board", "nonexistent-slug"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("no docs match slug nonexistent-slug");
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
        "unknown schema type: bogus (available: overall-spec, plan, phase-spec, single-spec)",
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

  it("review --type spec --dry-run — the thin-shell domain run synthesizes the approval", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      // The declared, contract-clean spec doc — the `doc-type:` head key
      // (spec §12 · D34) the capsule's doc-class discrimination reads
      // (zero filename inference).
      const spec = conformingSpec(repoRoot);
      const code = await command.runArgv(["review", "--type", "spec", "--spec", spec, "--dry-run"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("next: /kairos:cdd-plan");
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
    const command = Cli.create({ io, dispatch: () => ({ status: "APPROVED", findings: [] }) });
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

  it("detects the host from the harness-contract detect markers (claude > cursor > pi)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const dispatch = new HarnessDispatch({ scene, io, env: {} });
      expect(dispatch.detectHost({})).toBe("");
      expect(dispatch.detectHost({ CLAUDE_CODE_SESSION_ID: "s" })).toBe("claude");
      expect(dispatch.detectHost({ CURSOR_TRACE_ID: "t" })).toBe("cursor");
      expect(dispatch.detectHost({ AI_AGENT: "pi" })).toBe("pi");
      expect(dispatch.detectHost({ AI_AGENT: "claude-code" })).toBe("claude");
      expect(dispatch.detectHost({ CLAUDE_CODE_SESSION_ID: "s", CURSOR_TRACE_ID: "t" })).toBe(
        "claude",
      );
    } finally {
      cleanup();
    }
  });

  it("dispatches through the harness rows — the skill-ref slash form + the prompt, the draft read back into the outcome", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
      // the child's block-return is the two-line contract (status + artifacts — the
      // commit carrier is retired · spec §2.4)
      sync.stdout = "status: APPROVED\nartifacts: brief=/b report=/r test_evidence=/t\n";
      // The child's write-back: the implement draft at OUTPUT_HANDOFF per the injected
      // `work` schema + the canonical test-evidence file (the v1.9 read-back inputs).
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
      const outcome = dispatch.step()(implementFrame);
      expect(sync.calls.length).toBe(1);
      const call = sync.calls[0];
      expect(call.command).toBe("claude");
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
      // the outcome, the block's two lines the pointer
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

  it("prescribes the implement artifact paths — REPORT/EVIDENCE carry the canonical {family}-{key}- names (find #5)", () => {
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
      const sync = new FakeSync();
      sync.stdout = "status: APPROVED\n";
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      dispatch.step()(implementFrame);
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

  it("§4.2 — every wave frame (implement/review/fix) carries the scene's brief as INPUT_WAVE_BRIEF, never a disk-existence read", () => {
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
      const sync = new FakeSync();
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
      dispatch.step()(taskReviewFrame);
      dispatch.step()(fixFrame);
      for (const call of sync.calls) {
        const prompt = call.args[call.args.length - 1];
        expect(prompt).toContain(`- \`INPUT_WAVE_BRIEF\`: ${briefRel}`);
      }
    } finally {
      cleanup();
    }
  });

  it("the doc-family artifacts are round-keyed — a second review round prescribes a different report path, never an overwrite (find #5)", () => {
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
      const sync = new FakeSync();
      sync.stdout = "status: APPROVED\n";
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      dispatch.step()(specReviewFrame);
      const first = sync.calls[0]!.args[sync.calls[0]!.args.length - 1];
      dispatch.step()({ ...specReviewFrame, round: 2, params: { round: 2 } });
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

  it("a free-named declared artifact path is corrected to the canonical OUTPUT_* path + surfaced on the notes (find #5 self-derivation)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
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
      const outcome = dispatch.step()(implementFrame);
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
    } finally {
      cleanup();
    }
  });

  it("D39 — a trailing-comma draft reconstructs cleanly (the lenient read face; the round is not voided)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
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
      const outcome = dispatch.step()(implementFrame);
      // The trailing comma is tolerated — the round lands APPROVED, never a malformed
      // reject; the notes the child wrote survive into the carrier.
      expect(outcome.status).toBe("APPROVED");
      expect(io.stderrText).toBe("");
      expect((outcome.carrier as { notes?: string[] }).notes).toEqual(["a", "b"]);
    } finally {
      cleanup();
    }
  });

  it("§8.7 — a non-declared / engine-reserved draft field is dropped with a single WARN, never a BLOCK (materialize and the validator judge the same way)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
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
      const outcome = dispatch.step()(implementFrame);
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

  it("§8.7 — a findings-face draft carrying a stray `status` (+ another key) is dropped with a single WARN, never a BLOCK (the exact dogfood crash face)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
      // The §2.8/§8.7 dogfood crash face: a child-authored `status` (non-declared on
      // the findings face — the finding carrier holds no status; the conclusion derives
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
      const outcome = dispatch.step()(specReviewFrame);
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

  it("the docs review — the block + draft face: findings flow back from the file, the status rolls up", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
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
      const outcome = dispatch.step()(specReviewFrame);
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

  it("a task review appends the review skill ref — the object {ref} row's slash form", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
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
      const outcome = dispatch.step()(taskReviewFrame);
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

  it("the fix face carries no skill ref — the prompt opens with the template header, never a slash ref (T1)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
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
      const outcome = dispatch.step()(fixFrame);
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

  it("T6 — probe B: the fix dispatch prompt carries the strict-schema single sentence — the declaration is the field source, zero extra keys (the child-facing fix shell)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
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
      const outcome = dispatch.step()(fixFrame);
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

  it("D46/§2.9 — the BEHAVIOR pin: every work face spawns the child at cwd = repoRoot (implement · review · fix)", () => {
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
      const sync = new FakeSync();
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
        dispatch.step()(frame);
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

  it("no host harness → BLOCKED over the CDD_BLOCKED channel; a broken child → BLOCKED too", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const noHost = new HarnessDispatch({ scene, io, env: {} });
      expect(noHost.step()(implementFrame)).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("CDD_BLOCKED: no host harness detected");
      const failed = new HarnessDispatch({
        scene,
        io,
        sync: { run: () => ({ code: 1, stdout: "", stderr: "boom" }) },
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      expect(failed.step()(implementFrame)).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("child");
    } finally {
      cleanup();
    }
  });

  it("a child that exits 0 without the handoff → BLOCKED + CDD_BLOCKED + crash record (nothing clobbered)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
      sync.stdout = "status: APPROVED\n";
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = dispatch.step()(implementFrame);
      // no carrier → the bookkeep persists nothing: the read-back rejection face
      expect(outcome).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("CDD_BLOCKED: the handoff draft was not written");
      // the crash record — the same-command resume's decision source
      const crash = readJson<{ attemptedHandoff: string; next: string; cause: string }>(
        path.join(scene.workspace.path, "crash-implement.wave-1.json"),
      );
      // the persisted attempted-handoff path is the canonical repoRoot-RELATIVE
      // shape (P9 T4 §2.7 — the absolute handoffPath syscall form never lands).
      expect(crash.attemptedHandoff).toBe(
        path.relative(repoRoot, path.join(scene.workspace.path, "tasks-1-implement.json")),
      );
      expect(crash.next).toBe("cdd implement --tasks 1 --plan <plan>");
      expect(crash.cause).toBe("contract-violation");
    } finally {
      cleanup();
    }
  });

  it("a MALFORMED draft → BLOCKED reporting the true cause (malformed JSON), never the misleading 'not written' (D27)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
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
      const outcome = dispatch.step()(implementFrame);
      expect(outcome).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("CDD_BLOCKED: the handoff draft at");
      expect(io.stderrText).toContain("is malformed JSON");
      expect(io.stderrText).not.toContain("was not written");
    } finally {
      cleanup();
    }
  });

  it("a schema-violating draft → BLOCKED with the draft preserved untouched (no-overwrite on failure)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
      sync.stdout = "status: APPROVED\n";
      // the child wrote a draft MISSING the required `status` — the `work` subset's
      // read-back refuses it
      const draftPath = path.join(scene.workspace.path, "tasks-1-implement.json");
      writeFileSync(draftPath, JSON.stringify({ artifacts: { report: "/r" } }), "utf8");
      const dispatch = new HarnessDispatch({
        scene,
        io,
        sync,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      const outcome = dispatch.step()(implementFrame);
      expect(outcome).toEqual({ status: "BLOCKED" });
      expect(io.stderrText).toContain("violates the work schema");
      expect(io.stderrText).toContain("status: required");
      // the draft is preserved byte-identically — the engine never clobbers the
      // child's work; the resume re-runs the same command and the child rewrites it
      expect(readJson<{ artifacts: { report: string } }>(draftPath)).toEqual({
        artifacts: { report: "/r" },
      });
    } finally {
      cleanup();
    }
  });

  it("a missing/violating test-evidence file rewrites the draft to BLOCKED (the evidence read-back)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
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
      const outcome = dispatch.step()(implementFrame);
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
        failure_category: "evidence-contract",
        notes: [
          expect.stringContaining("artifact report"),
          expect.stringContaining("artifact test_evidence"),
          expect.stringContaining("the test evidence at"),
        ],
      });
      // T2 — the materialized work carrier is the work face: zero findings key (the
      // evidence-contract rewrite never re-injects the work-carrier findings bridge)
      expect("findings" in outcome.carrier!).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("a MALFORMED test-evidence file → BLOCKED reporting the true cause (malformed JSON), never the misleading 'missing' (D27)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
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
      const outcome = dispatch.step()(implementFrame);
      expect(outcome.status).toBe("BLOCKED");
      expect(outcome.carrier?.failure_category).toBe("evidence-contract");
      const notes = (outcome.carrier?.notes ?? []) as string[];
      expect(notes.join("\n")).toContain("is malformed JSON");
      // the true cause, never the misleading "missing" the collapsed read produced
      expect(notes.join("\n")).not.toContain("the evidence file is missing");
    } finally {
      cleanup();
    }
  });

  it("find #9 — the branch fix's OUTPUT_* artifacts are the line-keyed names (report `branch-fix-{round}-report.md` · evidence `branch-test-evidence.json`), never the range", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
      sync.stdout = "status: APPROVED\nartifacts: report=/r test_evidence=/t\n";
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
      const outcome = dispatch.step()(frame);
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
});

/** The fake child-process seam — records every invocation, ans answers a canned stdout. */
class FakeSync implements SyncProcess {
  calls: { command: string; args: string[]; cwd: string }[] = [];
  stdout = "";

  run(
    command: string,
    args: readonly string[],
    cwd: string,
  ): { code: number; stdout: string; stderr: string } {
    this.calls.push({ command, args: [...args], cwd });
    return { code: 0, stdout: this.stdout, stderr: "" };
  }
}
