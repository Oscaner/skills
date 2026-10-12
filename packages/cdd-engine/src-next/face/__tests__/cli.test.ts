// packages/cdd-engine/src-next/face/__tests__/cli.test.ts
// T11 Cli + composition-root suite (design spec §3.3):
//   · the command face — the six steady subcommand words (implement / review / fix /
//     schema / issue / base with their nested leaves) and the usage lines the
//     consumers read (T20: the base command face — `cdd base set|get` — converges
//     the six-command surface);
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
//   · the pure-command E2E — schema get (the shared schema-type vocabulary — the
//     primary doc-key spellings + the plan-graph display route), schema gen (the
//     derived doc skeleton — the same one-table-two-faces vocabulary with the
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
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Command } from "commander";
import { describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import type { RouteTarget } from "../../session/faces.ts";
import { Ledger } from "../../session/ledger.ts";
import type { Route } from "../../session/next.ts";
import { FIX_READBACK_SUFFIX } from "../../session/next.ts";
import type { OpenFrame } from "../../session/run.ts";
import { Capsule } from "../capsule.ts";
import type { CliIo, CliOptions, DispatchScene, SyncProcess } from "../cli.ts";
import { cli, HarnessDispatch } from "../cli.ts";
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
 *  residue is asserted across every plane, never a single file). */
const ENGINE_SOURCE_PLANES = ["contract", "face", "infra", "render", "session"] as const;

/** Every engine source file's (plane-qualified name, text) — the plane enum +
 *  readdir over the non-test tree (the __tests__ dirs are filtered by the .ts
 *  suffix already: a directory never ends with .ts). */
function engineSourceTexts(): [string, string][] {
  return ENGINE_SOURCE_PLANES.flatMap((plane) =>
    readdirSync(new URL(`../../${plane}/`, import.meta.url))
      .filter((name) => name.endsWith(".ts"))
      .map(
        (name) =>
          [
            `${plane}/${name}`,
            readFileSync(new URL(`../../${plane}/${name}`, import.meta.url), "utf8"),
          ] as [string, string],
      ),
  );
}

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
  command: ReturnType<typeof cli>;
  io: CaptureIo;
  repoRoot: string;
  cleanup: () => void;
}

/** A hermetic CLI fixture — a fresh temp repo, the io captured, the root injected. */
function fixture(opts: CliOptions = {}): CliFixture {
  const repoRoot = mkdtempSync(path.join(tmpdir(), "cli-"));
  const io = new CaptureIo();
  const command = cli({ io, repoRoot, ...opts });
  return {
    command,
    io,
    repoRoot,
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
  };
}

/** Init a git repo with one commit — the dry-run's HEAD (the review `next:` base).
 *  The fixture .gitignore keeps the dispatch's own writes (the `.kairos` workspace)
 *  and the fixture's synthetic docs (`/docs/`) out of the tree — the working tree
 *  stays clean across multi-dispatch flows (the P4.1 clean-tree dispatch gate).
 *  Pass an explicit ignore content to shape it (the no-`.kairos`-ignore consumer
 *  regression). */
