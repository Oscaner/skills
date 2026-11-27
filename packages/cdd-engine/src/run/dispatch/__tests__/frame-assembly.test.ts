// packages/cdd-engine/src/run/dispatch/__tests__/frame-assembly.test.ts
// The dispatch frame's assembly pins, one group per declared fact:
//
//   · the prompt — the child receives it as EXACTLY ONE positional, byte-equal to the band the
//     declared table renders for the same values record, and never zero times. Dropping the
//     assembly step (command plus flags only) is the shape of the failure this pin was written
//     from: a spawn that succeeded over a round with no task in it;
//   · the empty render — a record naming no declared band answers the refusal and spawns
//     nothing (the runner's call count is zero, not an exit code), with its neighbour proving
//     the same counter reaches one when a frame does exist;
//   · the data plane — the prompt form, the command, the invoke prefix and the child env all
//     come from the harness rows; switching the host switches the columns, so no literal row
//     can satisfy both;
//   · the input cells — each one's provenance is its own arm: swapping the host moves the
//     command and the env while the spawn directory and the log stand still, swapping a value
//     moves the prompt's bytes while the command stands still, the directory is the path
//     basis' absolute root, and the log's two spellings are one file;
//   · the skill ref — the dispatch slot plus the per-host slash form, prefixed onto the ONE
//     positional; a face with no slot (fix, and the spec / plan reviews) carries no prefix;
//   · the single source — a text scan over the assembly module: no reference key, invoke
//     prefix or child-env key is spelled there, so the tables stay the only copy of them.
//
// The expected values are DERIVED from the tables (`HOSTS`, `DISPATCH`, `REFS`, the prompt
// bands) and never typed as literals: a literal expectation would pass while the assembly
// hard-coded the same literal.
//
// The two injected suppliers are the REAL ones — a `run/advance/frame.ts#FrameFacts` and the
// `surface/render/templates.ts` renderer — so the narrow cells this segment declares are pinned
// against what the composition root will actually hand them, without the product file reaching
// either foreign segment.

import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { Paths } from "../../../env/index.ts";
import type { RepoPath } from "../../../env/paths/root.ts";
import { RepoRoot } from "../../../env/paths/root.ts";
import type { ChildOutcome, ChildRun, ChildRunner } from "../../../env/process/child-runner.ts";
import { Clock } from "../../../env/process/clock.ts";
import { DISPATCH, HOST_IDS, HOSTS, type HostId, REFS } from "../../../env/process/host.ts";
import { WorkspaceRoot } from "../../../env/workspace/workspace.ts";
import {
  PromptBandsRenderer,
  TEMPLATE_PROMPT,
  type WorkModeRowKey,
} from "../../../surface/render/templates.ts";
import type { FrameFacts } from "../../advance/frame.ts";
import type { TargetType } from "../../advance/target-faces.ts";
import { Child, type DispatchFrame, type DispatchLog } from "../child.ts";
import {
  assembleDispatchFrame,
  childPromptOf,
  type DispatchAssembly,
  type DispatchValuesRecord,
} from "../frame-assembly.ts";

/** This test's own directory — the text scan reads the module beside it. */
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The workspace slug both the frame and the log coordinate use. */
const SLUG = "p39";

/** The round's own two spellings, as the produced stub answers them. */
const STUB_LOG: DispatchLog = {
  file: "/repo/.kairos/cdd/p39/logs/tasks-16,20-implement-1.log",
  path: ".kairos/cdd/p39/logs/tasks-16,20-implement-1.log" as RepoPath,
};

/** One frame's facts — the phase and the target type are the two cells this assembly reads,
 *  the rest is standing context no arm here depends on. */
const frameOf = (over: Partial<FrameFacts> = {}): FrameFacts => ({
  kind: "frame",
  command: "implement",
  recover: false,
  type: "wave",
  slug: SLUG,
  key: "wave:16,20",
  doc: "docs/kairos/plans/2026-11-25-engine-doc-tooling-p39.md",
  planPath: "docs/kairos/plans/2026-11-25-engine-doc-tooling-p39.md",
  planText: "",
  graph: null,
  emptyFileTasks: new Set<number>(),
  tasks: [16, 20],
  target: {
    type: "wave",
    id: "16,20",
    plan: "docs/kairos/plans/2026-11-25-engine-doc-tooling-p39.md",
  },
  identity: { key: "wave", doc: null },
  program: null,
  overall: null,
  pipeline: {
    specType: "phase-spec",
    specPath: "docs/kairos/specs/2026-11-25-engine-doc-tooling-p39-design.md",
    planPath: "docs/kairos/plans/2026-11-25-engine-doc-tooling-p39.md",
    graph: null,
  },
  workspace: { dir: `.kairos/cdd/${SLUG}`, id: SLUG },
  phase: "implement",
  round: 1,
  attempt: 1,
  ...over,
});

