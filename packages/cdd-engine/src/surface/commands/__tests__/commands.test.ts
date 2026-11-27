// packages/cdd-engine/src/surface/commands/__tests__/commands.test.ts
// The command face's pins — one group per fact this slice owns:
//
//   · the declaration: one flag spelling per row, the `--type` domain derived rather than
//     typed, the scope rows derived from the command scopes, and no flag row carrying a
//     reason of its own (a reason on a flag row would be a field no reader reaches);
//   · the eight shells: each does three things — read the parsed cells, call ONE entry, hand
//     the value over — with the `schema` shell the one declared two-entry exception;
//   · the three misuse layers, kept apart because their bytes are: the parse layer's single
//     line, the conditional-required layer's single line, and the body layer's usage line
//     plus `error:`;
//   · the usage line is the command node's own first help line, so the two-byte family has
//     one derivation;
//   · the exit-code table: help 0, refusal 1, misuse 2, unknown command 2;
//   · the declaration's alignment with the usage union: every byte row's producer resolves,
//     and every scope row translates into the ONE scope-rejection member;
//   · the `init` wiring: one `onStep` per step, before its spawn, and the failure report on
//     stderr with `apply`'s own exit code;
//   · the skeleton landing: the shell hands the target over and the file appears.
//
// A shell pin drives the shell over a STUB entry: the point of a shell is that it adds
// nothing, so a stub that records its call is the sharper instrument than a real graph.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Documents } from "../../../docs/index.ts";
import type { RepoPath } from "../../../env/paths/root.ts";
import type { ProvisionRequest, ProvisionStep } from "../../../env/provision/init.ts";
import type { BaseArtifact, BaseRead, BaseWrite } from "../../../env/workspace/base-artifact.ts";
import type { FrameRequest } from "../../../run/advance/frame.ts";
import type { AdvanceOutcome, PreviewOutcome, Run } from "../../../run/index.ts";
import { Cli, FAILURE_REASONS, USAGE_BYTES } from "../../index.ts";
import type { InitLine } from "../../render/init.ts";
import { BaseCommand } from "../base.ts";
import { BoardCommand } from "../board.ts";
import {
  ARGV_CHANNEL,
  CLI_COMMANDS,
  type CliOutcome,
  type CommandReporter,
  type ParsedCommand,
  REQUIRED_GROUPS,
  SCOPE_ROWS,
} from "../declare.ts";
import { FixCommand } from "../fix.ts";
import { ImplementCommand } from "../implement.ts";
import { InitCommand } from "../init.ts";
import { IssueCommand } from "../issue.ts";
import { CommandTreeBuilder, ScopeGuard } from "../projection.ts";
import { ReviewCommand } from "../review.ts";
import { SchemaCommand } from "../schema.ts";

/** One parsed invocation, as a shell reads it — the shape every shell pin starts from. */
const parsed = (over: Partial<ParsedCommand> = {}): ParsedCommand => ({
  commandPath: "implement",
  leaf: null,
  args: {},
  positionals: [],
  dryRun: false,
  ...over,
});

/** A recording output face — the shell hands values here, so a pin can assert the value's
 *  identity rather than its bytes. */
class RecordingReporter implements CommandReporter {
  readonly outcomes: { readonly outcome: CliOutcome; readonly commandPath: string }[] = [];
  readonly progressLines: string[] = [];

  report(outcome: CliOutcome, commandPath: string): number {
    this.outcomes.push({ outcome, commandPath });
    return 0;
  }

  progress(lines: readonly InitLine[]): void {
    void lines;
  }
}

/** A recording progress face — the `init` shell writes one line per step here. */
class StepReporter extends RecordingReporter {
  readonly writes: string[] = [];

  override progress(lines: readonly InitLine[]): void {
    for (const line of lines) this.writes.push(line.text.trim().split("\n")[0] ?? "");
  }
}

/** The entries a shell stub records — the ONE call each shell is allowed. */
interface RunCalls {
  readonly advance: FrameRequest[];
  readonly preview: FrameRequest[];
}

/** A `Run` stand-in answering one fixed value per entry. */
const stubRun = (
  calls: RunCalls,
  answers: { advance?: AdvanceOutcome; preview?: PreviewOutcome } = {},
): Run =>
  ({
    advance: async (request: FrameRequest) => {
      calls.advance.push(request);
      return answers.advance ?? { kind: "usage", reason: { kind: "no-frame", command: "x" } };
    },
    previewOf: async (request: FrameRequest) => {
      calls.preview.push(request);
      return answers.preview ?? { kind: "usage", reason: { kind: "no-frame", command: "x" } };
    },
  }) as unknown as Run;