function gitInit(repoRoot: string, ignore = ".kairos\n/docs/\n"): string {
  spawnSync("git", ["init", "-q"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.email", "cli@test"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.name", "cli-test"], { cwd: repoRoot });
  writeFileSync(path.join(repoRoot, ".gitignore"), ignore, "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  return spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot }).stdout.toString().trim();
}

/** A plan document — the head + N task blocks (task 1 no-dep; loop tasks depend on task 1). */
function planFor(repoRoot: string, count = 1, name = "p3.md"): string {
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
      "# Test Plan",
      "**Spec:** [p3-design.md](docs/kairos/specs/p3-design.md)",
      "- **Parent program**: [p3-overall.md v1.0](docs/kairos/specs/p3-overall.md)",
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
}

/** Read a JSON file (the workspace artifact assertions). */
function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/** A doc-contract-clean plan — every registered plan element present (the header
 *  tuple + the version lineage + a Change-history table + the task fields), chain
 *  links resolving into existing same-family siblings. The P4.1 doc-contract
 *  dispatch gate (the spec/plan faces) requires it — a plain task-fixture plan is
 *  structurally defective and never dispatches a doc round. */
function conformingPlan(repoRoot: string): string {
  const file = path.join(repoRoot, "docs", "kairos", "plans", "p3.md");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    [
      "# Test Plan",
      "**Spec:** [p3-design.md](docs/kairos/specs/p3-design.md)",
      "- **Parent program**: [p3-overall.md v1.0](docs/kairos/specs/p3-overall.md)",
      "- **Version**: v1.0 · 2026-10-09",
      "- **Depends on**: P1",
      "- **Base**: develop",
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
}

/** A doc-contract-clean overall — every registered overall element present (the
 *  header tuple + the ten-element charter + the inventory tables), its chain links
 *  resolving into existing same-family siblings. The overall charter is the
 *  GOOD_OVERALL judge fixture shape (judge.test.ts:19-71) with the `o1-` names
 *  the temp repo actually holds — the review face's doc-contract gate must judge it
 *  under the overall key (zero phase-spec misreport on the doc-key derivation). */
function conformingOverall(repoRoot: string): string {
  const file = path.join(repoRoot, "docs", "kairos", "specs", "o1-overall.md");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    [
      "# Test Overall",
      "- **Version**: v1.21 · 2026-10-07",
      "- **Status**: Approved",
      "- **Author**: [human]",
      "- **Constraints**: all cross-cutting constraints apply",
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
}

/** A plan with N independent tasks (no deps — a single root wave of N members). */
function independentPlan(repoRoot: string, name: string, count: number): string {
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
      "# Test Plan",
      "**Spec:** [p3-design.md](docs/kairos/specs/p3-design.md)",
      "- **Parent program**: [p3-overall.md v1.0](docs/kairos/specs/p3-overall.md)",
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
}

// ---------------------------------------------------------------------------
// the command face — the steady subcommand words
// ---------------------------------------------------------------------------

describe("the command face — the six steady subcommand words", () => {
  it("declares exactly the six subcommands of the steady command face", () => {
    expect(CLI_COMMANDS.map((command) => command.name)).toEqual([
      "implement",
      "review",
      "fix",
      "base",
      "schema",
      "issue",
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

  it("declares the nested leaf surfaces — base set|get · schema get|gen · issue render", () => {
    const leavesOf = (verb: string) =>
      CLI_COMMANDS.find((c) => c.name === verb)!.leaves!.map((l) => l.name);
    expect(leavesOf("base")).toEqual(["set", "get"]);
    expect(leavesOf("schema")).toEqual(["get", "gen"]);
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

  it("rejects a non-sha --base / --head and a non-integer --round", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // find #10 — the sha channel's 8-char short form (spec §6.6)
      let code = await command.runArgv([
        "review",
        "--type",
        "branch",
        "--base",
        "abc",
        "--head",
        "a".repeat(8),
      ]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("must be an 8-char sha");
      io.stderrText = "";
      code = await command.runArgv(["review", "--type", "plan", "--plan", "x", "--round", "x"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("must be an integer");
    } finally {
      cleanup();
    }
  });

  it("the fix face declares NO branch refs — the range rides the --findings handoff (⑦: derived, never re-declared)", () => {
    // fix --type branch parses with --plan + --findings alone (no base/head)
    const fix = nodeOf("fix");
    gate.parse(
      ["fix", "--type", "branch", "--plan", "p.md", "--findings", "branch-review-x.json"],
      {
        from: "user",
      },
    );
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
    expect(leafOf("schema", "get").processedArgs).toEqual(["plan"]);
    leafOf("issue", "render");
    expect(leafOf("issue", "render").name()).toBe("render");
  });

  it("rejects an unknown schema type against the shared schema-type vocabulary", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "get", "bogus"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "unknown schema type: bogus (available: overall, plan, phase-spec, plan-graph)",
      );
    } finally {
      cleanup();
    }
  });

  it("parses the gen leaf — the shared vocabulary with the phaseSpec alias normalized to the kebab key", () => {
    const gen = leafOf("schema", "gen");
    const get = leafOf("schema", "get");
    gate.parse(["schema", "gen", "phase-spec"], { from: "user" });
    expect(gen.processedArgs).toEqual(["phase-spec"]);
    // the legacy camel alias normalizes to the same kebab key
    gate.parse(["schema", "gen", "phaseSpec"], { from: "user" });
    expect(gen.processedArgs).toEqual(["phase-spec"]);
    gate.parse(["schema", "gen", "plan"], { from: "user" });
    expect(gen.processedArgs).toEqual(["plan"]);
    gate.parse(["schema", "gen", "overall"], { from: "user" });
    expect(gen.processedArgs).toEqual(["overall"]);
    // the get leaf rides the SAME table — the primary spelling and the alias both parse
    gate.parse(["schema", "get", "phase-spec"], { from: "user" });
    expect(get.processedArgs).toEqual(["phase-spec"]);
    gate.parse(["schema", "get", "phaseSpec"], { from: "user" });
    expect(get.processedArgs).toEqual(["phase-spec"]);
  });

  it("rejects the gen leaf's unknown types; a bare gen surfaces the missing-type byte at the run face", async () => {
    const { command, io, cleanup } = fixture();
    try {
      // gen's <type> is an OPTIONAL positional — a bare `schema gen` parses green
      // and the missing-type byte surfaces at the domain run (exit 2 · §pure commands)
      let code = await command.runArgv(["schema", "gen"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("cdd schema gen: missing <type>");
      io.stderrText = "";
      // gen's vocabulary carries no plan-graph — the get leaf's special route is
      // not the gen leaf's
      code = await command.runArgv(["schema", "gen", "bogus"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(
        "unknown schema type: bogus (available: overall, plan, phase-spec)",
      );
      io.stderrText = "";
      code = await command.runArgv(["schema", "gen", "plan-graph"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("unknown schema type: plan-graph");
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
      // an extra positional rides the excess-arguments usage face
      code = await command.runArgv(["schema", "get", "plan", "extra"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain("error: too many arguments for 'get'");
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
        "--root",
        repoRoot,
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
      // the six-command table + the built-in help [command] row (native layout)
      for (const name of ["implement", "review", "fix", "base", "schema", "issue"]) {
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
      expect(io.stdoutText).toContain("--root <path>");
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
      expect(io.stdoutText).toContain("--base <sha>");
      expect(io.stdoutText).toContain("--head <sha>");
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
      expect(io.stdoutText).toContain("--findings <path>");
      expect(io.stdoutText).toContain("the source review handoff JSON path");
      expect(io.stdoutText).toContain(
        "cdd fix --type wave --tasks 1 --findings tasks-1-review-1.json",
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

  it("cdd schema --help — the native Commands table (get | gen) + the example, exit 0", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "--help"]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("Usage: cdd schema [options] [command]");
      expect(io.stdoutText).toContain("Commands:");
      expect(io.stdoutText).toContain("get [options] <type>");
      expect(io.stdoutText).toContain("gen [options] [type]");
      expect(io.stdoutText).toContain("print the derived doc-structure schema for <type>");
      expect(io.stdoutText).toContain("render the derived doc skeleton for <type>");
      expect(io.stdoutText).toContain("cdd schema get phase-spec");
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
      for (const verb of ["implement", "review", "fix", "base", "schema", "issue"]) {
        expect(await command.runArgv([verb, "--help"])).toBe(0);
      }
      // the tail note rides the commander afterAll surface — one line per help
      // face, listing --dry-run ALONE (the -h/--help redundant column unwritten)
      const legend = /program flags \(accepted at any position\): --dry-run/g;
      expect(io.stdoutText.match(legend) ?? []).toHaveLength(6);
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

  it("cdd --help — the native program face: Usage · the six-command table (short descriptions = the CLI_COMMANDS projection) · Examples heading · the --dry-run-only footer", async () => {
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
      // The six command rows — the command names + their short descriptions
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
      expect(help).toContain("--base <sha>");
      expect(help).toContain("--head <sha>");
      expect(help).toContain("--plan <path>");
      // The description order = the ARGV_CHANNEL row order of the review node's
      // declared keys (the registration order never a sorted/derived one).
      expect(help.indexOf("--type")).toBeLessThan(help.indexOf("--tasks"));
      expect(help.indexOf("--base")).toBeLessThan(help.indexOf("--head"));
      expect(help.indexOf("--root")).toBeLessThan(help.indexOf("--dry-run"));
    } finally {
      cleanup();
    }
  });

  it("cdd schema --help — the leaf subcommand table (get | gen) rides the native Commands face", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "--help"]);
      expect(code).toBe(0);
      const help = norm(io.stdoutText);
      expect(help).toContain("Commands:");
      expect(help).toContain("get [options] <type>");
      expect(help).toContain("gen [options] [type]");
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
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED · blocker: 0 · handoff: ");
      expect(io.stdoutText).toContain(`next: review --type wave --tasks 1`);
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      const progress = readJson<{ waves: unknown[] }>(path.join(workspace, "progress.json"));
      expect(progress.waves).toContainEqual({ wave: "1", rounds: { implement: 1 } });
      expect(existsSync(path.join(workspace, "tasks-1-implement.json"))).toBe(true);
      expect(existsSync(path.join(workspace, "tasks-1-brief.md"))).toBe(true);
      expect(readFileSync(path.join(workspace, "tasks-1-brief.md"), "utf8")).toContain(
        "WAVE_BASE:",
      );
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
        await command.runArgv([
          "implement",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
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
          "--root",
          repoRoot,
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
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(0);
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      const progress = readJson<{ waves: unknown[] }>(path.join(workspace, "progress.json"));
      // the wave-1 row carries its T11 (D16) revision record — the completed wave
      // review bound the plan it judged to ITS line (the record reviewedDocRevision
      // holds the reviewed plan's doc + sha1 content hash — the wave-gate reopen basis)
      expect(progress.waves).toContainEqual({
        wave: "1",
        rounds: { implement: 1, review: 1 },
        reviewedDocRevision: {
          kind: "doc-revision",
          doc: plan,
          doc_hash: createHash("sha1").update(readFileSync(plan, "utf8")).digest("hex"),
        },
      });
      expect(progress.waves).toContainEqual({ wave: "2", rounds: { implement: 1 } });
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
        "--root",
        repoRoot,
      ]);
      expect(split).toBe(1);
      expect(io.stderrText).toContain("derived wave");
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
        await command.runArgv([
          "implement",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
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
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED · blocker: 0 · handoff: ");
      expect(io.stdoutText).toContain("next: done");
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      expect(existsSync(path.join(workspace, "tasks-1-review-1.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("review with findings — the fix-route next: line carries the readback suffix", async () => {
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: (frame: OpenFrame) => {
        const commits = { base: "a".repeat(8), head: "b".repeat(8) };
        return frame.phase === "review"
          ? {
              status: "CHANGES_REQUESTED",
              findings: [{ severity: "blocker", summary: "drift" }],
            }
          : { status: "APPROVED", commits };
      },
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      expect(
        await command.runArgv([
          "implement",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
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
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(0);
      // the review's findings route the one-way fix hop — the capsule next: line
      // names the review handoff (the resolved workspace path) and rides the
      // readback suffix (the cli face checkable)
      expect(io.stdoutText).toContain("status: CHANGES_REQUESTED · blocker: 1 · handoff: ");
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      expect(io.stdoutText).toContain(
        `next: fix --type wave --tasks 1 --plan ${plan} --findings ${path.join(workspace, "tasks-1-review-1.json")} ${FIX_READBACK_SUFFIX}`,
      );
    } finally {
      cleanup();
    }
  });

  it("fix — the source review's blocker findings drive the re-review next (C5-1)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      const head = gitInit(repoRoot);
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
          commits: { base: head, head },
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
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED · blocker: 0 · handoff: ");
      expect(io.stdoutText).toContain(`next: review --type wave --tasks 1`);
      expect(existsSync(path.join(workspace.path, "tasks-1-fix-1.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("fix — the branch re-review next: carries the FULL range + --plan and re-dispatches through the runtime gate (find #8/#9/#10)", async () => {
    const base = "a".repeat(8);
    const headB = "b".repeat(8);
    const { command, io, repoRoot, cleanup } = fixture({
      dispatch: (frame: OpenFrame) =>
        frame.phase === "fix"
          ? { status: "APPROVED", commits: { base, head: headB } }
          : { status: "APPROVED", findings: [] },
    });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      // Seed the branch line: a blocker branch-review round (the fix's C5-1 input)
      // whose handoff carries the reviewed range (the fix's --findings single carrier).
      // find #9 — the branch line's workspace is the plan-slug (the fix dispatch's
      // --plan); the handoff file is the spine name `branch-review-{round}.json`.
      const workspace = new Workspace(
        new WorkspaceRoot(repoRoot, ".kairos/cdd"),
        Workspace.slugFromDoc(plan),
      ).ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      const params = { base8: base.slice(0, 8), head8: headB.slice(0, 8), round: 1 };
      ledger.persistHandoff("review", "branch", params, {
        phase: "branch-review",
        findings: [{ severity: "blocker", summary: "drift" }],
        commits: { base, head: headB },
      });
      // find #9 — the line key is the stable "branch" (round accumulates across
      // re-reviews; the old range-short key reset to 1 on every head move).
      ledger.recordRound("branch", "branch-review");
      const findingsPath = workspace.resolve("branch-review-1.json");
      const code = await command.runArgv([
        "fix",
        "--type",
        "branch",
        "--plan",
        plan,
        "--findings",
        findingsPath,
        "--dry-run",
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(0);
      // find #8/#10 — the re-review literal carries the FULL range (both runtime-required
      // 8-char shas) + the workspace --plan; the old --base-only 40-char literal exited 2
      expect(io.stdoutText).toContain(
        `next: review --type branch --plan ${plan} --base ${base.slice(0, 8)} --head ${headB.slice(0, 8)}`,
      );
      // the runtime gate, not parse-only: re-feeding the literal's argv through the CLI
      // dispatches a real branch review — exit 0, never the missing-refs refusal
      const reExit = await command.runArgv([
        "review",
        "--type",
        "branch",
        "--plan",
        plan,
        "--base",
        base.slice(0, 8),
        "--head",
        headB.slice(0, 8),
        "--dry-run",
        "--root",
        repoRoot,
      ]);
      expect(reExit).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("review --type branch — the branch-range face over base..head", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const base = "a".repeat(8);
      const head = "b".repeat(8);
      const code = await command.runArgv([
        "review",
        "--type",
        "branch",
        "--base",
        base.slice(0, 8),
        "--head",
        head.slice(0, 8),
        "--dry-run",
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED · blocker: 0 ·");
      expect(io.stdoutText).toContain("next: done");
      // find #9/#10 — the branch line's workspace is the range short (plan-less face)
      // and the handoff is the spine `branch-review-1.json` (no range token in the name)
      const workspace = path.join(
        repoRoot,
        ".kairos",
        "cdd",
        `${base.slice(0, 8)}..${head.slice(0, 8)}`,
      );
      expect(existsSync(path.join(workspace, "branch-review-1.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("review --type spec/plan — the doc-path face (the doc-derived workspace slug)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const spec = path.join(repoRoot, "docs", "kairos", "specs", "s1-design.md");
      const specCode = await command.runArgv([
        "review",
        "--type",
        "spec",
        "--spec",
        spec,
        "--dry-run",
        "--root",
        repoRoot,
      ]);
      expect(specCode).toBe(0);
      expect(io.stdoutText).toContain("next: done");
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
        "--root",
        repoRoot,
      ]);
      expect(planCode).toBe(0);
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3", "plan-review-1.json"))).toBe(
        true,
      );
    } finally {
      cleanup();
    }
  });

  it("review --type spec of an -overall.md — the overall doc-key face (zero phase-spec misreport)", async () => {
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
        "--root",
        repoRoot,
      ]);
      expect(overallCode).toBe(0);
      expect(io.stdoutText).toContain("next: done");
      // The overall was judged under the overall key (deriveDocType, design spec
      // §2.3) — a phase-spec misjudge would trip the doc-contract gate: the charter
      // fails the phase-spec face, the pre-flight refuses over CDD_BLOCKED and no
      // round lands. The exit 0 + round + empty-findings carrier pin the zero
      // misreport; the stderr stays free of the blocked channel.
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
      expect(
        await command.runArgv([
          "review",
          "--type",
          "plan",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      expect(io.stdoutText).toContain("next: done");
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
        "--root",
        repoRoot,
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
      expect(
        await command.runArgv([
          "review",
          "--type",
          "plan",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      expect(io.stdoutText).toContain("next: done");
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
        "--root",
        repoRoot,
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
      const plan = conformingPlan(repoRoot);
      // Round 1: a plan review closes the line AND records the reviewed doc
      // revision (the T7 write-back) — the line's identity now lives under the
      // doc-path key (the spec face reads the same key).
      expect(
        await command.runArgv([
          "review",
          "--type",
          "plan",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      expect(io.stdoutText).toContain("next: done");
      // The target doc becomes unreadable AT THE GATE (deleted) while the reviewed
      // identity stays on record — the ledger verdict is null, not "same": the
      // "target revision unchanged" claim would be fabricated (only present facts
      // land). The spec face tolerates the absent doc (the doc-contract gate skips
      // an unreadable target) and the gate keeps the generic closed-line message.
      rmSync(plan);
      io.stderrText = "";
      const blocked = await command.runArgv([
        "review",
        "--type",
        "spec",
        "--spec",
        plan,
        "--dry-run",
        "--root",
        repoRoot,
      ]);
      expect(blocked).toBe(1);
      expect(io.stderrText).toContain("the line holds no open round");
      expect(io.stderrText).not.toContain("target revision unchanged");
      // no phantom round files land on the null-verdict line
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3", "spec-review-2.json"))).toBe(
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
      expect(
        await command.runArgv([
          "review",
          "--type",
          "plan",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      expect(existsSync(path.join(workspace, "plan-review-1.json"))).toBe(true);
      // The aborted fix — the pre-T8 stuck path's origin: the fix attempt BLOCKS,
      // records no fix round, and the line stays fix-awaited with the OLD review's
      // findings binding the reviewed doc revision.
      io.stdoutText = "";
      io.stderrText = "";
      expect(
        await command.runArgv([
          "fix",
          "--type",
          "plan",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(1);
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
        "--root",
        repoRoot,
      ]);
      expect(reopen).toBe(0);
      expect(io.stderrText).not.toContain("cannot dispatch");
      expect(io.stderrText).not.toContain("the next round is fix");
      expect(existsSync(path.join(workspace, "plan-review-2.json"))).toBe(true);
      // The completion counts stay preserved (the re-review books the next round
      // increment) and the progress row's key set carries zero new fields (the
      // pending fix is derived, never a stored state).
      const progress = readJson<{
        waves: Array<{ wave: string; rounds?: Record<string, number> }>;
      }>(path.join(workspace, "progress.json"));
      const row = progress.waves.find((entry) => entry.wave === plan);
      expect(row?.rounds?.review).toBe(2);
      expect(row?.rounds?.fix).toBeUndefined();
      expect(JSON.stringify(progress)).not.toContain("pending");
    } finally {
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
          : { status: "APPROVED", commits: { base: "a".repeat(8), head: "b".repeat(8) } },
    });
    try {
      gitInit(repoRoot);
      const plan = conformingPlan(repoRoot);
      expect(
        await command.runArgv([
          "review",
          "--type",
          "plan",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
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
        "--root",
        repoRoot,
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
          ? { status: "APPROVED", commits: { base: "a".repeat(8), head: "b".repeat(8) } }
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
      expect(
        await command.runArgv([
          "review",
          "--type",
          "plan",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      io.stdoutText = "";
      io.stderrText = "";
      expect(
        await command.runArgv([
          "fix",
          "--type",
          "plan",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      io.stdoutText = "";
      io.stderrText = "";
      const reopen = await command.runArgv([
        "review",
        "--type",
        "plan",
        "--plan",
        plan,
        "--dry-run",
        "--root",
        repoRoot,
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
        "--root",
        repoRoot,
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
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(1);
      expect(io.stdoutText).toContain("status: BLOCKED");
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
          "--root",
          repoRoot,
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
          "--root",
          repoRoot,
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
        await command.runArgv([
          "review",
          "--tasks",
          "1,2",
          "--plan",
          planPath,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).not.toBe(1);
      // a re-implement on the at-review wave is the wrong-phase BLOCK, not a silent split.
      io.stderrText = "";
      expect(
        await command.runArgv([
          "implement",
          "--tasks",
          "1,2",
          "--plan",
          planPath,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(1);
      expect(io.stderrText).toContain("at review");
    } finally {
      cleanup();
    }
  });

  it("a completed non-failed round with no next: line is a hard error (CDD_BLOCKED · exit 1)", async () => {
    // An implement round that concludes APPROVED without commits produces a null route —
    // the v1.20 no-next hard error (a silent approved-without-next is gone).
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
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(1);
      expect(io.stdoutText).toContain("status: APPROVED");
      expect(io.stderrText).toContain("CDD_BLOCKED:");
      expect(io.stderrText).toContain("no next: line");
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
        const code = await command.runArgv([...args, "--dry-run", "--root", repoRoot]);
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
        "--root",
        repoRoot,
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
        "--root",
        repoRoot,
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
        "--root",
        repoRoot,
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
      const head = gitInit(repoRoot);
      const plan = planFor(repoRoot);
      // the implement leg — the dry-run dispatch persists the work-face final carrier
      expect(
        await command.runArgv([
          "implement",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
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
          commits: { base: head, head },
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
          "--root",
          repoRoot,
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

  it("plan-graph — the board shows the in-wave ✔/▶ mix from closedWaves", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const planPath = independentPlan(repoRoot, "two.md", 2);
      // Seed task 1's full C5 closure record (implement + a clean review) and leave
      // task 2 unrecorded — both sit in the single root wave {1,2}, so the board's
      // current wave holds the MIX: task 1 done (✔), task 2 in-flight (▶). The v1.20
      // marker fix — a done task shows ✔ INSIDE the current wave, never a swallowed
      // whole-row ▶ ("any ledger row is done" is retired: the closed set = closedWaves).
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "two").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      ledger.recordRound(1, "implement");
      ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "1", round: 1 },
        {
          tasks: [1],
          phase: "review",
          findings: [],
          commits: { base: "a".repeat(8), head: "b".repeat(8) },
        },
      );
      ledger.recordRound(1, "review");
      io.stdoutText = "";
      const code = await command.runArgv(["schema", "get", "plan-graph", "--plan", planPath]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("T1✔ · T2▶");
      expect(io.stdoutText).toContain("wave board:");
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
  // find #9/#10 — the branch target carries the workspace --plan, the id is the
  // 8-char range (long shas retired engine-wide · spec §6.6)
  const branch = {
    type: "branch",
    id: "aaaaaaaa..bbbbbbbb",
    plan: "docs/kairos/plans/p3.md",
  } as const;
  const base = "a".repeat(8);
  const head = "b".repeat(8);

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
    const waveLiteral = literalOf({ kind: "review", base }, wave);
    expect(waveLiteral).toBe("review --type wave --tasks 1,2 --plan docs/kairos/plans/p3.md");
    parses(waveLiteral);
    const specLiteral = literalOf({ kind: "review", base }, spec);
    expect(specLiteral).toBe("review --type spec --spec docs/kairos/specs/p3-design.md");
    parses(specLiteral);
    const planLiteral = literalOf({ kind: "review", base }, planT);
    expect(planLiteral).toBe("review --type plan --plan docs/kairos/plans/p3.md");
    parses(planLiteral);
    const branchLiteral = literalOf({ kind: "review", base, head }, branch);
    // find #8/#10 — the branch review literal carries the full 8-char range + --plan
    expect(branchLiteral).toBe(
      `review --type branch --plan docs/kairos/plans/p3.md --base ${base.slice(0, 8)} --head ${head.slice(0, 8)}`,
    );
    parses(branchLiteral);
  });

  it("fix × 4 types — `fix --type <type> <type-arg> --findings <handoff>` parses", () => {
    const waveLiteral = literalOf({ kind: "fix", findings: "tasks-1-review-1.json" }, wave);
    expect(waveLiteral).toBe(
      "fix --type wave --tasks 1,2 --plan docs/kairos/plans/p3.md --findings tasks-1-review-1.json " +
        FIX_READBACK_SUFFIX,
    );
    parses(waveLiteral);
    const specLiteral = literalOf({ kind: "fix", findings: "s1-review-1.json" }, spec);
    expect(specLiteral).toBe(
      "fix --type spec --spec docs/kairos/specs/p3-design.md --findings s1-review-1.json " +
        FIX_READBACK_SUFFIX,
    );
    parses(specLiteral);
    const planLiteral = literalOf({ kind: "fix", findings: "p1-review-1.json" }, planT);
    expect(planLiteral).toBe(
      `fix --type plan --plan docs/kairos/plans/p3.md --findings p1-review-1.json ${FIX_READBACK_SUFFIX}`,
    );
    parses(planLiteral);
    const branchLiteral = literalOf({ kind: "fix", findings: "br1-review-1.json" }, branch);
    // find #8 F1b — the branch fix literal carries the workspace --plan
    // (user-decided; the orchestrator provides zero fallback · spec §5.7 fix (2))
    expect(branchLiteral).toBe(
      `fix --type branch --plan docs/kairos/plans/p3.md --findings br1-review-1.json ${FIX_READBACK_SUFFIX}`,
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
    expect(literalOf({ kind: "review", base }, wave)).toMatch(
      new RegExp(`^${words.routeWord("review")} `),
    );
    expect(literalOf({ kind: "fix", findings: "f.json" }, wave)).toMatch(
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
          : { status: "APPROVED", commits: { base: "a".repeat(8), head: "b".repeat(8) } };
      },
    });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot, 2);
      const workspace = path.join(repoRoot, ".kairos", "cdd", "p3");
      const nextOf = (): string | null => {
        const m = io.stdoutText.match(/^next: (.+)$/m);
        return m === null ? null : m[1]!;
      };

      // rev 1 — implement wave 1 → the review literal
      expect(
        await command.runArgv([
          "implement",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      expect(nextOf()).toBe(`review --type wave --tasks 1 --plan ${plan}`);
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
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      expect(nextOf()).toBe(
        `fix --type wave --tasks 1 --plan ${plan} --findings ${path.join(workspace, "tasks-1-review-1.json")} ${FIX_READBACK_SUFFIX}`,
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
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      expect(nextOf()).toBe(`implement --plan ${plan} --tasks 2`);
      io.stdoutText = "";

      // rev 2 — implement wave 2 → the review literal
      expect(
        await command.runArgv([
          "implement",
          "--tasks",
          "2",
          "--plan",
          plan,
          "--dry-run",
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      expect(nextOf()).toBe(`review --type wave --tasks 2 --plan ${plan}`);
      io.stdoutText = "";

      // the final review closes the run → rev2 lands on `done`
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
          "--root",
          repoRoot,
        ]),
      ).toBe(0);
      expect(nextOf()).toBe("done");

      const progress = readJson<{ waves: unknown[] }>(path.join(workspace, "progress.json"));
      // the wave-2 row carries its own T11 revision record — the final APPROVED
      // review bound the plan to wave 2's line (the same write-back as wave 1's row)
      expect(progress.waves).toContainEqual({
        wave: "2",
        rounds: { implement: 1, review: 1 },
        reviewedDocRevision: {
          kind: "doc-revision",
          doc: plan,
          doc_hash: createHash("sha1").update(readFileSync(plan, "utf8")).digest("hex"),
        },
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
        "unknown schema type: bogus (available: overall, plan, phase-spec, plan-graph)",
      );
    } finally {
      cleanup();
    }
  });

  it("schema gen <type> — the derived doc skeleton to stdout (the pure-render leaf)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["schema", "gen", "phase-spec"]);
      expect(code).toBe(0);
      // the structural scaffold — headings, numeric truths, fills, the version row
      // and the change-history first row
      expect(io.stdoutText).toContain("## Design");
      expect(io.stdoutText).toContain("### 1. :::fill group-title");
      expect(io.stdoutText).toContain("- `:::fill acceptance-entry`");
      expect(io.stdoutText).toContain("- **Version**: v0.1 · ");
      expect(io.stdoutText).toContain("| v0.1 | ");
      // the appended newline is the CLI's single one — the redirected fixture
      // EOF rule (render() never appends)
      expect(io.stdoutText.endsWith("\n")).toBe(true);
      expect(io.stdoutText.endsWith("\n\n")).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("schema gen — the phaseSpec alias renders byte-identical to the DocType literal", async () => {
    const dash = fixture();
    const camel = fixture();
    try {
      expect(await dash.command.runArgv(["schema", "gen", "phase-spec"])).toBe(0);
      expect(await camel.command.runArgv(["schema", "gen", "phaseSpec"])).toBe(0);
      expect(camel.io.stdoutText).toBe(dash.io.stdoutText);
    } finally {
      dash.cleanup();
      camel.cleanup();
    }
  });

  it("schema gen — the gen-only missing/unknown error faces exit 2", async () => {
    const bare = fixture();
    expect(await bare.command.runArgv(["schema", "gen"])).toBe(2);
    expect(bare.io.stderrText).toContain("cdd schema gen: missing <type>");
    bare.cleanup();
    const unknown = fixture();
    expect(await unknown.command.runArgv(["schema", "gen", "bogus"])).toBe(2);
    expect(unknown.io.stderrText).toContain(
      "unknown schema type: bogus (available: overall, plan, phase-spec)",
    );
    unknown.cleanup();
    // plan-graph is the get leaf's special route — never the gen leaf's
    const graph = fixture();
    expect(await graph.command.runArgv(["schema", "gen", "plan-graph"])).toBe(2);
    expect(graph.io.stderrText).toContain("unknown schema type: plan-graph");
    graph.cleanup();
  });

  it("schema get — the bare call keeps its missing-type byte; the kebab spelling and the legacy alias render the same derived JSON", async () => {
    const bare = fixture();
    expect(await bare.command.runArgv(["schema", "get"])).toBe(2);
    // the get leaf's missing-type byte is unchanged — the parse-level required
    // positional face (commander's native missing-required-argument error), never
    // the gen leaf's message
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
        "unknown schema type: bogus (available: overall, plan, phase-spec, plan-graph)",
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
      // the schema faces — the gen leaf's missing-type byte rides its own face
      expect(await command.runArgv(["schema", "gen"])).toBe(2);
      expect(io.stderrText).toContain("Usage: cdd schema gen [options] [type]");
      expect(io.stderrText).toContain("cdd schema gen: missing <type>");
    } finally {
      cleanup();
    }
  });

  it("the plan-graph read refuses a missing --plan with the schema get face's native usage line", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      expect(await command.runArgv(["schema", "get", "plan-graph"])).toBe(2);
      expect(io.stderrText).toContain("Usage: cdd schema get [options] <type>");
      expect(io.stderrText).toContain("error: cdd schema get plan-graph: missing --plan <path>");
      io.stderrText = "";
      // the shared text-read's unreadable-file refusal rides the same face
      const missing = path.join(repoRoot, "no-such-plan.md");
      expect(await command.runArgv(["schema", "get", "plan-graph", "--plan", missing])).toBe(2);
      expect(io.stderrText).toContain("Usage: cdd schema get [options] <type>");
      expect(io.stderrText).toContain(`error: cannot read file: ${missing}`);
    } finally {
      cleanup();
    }
  });

  it("the base get domain read — a set artifact exits 0 over the write-through path", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
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
      const spec = path.join(repoRoot, "docs", "kairos", "specs", "s1-design.md");
      const code = await command.runArgv([
        "review",
        "--type",
        "spec",
        "--spec",
        spec,
        "--dry-run",
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("next: done");
    } finally {
      cleanup();
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
    return { workspace, ledger, planPath: null, briefPath: null, head: null };
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
    target: { kind: "doc", doc: "docs/kairos/specs/s1-design.md" },
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
      // find #10 — the child's block-return commits are the 8-char short shas
      sync.stdout =
        "status: APPROVED\ncommits: base=aaaaaaaa head=bbbbbbbb\nartifacts: brief=/b report=/r test_evidence=/t\n";
      // The child's write-back: the implement draft at OUTPUT_HANDOFF per the injected
      // `work` schema + the canonical test-evidence file (the v1.9 read-back inputs).
      const draft = path.join(scene.workspace.path, "tasks-1-implement.json");
      const head = "b".repeat(8);
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
          commits: { base: "a".repeat(8), head },
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
      // The skill ref is NOT a standalone positional (the harness CLI consumes the
      // first positional as the whole prompt — a split prompt loses everything after
      // the ref). It prefixes the single prompt argument instead.
      expect(call.args).not.toContain("/mattpocock-skills:implement");
      const prompt = call.args[call.args.length - 1];
      expect(prompt.startsWith("/mattpocock-skills:implement ")).toBe(true);
      // v1.8 — the mode dispatch table + the normalized naming grammar (ROLE/WAVE · INPUT_/OUTPUT_/WORKSPACE_)
      expect(prompt).toContain("- `ROLE`: implement");
      expect(prompt).toContain("- `WAVE`: 1");
      expect(prompt).toContain(`- \`WORKSPACE_DIR\`: ${scene.workspace.path}`);
      expect(prompt).toContain(
        `- \`OUTPUT_HANDOFF\`: ${path.join(scene.workspace.path, "tasks-1-implement.json")}`,
      );
      // find #4 — INPUT_RULES is gone: the implement child reads the plan's
      // `## Constraints` directly through INPUT_PLAN (zero materialized rules file,
      // zero dead pointer — the round context carries no rules channel).
      expect(prompt).not.toContain("INPUT_RULES");
      // find #5 — the artifact write paths are prescribed (OUTPUT_* · {family}-{key}-
      // prefix): this scene carries no brief (briefPath null), so OUTPUT_BRIEF is not
      // emitted (only present facts ride the prompt) while the report + evidence are.
      expect(prompt).not.toContain("- `OUTPUT_BRIEF`");
      expect(prompt).toContain(
        `- \`OUTPUT_REPORT\`: ${path.join(scene.workspace.path, "tasks-1-implement-report.md")}`,
      );
      expect(prompt).toContain(
        `- \`OUTPUT_EVIDENCE\`: ${path.join(scene.workspace.path, "tasks-1-test-evidence.json")}`,
      );
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
      // the outcome, the block's three lines the pointer
      expect(outcome.status).toBe("APPROVED");
      // find #10 — the read-back carrier's commits are the 8-char short shas
      expect(outcome.commits).toEqual({ base: "a".repeat(8), head });
      expect(outcome.carrier).toEqual({
        artifacts: {
          brief: "/b",
          report: path.join(scene.workspace.path, "tasks-1-implement-report.md"),
          test_evidence: path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        },
        commits: { base: "a".repeat(8), head },
        status: "APPROVED",
      });
      // T2 — the materialized work carrier is the work face: zero findings key (the
      // face-aware write path never injects the work-carrier findings byte bridge)
      expect("findings" in outcome.carrier!).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("prescribes the implement artifact paths — OUTPUT_BRIEF/REPORT/EVIDENCE carry the canonical {family}-{key}- names (find #5)", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader());
      const scene: DispatchScene = {
        workspace,
        ledger,
        planPath: null,
        briefPath: path.join(workspace.path, "tasks-1-brief.md"),
        head: null,
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
      // the prescribed write paths — the {family}-{key}-{artifact} single naming:
      // every OUTPUT_* slot implements consumes rides the round context (the carry
      // brief = the engine-rendered input artifact; report + evidence = the report/verify
      // write paths — zero free naming, cross-round zero overwrite).
      expect(prompt).toContain(
        `- \`OUTPUT_BRIEF\`: ${path.join(workspace.path, "tasks-1-brief.md")}`,
      );
      expect(prompt).toContain(
        `- \`OUTPUT_REPORT\`: ${path.join(workspace.path, "tasks-1-implement-report.md")}`,
      );
      expect(prompt).toContain(
        `- \`OUTPUT_EVIDENCE\`: ${path.join(workspace.path, "tasks-1-test-evidence.json")}`,
      );
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
        head: null,
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
      expect(first).toContain(
        `- \`OUTPUT_REPORT\`: ${path.join(workspace.path, "spec-review-1-report.md")}`,
      );
      expect(second).toContain(
        `- \`OUTPUT_REPORT\`: ${path.join(workspace.path, "spec-review-2-report.md")}`,
      );
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
      // find #10 — the committed shas are the 8-char short form
      const head = "b".repeat(8);
      const draftPath = path.join(scene.workspace.path, "tasks-1-implement.json");
      writeFileSync(
        draftPath,
        JSON.stringify({
          status: "APPROVED",
          artifacts: { report: "/r", test_evidence: "/t" },
          commits: { base: "a".repeat(8), head },
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
      // both deviations ride the carrier's notes (the review scope axis reads them)
      expect(outcome.carrier).toEqual({
        artifacts: {
          report: path.join(scene.workspace.path, "tasks-1-implement-report.md"),
          test_evidence: path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        },
        commits: { base: "a".repeat(8), head },
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
      expect(outcome.carrier).toEqual({
        artifacts: {},
        findings: [{ severity: "blocker", lens: "spec", summary: "drift" }],
        status: "CHANGES_REQUESTED",
      });
      // the URC criteria ride the review prompt's fixed prefix (the spec review has
      // no slash ref) — the criteria/lens are folded in, never round-context values
      const call = sync.calls[0];
      expect(call.args).not.toContain("/mattpocock-skills:code-review");
      const prompt = call.args[call.args.length - 1];
      expect(prompt).toContain("Follow URC:");
      expect(prompt).toContain("- `ROLE`: review");
      expect(prompt).toContain("- `INPUT_RANGE`: docs/kairos/specs/s1-design.md");
      // the v1.8 per-mode trimming: a review context carries no fix/work keys
      expect(prompt).not.toContain("- `INPUT_FINDINGS`");
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
          commits: { base: "a".repeat(8), head: "b".repeat(8) },
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
          commits: { base: "a".repeat(8), head: "b".repeat(8) },
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
      expect(crash.attemptedHandoff).toBe(
        path.join(scene.workspace.path, "tasks-1-implement.json"),
      );
      expect(crash.next).toBe("cdd implement --tasks 1 --plan <plan>");
      expect(crash.cause).toBe("contract-violation");
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
          commits: { base: "a".repeat(8), head: "b".repeat(8) },
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
      // and evidence book their canonical tasks-1- names with the deviations surfaced.
      expect(outcome.carrier).toEqual({
        artifacts: {
          brief: "/b",
          report: path.join(scene.workspace.path, "tasks-1-implement-report.md"),
          test_evidence: path.join(scene.workspace.path, "tasks-1-test-evidence.json"),
        },
        commits: { base: "a".repeat(8), head: "b".repeat(8) },
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

  it("find #9 — the branch fix's OUTPUT_* artifacts are the line-keyed names (report `branch-fix-{round}-report.md` · evidence `branch-test-evidence.json`), never the range", () => {
    const { repoRoot, cleanup } = fixture();
    try {
      const scene = harnessScene(repoRoot);
      const io = new CaptureIo();
      const sync = new FakeSync();
      sync.stdout =
        "status: APPROVED\ncommits: base=aaaaaaaa head=bbbbbbbb\nartifacts: brief=/b report=/r test_evidence=/t\n";
      // a valid fix draft — commits in the 8-char living form (find #10)
      const head = "b".repeat(8);
      writeFileSync(
        path.join(scene.workspace.path, "branch-fix-1.json"),
        JSON.stringify({
          status: "APPROVED",
          artifacts: {
            brief: "/b",
            report: path.join(scene.workspace.path, "branch-fix-1-report.md"),
            test_evidence: path.join(scene.workspace.path, "branch-test-evidence.json"),
          },
          commits: { base: "a".repeat(8), head },
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
        // the branch fix's target carries the range shas (the carrier source) but
        // the artifact names NEVER embed them (find #9 — the spine wins)
        target: { kind: "branch", base: "a".repeat(40), head: "b".repeat(40) },
        params: { base8: "a".repeat(8), head8: "b".repeat(8), round: 1 },
        key: "branch",
      };
      const outcome = dispatch.step()(frame);
      expect(io.stderrText).toBe("");
      expect(outcome.status).toBe("APPROVED");
      const prompt = sync.calls[0]!.args[sync.calls[0]!.args.length - 1];
      // find #9 — the prescribed artifact names are line-keyed: the round rides the
      // name (branch-fix-1-report.md), the evidence is the line's single file
      // (branch-test-evidence.json); the range token appears NOWHERE in the paths
      expect(prompt).toContain(
        `- \`OUTPUT_REPORT\`: ${path.join(scene.workspace.path, "branch-fix-1-report.md")}`,
      );
      expect(prompt).toContain(
        `- \`OUTPUT_EVIDENCE\`: ${path.join(scene.workspace.path, "branch-test-evidence.json")}`,
      );
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
