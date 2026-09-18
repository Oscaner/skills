// packages/cdd-engine/src/infra/__tests__/infra.invoke.test.ts
// Mirrors the .mjs cli-shared.test.mjs contract on the rebuilt module: timeout resolution from
// canonical + env status (per-mode over global override, stepped, clamped), stream-json
// finalText extraction, op×type prefix/suffix injection, transient retry on overloaded stderr.
// execa is mocked (same seam as the .mjs suite) — proc.spawnManaged is exercised through it.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("execa", () => ({ execa: vi.fn() }));

import { execa } from "execa";
import { resolveTimeoutMs, invokeCli, invokeCliWithRetry } from "../invoke.ts";

describe("infra/invoke.ts — resolveTimeoutMs", () => {
  it("per-mode env takes priority", () => {
    expect(resolveTimeoutMs({ CDD_TASK_TIMEOUT: "60" }, "task")).toBe(60_000);
  });
  it("CDD_CLI_TIMEOUT is stepped to 30-min boundary", () => {
    // 1801s → ceil to 3600s
    expect(resolveTimeoutMs({ CDD_CLI_TIMEOUT: "1801" }, "task")).toBe(3_600_000);
  });
  it("default task timeout is 90min (canonical timeouts.defaults.task)", () => {
    expect(resolveTimeoutMs({}, "task")).toBe(5_400_000);
  });
  it("default review timeout is 60min (canonical timeouts.defaults.review)", () => {
    expect(resolveTimeoutMs({}, "review")).toBe(3_600_000);
  });
  it("giant seconds clamp to the 2e9ms safety cap (setTimeout 32-bit overflow guard)", () => {
    expect(resolveTimeoutMs({ CDD_REVIEW_TIMEOUT: "2700000" }, "review")).toBeLessThanOrEqual(2_000_000_000);
  });
  it("unknown mode returns undefined", () => {
    expect(resolveTimeoutMs({}, "unknown")).toBeUndefined();
  });
});

describe("infra/invoke.ts — invokeCli stream-json + injection", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("picks last completion.finalText from NDJSON stream", async () => {
    execa.mockResolvedValue({
      exitCode: 0, stdout: '{"type":"text","text":"hello"}\n{"type":"completion","finalText":"done"}\n',
      stderr: "", timedOut: false,
    });
    const entry = { cli: "claude", invoke: "-p --output-format stream-json", output: "stream-json" };
    const res = await invokeCli(entry, "prompt", { op: "implement" }, {}, "/tmp", undefined);
    expect(res.ok).toBe(true);
    expect(res.stdout).toBe("done");
  });

  it("injects /mattpocock-skills:tdd as first prompt line for implement", async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: "status: APPROVED", stderr: "", timedOut: false });
    const entry = {
      cli: "claude", invoke: "-p", output: "text",
      prefix: { implement: "/mattpocock-skills:tdd" }, suffix: {},
    };
    await invokeCli(entry, "line one\nline two", { op: "implement" }, {}, "/tmp", undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split("\n")[0]).toBe("/mattpocock-skills:tdd");
    expect(promptArg.split("\n").slice(1).join("\n")).toBe("line one\nline two");
  });

  it("review×spec shared pointer (no type substructure) → prompt unchanged", async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "", timedOut: false });
    const entry = { cli: "claude", invoke: "-p", output: "text", prefix: {}, suffix: {} };
    await invokeCli(entry, "spec prompt", { op: "review", type: "spec" }, {}, "/tmp", undefined);
    expect(execa.mock.calls[0][1].at(-1)).toBe("spec prompt");
  });

  it("legacy flat mode key straight hit (unmigrated registry fallback)", async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "", timedOut: false });
    const entry = { cli: "claude", invoke: "-p", output: "text", prefix: { "legacy-review": "/legacy" }, suffix: {} };
    await invokeCli(entry, "legacy prompt", { op: "legacy-review" }, {}, "/tmp", undefined);
    expect(execa.mock.calls[0][1].at(-1).split("\n")[0]).toBe("/legacy");
  });
});

describe("infra/invoke.ts — invokeCliWithRetry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  beforeEach(() => vi.clearAllMocks());

  it("retries on overloaded stderr, succeeds on 2nd attempt", async () => {
    const sd = "status: APPROVED\ncommits: base=abc head=def\nartifacts: \nblocker: none";
    execa
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "overloaded", timedOut: false })
      .mockResolvedValueOnce({ exitCode: 0, stdout: sd, stderr: "", timedOut: false });
    const entry = { cli: "claude", invoke: "-p", output: "text" };
    const promise = invokeCliWithRetry(entry, "prompt", { op: "implement" }, {}, "/tmp", undefined);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(execa).toHaveBeenCalledTimes(2);
  });

  it("does not retry on timeout", async () => {
    execa.mockResolvedValue({ exitCode: -1, stdout: "", stderr: "", timedOut: true });
    const entry = { cli: "claude", invoke: "-p", output: "text" };
    const res = await invokeCliWithRetry(entry, "prompt", { op: "implement" }, {}, "/tmp", undefined);
    expect(res.timedOut).toBe(true);
    expect(execa).toHaveBeenCalledTimes(1);
  });
});
