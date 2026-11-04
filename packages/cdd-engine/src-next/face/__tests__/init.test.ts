// packages/cdd-engine/src-next/face/__tests__/init.test.ts
// P20 — the `cdd init` seam pins. Three faces:
//
//   · the sequence — the run's argv stream is the roster's flattened install (or
//     update) column for the requested harness, in declared row order, and a
//     `--update` run carries zero install argv;
//   · the failure face — the first non-zero exit stops the sequence, the report
//     line keeps the pinned three-part bytes (`init[<i>/<n>] · <argv join> ·
//     exit <code>`), and only the update form carries the not-installed hint;
//   · the output face — the step headers (`init[<i>/<n>] <harness> · <pkg> ·
//     <command tail>`) are written through the injected synchronous header seam
//     before that step's own spawn (one ordered event log, so an inverted pair is
//     visible), and the green run closes with the summary line;
//   · the production runner — a real spawn returns the child's own exit code and
//     the `SPAWN_FAILURE_CODE` for a missing binary, with all three standard
//     streams inherited;
//   · the production face — the real bin run under a pipe against a stand-in
//     harness on PATH: every header lands ahead of its child's own line and the
//     child's output reaches the bin's (piped) stdout, which is the consumer-facing
//     half of the synchronous-writer ruling.

import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { CliIo } from "../cli.ts";
import type { HostId } from "../host.ts";
import {
  CliInit,
  ExecaStepRunner,
  type InitRequest,
  SPAWN_FAILURE_CODE,
  STDIO,
  type StepRunner,
} from "../init.ts";
import { PLUGINS, type PluginRow } from "../plugins.ts";

/** The roster narrowed to its CORE rows — the flag-less face's plan source (the
 *  recommended tier is opt-in, so a flag-less mirror takes the core rows only). */
const ROSTER: readonly PluginRow[] = PLUGINS.filter((row) => row.tier === "core");

/** The flattened argv of an arbitrary row set — the independent source a tiered
 *  request is compared against (derived from the roster, never from the run's order). */
const stepsOf = (
  rows: readonly PluginRow[],
  host: HostId,
  shape: "install" | "update",
): string[][] => rows.flatMap((row) => row[host][shape].map((argv) => [...argv]));

/** The roster's core-only flattened argv for one harness + shape — the independent
 *  source a flag-less run is compared against (never reverse-derived from the run's
 *  own order). The flatten shape itself lives once, in `stepsOf`. */
const sequenceOf = (host: HostId, shape: "install" | "update"): string[][] =>
  stepsOf(ROSTER, host, shape);

/** One flatten request — the flag-less face (core rows only) unless a case opts in. */
const req = (host: HostId, shape: "install" | "update", recommended = false): InitRequest => ({
  host,
  shape,
  recommended,
});

/** The shipped CLI entry — executed the way the consumer runs it (never imported). */
const BIN = fileURLToPath(new URL("../../bin.ts", import.meta.url));

/** The exact claude install heads — the pinned step-header bytes (spec §2.5), one
 *  per step, in roster order. */
const CLAUDE_INSTALL_HEADS = [
  "init[1/6] claude · superpowers · plugin marketplace add obra/superpowers-marketplace",
  "init[2/6] claude · superpowers · plugin install superpowers@superpowers-marketplace",
  "init[3/6] claude · mattpocock-skills · plugin marketplace add mattpocock/skills",
  "init[4/6] claude · mattpocock-skills · plugin install mattpocock-skills@mattpocock",
  "init[5/6] claude · kairos · plugin marketplace add oscaner/skills",
  "init[6/6] claude · kairos · plugin install kairos@oscaner-skills",
];

/** The capturing io — the failure report's stderr face. */
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

/** One ordered event from the run face. The header seam and the runner seam push
 *  into ONE log: two independent arrays cannot observe an inverted pair, because a
 *  header written after its spawn would still be "one of six headers". */
type InitEvent =
  | { readonly kind: "header"; readonly line: string }
  | { readonly kind: "run"; readonly argv: readonly string[] };

/** The ordered event log shared by the header collector and the stand-in runner. */
class EventLog {
  readonly events: InitEvent[] = [];

  record(event: InitEvent): void {
    this.events.push(event);
  }
}

/** The stand-in runner — returns the n-th pinned code for the n-th call (absent
 *  codes are 0), so "the first two steps pass, the third fails" is expressible. */