/** The round-context record — the cells the band's slots read, in the shape the pre-frame
 *  assembly produces. */
const valuesOf = (over: DispatchValuesRecord = {}): DispatchValuesRecord => ({
  ROLE: "implement",
  TARGET_TYPE: "",
  WAVE: "16,20",
  HANDOFF_SCHEMA: '{"type":"object","required":["status","artifacts"]}',
  INPUT_WAVE_BRIEF: `.kairos/cdd/${SLUG}/tasks-16,20-brief.md`,
  OUTPUT_REPORT: `.kairos/cdd/${SLUG}/tasks-16,20-implement-1-report.md`,
  OUTPUT_EVIDENCE: `.kairos/cdd/${SLUG}/tasks-16,20-implement-1-test-evidence.json`,
  OUTPUT_HANDOFF: `.kairos/cdd/${SLUG}/tasks-16,20-implement-1.json`,
  WORKSPACE_DIR: `.kairos/cdd/${SLUG}`,
  WORKSPACE_ID: SLUG,
  ...over,
});

/** One assembly's declared inputs — the prompt bands arrive as the real render face, exactly
 *  as the composition root will hand them over. */
const inputsOf = (over: Partial<DispatchAssembly> = {}): DispatchAssembly => ({
  frame: frameOf(),
  briefPath: `.kairos/cdd/${SLUG}/tasks-16,20-brief.md` as RepoPath,
  values: valuesOf(),
  prompts: BANDS,
  host: "claude",
  cwd: "/repo",
  log: STUB_LOG,
  ...over,
});

/** The band the declared table renders for one values record — the expected prompt, derived
 *  from the tables, never from the renderer's own output. */
const BANDS = new PromptBandsRenderer();

/** The declared row one record selects — the TABLE's row, read directly, so the expectation
 *  below cannot inherit a composition defect from the renderer it is pinning. */
const rowOf = (values: DispatchValuesRecord) =>
  values.ROLE === "review"
    ? TEMPLATE_PROMPT.reviews[(values.TARGET_TYPE ?? "") as TargetType]
    : TEMPLATE_PROMPT.modes[(values.ROLE ?? "") as WorkModeRowKey];

/** The expected prompt bytes of one assembly — the three zones the child reads, composed from
 *  `TEMPLATE_PROMPT`'s declared data: the version line and the row's shell, the shared return
 *  zone, then the row's declared round context resolved three-state. A renderer that dropped
 *  the context zone, or lost a zone separator, cannot satisfy this expectation. */
const promptOf = (values: DispatchValuesRecord): string => {
  const row = rowOf(values);
  if (row === undefined) return "";
  const context = row.context.flatMap((decl) => {
    const slot = /\{\{([A-Z0-9_]+)\}\}/.exec(decl.line)?.[1];
    if (slot === undefined) return [decl.line];
    if ((values[slot] ?? "") !== "") return [decl.line];
    return decl.absent === "none" ? [decl.line.replace(/\{\{[A-Z0-9_]+\}\}/, "none")] : [];
  });
  const zones = [
    [`$version ${TEMPLATE_PROMPT.$version}`, ...row.shell].join("\n"),
    TEMPLATE_PROMPT.return.RETURN_PROSE.join("\n"),
    context.join("\n"),
  ];
  return zones
    .join("\n\n")
    .replace(
      /\{\{> cl:([A-Za-z0-9-]+)\}\}/g,
      (whole, name: string) => TEMPLATE_PROMPT.clauses[`cl:${name}`] ?? whole,
    )
    .replace(/\{\{([A-Z0-9_]+)\}\}/g, (whole, name: string) => values[name] ?? whole);
};

