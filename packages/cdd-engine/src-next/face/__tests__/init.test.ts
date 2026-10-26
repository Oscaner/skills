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
//     before the spawn, and the green run closes with the summary line;
//   · the production runner — a real spawn returns the child's own exit code and
//     the `SPAWN_FAILURE_CODE` for a missing binary, with all three standard
//     streams inherited.

import process from "node:process";
import { describe, expect, it } from "vitest";

import type { CliIo } from "../cli.ts";
import type { HostId } from "../host.ts";
import { CliInit, ExecaStepRunner, SPAWN_FAILURE_CODE, STDIO, type StepRunner } from "../init.ts";
import { PLUGINS, type PluginRow } from "../plugins.ts";

/** The roster widened to its row face — the literal tuple union flattens cleanly. */
const ROSTER: readonly PluginRow[] = PLUGINS;

/** The roster's flattened argv for one harness + shape — the independent source the
 *  run is compared against (never reverse-derived from the run's own order). */
const sequenceOf = (host: HostId, shape: "install" | "update"): string[][] =>
  ROSTER.flatMap((row) => row[host][shape].map((argv) => [...argv]));

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

/** The stand-in runner — returns the n-th pinned code for the n-th call (absent
 *  codes are 0), so "the first two steps pass, the third fails" is expressible. */
class RecordingRunner implements StepRunner {
  readonly calls: (readonly string[])[] = [];
  readonly codes: readonly number[];

  constructor(codes: readonly number[] = []) {
    this.codes = codes;
  }

  async run(argv: readonly string[]): Promise<number> {
    this.calls.push(argv);
    return this.codes[this.calls.length - 1] ?? 0;
  }
}

/** The init face over the injected runner + header collector. */
const initFace = (runner: StepRunner): { init: CliInit; io: CaptureIo; headers: string[] } => {
  const io = new CaptureIo();
  const headers: string[] = [];
  const init = new CliInit({
    io,
    runner,
    header: (line) => headers.push(line),
  });
  return { init, io, headers };
};

describe("CliInit — the harness plugin sequence", () => {
  it("runs the claude install sequence — the roster's flattened install argv, in declared order", async () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    expect(await init.run("claude", false)).toBe(0);
    expect(runner.calls).toEqual(sequenceOf("claude", "install"));
    // the sequence is the full six steps (3 packages × 2 claude commands)
    expect(runner.calls).toHaveLength(6);
  });

  it("runs the pi install sequence — one step per package", async () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    expect(await init.run("pi", false)).toBe(0);
    expect(runner.calls).toEqual(sequenceOf("pi", "install"));
    expect(runner.calls).toHaveLength(3);
  });

  it("--update runs the update sequence — zero install argv rides the run", async () => {
    const runner = new RecordingRunner();
    const { init } = initFace(runner);
    expect(await init.run("claude", true)).toBe(0);
    expect(runner.calls).toEqual(sequenceOf("claude", "update"));
    const installs = sequenceOf("claude", "install").map((argv) => argv.join(" "));
    for (const call of runner.calls) expect(installs).not.toContain(call.join(" "));
  });
});

describe("CliInit — the first-failure stop and its report", () => {
  it("stops at the first non-zero exit and reports the failing step (global ordinal, exit code)", async () => {
    const runner = new RecordingRunner([0, 0, 9]);
    const { init, io } = initFace(runner);
    expect(await init.run("claude", false)).toBe(1);
    // the third step failed — the fourth never ran
    expect(runner.calls).toHaveLength(3);
    expect(io.stderrText).toBe(
      "init[3/6] · claude plugin marketplace add mattpocock/skills · exit 9\n",
    );
  });

  it("the update form appends the not-installed hint; the install form carries zero hint", async () => {
    const updateRunner = new RecordingRunner([0, 0, 9]);
    const updateFace = initFace(updateRunner);
    expect(await updateFace.init.run("claude", true)).toBe(1);
    expect(updateFace.io.stderrText.split("\n")[0]).toBe(
      "init[3/6] · claude plugin marketplace update mattpocock · exit 9",
    );
    expect(updateFace.io.stderrText).toContain(
      "if the package is not installed, run cdd init --harness=claude without --update first\n",
    );
    const installRunner = new RecordingRunner([0, 0, 9]);
    const installFace = initFace(installRunner);
    expect(await installFace.init.run("claude", false)).toBe(1);
    expect(installFace.io.stderrText).not.toContain("if the package is not installed");
  });
});

describe("CliInit — the step headers and the summary line", () => {
  it("writes one header per step before its spawn — the harness · package · command tail bytes", async () => {
    const runner = new RecordingRunner();
    const { init, headers } = initFace(runner);
    expect(await init.run("claude", false)).toBe(0);
    // the first two headers are the SAME package's two commands — different tails
    expect(headers[0]).toBe(
      "init[1/6] claude · superpowers · plugin marketplace add obra/superpowers-marketplace",
    );
    expect(headers[1]).toBe(
      "init[2/6] claude · superpowers · plugin install superpowers@superpowers-marketplace",
    );
    // six step headers + the summary line
    expect(headers).toHaveLength(7);
    expect(headers[5]).toBe("init[6/6] claude · kairos · plugin install kairos@oscaner-skills");
  });

  it("closes a green run with the summary line — the harness and the shape verb", async () => {
    const installRunner = new RecordingRunner();
    const installFace = initFace(installRunner);
    expect(await installFace.init.run("claude", false)).toBe(0);
    expect(installFace.headers.at(-1)).toBe("init: 6 steps ok (claude · install)");
    const updateRunner = new RecordingRunner();
    const updateFace = initFace(updateRunner);
    expect(await updateFace.init.run("claude", true)).toBe(0);
    expect(updateFace.headers.at(-1)).toBe("init: 6 steps ok (claude · update)");
  });

  it("the pi face counts three steps — the denominator is the harness sequence, never the package count", async () => {
    const runner = new RecordingRunner();
    const { init, headers } = initFace(runner);
    expect(await init.run("pi", false)).toBe(0);
    expect(headers[0]).toBe("init[1/3] pi · superpowers · install git:github.com/obra/superpowers");
    expect(headers.at(-1)).toBe("init: 3 steps ok (pi · install)");
  });

  it("a failing run writes no summary line", async () => {
    const runner = new RecordingRunner([0, 9]);
    const { init, headers } = initFace(runner);
    expect(await init.run("claude", false)).toBe(1);
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

  it("inherits all three standard streams — the consumer sees the harness output live", () => {
    expect(STDIO).toBe("inherit");
  });
});