class RecordingRunner implements StepRunner {
  readonly calls: (readonly string[])[] = [];
  readonly codes: readonly number[];
  readonly #log: EventLog | null;

  constructor(codes: readonly number[] = [], log: EventLog | null = null) {
    this.codes = codes;
    this.#log = log;
  }

  async run(argv: readonly string[]): Promise<number> {
    this.calls.push(argv);
    this.#log?.record({ kind: "run", argv });
    return this.codes[this.calls.length - 1] ?? 0;
  }
}

/** The init face over the injected runner + header collector. */
const initFace = (
  runner: StepRunner,
  log: EventLog | null = null,
): { init: CliInit; io: CaptureIo; headers: string[] } => {
  const io = new CaptureIo();
  const headers: string[] = [];
  const init = new CliInit({
    io,
    runner,
    header: (line) => {
      headers.push(line);
      log?.record({ kind: "header", line });
    },
  });
  return { init, io, headers };
};

describe("CliInit — the harness plugin sequence", () => {
  it("runs the claude install sequence — the roster's flattened install argv, in declared order", async () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    expect(await init.run(req("claude", "install"))).toBe(0);
    expect(runner.calls).toEqual(sequenceOf("claude", "install"));
    // the sequence is the full six steps (3 packages × 2 claude commands)
    expect(runner.calls).toHaveLength(6);
  });

  it("runs the pi install sequence — one step per package", async () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    expect(await init.run(req("pi", "install"))).toBe(0);
    expect(runner.calls).toEqual(sequenceOf("pi", "install"));
    expect(runner.calls).toHaveLength(3);
  });

  it("--update runs the update sequence — zero install argv rides the run", async () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    expect(await init.run(req("claude", "update"))).toBe(0);
    expect(runner.calls).toEqual(sequenceOf("claude", "update"));
    const installs = sequenceOf("claude", "install").map((argv) => argv.join(" "));
    for (const call of runner.calls) expect(installs).not.toContain(call.join(" "));
  });
});

describe("CliInit — the --dry-run preview face", () => {
  it("previews the claude install plan — one would-run line per step, then the summary", () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    const lines = init.preview(req("claude", "install"));
    // one line per step plus the summary — the same denominator the real run prints
    expect(lines).toHaveLength(ROSTER.flatMap((row) => row.claude.install).length + 1);
    // every step line is the roster's own argv, joined — never a re-derived shape
    expect(lines.slice(0, -1)).toEqual(
      sequenceOf("claude", "install").map((argv) => `would run: ${argv.join(" ")}`),
    );
    expect(lines[0]).toBe("would run: claude plugin marketplace add obra/superpowers-marketplace");
    expect(lines.at(-1)).toBe("init: 6 steps (claude · install) — dry run, nothing executed");
    // zero spawn, zero side effect — the preview never reaches the injected runner
    expect(runner.calls).toEqual([]);
  });

  it("previews the update shape — the update commands, and the summary names the update verb", () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    const lines = init.preview(req("claude", "update"));
    expect(lines.slice(0, -1)).toEqual(
      sequenceOf("claude", "update").map((argv) => `would run: ${argv.join(" ")}`),
    );
    expect(lines[0]).toBe("would run: claude plugin marketplace update superpowers-marketplace");
    expect(lines.at(-1)).toBe("init: 6 steps (claude · update) — dry run, nothing executed");
    expect(runner.calls).toEqual([]);
  });

  it("the pi preview counts three steps — the harness sequence, never the package count", () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    const lines = init.preview(req("pi", "install"));
    expect(lines).toHaveLength(4);
    expect(lines.at(-1)).toBe("init: 3 steps (pi · install) — dry run, nothing executed");
    expect(runner.calls).toEqual([]);
  });

  it("the pi update preview reads the update sequence — three steps, the update verb in the summary", () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    const lines = init.preview(req("pi", "update"));
    expect(lines.slice(0, -1)).toEqual(
      sequenceOf("pi", "update").map((argv) => `would run: ${argv.join(" ")}`),
    );
    expect(lines).toHaveLength(4);
    expect(lines.at(-1)).toBe("init: 3 steps (pi · update) — dry run, nothing executed");
    expect(runner.calls).toEqual([]);
  });

  it("the recommended tier joins the pi plan — nine steps, the core three first and argv-identical", () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    const lines = init.preview(req("pi", "install", true));
    // The step lines carry argv, never the "[<i>/<n>]" denominator — the denominator
    // grows 3 → 9 with the tier, so the core span is compared by its argv sequence.
    const steps = lines.slice(0, -1);
    expect(steps).toHaveLength(9);
    expect(steps.slice(0, 3)).toEqual(
      sequenceOf("pi", "install").map((argv) => `would run: ${argv.join(" ")}`),
    );
    const recommended = PLUGINS.filter((row) => row.tier === "recommended");
    expect(recommended.map((row) => row.name)).toEqual([
      "pi-fff",
      "rpiv-todo",
      "rpiv-ask-user-question",
      "pi-web-access",
      "pi-background-tasks",
      "pi-agentsmd",
    ]);
    expect(steps.slice(3)).toEqual(
      recommended.flatMap((row) => row.pi.install.map((argv) => `would run: ${argv.join(" ")}`)),
    );
    expect(runner.calls).toEqual([]);
  });

  it("the recommended tier adds zero claude steps — the recommended claude column is empty", () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    const lines = init.preview(req("claude", "install", true));
    // the flag face closes with the summary and the empty-tier info line — the step
    // lines themselves are the core span, argv-identical to the flag-less plan
    const steps = lines.filter((line) => line.startsWith("would run: "));
    expect(steps).toHaveLength(6);
    expect(steps).toEqual(
      sequenceOf("claude", "install").map((argv) => `would run: ${argv.join(" ")}`),
    );
    expect(runner.calls).toEqual([]);
  });
});