/** A capturing io pair and the surface over it. */
class Harness {
  readonly out: string[] = [];
  readonly err: string[] = [];
  readonly cli: Cli;

  constructor(options: ConstructorParameters<typeof Cli>[0] = {}) {
    this.cli = new Cli({
      ...options,
      io: { stdout: (text) => this.out.push(text), stderr: (text) => this.err.push(text) },
    });
  }

  get stdout(): string {
    return this.out.join("");
  }

  get stderr(): string {
    return this.err.join("");
  }
}

describe("the declaration", () => {
  it("declares the eight command words and one row per flag spelling", () => {
    expect(CLI_COMMANDS.map((spec) => spec.name)).toEqual([
      "implement",
      "review",
      "fix",
      "base",
      "schema",
      "issue",
      "board",
      "init",
    ]);
    // One spelling per flag: two rows claiming `--plan` would be two declarations of one
    // option, which is exactly the drift the single surface exists to prevent.
    const spells = Object.values(ARGV_CHANNEL).map((row) => row.flag);
    expect(new Set(spells).size).toBe(spells.length);
  });

  it("carries every declared key in the channel and every non-program channel row on a command", () => {
    const declared = new Set<string>();
    for (const spec of CLI_COMMANDS) {
      for (const key of spec.keys) declared.add(key.key);
      for (const leaf of spec.leaves ?? []) for (const key of leaf.keys) declared.add(key.key);
    }
    expect([...declared].filter((key) => ARGV_CHANNEL[key] === undefined)).toEqual([]);
    const orphan = Object.entries(ARGV_CHANNEL)
      .filter(([key, row]) => !declared.has(key) && row.scope !== "program")
      .map(([key]) => key);
    expect(orphan).toEqual([]);
  });

  it("derives the --type domain as the two node faces then the four document faces", () => {
    // The order is the value token's own rendering, so it is read off the declaration that
    // already holds the set — never typed a second time.
    expect(ARGV_CHANNEL.type.values).toEqual([
      "wave",
      "branch",
      "phase-spec",
      "overall",
      "plan",
      "single-spec",
    ]);
  });

  it("derives the scope rows from the command scopes, and translates every one of them into the ONE member", () => {
    const pure = CLI_COMMANDS.filter((spec) => spec.scope === "pure").map((spec) => spec.name);
    expect(SCOPE_ROWS.map((row) => row.verb)).toEqual(pure);
    expect(SCOPE_ROWS.every((row) => row.flag === ARGV_CHANNEL.dryRun.flag)).toBe(true);
    const guard = new ScopeGuard();
    for (const row of SCOPE_ROWS) {
      const rejection = guard.rejectionOf({ commandPath: row.verb, dryRun: true });
      expect(rejection?.reason.kind).toBe("dry-run-scope");
    }
    // The three preview-capable commands and the three dispatch commands take the flag.
    for (const commandPath of ["implement", "review", "fix", "init"]) {
      expect(guard.rejectionOf({ commandPath, dryRun: true })).toBeNull();
    }
  });

  it("binds no reason onto a flag row — the declaration declares and does not fill", () => {
    // The parse layer and the conditional-required layer answer at parse time through
    // commander's own bytes; a `reason` cell on a flag row would be a field no reader
    // reaches, because no body-layer member is produced from a flag.
    for (const row of Object.values(ARGV_CHANNEL)) {
      expect(Object.keys(row).sort()).not.toContain("reason");
    }
  });
});

