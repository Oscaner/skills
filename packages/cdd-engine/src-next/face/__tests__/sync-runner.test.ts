// packages/cdd-engine/src-next/face/__tests__/sync-runner.test.ts
// The SyncRunner colocated pins (spec §14 · D36 — the host-channel integrity):
// the sync child-process face collects UNBOUNDED output (the retired fixed 1 MiB
// output-buffer cap — the W1 truncation class — is gone: execa's sync face
// buffers without bound by default):
//   · >1 MiB output (exactly the retired default-ceiling byte count + 1) arrives
//     whole — the child's stdout is byte-faithful (its consumers are the host log
//     and the crash record's `stdoutTail`; nothing downstream parses it);
//   · the round's closing prose survives the biggest pipe —
//     the W1 failure class (tail truncation losing the child's last words) is dead;
//   · stderr aggregates by the same face;
//   · the fail-open semantics hold — a non-zero child rides its code, a broken
//     command never throws.
// The child is a real hermetic shell process (no network, no repo writes).

import { describe, expect, it } from "vitest";
import { SyncRunner } from "../lifecycle.ts";

describe("SyncRunner — the unbounded sync child-channel collection (spec §14 · D36)", () => {
  const runner = new SyncRunner();

  it("collects >1 MiB stdout whole — exactly the retired default ceiling + 1 byte", () => {
    // 1 MiB + 1 byte of 'x' — the byte count that trips the retired default
    // output-buffer cap; every byte must arrive.
    const result = runner.run(
      "sh",
      ["-c", "head -c 1048577 /dev/zero | tr '\\0' x"],
      process.cwd(),
    );
    expect(result.code).toBe(0);
    expect(result.stdout.length).toBe(1048577);
  });

  it("keeps the child's closing prose intact behind a huge narrative — the W1 truncation class is dead", () => {
    // A big narrative stdout followed by the round's closing prose (the `## Return`
    // contract: plain sentences, no key-value lines) — the exact W1 incident shape
    // (work fine, tail lost). The closing lines MUST reach.
    const result = runner.run(
      "sh",
      [
        "-c",
        "head -c 2000000 /dev/zero | tr '\\0' x; printf '\\nThe round succeeded; every check is green.\\nThe handoff draft is the machine-readable result.\\n'",
      ],
      process.cwd(),
    );
    expect(result.code).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(2000000);
    expect(result.stdout).toMatch(/^The round succeeded; every check is green\.$/m);
    expect(result.stdout).toMatch(/^The handoff draft is the machine-readable result\.$/m);
  });

  it("aggregates stderr by the same streaming face", () => {
    const result = runner.run(
      "sh",
      ["-c", "head -c 1100000 /dev/zero | tr '\\0' e >&2"],
      process.cwd(),
    );
    expect(result.code).toBe(0);
    expect(result.stderr.length).toBe(1100000);
    expect(result.stderr).toMatch(/^e+$/);
  });

  it("stays fail-open — a non-zero child rides its code, a broken command never throws", () => {
    const nonZero = runner.run("sh", ["-c", "echo partial; exit 7"], process.cwd());
    expect(nonZero.code).toBe(7);
    expect(nonZero.stdout).toBe("partial\n");
    const broken = runner.run("cdd-no-such-binary-xyz", [], process.cwd());
    expect(broken.code).toBe(1);
    expect(broken.stdout).toBe("");
    expect(broken.stderr.length).toBeGreaterThan(0);
  });
});