/** Every `{{> cl:<key>}}` spelling the declared shells carry — the coverage arm's roster,
 *  derived from the table rather than typed. */
const clauseKeysOf = (): readonly string[] => {
  const rows = [...Object.values(TEMPLATE_PROMPT.modes), ...Object.values(TEMPLATE_PROMPT.reviews)];
  const spelled = rows.flatMap((row) =>
    row.shell.flatMap((line) =>
      [...line.matchAll(/\{\{> cl:([A-Za-z0-9-]+)\}\}/g)].map((m) => m[1] ?? ""),
    ),
  );
  return [...new Set(spelled)];
};

/** The invoke prefix of one host row — the non-empty segments of the declared column. */
const prefixOf = (host: HostId): readonly string[] =>
  HOSTS[host].invoke.split(" ").filter((part) => part.length > 0);

/** The assemble-then-narrow helper: the frame an arm expects, with the refusal kept loud. */
const frameFor = (inputs: DispatchAssembly): DispatchFrame => {
  const outcome = assembleDispatchFrame(inputs);
  if (outcome.kind !== "frame") throw new Error(`expected a frame, got ${outcome.kind}`);
  return outcome.frame;
};

/** The one positional a frame carries. */
const positionalOf = (frame: DispatchFrame): string => frame.args[frame.args.length - 1] ?? "";

/** A recording runner — the call count IS the "did the child exist" fact. */
class RecordingRunner implements ChildRunner {
  calls: ChildRun[] = [];

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    return {
      code: 0,
      stdout: "",
      stderr: "",
      facts: { overBudget: false, stopped: false, signal: null },
    };
  }
}

const tempDirs: string[] = [];

/** A real repository root over a temp directory — the log arms need the workspace's own
 *  coordinate, so the basis is a real one rather than a literal. */
const tempRepo = (): RepoRoot => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-frame-assembly-")));
  tempDirs.push(repo);
  return new RepoRoot(repo);
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("the dispatch frame's prompt", () => {
  it("carries the rendered band as the ONE positional, byte for byte", () => {
    // The fix face resolves no dispatch slot, so its positional IS the band's bytes — the
    // form in which "byte-equal to the render" is a direct comparison.
    const values = valuesOf({ ROLE: "fix", TARGET_TYPE: "phase-spec" });
    const frame = frameFor(
      inputsOf({ frame: frameOf({ phase: "fix", type: "phase-spec" }), values }),
    );
    const expected = promptOf(values);
    expect(expected.length).toBeGreaterThan(0);
    expect(positionalOf(frame)).toBe(expected);
    // Exactly once: the band's head appears in that one argument and in no other.
    const head = expected.split("\n")[0] ?? "";
    expect(head.length).toBeGreaterThan(0);
    expect(frame.args.filter((arg) => arg.includes(head))).toEqual([expected]);
  });

  it("sits after the invoke prefix — dropping the assembly step answers the command and flags alone", () => {
    const frame = frameFor(inputsOf());
    const prefix = prefixOf("claude");
    const expected = promptOf(valuesOf());
    expect(frame.args.slice(0, prefix.length)).toEqual(prefix);
    expect(frame.args.length).toBe(prefix.length + 1);
    // The failure shape: command plus flags with no task in them is exactly the argv this
    // pin refuses — and it is not what the assembly answers.
    expect(frame.args.slice(0, -1)).not.toContain(expected);
    expect(positionalOf(frame).endsWith(expected)).toBe(true);
  });

  it("answers the refusal for a record that selects no declared band, and spawns nothing", async () => {
    for (const role of ["", "   ", "not-a-mode"]) {
      const runner = new RecordingRunner();
      const child = new Child({ runner, clock: new Clock(() => 0) });
      const outcome = assembleDispatchFrame(inputsOf({ values: valuesOf({ ROLE: role }) }));
      // What a caller does with either variant: hand the frame over when there is one. A
      // refusal therefore reaches no spawn at all — the count is the fact, never an exit code.
      if (outcome.kind === "frame") await child.dispatch(outcome.frame);
      expect(outcome.kind).toBe("empty-prompt");
      expect(outcome.kind === "empty-prompt" && outcome.briefPath).toBe(
        `.kairos/cdd/${SLUG}/tasks-16,20-brief.md`,
      );
      expect(runner.calls.length).toBe(0);
    }
    // The neighbour: the same counter reaches one when the record does name a band.
    const runner = new RecordingRunner();
    const child = new Child({ runner, clock: new Clock(() => 0) });
    await child.dispatch(frameFor(inputsOf()));
    expect(runner.calls.length).toBe(1);
    expect(runner.calls[0]?.args).toEqual(frameFor(inputsOf()).args);
  });

  it("takes the prompt form from the host's column rather than from a branch", () => {
    const expected = promptOf(valuesOf());
    const ref = REFS[DISPATCH.implement]?.claude ?? "";
    for (const host of HOST_IDS) {
      const frame = frameFor(inputsOf({ host }));
      const hostRef = REFS[DISPATCH.implement]?.[host] ?? "";
      // Derived from the table: a prefixed row prefixes, a plain row hands the prompt over.
      const want = HOSTS[host].promptForm === "ref-prefixed" ? `${hostRef} ${expected}` : expected;
      expect(positionalOf(frame)).toBe(want);
    }
    // Both declared rows are the prefixed form today, so the plain side is pinned directly:
    // the column's other declared value, on the same one-positional contract.
    expect(childPromptOf("plain", ref, expected)).toBe(expected);
    expect(childPromptOf("ref-prefixed", ref, expected)).toBe(`${ref} ${expected}`);
    // A slotless frame keeps its prefix off even on the prefixed form.
    expect(childPromptOf("ref-prefixed", null, expected)).toBe(expected);
  });
});