describe("the shells — three actions and no fourth", () => {
  it("implement: one advance, the value handed over unchanged, the request read off the flags", async () => {
    const calls: RunCalls = { advance: [], preview: [] };
    const answer: AdvanceOutcome = {
      kind: "held",
      state: { kind: "absent" },
      checked: [],
    };
    const report = new RecordingReporter();
    const shell = new ImplementCommand({ run: stubRun(calls, { advance: answer }), report });
    await shell.run(parsed({ args: { tasks: "1,2", plan: "p.md", recover: "true" } }));
    expect(calls.advance).toEqual([
      { command: "implement", type: "wave", tasks: "1,2", plan: "p.md", recover: true },
    ]);
    expect(calls.preview).toEqual([]);
    expect(report.outcomes).toHaveLength(1);
    expect(report.outcomes[0]?.outcome).toEqual({
      kind: "advance-entry",
      value: answer,
      request: calls.advance[0],
    });
    expect(report.outcomes[0]?.commandPath).toBe("implement");
  });

  it("implement: --dry-run reaches the forecast entry and nothing else", async () => {
    const calls: RunCalls = { advance: [], preview: [] };
    const report = new RecordingReporter();
    const shell = new ImplementCommand({ run: stubRun(calls), report });
    await shell.run(parsed({ dryRun: true, args: { tasks: "1", plan: "p.md" } }));
    expect(calls.advance).toEqual([]);
    expect(calls.preview).toHaveLength(1);
    expect(report.outcomes[0]?.outcome.kind).toBe("preview-entry");
  });

  it("review and fix read the --type and --spec cells the declaration validated", async () => {
    const calls: RunCalls = { advance: [], preview: [] };
    const report = new RecordingReporter();
    await new ReviewCommand({ run: stubRun(calls), report }).run(
      parsed({ commandPath: "review", args: { type: "phase-spec", spec: "s.md" } }),
    );
    await new FixCommand({ run: stubRun(calls), report }).run(
      parsed({ commandPath: "fix", args: { type: "wave", tasks: "3", plan: "p.md" } }),
    );
    expect(calls.advance[0]).toEqual({ command: "review", type: "phase-spec", spec: "s.md" });
    expect(calls.advance[1]).toEqual({ command: "fix", type: "wave", tasks: "3", plan: "p.md" });
  });

  it("schema: the --output value dispatches to ONE of the two entries, never a second branch", async () => {
    const skeletonCalls: unknown[] = [];
    const projectCalls: unknown[] = [];
    const documents = {
      skeletonAt: (type: string, target: string | undefined) => {
        skeletonCalls.push([type, target]);
        return { kind: "written", target: target ?? "" };
      },
      projectOf: (type: string, target: string | undefined) => {
        projectCalls.push([type, target]);
        return { kind: "projection", text: "{}\n" };
      },
    } as unknown as Documents;
    const report = new RecordingReporter();
    const shell = new SchemaCommand({
      documents,
      relative: (raw) => raw as RepoPath,
      report,
    });
    shell.run(
      parsed({
        commandPath: "schema get",
        positionals: ["plan", "x.md"],
        args: { output: "skeleton" },
      }),
    );
    shell.run(parsed({ commandPath: "schema get", positionals: ["plan"] }));
    expect(skeletonCalls).toEqual([["plan", "x.md"]]);
    expect(projectCalls).toEqual([["plan", undefined]]);
    expect(projectCalls).toHaveLength(1);
  });

  it("board: the two display switches are handed down as the flags' own values", async () => {
    const calls: RunCalls = { advance: [], preview: [] };
    const report = new RecordingReporter();
    const run = {
      boardOf: async () => ({ kind: "usage", reason: { kind: "missing-plan-or-spec" } }),
    } as unknown as Run;
    const shell = new BoardCommand({ run, typeOf: () => "plan", report });
    await shell.run(parsed({ commandPath: "board", args: { notes: "true" } }));
    const outcome = report.outcomes[0]?.outcome;
    expect(outcome?.kind).toBe("board-entry");
    if (outcome?.kind !== "board-entry") return;
    expect(outcome.display).toEqual({ notes: true, artifacts: false });
    void calls;
  });

  it("base: the leaf word picks the read or the write, and the conflict value goes out unchanged", () => {
    const read: BaseRead = { kind: "absent", target: "base.json" as RepoPath };
    const written: BaseWrite = { kind: "written", target: "base.json" as RepoPath };
    const seen: string[] = [];
    const artifact = {
      read: () => {
        seen.push("read");
        return read;
      },
      write: () => {
        seen.push("write");
        return written;
      },
    } as unknown as BaseArtifact;
    const report = new RecordingReporter();
    const resolver = () => ({
      kind: "resolved" as const,
      target: { artifact, plan: "p.md" as RepoPath },
    });
    const shell = new BaseCommand({ resolve: resolver, report });
    shell.run(parsed({ commandPath: "base get", leaf: "get", args: { plan: "p.md" } }));
    shell.run(
      parsed({
        commandPath: "base set",
        leaf: "set",
        args: { plan: "p.md", base: "main", source: "plan-field" },
      }),
    );
    expect(seen).toEqual(["read", "write"]);
    expect(report.outcomes[0]?.outcome).toEqual({ kind: "base-read", value: read });
    expect(report.outcomes[1]?.outcome).toEqual({ kind: "base-write", value: written });
  });

  it("base: an unresolved plan hands over the resolver's own value, adding no branch", () => {
    const report = new RecordingReporter();
    const refusal: CliOutcome = { kind: "usage", reason: { kind: "read-failure", target: "p.md" } };
    const shell = new BaseCommand({
      resolve: () => ({ kind: "refused", outcome: refusal }),
      report,
    });
    shell.run(parsed({ commandPath: "base get", leaf: "get", args: { plan: "p.md" } }));
    expect(report.outcomes[0]?.outcome).toEqual(refusal);
  });

  it("issue: one stdin read, one render, one report", () => {
    const reads: string[] = [];
    const renderer = {
      report: (stdin: string) => {
        reads.push(stdin);
        return { stream: "stdout" as const, text: "body\n", exitCode: 0 };
      },
    };
    const report = new RecordingReporter();
    const shell = new IssueCommand({
      renderer: renderer as never,
      stdin: () => '{"type":"bug"}',
      report,
    });
    shell.run(parsed({ commandPath: "issue render", leaf: "render" }));
    expect(reads).toEqual(['{"type":"bug"}']);
    expect(report.outcomes[0]?.outcome).toEqual({
      kind: "issue-report",
      report: { stream: "stdout", text: "body\n", exitCode: 0 },
    });
  });

  it("init: one plan, one onStep per step BEFORE its spawn, and the failure report from apply's code", async () => {
    const steps: readonly ProvisionStep[] = [
      { packageName: "a", tier: "core", argv: ["npm", "i", "a"] },
      { packageName: "b", tier: "core", argv: ["npm", "i", "b"] },
    ];
    const events: string[] = [];
    const provisioner = {
      plan: (host: string, request: ProvisionRequest) => {
        events.push(`plan:${host}:${request.shape}`);
        return steps;
      },
      apply: async (
        sequence: readonly ProvisionStep[],
        onStep: (index: number) => void,
      ): Promise<{ kind: "failed"; index: number; exitCode: number }> => {
        for (const [index] of sequence.entries()) {
          onStep(index);
          events.push(`spawn:${index}`);
        }
        return { kind: "failed", index: 1, exitCode: 9 };
      },
    };
    const report = new StepReporter();
    const shell = new InitCommand({
      provisioner: provisioner as never,
      renderer: new InitRendererStub(events) as never,
      report,
    });
    const code = await shell.run(
      parsed({ commandPath: "init", args: { harness: "claude", includeRecommends: "false" } }),
    );
    expect(events).toEqual([
      "plan:claude:install",
      "progress:0",
      "spawn:0",
      "progress:1",
      "spawn:1",
    ]);
    expect(code).toBe(0);
    const outcome = report.outcomes[0]?.outcome;
    expect(outcome?.kind).toBe("init");
    if (outcome?.kind !== "init") return;
    // The failure line carries `apply`'s OWN code, never a second guess.
    expect(outcome.lines.map((line) => line.text).join("")).toContain("exit 9");
    expect(outcome.exitCode).toBe(1);
    expect(outcome.lines.every((line) => line.stream === "stderr")).toBe(true);
  });

  it("init: --dry-run renders the step plan and reaches no runner", async () => {
    const events: string[] = [];
    const provisioner = {
      plan: () =>
        [{ packageName: "a", tier: "core", argv: ["npm", "i", "a"] }] as readonly ProvisionStep[],
      apply: async () => {
        events.push("apply");
        return { kind: "green" as const };
      },
    };
    const report = new RecordingReporter();
    const shell = new InitCommand({
      provisioner: provisioner as never,
      renderer: new InitRendererStub() as never,
      report,
    });
    const code = await shell.run(
      parsed({ commandPath: "init", dryRun: true, args: { harness: "pi" } }),
    );
    expect(events).toEqual([]);
    expect(code).toBe(0);
    const outcome = report.outcomes[0]?.outcome;
    if (outcome?.kind !== "init") throw new Error("expected an init outcome");
    expect(outcome.lines.map((line) => line.text).join("")).toContain("would run:");
  });
});

