// packages/cdd-engine/src-next/face/__tests__/cli.test.ts
// T11 Cli + composition-root suite (design spec §3.3):
//   · the command face — the six steady subcommand words (implement / review / fix /
//     schema / issue / base with their nested leaves) and the usage lines the
//     consumers read (T20: the base command face — `cdd base set|get` — converges
//     the six-command surface);
//   · parse — the tokenizer + component-value validation (int-list tasks, enum type /
//     source, sha base/head, int round) + the guardArgs unknown-flag rejection (the
//     acceptance's unknown-flag BLOCK) and the program scopes (--dry-run / --help);
//   · the work-command E2E (dry-run) — implement / review / fix compose the lifecycle,
//     the capsule and the ledger in a hermetic temp repo, advance the requested phase
//     and land the canonical artifacts (brief / handoffs / progress); the phase gate
//     refuses an unreachable round without dispatching a phantom;
//   · the pure-command E2E — schema get (the derived doc-key vocabulary), issue render
//     (stdin body — the subcommand face; the renderer's own suite lives in
//     render/__tests__/render.test.ts, its T19 home), base set/get (the single → artifact);
//   · the composition root + HarnessDispatch — host detection, the dispatch prompt
//     (template data plane), the child return-block parse (block + JSON).
// Fixtures are hermetic mkdtemp repos (git-inited for the dry-run HEAD); the io is
// captured, never the process.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../../session/ledger.ts";
import { FIX_READBACK_SUFFIX } from "../../session/next.ts";
import type { OpenFrame } from "../../session/run.ts";
import type { CliIo, CliOptions, DispatchScene, SyncProcess } from "../cli.ts";
import { CLI_COMMANDS, CLI_USAGE, cli, HarnessDispatch } from "../cli.ts";

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

/** Init a git repo with one commit — the dry-run's HEAD (the review `next:` base). */
function gitInit(repoRoot: string): string {
  spawnSync("git", ["init", "-q"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.email", "cli@test"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.name", "cli-test"], { cwd: repoRoot });
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

  it("the usage lines carry the steady consumption face (verb + leaf words included)", () => {
    expect(CLI_USAGE.implement).toBe("usage: cdd implement --tasks <n|n,n,…> --plan <path>");
    expect(CLI_USAGE.review).toContain("--type <wave|branch|spec|plan>");
    expect(CLI_USAGE.review).toContain("branch: --base <sha> --head <sha>");
    expect(CLI_USAGE.fix).toContain("--type <wave|branch|spec|plan>");
    expect(CLI_USAGE.base).toContain("<set|get>");
    expect(CLI_USAGE.schema).toContain("get <type>");
    expect(CLI_USAGE.issue).toContain("render");
  });

  it("declares the nested leaf surfaces — base set|get · schema get · issue render", () => {
    const leavesOf = (verb: string) =>
      CLI_COMMANDS.find((c) => c.name === verb)!.leaves!.map((l) => l.name);
    expect(leavesOf("base")).toEqual(["set", "get"]);
    expect(leavesOf("schema")).toEqual(["get"]);
    expect(leavesOf("issue")).toEqual(["render"]);
  });
});

// ---------------------------------------------------------------------------
// parse — the component-value validation + the unknown-flag guard
// ---------------------------------------------------------------------------