describe("CliInit — the recommended tier on the run face", () => {
  it("runs the pi recommended plan — nine steps, the core three first, the six recommended rows after", async () => {
    const runner = new RecordingRunner();
    const { init, io, headers } = initFace(runner);
    expect(await init.run(req("pi", "install", true))).toBe(0);
    expect(runner.calls).toEqual(stepsOf(PLUGINS, "pi", "install"));
    expect(runner.calls).toHaveLength(9);
    // the core span is argv-identical to the flag-less plan — only the denominator grows
    expect(runner.calls.slice(0, 3)).toEqual(sequenceOf("pi", "install"));
    expect(headers.at(-1)).toBe("init: 9 steps ok (pi · install · 3 core + 6 recommended)");
    // r > 0 — the empty-tier info line is the r === 0 face only
    expect(headers).not.toContain("init: no recommended packages for pi");
    expect(io.stderrText).toBe("");
  });

  it("the claude recommended plan adds zero steps and reports the empty tier after the summary", async () => {
    const runner = new RecordingRunner();
    const { init, io, headers } = initFace(runner);
    expect(await init.run(req("claude", "install", true))).toBe(0);
    expect(runner.calls).toEqual(sequenceOf("claude", "install"));
    expect(headers.slice(-2)).toEqual([
      "init: 6 steps ok (claude · install · 6 core + 0 recommended)",
      "init: no recommended packages for claude",
    ]);
    expect(io.stderrText).toBe("");
  });
});

describe("CliInit — the recommended tier on the preview face", () => {
  it("the pi recommended preview carries ten lines — nine steps, the tier split in the summary", () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    const lines = init.preview(req("pi", "install", true));
    expect(lines).toHaveLength(10);
    expect(lines.slice(0, -1)).toEqual(
      stepsOf(PLUGINS, "pi", "install").map((argv) => `would run: ${argv.join(" ")}`),
    );
    expect(lines.at(-1)).toBe(
      "init: 9 steps (pi · install · 3 core + 6 recommended) — dry run, nothing executed",
    );
    expect(lines).not.toContain("init: no recommended packages for pi");
    expect(runner.calls).toEqual([]);
  });

  it("the claude recommended preview states the empty tier after the summary — the run face's order", () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    const lines = init.preview(req("claude", "install", true));
    expect(lines).toHaveLength(8);
    expect(lines.slice(-2)).toEqual([
      "init: 6 steps (claude · install · 6 core + 0 recommended) — dry run, nothing executed",
      "init: no recommended packages for claude",
    ]);
    expect(runner.calls).toEqual([]);
  });

  it("the update shape previews the update column on both harnesses — zero install argv", () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    const piLines = init.preview(req("pi", "update", true));
    // the update column is the independent source — never reverse-derived from install
    const piSteps = piLines.filter((line) => line.startsWith("would run: "));
    expect(piSteps).toEqual(
      stepsOf(PLUGINS, "pi", "update").map((argv) => `would run: ${argv.join(" ")}`),
    );
    expect(piLines).toHaveLength(10);
    const installs = new Set(stepsOf(PLUGINS, "pi", "install").map((argv) => argv.join(" ")));
    for (const line of piSteps) {
      expect(installs.has(line.replace("would run: ", ""))).toBe(false);
    }
    const claudeLines = init.preview(req("claude", "update", true));
    const claudeSteps = claudeLines.filter((line) => line.startsWith("would run: "));
    expect(claudeSteps).toEqual(
      stepsOf(PLUGINS, "claude", "update").map((argv) => `would run: ${argv.join(" ")}`),
    );
    expect(claudeLines.slice(-2)).toEqual([
      "init: 6 steps (claude · update · 6 core + 0 recommended) — dry run, nothing executed",
      "init: no recommended packages for claude",
    ]);
    expect(runner.calls).toEqual([]);
  });
});