describe("the round-context zone", () => {
  it("composes three zones — fixed prefix, return prose, round context — separated by blank lines", () => {
    const positional = positionalOf(frameFor(inputsOf()));
    expect(positional.endsWith(promptOf(valuesOf()))).toBe(true);
    // The zone boundaries are blank lines, never a bare newline: a single `\n` join is the
    // defect this arm was written from (the return prose ran into the shell's tail).
    expect(positional).toContain(`\n\n${TEMPLATE_PROMPT.return.RETURN_PROSE[0] ?? ""}`);
    expect(positional).toContain("\n\n## Round context\n");
  });

  it("names the brief, the write paths and the workspace the child is scoped to", () => {
    const values = valuesOf();
    const positional = positionalOf(frameFor(inputsOf({ values })));
    // The failure this pin exists for: a prompt that ends at the handoff schema. The child
    // then cannot read its brief, write its draft where the engine looks, or scope itself —
    // and the spawn still succeeds, which is why the bytes are the only evidence.
    for (const token of [
      "INPUT_WAVE_BRIEF",
      "OUTPUT_REPORT",
      "OUTPUT_EVIDENCE",
      "OUTPUT_HANDOFF",
      "WORKSPACE_DIR",
      "WORKSPACE_ID",
    ]) {
      const value = values[token] ?? "";
      expect(value.length).toBeGreaterThan(0);
      expect(positional).toContain(`- \`${token}\`: ${value}`);
    }
  });

  it("expands every clause partial the shells name, and ships none of the spellings", () => {
    // The roster is the table's own: drop a clause row and the shell that names it fails here.
    const keys = clauseKeysOf();
    expect(keys.length).toBeGreaterThan(0);
    const positional = positionalOf(frameFor(inputsOf()));
    expect(positional).not.toContain("{{> cl:");
    for (const key of keys) {
      const clause = TEMPLATE_PROMPT.clauses[`cl:${key}`];
      expect(clause, `clause cl:${key} is named by a shell but not declared`).toBeTruthy();
      expect(positional).toContain(`- ${clause}`);
    }
  });

  it("resolves a cell three-state: a value, a dropped line, and a `none` literal", () => {
    const fixFrame = (over: DispatchValuesRecord) =>
      frameFor(
        inputsOf({ frame: frameOf({ phase: "fix", type: "wave" }), values: valuesOf(over) }),
      );
    // Absence declared as `none` prints the bare literal — the round really has no sidecar.
    const absent = positionalOf(fixFrame({ ROLE: "fix", TARGET_TYPE: "wave", INPUT_RULINGS: "" }));
    expect(absent).toContain("- `INPUT_RULINGS`: none");
    // A present value renders in the slot's place.
    const present = positionalOf(
      fixFrame({ ROLE: "fix", TARGET_TYPE: "wave", INPUT_RULINGS: ".kairos/cdd/p39/rulings.json" }),
    );
    expect(present).toContain("- `INPUT_RULINGS`: .kairos/cdd/p39/rulings.json");
    // A cell declared `drop` withholds its line whole: rendering the empty value would leave
    // `- \`INPUT_PLAN\`: ` behind, which is the shape this arm refuses.
    expect(absent).not.toContain("- `INPUT_PLAN`:");
    expect(absent).not.toContain("- `INPUT_SPEC`:");
    // And a row that declares no such cell never prints it at all.
    expect(positionalOf(frameFor(inputsOf()))).not.toContain("INPUT_RULINGS");
  });
});