describe("parse — the component-value validation + the unknown-flag guard", () => {
  it("parses implement with the normalized int-list tasks + the plan + the dry-run scope", () => {
    const parsed = cli().parse([
      "implement",
      "--tasks",
      "2,1,2",
      "--plan",
      "docs/x.md",
      "--dry-run",
    ]);
    expect(parsed.verb).toBe("implement");
    expect(parsed.leaf).toBeNull();
    expect(parsed.args.tasks).toBe("1,2");
    expect(parsed.args.plan).toBe("docs/x.md");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.help).toBe(false);
  });

  it("rejects a non-integer --tasks token (the int-list value shape)", () => {
    expect(() => cli().parse(["implement", "--tasks", "1,x", "--plan", "x"])).toThrow(
      /--tasks must be comma-separated integers: x/,
    );
  });

  it("rejects an out-of-enum --type and --source", () => {
    expect(() => cli().parse(["review", "--type", "bogus"])).toThrow(
      /--type must be one of wave \| branch \| spec \| plan/,
    );
    expect(() =>
      cli().parse(["base", "set", "--plan", "p", "--base", "d", "--source", "nope"]),
    ).toThrow(
      /--source must be one of plan-field \| branch-upstream \| conversation-context \| user-confirmed/,
    );
  });

  it("rejects a non-sha --base / --head and a non-integer --round", () => {
    expect(() =>
      cli().parse(["review", "--type", "branch", "--base", "abc", "--head", "a".repeat(40)]),
    ).toThrow(/--base must be a 40-char sha/);
    expect(() => cli().parse(["review", "--type", "plan", "--plan", "x", "--round", "x"])).toThrow(
      /--round must be an integer/,
    );
  });

  it("the fix face declares NO branch refs — the range rides the --findings handoff (⑦: derived, never re-declared)", () => {
    // fix --type branch parses with --plan + --findings alone (no base/head)
    const parsed = cli().parse([
      "fix",
      "--type",
      "branch",
      "--plan",
      "p.md",
      "--findings",
      "branch-review-x.json",
    ]);
    expect(parsed.args.base).toBeUndefined();
    expect(parsed.args.head).toBeUndefined();
    // re-declaring the range on the fix CLI is rejected (a dual identity)
    expect(() =>
      cli().parse(["fix", "--type", "branch", "--base", "a".repeat(40), "--head", "b".repeat(40)]),
    ).toThrow(/unknown option: --base/);
  });

  it("rejects an unknown flag — the guardArgs semantics (a typo never runs a dispatch)", () => {
    expect(() => cli().parse(["implement", "--taks", "1", "--plan", "x"])).toThrow(
      /unknown option: --taks/,
    );
  });

  it("rejects a non-program flag before the verb and an unknown command", () => {
    expect(() => cli().parse(["--root", "x", "implement"])).toThrow(/unknown option: --root/);
    expect(() => cli().parse(["implementt", "--tasks", "1"])).toThrow(
      /unknown command: implementt/,
    );
  });

  it("rejects a missing required flag", () => {
    expect(() => cli().parse(["implement", "--plan", "x"])).toThrow(/missing required --tasks/);
    expect(() => cli().parse(["review", "--tasks", "1"])).toThrow(/missing required --type/);
  });

  it("parses the nested leaves — base set|get · schema get · issue render", () => {
    const set = cli().parse([
      "base",
      "set",
      "--plan",
      "p.md",
      "--base",
      "dev",
      "--source",
      "plan-field",
    ]);
    expect(set.verb).toBe("base");
    expect(set.leaf).toBe("set");
    expect(set.args.base).toBe("dev");
    const get = cli().parse(["base", "get", "--plan", "p.md"]);
    expect(get.leaf).toBe("get");
    const schema = cli().parse(["schema", "get", "plan"]);
    expect(schema.verb).toBe("schema");
    expect(schema.positionals).toEqual(["plan"]);
    expect(cli().parse(["issue", "render"]).leaf).toBe("render");
  });

  it("rejects an unknown schema type against the derived registry-key vocabulary", () => {
    expect(() => cli().parse(["schema", "get", "bogus"])).toThrow(
      /unknown schema type: bogus \(available: overall, plan, phaseSpec, plan-graph\)/,
    );
  });

  it("rejects a missing leaf, an unknown leaf and an extra positional", () => {
    expect(() => cli().parse(["base"])).toThrow(/missing subcommand — set \| get/);
    expect(() => cli().parse(["base", "reset"])).toThrow(/unknown subcommand: reset/);
    expect(() => cli().parse(["schema", "get", "plan", "extra"])).toThrow(
      /unexpected argument: extra/,
    );
  });

  it("accepts --help / -h and the dry-run scope at any position", () => {
    expect(cli().parse(["review", "--type", "wave", "--help"]).help).toBe(true);
    expect(cli().parse(["-h", "implement", "--tasks", "1"]).help).toBe(true);
    expect(cli().parse(["--dry-run", "implement", "--tasks", "1", "--plan", "x"]).dryRun).toBe(
      true,
    );
    expect(cli().parse(["implement", "--no-dry-run", "--tasks", "1", "--plan", "x"]).dryRun).toBe(
      false,
    );
  });

  it("a help flag on a leaf command pre-empts the required leaf word — base --help", () => {
    const parsed = cli().parse(["base", "--help"]);
    expect(parsed.help).toBe(true);
    expect(parsed.verb).toBe("base");
    expect(parsed.leaf).toBeNull();
  });

  it("the bool negation spelling — --no-force yields args.force 'false', --force 'true'", () => {
    const flags = ["--force", "--no-force"];
    for (const flag of flags) {
      expect(
        cli().parse(["base", "set", "--plan", "p", "--base", "d", "--source", "plan-field", flag])
          .args.force,
      ).toBe(flag === "--force" ? "true" : "false");
    }
  });

  it("runArgv exits 2 with the usage line + the message (a bad flag never runs a dispatch)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const code = await command.runArgv(["implement", "--taks", "1"]);
      expect(code).toBe(2);
      expect(io.stderrText).toContain(CLI_USAGE.implement);
      expect(io.stderrText).toContain("unknown option: --taks");
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
      const head = gitInit(repoRoot);
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
      expect(io.stdoutText).toContain(`next: review wave 1 (base ${head.slice(0, 7)})`);
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
      expect(progress.waves).toContainEqual({ wave: "1", rounds: { implement: 1, review: 1 } });
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
        const commits = { base: "a".repeat(40), head: "b".repeat(40) };
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
        `next: fix wave 1 --findings ${path.join(workspace, "tasks-1-review-1.json")} ${FIX_READBACK_SUFFIX}`,
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
      expect(io.stdoutText).toContain(`next: review wave 1 (base ${head.slice(0, 7)})`);
      expect(existsSync(path.join(workspace.path, "tasks-1-fix-1.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("review --type branch — the branch-range face over base..head", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      const base = "a".repeat(40);
      const head = "b".repeat(40);
      const code = await command.runArgv([
        "review",
        "--type",
        "branch",
        "--base",
        base,
        "--head",
        head,
        "--dry-run",
        "--root",
        repoRoot,
      ]);
      expect(code).toBe(0);
      expect(io.stdoutText).toContain("status: APPROVED · blocker: 0 ·");
      expect(io.stdoutText).toContain("next: done");
      const workspace = path.join(
        repoRoot,
        ".kairos",
        "cdd",
        `${base.slice(0, 7)}..${head.slice(0, 7)}`,
      );
      expect(
        existsSync(
          path.join(workspace, `branch-review-${base.slice(0, 7)}..${head.slice(0, 7)}-r1.json`),
        ),
      ).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("review --type spec/plan — the doc-path face (the doc-derived workspace slug)", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
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
      const plan = planFor(repoRoot);
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

  it("the phase gate refuses an unreachable round without dispatching a phantom", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
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
          commits: { base: "a".repeat(40), head: "b".repeat(40) },
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
        "unknown schema type: bogus (available: overall, plan, phaseSpec, plan-graph)",
      );
    } finally {
      cleanup();
    }
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
      sync.stdout =
        "status: APPROVED\ncommits: base=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa head=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\nartifacts: brief=/b report=/r test_evidence=/t\n";
      // The child's write-back: the implement draft at OUTPUT_HANDOFF per the injected
      // `work` schema + the canonical test-evidence file (the v1.9 read-back inputs).
      const draft = path.join(scene.workspace.path, "tasks-1-implement.json");
      const head = "b".repeat(40);
      writeFileSync(
        draft,
        JSON.stringify({
          status: "APPROVED",
          artifacts: { brief: "/b", report: "/r", test_evidence: "/t" },
          commits: { base: "a".repeat(40), head },
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
      // the per-mode 精简: this scene carries no brief (briefPath null) — the empty
      // INPUT_TASK key is NOT emitted (空值键不发)
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
      expect(outcome.commits).toEqual({ base: "a".repeat(40), head });
      expect(outcome.carrier).toEqual({
        artifacts: { brief: "/b", report: "/r", test_evidence: "/t" },
        findings: [],
        commits: { base: "a".repeat(40), head },
        status: "APPROVED",
      });
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
      // the v1.8 per-mode 精简: a review context carries no fix/work keys
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

  it("a schema-violating draft → BLOCKED with the draft preserved untouched (失败不覆盖)", () => {
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
          commits: { base: "a".repeat(40), head: "b".repeat(40) },
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
      // the carrier is materialized (the child's work preserved) but rewritten BLOCKED
      expect(outcome.carrier).toEqual({
        artifacts: { brief: "/b", report: "/r", test_evidence: "/t" },
        findings: [],
        commits: { base: "a".repeat(40), head: "b".repeat(40) },
        status: "BLOCKED",
        failure_category: "evidence-contract",
        notes: [expect.stringContaining("the test evidence at")],
      });
    } finally {
      cleanup();
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