describe("CliInit — the recommended-tier failure face", () => {
  it("the install form names the package as recommended — core already installed, zero update hint", async () => {
    const runner = new RecordingRunner([0, 0, 0, 9]);
    const { init, io } = initFace(runner);
    expect(await init.run(req("pi", "install", true))).toBe(1);
    // the first recommended step failed — the fifth never ran
    expect(runner.calls).toHaveLength(4);
    expect(io.stderrText).toBe(
      "init[4/9] · pi install npm:@ff-labs/pi-fff · exit 9\n" +
        "init: pi-fff is a recommended package — the core plugin set is already installed\n",
    );
  });

  it("the update form appends the recommended line before the unchanged not-installed hint", async () => {
    const runner = new RecordingRunner([0, 0, 0, 9]);
    const { init, io } = initFace(runner);
    expect(await init.run(req("pi", "update", true))).toBe(1);
    expect(io.stderrText).toBe(
      "init[4/9] · pi update npm:@ff-labs/pi-fff · exit 9\n" +
        "init: pi-fff is a recommended package — run cdd init --harness=pi --include-recommends without --update first\n" +
        "if the package is not installed, run cdd init --harness=pi without --update first\n",
    );
  });

  it("a core-tier failure under the flag carries zero recommended line — the tier is the step's own fact", async () => {
    const runner = new RecordingRunner([9]);
    const { init, io } = initFace(runner);
    expect(await init.run(req("pi", "install", true))).toBe(1);
    expect(io.stderrText).toBe("init[1/9] · pi install git:github.com/obra/superpowers · exit 9\n");
  });
});

describe("CliInit — the first-failure stop and its report", () => {
  it("stops at the first non-zero exit and reports the failing step (global ordinal, exit code)", async () => {
    const runner = new RecordingRunner([0, 0, 9]);
    const { init, io } = initFace(runner);
    expect(await init.run(req("claude", "install"))).toBe(1);
    // the third step failed — the fourth never ran
    expect(runner.calls).toHaveLength(3);
    expect(io.stderrText).toBe(
      "init[3/6] · claude plugin marketplace add mattpocock/skills · exit 9\n",
    );
  });

  it("the update form appends the not-installed hint; the install form carries zero hint", async () => {
    const updateRunner = new RecordingRunner([0, 0, 9]);
    const updateFace = initFace(updateRunner);
    expect(await updateFace.init.run(req("claude", "update"))).toBe(1);
    expect(updateFace.io.stderrText.split("\n")[0]).toBe(
      "init[3/6] · claude plugin marketplace update mattpocock · exit 9",
    );
    expect(updateFace.io.stderrText).toContain(
      "if the package is not installed, run cdd init --harness=claude without --update first\n",
    );
    const installRunner = new RecordingRunner([0, 0, 9]);
    const installFace = initFace(installRunner);
    expect(await installFace.init.run(req("claude", "install"))).toBe(1);
    expect(installFace.io.stderrText).not.toContain("if the package is not installed");
  });
});