describe("the harness row's columns", () => {
  it("reads the command, the invoke prefix and the child env off the host's own row", () => {
    for (const host of HOST_IDS) {
      const frame = frameFor(inputsOf({ host }));
      expect(frame.command).toBe(HOSTS[host].cli);
      const prefix = prefixOf(host);
      expect(frame.args.slice(0, prefix.length)).toEqual(prefix);
      expect(frame.env).toEqual(HOSTS[host].env);
    }
    // The pair is only a pin while the rows actually differ: a hard-coded column cannot
    // satisfy both hosts.
    const [first, second] = HOST_IDS;
    expect(HOSTS[first].cli).not.toBe(HOSTS[second].cli);
    expect(prefixOf(first)).not.toEqual(prefixOf(second));
    expect(HOSTS[first].env).not.toEqual(HOSTS[second].env);
  });

  it("carries the frame's phase and leaves the child seam passing the frame through", async () => {
    const frame = frameFor(inputsOf({ frame: frameOf({ phase: "review", type: "wave" }) }));
    expect(frame.phase).toBe("review");
    const runner = new RecordingRunner();
    await new Child({ runner, clock: new Clock(() => 0) }).dispatch(frame);
    expect(runner.calls[0]?.env).toEqual(HOSTS.claude.env);
    expect(runner.calls[0]?.args).toEqual([...frame.args]);
  });
});

describe("the input cells' provenance", () => {
  it("moves the command and the env with the host, and leaves the directory and the log alone", () => {
    const claude = frameFor(inputsOf({ host: "claude" }));
    const pi = frameFor(inputsOf({ host: "pi" }));
    expect(claude.command).toBe(HOSTS.claude.cli);
    expect(pi.command).toBe(HOSTS.pi.cli);
    expect(claude.env).toEqual(HOSTS.claude.env);
    expect(pi.env).toEqual(HOSTS.pi.env);
    expect(claude.cwd).toBe(pi.cwd);
    expect(claude.log).toEqual(pi.log);
  });

  it("moves the prompt's bytes with the values record, and leaves the command alone", () => {
    const before = frameFor(inputsOf());
    const after = frameFor(inputsOf({ values: valuesOf({ HANDOFF_SCHEMA: '{"type":"string"}' }) }));
    expect(positionalOf(before)).not.toBe(positionalOf(after));
    expect(
      positionalOf(after).endsWith(promptOf(valuesOf({ HANDOFF_SCHEMA: '{"type":"string"}' }))),
    ).toBe(true);
    expect(before.command).toBe(after.command);
    expect(after.args.slice(0, prefixOf("claude").length)).toEqual(
      before.args.slice(0, prefixOf("claude").length),
    );
  });

  it("spawns the child in the path basis' absolute root", () => {
    const root = tempRepo();
    const paths = new Paths(root);
    const frame = frameFor(inputsOf({ cwd: paths.root.absolute }));
    expect(frame.cwd).toBe(root.absolute);
    expect(frame.cwd).toBe(paths.root.absolute);
  });

  it("takes the log's two spellings as one file, from the workspace's own coordinate", () => {
    const root = tempRepo();
    const workspace = new WorkspaceRoot({
      basis: root,
      now: () => 0,
      baseName: "base.json",
    }).at(SLUG);
    const logPath = workspace.roundLogOf("tasks-16,20-implement-1");
    const log: DispatchLog = { file: root.resolve(logPath), path: logPath };
    const frame = frameFor(inputsOf({ cwd: root.absolute, log }));
    expect(frame.log).toEqual(log);
    expect(frame.log.path).toBe(logPath);
    expect(frame.log.file).toBe(root.resolve(logPath));
    // The same file, spelled twice: one conversion pair, no second derivation.
    expect(root.relativize(frame.log.file)).toBe(frame.log.path);
  });
});

