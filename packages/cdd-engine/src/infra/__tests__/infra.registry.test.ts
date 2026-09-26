// packages/cdd-engine/src/infra/__tests__/infra.registry.test.ts
// Mirrors the .mjs registry.test.mjs contract: ship gate (unknown/not-supported → blocked exit 1;
// CLI missing → cli-missing exit 2), registryField fallback "", op×type prefix resolution.

import { existsSync } from "node:fs";
import { expect, it } from "vitest";

import { REG_PATH, Registry } from "../registry.ts";

const registry = new Registry();

// REG_PATH is state-independent since P3 T7 (consumer parity): the published dist copy first, the
// source tree as the dev fallback — the file must exist either way and always be the registry.
it("REG_PATH resolves to an existing harness-registry.json (published dist/resources or src fallback)", () => {
  expect(REG_PATH).toMatch(/(?:dist[\\/]resources|src[\\/]infra)[\\/]harness-registry\.json$/);
  expect(existsSync(REG_PATH)).toBe(true);
});

it("loadRegistry: reads 2 harnesses (claude / cursor-agent)", () => {
  const reg = registry.load(REG_PATH);
  expect(Object.keys(reg).sort()).toEqual(["claude", "cursor-agent"]);
});

it("checkHarness: claude passes ship gate (dryRun skips PATH check)", () => {
  const reg = registry.load(REG_PATH);
  const entry = registry.checkHarness(reg, "claude", { dryRun: true });
  expect(entry.cli).toBe("claude");
  expect(entry.ship).toBe("full");
});

it("checkHarness: unknown harness → blocked (exit 1)", () => {
  const reg = registry.load(REG_PATH);
  expect(() => registry.checkHarness(reg, "no-such-harness")).toThrow();
  try {
    registry.checkHarness(reg, "no-such-harness");
  } catch (e) {
    expect((e as { kind?: string; exitCode?: number }).kind).toBe("blocked");
    expect((e as { exitCode?: number }).exitCode).toBe(1);
  }
});

it("checkHarness: full harness with missing binary → cli-missing (exit 2)", () => {
  const reg = registry.load(REG_PATH);
  const ghost = "cdd-nonexistent-cli-xyz";
  const fixture = { ...reg, ghost: { cli: ghost, invoke: "-p", output: "text", ship: "full" } };
  try {
    registry.checkHarness(fixture, "ghost");
  } catch (e) {
    expect((e as { kind?: string }).kind).toBe("cli-missing");
    expect((e as { exitCode?: number }).exitCode).toBe(2);
    expect(String((e as Error).message)).toContain(`${ghost} not found in PATH`);
  }
});

it("registryField: field read + missing fallback empty string", () => {
  const reg = registry.load(REG_PATH);
  expect(registry.field(reg, "claude", "cli")).toBe("claude");
  expect(registry.field(reg, "claude", "no-such-field")).toBe("");
  expect(registry.field(reg, "no-such-harness", "cli")).toBe("");
});

it("resolveInjection: op×type resolution (implement/fix → tdd; review spec/plan → URC pointer)", () => {
  const reg = registry.load(REG_PATH);
  expect(registry.resolveInjection(reg.claude, "implement")).toBe("/mattpocock-skills:tdd");
  expect(registry.resolveInjection(reg.claude, "fix")).toBe("/mattpocock-skills:tdd");
  expect(registry.resolveInjection(reg.claude, "review", "task")).toContain("code-review");
  expect(registry.resolveInjection(reg.claude, "review", "spec")).toMatch(/^Follow URC/);
  expect(registry.resolveInjection(reg.claude, "review", "plan")).toMatch(/^Follow URC/);
});

it("resolveSuffix: missing suffix → empty string", () => {
  const reg = registry.load(REG_PATH);
  expect(registry.resolveSuffix(reg.claude, "implement")).toBe("");
});
