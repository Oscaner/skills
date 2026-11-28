// packages/cdd-engine/src/env/provision/__tests__/provision.test.ts
// The provisioning segment's pins.
//
// Five facts, one per step the consumer depends on: the plan is the ONE step source (a
// preview and a run read the same sequence) · a preview spawns nothing · the two tiers
// derive their step counts off the data plane (never a literal) · the update sequence and
// the install sequence are different runs of one table · `apply`'s outcome is a declared
// value carrying the first failure's index and the code the child returned, and its progress
// face fires once per step BEFORE the spawn.
//
// Every case injects a step runner: the segment's whole point is that no test here spawns a
// harness.

import { describe, expect, it } from "vitest";
import { HOST_IDS } from "../../process/host.ts";
import { Provisioner, SPAWN_FAILURE_CODE, type StepRunner } from "../init.ts";
import { PLUGINS, type PluginRow } from "../plugins.ts";

/** A step runner that records every argv it was asked to run. */
class RecordingRunner implements StepRunner {
  readonly calls: (readonly string[])[] = [];
  /** The code every step answers. */
  #code: number;

  constructor(code = 0) {
    this.#code = code;
  }

  /** Answer a different code for the next run — how a failing step is staged. */
  answer(code: number): void {
    this.#code = code;
  }

  async run(argv: readonly string[]): Promise<number> {
    this.calls.push(argv);
    return this.#code;
  }
}

/** The step count one tier contributes for one host and shape — the data plane's own
 *  answer, so the pin never writes a literal count. */
const tierSteps = (
  host: (typeof HOST_IDS)[number],
  shape: "install" | "update",
  tier: string,
): number =>
  PLUGINS.filter((row: PluginRow) => row.tier === tier).reduce(
    (total, row: PluginRow) =>
      total + (shape === "update" ? row[host].update : row[host].install).length,
    0,
  );

describe("the provisioning plan", () => {
  it("is the ONE step source: the same request answers the same sequence twice", () => {
    const provisioner = new Provisioner({ runner: new RecordingRunner() });
    const request = { shape: "install", recommended: true } as const;
    const first = provisioner.plan("pi", request);
    const second = provisioner.plan("pi", request);
    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
  });

  it("spawns nothing — a preview is a plan", () => {
    const runner = new RecordingRunner();
    const provisioner = new Provisioner({ runner });
    provisioner.plan("claude", { shape: "install", recommended: true });
    provisioner.plan("pi", { shape: "update", recommended: false });
    expect(runner.calls).toEqual([]);
  });

  it("derives both tiers' step counts off the data plane, never a literal", () => {
    const provisioner = new Provisioner();
    for (const host of HOST_IDS) {
      const core = provisioner.plan(host, { shape: "install", recommended: false });
      const whole = provisioner.plan(host, { shape: "install", recommended: true });
      expect(core).toHaveLength(tierSteps(host, "install", "core"));
      expect(whole).toHaveLength(
        tierSteps(host, "install", "core") + tierSteps(host, "install", "recommended"),
      );
      // The flag-less face takes the core rows alone — the recommended tier is opt-in.
      expect(core.every((step) => step.tier === "core")).toBe(true);
    }
    // Claude Code carries the capability packages natively: its recommended column is empty,
    // so the flag adds no step on that harness.
    const claudeCore = provisioner.plan("claude", { shape: "install", recommended: false });
    expect(provisioner.plan("claude", { shape: "install", recommended: true })).toHaveLength(
      claudeCore.length,
    );
    expect(
      provisioner.countsOf(provisioner.plan("claude", { shape: "install", recommended: true })),
    ).toEqual({ core: claudeCore.length, recommended: 0 });
  });

  it("update and install are different runs of one table", () => {
    const provisioner = new Provisioner();
    const install = provisioner.plan("pi", { shape: "install", recommended: true });
    const update = provisioner.plan("pi", { shape: "update", recommended: true });
    expect(update.map((step) => step.argv)).not.toEqual(install.map((step) => step.argv));
    // Same rows, same order: only the command shape differs.
    expect(update.map((step) => step.packageName)).toEqual(install.map((step) => step.packageName));
    // Every argv is the roster's own — the plan mints no command of its own.
    const declared = new Set(
      PLUGINS.flatMap((row) => [...row.pi.install, ...row.pi.update]).map((argv) => argv.join(" ")),
    );
    for (const step of [...install, ...update])
      expect(declared.has(step.argv.join(" "))).toBe(true);
  });

  it("refuses an undeclared command shape", () => {
    expect(() =>
      new Provisioner().plan("pi", { shape: "reinstall" as never, recommended: false }),
    ).toThrow(/not a declared command shape/);
  });
});

describe("the provisioning run", () => {
  it("runs exactly the plan's steps, one progress call per step before its spawn", async () => {
    const runner = new RecordingRunner();
    const provisioner = new Provisioner({ runner });
    const steps = provisioner.plan("pi", { shape: "install", recommended: true });
    const progress: string[] = [];
    const outcome = await provisioner.apply(steps, (index, step) => {
      // The progress face fires BEFORE the spawn: the step is not on the runner yet.
      expect(runner.calls).toHaveLength(index);
      progress.push(`${index}:${step.packageName}`);
    });
    expect(outcome).toEqual({ kind: "green" });
    expect(runner.calls).toEqual(steps.map((step) => step.argv));
    expect(progress).toHaveLength(steps.length);
  });

  it("stops at the first failure and names its index and the child's own code", async () => {
    const runner = new RecordingRunner();
    const provisioner = new Provisioner({ runner });
    const steps = provisioner.plan("claude", { shape: "install", recommended: false });
    expect(steps.length).toBeGreaterThan(1);
    let spawned = 0;
    const outcome = await provisioner.apply(steps, (index) => {
      // The second step (index 1) is the one that fails.
      if (index === 1) runner.answer(7);
      spawned += 1;
    });
    expect(outcome).toEqual({ kind: "failed", index: 1, exitCode: 7 });
    // Nothing after the failing step was spawned.
    expect(runner.calls).toHaveLength(2);
    expect(spawned).toBe(2);
    // A different code from the stand-in changes the reported value — the code is the
    // child's fact, never a constant.
    runner.answer(SPAWN_FAILURE_CODE);
    expect(await provisioner.apply(steps.slice(0, 1), () => {})).toEqual({
      kind: "failed",
      index: 0,
      exitCode: SPAWN_FAILURE_CODE,
    });
  });

  it("answers green for an empty plan — no step, no spawn", async () => {
    const runner = new RecordingRunner();
    const provisioner = new Provisioner({ runner });
    expect(await provisioner.apply([], () => {})).toEqual({ kind: "green" });
    expect(runner.calls).toEqual([]);
  });
});