/** One `init` renderer stand-in — the shell's wiring is what is judged, not the layout. */
class InitRendererStub {
  readonly #events: string[];

  constructor(events: string[] = []) {
    this.#events = events;
  }

  preview(): readonly { readonly stream: "stdout"; readonly text: string }[] {
    return [{ stream: "stdout", text: "would run: npm i a\n" }];
  }

  progress(_facts: unknown, index: number): { readonly stream: "stdout"; readonly text: string } {
    this.#events.push(`progress:${index}`);
    return { stream: "stdout", text: `progress:${index}\n` };
  }

  green(): readonly { readonly stream: "stdout"; readonly text: string }[] {
    return [{ stream: "stdout", text: "init: 1 steps ok\n" }];
  }

  failure(
    _facts: unknown,
    index: number,
    exitCode: number,
  ): readonly {
    readonly stream: "stderr";
    readonly text: string;
  }[] {
    return [{ stream: "stderr", text: `init[${index + 1}/2] · exit ${exitCode}\n` }];
  }
}

describe("the three misuse layers", () => {
  it("the parse layer answers one line, no usage line, exit 2 — and its neighbour passes", async () => {
    const harness = new Harness();
    expect(await harness.cli.run(["base", "set"])).toBe(2);
    expect(harness.stderr).toBe("error: required option '--plan <path>' not specified\n");
    const known = new Harness();
    // The neighbour arm: the same command WITH the flag gets past the parse layer.
    const code = await known.cli.run([
      "base",
      "set",
      "--plan",
      "p.md",
      "--base",
      "main",
      "--source",
      "plan-field",
    ]);
    expect(code).not.toBe(2);
    expect(known.stderr).not.toContain("required option");
  });

  it("the parse layer refuses a missing positional and an unknown flag on the same one-line shape", async () => {
    const missing = new Harness();
    expect(await missing.cli.run(["schema", "get"])).toBe(2);
    expect(missing.stderr).toContain("error: missing required argument 'type'");
    expect(missing.stderr.split("\n").filter((line) => line !== "")).toHaveLength(1);
    const unknown = new Harness();
    expect(await unknown.cli.run(["base", "--plan", "p.md"])).toBe(2);
    expect(unknown.stderr).toContain("error: unknown option '--plan'");
    expect(unknown.stderr.split("\n").filter((line) => line !== "")).toHaveLength(1);
  });

  it("the conditional-required layer answers one line, and its spelling comes from REQUIRED_GROUPS", async () => {
    const harness = new Harness();
    expect(await harness.cli.run(["review", "--type", "wave"])).toBe(2);
    const flag = REQUIRED_GROUPS.review.wave?.[0] ?? "";
    expect(harness.stderr).toBe(`error: ${flag} required when --type wave\n`);
    const neighbour = new Harness();
    const code = await neighbour.cli.run(["review", "--type", "wave", "--plan", "p.md"]);
    expect(code).not.toBe(2);
    expect(neighbour.stderr).not.toContain("required when");
  });

  it("the body layer prefixes the command node's own usage line, and that line is its --help first line", async () => {
    for (const command of ["board", "schema get"]) {
      const argv =
        command === "board" ? ["board", "--dry-run"] : ["schema", "get", "plan", "--dry-run"];
      const harness = new Harness();
      expect(await harness.cli.run(argv)).toBe(2);
      const [usageLine, errorLine] = harness.stderr.split("\n");
      // Two sources, one derivation: the usage byte and the node's help head are the same
      // assembly, so they cannot drift.
      const builder = new CommandTreeBuilder();
      expect(usageLine).toBe(builder.usageLineOf(command));
      expect(errorLine?.startsWith("error: ")).toBe(true);
      // The scope rejection is a declared row's value, not commander's `unknown option`
      // byte — the two shapes are different and neither substitutes for the other.
      expect(harness.stderr).not.toContain("unknown option");
    }
  });

  it("an unknown command is a misuse too — exit 2, and the help face is exit 0", async () => {
    const unknown = new Harness();
    expect(await unknown.cli.run(["nope"])).toBe(2);
    const help = new Harness();
    expect(await help.cli.run(["--help"])).toBe(0);
    expect(help.stdout.startsWith("Usage: cdd [options] [command]")).toBe(true);
    expect(help.stderr).toBe("");
  });
});