describe("the skill ref", () => {
  it("prefixes the one positional with the dispatch slot's slash form", () => {
    for (const host of HOST_IDS) {
      const expected = promptOf(valuesOf());
      const frame = frameFor(inputsOf({ host }));
      const ref = REFS[DISPATCH.implement]?.[host] ?? "";
      expect(ref.length).toBeGreaterThan(0);
      expect(positionalOf(frame)).toBe(`${ref} ${expected}`);
      // The prefix is the table's: without it the positional is the bare render.
      expect(positionalOf(frame).slice(ref.length + 1)).toBe(expected);
    }
  });

  it("reads the review faces' slot from the phase and type row", () => {
    for (const host of HOST_IDS) {
      const values = valuesOf({ ROLE: "review", TARGET_TYPE: "wave" });
      const frame = frameFor(
        inputsOf({ host, frame: frameOf({ phase: "review", type: "wave" }), values }),
      );
      const ref = REFS[DISPATCH.review.wave.ref]?.[host] ?? "";
      expect(ref.length).toBeGreaterThan(0);
      expect(positionalOf(frame)).toBe(`${ref} ${promptOf(values)}`);
    }
    // A review whose type has no dispatch row (the spec and plan reviews) carries no slot,
    // so no prefix — the same rule the fix face gets.
    for (const type of ["phase-spec", "plan", "overall", "single-spec"] as const) {
      const values = valuesOf({ ROLE: "review", TARGET_TYPE: type });
      const frame = frameFor(inputsOf({ frame: frameOf({ phase: "review", type }), values }));
      expect(positionalOf(frame)).toBe(promptOf(values));
      expect((DISPATCH.review as Readonly<Record<string, unknown>>)[type]).toBeUndefined();
    }
  });

  it("carries no prefix on the fix face", () => {
    const values = valuesOf({ ROLE: "fix", TARGET_TYPE: "phase-spec" });
    const frame = frameFor(
      inputsOf({ frame: frameOf({ phase: "fix", type: "phase-spec" }), values }),
    );
    expect(positionalOf(frame)).toBe(promptOf(values));
  });

  it("carries no prefix when the phase resolves no slot at all", () => {
    // A branch review resolves the branch row, a branch-review of a type with no row does
    // not: the slot source is the table, not the phase word alone.
    const values = valuesOf({ ROLE: "review", TARGET_TYPE: "plan" });
    const frame = frameFor(
      inputsOf({ frame: frameOf({ phase: "branch-review", type: "plan" }), values }),
    );
    expect(positionalOf(frame)).toBe(promptOf(values));
  });
});

describe("the single source", () => {
  it("spells no reference key, invoke prefix or child-env key of its own", () => {
    const text = readFileSync(path.join(HERE, "..", "frame-assembly.ts"), "utf8");
    // Every one of these is a table cell elsewhere: a copy here would be the second spelling
    // the tables exist to prevent, and it would agree with the table right up to the day the
    // table moves.
    const spells = [
      "mattpocock-skills",
      "superpowers",
      "--output-format",
      "--dangerously-skip-permissions",
      "--mode text",
      "FORCE_PROMPT_CACHING",
      "PI_CACHE_RETENTION",
    ];
    expect(spells.filter((spell) => text.includes(spell))).toEqual([]);
    // And the two foreign segments stay out of its imports: the render face arrives injected,
    // the frame arrives structurally, so nothing here names a frontier or a byte module.
    expect(text).not.toContain('"../advance/');
    expect(text).not.toContain('"../../surface/');
  });

  it("accepts the composition root's two real suppliers through its narrow cells", () => {
    // The compile-time half of the same fact: a real `FrameFacts` and the real renderer are
    // what the assembly is handed, and both satisfy the declared cells.
    const frame = frameFor(inputsOf({ prompts: new PromptBandsRenderer() }));
    expect(frame.command).toBe(HOSTS.claude.cli);
    expect(positionalOf(frame).endsWith(promptOf(valuesOf()))).toBe(true);
  });
});
