// packages/cdd-engine/src/infra/__tests__/infra.invoke.test.ts
// Mirrors the .mjs cli-shared.test.mjs contract on the rebuilt module: timeout resolution from
// canonical + env status (per-mode over global override, stepped, clamped), stream-json
// finalText extraction, op×type prefix/suffix injection, transient retry on overloaded stderr.
// execa is mocked (same seam as the .mjs suite) — proc.spawnManaged is exercised through it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("execa", () => ({ execa: vi.fn() }));

import { execa as execaImport } from "execa";
import { type DispatchOp, EngineInvoker } from "../invoke.ts";
import { mockExeca } from "./helpers.ts";

// vi.mock("execa") swaps the module for a bare vi.fn — the seam exposes the mock surface once
// (framework-boundary fixture cast, shared helper).
const execa = mockExeca(execaImport);

const invoker = new EngineInvoker();

describe("infra/invoke.ts — resolveTerminationConfig (T26 single resolver, env-zero; T9 op-dimension budgets)", () => {
  it("default implement budget is 6h (canonical timeouts.defaults.implement)", () => {
    expect(invoker.resolveTerminationConfig("implement").budgetMs).toBe(21_600_000);
  });
  it("default review budget is 3h (canonical timeouts.defaults.review)", () => {
    expect(invoker.resolveTerminationConfig("review").budgetMs).toBe(10_800_000);
  });
  it("default fix budget is 6h (canonical timeouts.defaults.fix — same amount as implement, user ruling)", () => {
    expect(invoker.resolveTerminationConfig("fix").budgetMs).toBe(21_600_000);
  });
  it("seam override wins over the canonical default (no env reads anywhere)", () => {
    expect(invoker.resolveTerminationConfig("implement", { budgetMs: 42_000 }).budgetMs).toBe(
      42_000,
    );
    expect(invoker.resolveTerminationConfig("review", { budgetMs: 7_000 }).budgetMs).toBe(7_000);
    expect(invoker.resolveTerminationConfig("fix", { budgetMs: 9_000 }).budgetMs).toBe(9_000);
  });
  it("stall detector timing comes from canonical timeouts.liveness (60s sample / 15min idle window)", () => {
    expect(invoker.resolveTerminationConfig("implement").sampleIntervalMs).toBe(60_000);
    expect(invoker.resolveTerminationConfig("implement").idleWindowMs).toBe(900_000);
  });
  it("progressPath threads through (workspace tree signal for the stall detector)", () => {
    expect(invoker.resolveTerminationConfig("implement", undefined, "/ws").progressPath).toBe(
      "/ws",
    );
  });
  it("config-missing key → budget undefined (the unknown→undefined fail-safe: the DispatchOp union makes any other literal unreachable at compile time; the runtime defense still covers a canonical that lacks a key)", () => {
    const cfg = invoker.resolveTerminationConfig("unknown" as DispatchOp);
    expect(cfg.budgetMs).toBeUndefined();
    // stall cadence still resolves from canonical liveness — the liveness defaults are
    // not op-scoped (T14 surface preserved under the unified resolver)
    expect(cfg.sampleIntervalMs).not.toBeUndefined();
  });
});

describe("infra/invoke.ts — invokeCli stream-json + injection", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("picks last completion.finalText from NDJSON stream", async () => {
    execa.mockResolvedValue({
      exitCode: 0,
      stdout: '{"type":"text","text":"hello"}\n{"type":"completion","finalText":"done"}\n',
      stderr: "",
      timedOut: false,
    });
    const entry = {
      cli: "claude",
      invoke: "-p --output-format stream-json",
      output: "stream-json",
    };
    const res = await invoker.invokeCli(
      entry,
      "prompt",
      { op: "implement" },
      {},
      "/tmp",
      undefined,
    );
    expect(res.ok).toBe(true);
    expect(res.stdout).toBe("done");
  });

  it("injects /mattpocock-skills:tdd as first prompt line for implement", async () => {
    execa.mockResolvedValue({
      exitCode: 0,
      stdout: "status: APPROVED",
      stderr: "",
      timedOut: false,
    });
    const entry = {
      cli: "claude",
      invoke: "-p",
      output: "text",
      prefix: { implement: "/mattpocock-skills:tdd" },
      suffix: {},
    };
    await invoker.invokeCli(
      entry,
      "line one\nline two",
      { op: "implement" },
      {},
      "/tmp",
      undefined,
    );
    const promptArg = execa.mock.calls[0][1].at(-1) ?? "";
    expect(promptArg.split("\n")[0]).toBe("/mattpocock-skills:tdd");
    expect(promptArg.split("\n").slice(1).join("\n")).toBe("line one\nline two");
  });

  it("review×spec shared pointer (no type substructure) → prompt unchanged", async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "", timedOut: false });
    const entry = { cli: "claude", invoke: "-p", output: "text", prefix: {}, suffix: {} };
    await invoker.invokeCli(
      entry,
      "spec prompt",
      { op: "review", type: "spec" },
      {},
      "/tmp",
      undefined,
    );
    expect(execa.mock.calls[0][1].at(-1)).toBe("spec prompt");
  });

  it("legacy flat mode key straight hit (unmigrated registry fallback)", async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "", timedOut: false });
    const entry = {
      cli: "claude",
      invoke: "-p",
      output: "text",
      prefix: { "legacy-review": "/legacy" },
      suffix: {},
    };
    await invoker.invokeCli(entry, "legacy prompt", { op: "legacy-review" }, {}, "/tmp", undefined);
    expect((execa.mock.calls[0][1].at(-1) ?? "").split("\n")[0]).toBe("/legacy");
  });
});

describe("infra/invoke.ts — invokeCliWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it("retries on overloaded stderr, succeeds on 2nd attempt", async () => {
    const sd = "status: APPROVED\ncommits: base=abc head=def\nartifacts: "; // 3-line agent contract (no blocker column)
    execa
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "overloaded", timedOut: false })
      .mockResolvedValueOnce({ exitCode: 0, stdout: sd, stderr: "", timedOut: false });
    const entry = { cli: "claude", invoke: "-p", output: "text" };
    const promise = invoker.invokeCliWithRetry(
      entry,
      "prompt",
      { op: "implement" },
      {},
      "/tmp",
      undefined,
    );
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(execa).toHaveBeenCalledTimes(2);
  });

  it("does not retry on timeout", async () => {
    // external-SIGTERM exit shape — the T26 cause derivation reads signal === "SIGTERM" (execa's
    // timedOut flag alone was dropped with the monitor takeover; the monitor always kills via SIGTERM)
    execa.mockResolvedValue({ exitCode: -1, stdout: "", stderr: "", signal: "SIGTERM" });
    const entry = { cli: "claude", invoke: "-p", output: "text" };
    const res = await invoker.invokeCliWithRetry(
      entry,
      "prompt",
      { op: "implement" },
      {},
      "/tmp",
      undefined,
    );
    expect(res.timedOut).toBe(true);
    expect(res.cause).toBe("signal");
    expect(execa).toHaveBeenCalledTimes(1);
  });
});
