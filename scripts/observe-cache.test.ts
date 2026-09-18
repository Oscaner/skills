// scripts/observe-cache.test.ts — spec D-3 C7 observation seam: the extraction parser that turns
// `/cost` / `--debug` harness output into { readTokens, writeTokens }. Pure, harness-shaped-text
// driven; the actual measurement run is a documented dev-side action (no live harness in CI).
import { describe, it, expect } from "vitest";
import { extractCacheUsage } from "./observe-cache.ts";

describe("extractCacheUsage — parse prompt-cache read/write tokens from harness output", () => {
  it("Anthropic --debug key=val form (cache_creation_input_tokens / cache_read_input_tokens)", () => {
    const log = '{"type":"assistant","usage":{"input_tokens":412,"cache_creation_input_tokens":3482,"cache_read_input_tokens":6093,"output_tokens":15}}';
    expect(extractCacheUsage(log)).toEqual({ readTokens: 6093, writeTokens: 3482 });
  });

  it("OpenAI-verbose prompt_cache_read/write_tokens form", () => {
    const log = 'usage: {"prompt_tokens":500,"prompt_cache_read_tokens":300,"prompt_cache_write_tokens":200}';
    expect(extractCacheUsage(log)).toEqual({ readTokens: 300, writeTokens: 200 });
  });

  it("human /cost table lines (thousands separators, case-insensitive)", () => {
    const log = "Cost details:\nPrompt cache read tokens:       6,093\nPrompt cache write tokens: 2,000";
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
    const log = 'usage: {"input_tokens":100,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}';
    expect(extractCacheUsage(log)).toEqual({ readTokens: 0, writeTokens: 0 });
  });

  it("no cache fields → null (not a measurable round)", () => {
    expect(extractCacheUsage("status: APPROVED\ncommits: base=x head=y")).toBeNull();
    expect(extractCacheUsage("")).toBeNull();
  });
});