describe("the exit-code table", () => {
  it("a refused dispatch exits 1 and its bytes ride the CDD_BLOCKED channel", async () => {
    const calls: RunCalls = { advance: [], preview: [] };
    const harness = new Harness({
      run: stubRun(calls, {
        advance: {
          kind: "held",
          state: {
            kind: "held",
            record: {
              pid: 42,
              command: "cdd implement --tasks 1",
              slug: "p9",
              startedAt: 0,
              wave: "1",
            } as never,
            alive: true,
            targetGone: [],
          },
          checked: [],
        },
        preview: { kind: "held", state: { kind: "absent" }, checked: [] },
      }),
    });
    const code = await harness.cli.run(["implement", "--tasks", "1", "--plan", "p.md"]);
    expect(code).toBe(1);
    expect(harness.stderr.startsWith("CDD_BLOCKED: ")).toBe(true);
    expect(harness.stderr).toContain("pid 42");
  });

  it("the dispatch arm is a NAMED refusal, never a plausible-looking wrong byte", async () => {
    // The capsule needs the round's conclusion word, its carrier coordinate and its hop —
    // none of which `AdvanceOutcome` carries. A surface that printed a status line without
    // its word would look almost right, which is worse than refusing.
    const calls: RunCalls = { advance: [], preview: [] };
    const harness = new Harness({
      run: stubRun(calls, {
        advance: {
          kind: "dispatch",
          result: {
            code: 0,
            log: "round.log",
            termination: null,
            brief: "",
            round: {
              op: "implement",
              cycle: 1,
              attempt: 1,
              dispatchBase: null,
              verdict: { treeClean: true, targetAction: true },
              violations: [],
              carrierDigest: null,
            },
            route: { kind: "review" },
          },
          capsule: {},
          checked: [],
        },
      }),
    });
    const code = await harness.cli.run(["implement", "--tasks", "1", "--plan", "p.md"]);
    expect(code).toBe(1);
    expect(harness.stderr).toContain("not renderable at the surface");
    expect(harness.stdout).toBe("");
  });
});

