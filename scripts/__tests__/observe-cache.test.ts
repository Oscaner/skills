// scripts/__tests__/observe-cache.test.ts — spec D-3 C7 observation seam: the extraction parser that turns
// `/cost` / `--debug` harness output into { readTokens, writeTokens }. Pure, harness-shaped-text
// driven; the actual measurement run is a documented dev-side action (no live harness in CI).
// Also pins the argv parser (boolean-presence semantics) and the measurement-mode cross-phase
// derivation (review/fix fixed-point from real prior handoffs).

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractCacheUsage, parseArgs, priorHandoffPaths } from "../observe-cache.ts";

describe("extractCacheUsage — parse prompt-cache read/write tokens from harness output", () => {
  it("Anthropic --debug key=val form (cache_creation_input_tokens / cache_read_input_tokens)", () => {
    const log =
      '{"type":"assistant","usage":{"input_tokens":412,"cache_creation_input_tokens":3482,"cache_read_input_tokens":6093,"output_tokens":15}}';
    expect(extractCacheUsage(log)).toEqual({ readTokens: 6093, writeTokens: 3482 });
  });

  it("OpenAI-verbose prompt_cache_read/write_tokens form", () => {
    const log =
      'usage: {"prompt_tokens":500,"prompt_cache_read_tokens":300,"prompt_cache_write_tokens":200}';
    expect(extractCacheUsage(log)).toEqual({ readTokens: 300, writeTokens: 200 });
  });

  it("human /cost table lines (thousands separators, case-insensitive)", () => {
    const log =
      "Cost details:\nPrompt cache read tokens:       6,093\nPrompt cache write tokens: 2,000";
    expect(extractCacheUsage(log)).toEqual({ readTokens: 6093, writeTokens: 2000 });
  });

  it("takes the last summary occurrence (round-after-round capture)", () => {
    const log = [
      "cache_read_input_tokens=0 cache_creation_input_tokens=100",
      "cache_read_input_tokens=500 cache_creation_input_tokens=100",
      "cache_read_input_tokens=1234 cache_creation_input_tokens=100",
    ].join("\n");
    expect(extractCacheUsage(log)).toEqual({ readTokens: 1234, writeTokens: 100 });
  });

  it("zero-token cache fields are still a measurement (not null)", () => {
    const log =
      'usage: {"input_tokens":100,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}';
    expect(extractCacheUsage(log)).toEqual({ readTokens: 0, writeTokens: 0 });
  });

  it("no cache fields → null (not a measurable round)", () => {
    expect(extractCacheUsage("status: APPROVED\ncommits: base=x head=y")).toBeNull();
    expect(extractCacheUsage("")).toBeNull();
  });
});

describe("parseArgs — presence-based booleans + value-taking options", () => {
  it("defaults: --debug flag, claude harness, 2 rounds", () => {
    expect(parseArgs(["--", "ws", "7", "implement"])).toEqual({
      harness: "claude",
      rounds: 2,
      flag: "--debug",
      workspace: "ws",
      task: 7,
      mode: "implement",
    });
  });

  it("boolean flags are presence-only and never swallow the workspace positional (natural usage without `--`)", () => {
    expect(parseArgs(["--debug", "ws", "7", "implement"]).flag).toBe("--debug");
    expect(parseArgs(["--debug", "ws", "7", "implement"]).workspace).toBe("ws");
    expect(parseArgs(["--debug", "ws", "7", "implement"]).mode).toBe("implement");
  });

  it("--cost stays an explicit opt-in; --harness/--rounds keep consuming their value", () => {
    const a = parseArgs(["--cost", "ws", "7", "fix"]);
    expect(a.flag).toBe("--cost");
    expect(a.workspace).toBe("ws");
    const b = parseArgs(["--harness", "cursor-agent", "--rounds", "3", "--", "ws", "7", "review"]);
    expect(b.harness).toBe("cursor-agent");
    expect(b.rounds).toBe(3);
    expect(b.flag).toBe("--debug");
  });

  it("rejects a zero or non-numeric task (citty enforces presence only, not the integer boundary)", () => {
    expect(() => parseArgs(["--", "ws", "0", "implement"])).toThrow(/positive integer/);
    expect(() => parseArgs(["--", "ws", "abc", "implement"])).toThrow(/positive integer/);
  });
});

describe("priorHandoffPaths — measurement-mode cross-phase derivation (mirrors dispatch/task.ts)", () => {
  // fixture workspace with real prior-handoff shapes (commits.base is what the engine reads)
  let ws: string;
  beforeEach(() => {
    ws = mkdtempSync(path.join(tmpdir(), "observe-cache-"));
    writeFileSync(
      path.join(ws, "task-7-implement.json"),
      JSON.stringify({
        phase: "implement",
        commits: { base: "a".repeat(40), head: "b".repeat(40) },
      }),
    );
    writeFileSync(
      path.join(ws, "task-7-review-1.json"),
      JSON.stringify({ phase: "review", commits: { base: "c".repeat(40), head: "d".repeat(40) } }),
    );
    writeFileSync(
      path.join(ws, "task-7-fix-1.json"),
      JSON.stringify({ phase: "fix", commits: { base: "e".repeat(40), head: "f".repeat(40) } }),
    );
  });
  afterEach(() => rmSync(ws, { recursive: true, force: true }));

  it("implement: no findings, no fixed point (byte-identical rounds)", () => {
    expect(priorHandoffPaths({ workspace: ws, task: 7, mode: "implement", round: 1 })).toEqual({
      findingsPath: "",
      fixedPoint: "",
    });
    expect(
      priorHandoffPaths({ workspace: ws, task: 7, mode: "implement", round: 2 }).fixedPoint,
    ).toBe("");
  });

  it("fix round R: findings + fixed point come from the same-round review handoff (prev = review.task:R)", () => {
    const r1 = priorHandoffPaths({ workspace: ws, task: 7, mode: "fix", round: 1 });
    expect(r1.findingsPath).toBe(path.join(ws, "task-7-review-1.json"));
    expect(r1.fixedPoint).toBe("c".repeat(40)); // the review handoff's commits.base
  });

  it("missing prior review handoff → the review path as findings, empty fixed point (documented approximation)", () => {
    const r2 = priorHandoffPaths({ workspace: ws, task: 7, mode: "fix", round: 2 });
    expect(r2.findingsPath).toBe(path.join(ws, "task-7-review-2.json"));
    expect(r2.fixedPoint).toBe("");
  });

  it("review round 1: fixed point from the implement handoff; review round R: from fix-(R-1)", () => {
    expect(priorHandoffPaths({ workspace: ws, task: 7, mode: "review", round: 1 }).fixedPoint).toBe(
      "a".repeat(40),
    );
    expect(priorHandoffPaths({ workspace: ws, task: 7, mode: "review", round: 2 }).fixedPoint).toBe(
      "e".repeat(40),
    );
  });
});
