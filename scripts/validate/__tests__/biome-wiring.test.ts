// scripts/validate/__tests__/biome-wiring.test.ts — T2 (P4.4): pins the biome
// gate wiring — biome.json's ts-scoped recommended shape (the consumer-reproducible
// lint face) and the pre-commit hook's biome step (autofix + re-stage before the
// `pnpm run precommit` chain, `set -e` so a surviving lint violation aborts the
// commit). The zero-violation state itself is enforced by the hook on every commit
// and re-asserted by Task 11; these pins guard the wiring, not the tree.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("biome gate wiring (T2/P4.4)", () => {
  it("biome.json ships the recommended ts-surface config", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8"));
    expect(config.linter.rules.preset).toBe("recommended");
    expect(config.files.includes).toContain("**/*.ts");
    expect(config.formatter.enabled).toBe(true);
  });

  it("pre-commit hook runs the biome gate before the precommit chain", () => {
    const hook = readFileSync(join(ROOT, ".husky", "pre-commit"), "utf8");
    // Anchor on execution lines (newline-prefixed), not comment mentions.
    const biomeIdx = hook.indexOf("\npnpm biome:fix");
    const precommitIdx = hook.indexOf("\npnpm run precommit");
    expect(biomeIdx).toBeGreaterThan(-1);
    expect(precommitIdx).toBeGreaterThan(biomeIdx);
    expect(hook).toContain("set -e");
    expect(hook).toContain("git add"); // biome's reformat is re-staged into the commit
  });
});