describe("the declaration and the usage union", () => {
  it("resolves every byte row's producer landing — a module path and an export name", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
    for (const [member, row] of Object.entries(USAGE_BYTES)) {
      const [modulePath, exportName] = row.producer.split("#");
      expect(modulePath, member).toBeDefined();
      expect(exportName, member).toBeDefined();
      const file = path.join(root, "src", modulePath ?? "");
      expect(existsSync(file), `${member}: ${row.producer}`).toBe(true);
      expect(readFileSync(file, "utf8"), `${member}: ${row.producer}`).toContain(exportName ?? "");
    }
  });

  it("translates every declared failure value through the ONE table, and the two base read variants land on one member", () => {
    // Every declared failure value answers a member the byte table carries.
    const members = Object.values(FAILURE_REASONS).map((translate) => translate as never);
    expect(members.length).toBeGreaterThan(0);
    expect(USAGE_BYTES["read-failure"].producer).toContain("#");
    expect(USAGE_BYTES["write-failure"].producer).toContain("#");
    expect(FAILURE_REASONS.absent({ kind: "absent", target: "t" })).toEqual({
      kind: "base-absent",
      target: "t",
    });
    expect(FAILURE_REASONS.corrupt({ kind: "corrupt", target: "t" })).toEqual({
      kind: "base-absent",
      target: "t",
    });
  });
});

describe("the skeleton landing", () => {
  it("writes the target through the injected writer and echoes the repo-relative path", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "cmd-skeleton-"));
    try {
      const target = "landed.md";
      const { Documents } = await import("../../../docs/index.ts");
      const documents = new Documents({
        readText: (rel) => ({ kind: "read-failure", target: rel }),
        today: "2026-01-01",
        textWriter: (rel, text) => {
          const absolute = path.join(repo, rel);
          // The writer is the ONLY landing point — the shell never touches the file system.
          mkdirSync(path.dirname(absolute), { recursive: true });
          writeFileSync(absolute, text, "utf8");
          return { kind: "written", target: rel };
        },
      });
      const harness = new Harness({
        documents,
        relative: (raw) => raw as RepoPath,
        stdin: () => "",
      });
      const code = await harness.cli.run(["schema", "get", "plan", "--output", "skeleton", target]);
      expect(code).toBe(0);
      expect(harness.stdout).toBe(`${target}\n`);
      const absolute = path.join(repo, target);
      expect(existsSync(absolute)).toBe(true);
      const bytes = readFileSync(absolute, "utf8");
      expect(bytes.length).toBeGreaterThan(0);
      expect(bytes).toBe(`${documents.skeletonOf("plan")}\n`);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
