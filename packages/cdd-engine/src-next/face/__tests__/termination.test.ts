// packages/cdd-engine/src-next/face/__tests__/termination.test.ts
// The Terminator's colocated pins — the asynchronous child-channel integrity the
// retired sync face carried (spec §14 · D36), re-homed onto the `ChildRunner` seam
// when the sync runner was retired:
//   · >1 MiB output (exactly the retired default-ceiling byte count + 1) arrives
//     whole — the child's stdout is byte-faithful (its consumers are the host log
//     and the crash record's `stdoutTail`; nothing downstream parses it);
//   · the round's closing prose survives the biggest pipe — the W1 failure class
//     (tail truncation losing the child's last words) is dead;
//   · stderr aggregates by the same face;
//   · the fail-open semantics hold — a non-zero child rides its own exit code, a
//     broken command never throws (a spawn failure has NO exit code: it rides
//     `code: null`, never a folded `1`, and its reason text survives on stderr).
// The child is a real hermetic shell process (no network, no repo writes).

import { describe, expect, it } from "vitest";
import { type ChildRun, TerminationPolicy, Terminator } from "../termination.ts";

/** One production-shaped child run — the phase's own policy, a scratch cwd and the
 *  heartbeat path the sampler (T3) writes; this suite never samples, so the paths
 *  are inert. */
const childRun = (command: string, args: readonly string[]): ChildRun => ({
  command,
  args,
  cwd: process.cwd(),
  heartbeatPath: `${process.cwd()}/liveness.json`,
  policy: TerminationPolicy.of("implement"),
});

describe("Terminator — the asynchronous child-channel collection (spec §14 · D36)", () => {
  const runner = new Terminator();

  it("collects >1 MiB stdout whole — exactly the retired default ceiling + 1 byte", async () => {
    // 1 MiB + 1 byte of 'x' — the byte count that trips the retired default
    // output-buffer cap; every byte must arrive.
    const result = await runner.run(
      childRun("sh", ["-c", "head -c 1048577 /dev/zero | tr '\\0' x"]),
    );
    expect(result.code).toBe(0);
    expect(result.stdout.length).toBe(1048577);
    expect(result.termination).toBeNull();
  });

  it("keeps the child's closing prose intact behind a huge narrative — the W1 truncation class is dead", async () => {
    // A big narrative stdout followed by the round's closing prose (the `## Return`
    // contract: plain sentences, no key-value lines) — the exact W1 incident shape
    // (work fine, tail lost). The closing lines MUST reach.
    const result = await runner.run(
      childRun("sh", [
        "-c",
        "head -c 2000000 /dev/zero | tr '\\0' x; printf '\\nThe round succeeded; every check is green.\\nThe handoff draft is the machine-readable result.\\n'",
      ]),
    );
    expect(result.code).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(2000000);
    expect(result.stdout).toMatch(/^The round succeeded; every check is green\.$/m);
    expect(result.stdout).toMatch(/^The handoff draft is the machine-readable result\.$/m);
  });

  it("aggregates stderr by the same streaming face", async () => {
    const result = await runner.run(
      childRun("sh", ["-c", "head -c 1100000 /dev/zero | tr '\\0' e >&2"]),
    );
    expect(result.code).toBe(0);
    expect(result.stderr.length).toBe(1100000);
    expect(result.stderr).toMatch(/^e+$/);
  });

  it("stays fail-open — a non-zero child rides its code, a broken command never throws", async () => {
    const nonZero = await runner.run(childRun("sh", ["-c", "echo partial; exit 7"]));
    expect(nonZero.code).toBe(7);
    expect(nonZero.stdout).toBe("partial\n");
    expect(nonZero.termination).toBeNull();
    // A broken command never spawned: it has no exit code (null, never the retired
    // folded `1`), no signal event — so it is NOT a termination, and it is reported
    // with a reason text (execa's own diagnostic) on stderr.
    const broken = await runner.run(childRun("cdd-no-such-binary-xyz", []));
    expect(broken.code).toBeNull();
    expect(broken.stdout).toBe("");
    expect(broken.stderr.length).toBeGreaterThan(0);
    expect(broken.termination).toBeNull();
  });

  it("carries the phase's wall-clock ceiling as the child's timeout — the budget leg of the seam", async () => {
    // The production option face takes the phase's own budget key (the terminator
    // never invents a second clock): a policy whose budget has already elapsed
    // terminates the sleeping child on execa's own kill path, and the outcome
    // reports the termination fact rather than a fabricated exit code.
    const result = await runner.run({
      ...childRun("sh", ["-c", "sleep 30"]),
      policy: new TerminationPolicy(200),
    });
    expect(result.termination).not.toBeNull();
    expect(result.termination?.cause).toBe("over-budget");
    expect(result.code).toBeNull();
  });
});
