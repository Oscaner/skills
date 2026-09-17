// tests/infra.registry.test.ts — TS infra layer: harness registry port (spec §2.13 registry row).
// Mirrors the .mjs registry.test.mjs contract: ship gate (unknown/not-supported → blocked exit 1;
// CLI missing → cli-missing exit 2), registryField fallback "", op×type prefix resolution.
import { it, expect } from "vitest";

import {
  loadRegistry, checkHarness, registryField, resolveInjection, resolveSuffix, REG_PATH,
} from "../src/infra/registry.ts";

it("REG_PATH resolves next to harness-registry.json", () => {
  expect(REG_PATH).toMatch(/infra\/harness-registry\.json$/);
});

it("loadRegistry: reads 2 harnesses (claude / cursor-agent)", () => {
  const reg = loadRegistry(REG_PATH);
  expect(Object.keys(reg).sort()).toEqual(["claude", "cursor-agent"]);
});

it("checkHarness: claude passes ship gate (dryRun skips PATH check)", () => {
  const reg = loadRegistry(REG_PATH);
  const entry = checkHarness(reg, "claude", { dryRun: true });
  expect(entry.cli).toBe("claude");
  expect(entry.ship).toBe("full");
});

it("checkHarness: unknown harness → blocked (exit 1)", () => {
  const reg = loadRegistry(REG_PATH);
  expect(() => checkHarness(reg, "no-such-harness")).toThrow();
  try {
    checkHarness(reg, "no-such-harness");
  } catch (e) {
    expect((e as { kind?: string; exitCode?: number }).kind).toBe("blocked");
    expect((e as { exitCode?: number }).exitCode).toBe(1);
  }
});

it("checkHarness: full harness with missing binary → cli-missing (exit 2)", () => {
  const reg = loadRegistry(REG_PATH);
  const ghost = "cdd-nonexistent-cli-xyz";
  const fixture = { ...reg, ghost: { cli: ghost, invoke: "-p", output: "text", ship: "full" } };
  try {
    checkHarness(fixture, "ghost");
  } catch (e) {
    expect((e as { kind?: string }).kind).toBe("cli-missing");
    expect((e as { exitCode?: number }).exitCode).toBe(2);
    expect(String((e as Error).message)).toContain(`${ghost} not found in PATH`);
  }
});

it("registryField: field read + missing fallback empty string", () => {
  const reg = loadRegistry(REG_PATH);
  expect(registryField(reg, "claude", "cli")).toBe("claude");
  expect(registryField(reg, "claude", "no-such-field")).toBe("");
  expect(registryField(reg, "no-such-harness", "cli")).toBe("");
});

it("resolveInjection: op×type resolution (implement/fix → tdd; review spec/plan → URC pointer)", () => {
  const reg = loadRegistry(REG_PATH);
  expect(resolveInjection(reg.claude, "implement")).toBe("/mattpocock-skills:tdd");
  expect(resolveInjection(reg.claude, "fix")).toBe("/mattpocock-skills:tdd");
  expect(resolveInjection(reg.claude, "review", "task")).toContain("code-review");
  expect(resolveInjection(reg.claude, "review", "spec")).toMatch(/^Follow URC/);
  expect(resolveInjection(reg.claude, "review", "plan")).toMatch(/^Follow URC/);
});

it("resolveSuffix: missing suffix → empty string", () => {
  const reg = loadRegistry(REG_PATH);
  expect(resolveSuffix(reg.claude, "implement")).toBe("");
});