describe("CliInit — the step headers and the summary line", () => {
  it("writes each step header before that step's spawn — the header/run interleave, head bytes first", async () => {
    const log = new EventLog();
    const runner = new RecordingRunner([], log);
    const { init } = initFace(runner, log);
    expect(await init.run(req("claude", "install"))).toBe(0);
    // Every step is one header immediately followed by its own spawn — the order the
    // synchronous writer exists to guarantee (§2.5). An unrelated pair of arrays
    // could not see an inverted pair; this one log can.
    const calls = sequenceOf("claude", "install");
    const steps = CLAUDE_INSTALL_HEADS.flatMap((head, index) => {
      const argv = calls[index] ?? [];
      return [`header:${head}`, `run:${argv.join(" ")}`];
    });
    expect(
      log.events.map((event) =>
        event.kind === "header" ? `header:${event.line}` : `run:${event.argv.join(" ")}`,
      ),
    ).toEqual([...steps, "header:init: 6 steps ok (claude · install)"]);
  });

  it("closes a green run with the summary line — the harness and the shape verb", async () => {
    const installRunner = new RecordingRunner();
    const installFace = initFace(installRunner);
    expect(await installFace.init.run(req("claude", "install"))).toBe(0);
    expect(installFace.headers.at(-1)).toBe("init: 6 steps ok (claude · install)");
    const updateRunner = new RecordingRunner();
    const updateFace = initFace(updateRunner);
    expect(await updateFace.init.run(req("claude", "update"))).toBe(0);
    expect(updateFace.headers.at(-1)).toBe("init: 6 steps ok (claude · update)");
  });

  it("the pi face counts three steps — the denominator is the harness sequence, never the package count", async () => {
    const runner = new RecordingRunner();
    const { init, headers } = initFace(runner);
    expect(await init.run(req("pi", "install"))).toBe(0);
    expect(headers[0]).toBe("init[1/3] pi · superpowers · install git:github.com/obra/superpowers");
    expect(headers.at(-1)).toBe("init: 3 steps ok (pi · install)");
  });

  it("a failing run writes no summary line", async () => {
    const runner = new RecordingRunner([0, 9]);
    const { init, headers } = initFace(runner);
    expect(await init.run(req("claude", "install"))).toBe(1);
    expect(headers).toHaveLength(2);
    expect(headers.some((line) => line.startsWith("init: "))).toBe(false);
  });
});

describe("ExecaStepRunner — the real spawn face", () => {
  it("returns the child's own exit code", async () => {
    const code = await new ExecaStepRunner().run([process.execPath, "-e", "process.exit(3)"]);
    expect(code).toBe(3);
    expect(await new ExecaStepRunner().run([process.execPath, "-e", "process.exit(0)"])).toBe(0);
  });

  it("returns SPAWN_FAILURE_CODE for a missing binary — no throw crosses the seam", async () => {
    const code = await new ExecaStepRunner().run([`cdd-no-such-binary-${Date.now()}`, "x"]);
    expect(code).toBe(SPAWN_FAILURE_CODE);
    expect(SPAWN_FAILURE_CODE).toBe(127);
  });

  it("declares the inherited three-stream face — `STDIO` is the option the runner hands over", () => {
    expect(STDIO).toBe("inherit");
  });
});

describe("the production face — the default writer and the real bin under a pipe", () => {
  it("the composition root's default header writer is the synchronous one — writeSync on fd 1", () => {
    // The ordering guarantee below (and the consumer-facing §2.5 promise) exists
    // only because the writer is synchronous: `process.stdout.write` queues when
    // fd 1 is a pipe, so its header can surface behind the child's own writes. The
    // writer choice is therefore a face of its own — a pipe that drains promptly
    // cannot expose the difference behaviourally, so it is pinned at the source.
    const src = readFileSync(new URL("../cli.ts", import.meta.url), "utf8");
    expect(src).toMatch(
      /this\.#initHeader = opts\.initHeader \?\? \(\(line\) => writeSync\(1, `\$\{line\}\\n`\)\);/,
    );
  });

  it("writes each header before its own child's output and carries that output on the piped stdout", () => {
    // A stand-in harness on PATH: one stdout line, exit 0. Under `stdio: "inherit"`
    // that line lands on the bin's own fd 1; when fd 1 is a pipe (the case the
    // synchronous writer exists for) the parent's headers and the child's lines
    // must still interleave header-first, or a piped log shows each child ahead of
    // its own header.
    const dir = mkdtempSync(join(tmpdir(), "cdd-init-e2e-"));
    try {
      const stub = join(dir, "claude");
      writeFileSync(stub, '#!/bin/sh\necho "harness-step-output"\nexit 0\n');
      chmodSync(stub, 0o755);
      const result = spawnSync(process.execPath, [BIN, "init", "--harness=claude"], {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ""}` },
        stdio: ["ignore", "pipe", "pipe"],
      });
      expect(result.status).toBe(0);
      const childLine = "harness-step-output";
      expect(result.stdout).toBe(
        [
          ...CLAUDE_INSTALL_HEADS.flatMap((head) => [head, childLine]),
          "init: 6 steps ok (claude · install)",
          "",
        ].join("\n"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
