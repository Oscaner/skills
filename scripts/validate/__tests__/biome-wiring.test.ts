// scripts/validate/__tests__/biome-wiring.test.ts — pins the commit-gate wiring
// (C6): the biome gate and the validate-subset backstop now ride lint-staged.
// `.husky/pre-commit` is the single `pnpm exec lint-staged` line — the handwritten
// autofix + re-stage loop is gone (biome:fix stays a manual script; the hook never
// calls it), and lint-staged.config.mjs declares the two tasks: `biome check` for
// the staged ts domain (no `--write`, so a surviving format/lint violation exits
// non-zero and blocks the commit — the no-fix intercept) + a `*` catch-all that
// keeps running `pnpm run precommit` (the tree-independent validate subset) as the
// full-tree backstop. The zero-violation state itself is enforced by the hook on
// every commit and re-asserted by the validate suite; these pins guard the
// wiring, not the tree.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CONFIG_PATH = join(ROOT, "lint-staged.config.mjs");

describe("biome gate wiring (C6/no-fix)", () => {
  it("biome.json ships the recommended ts-surface config", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8"));
    expect(config.linter.rules.preset).toBe("recommended");
    expect(config.files.includes).toContain("**/*.ts");
    expect(config.formatter.enabled).toBe(true);
  });

  it("pre-commit hook runs the lint-staged gate (no-fix intercept, zero autofix residue)", () => {
    const hook = readFileSync(join(ROOT, ".husky", "pre-commit"), "utf8");
    // The hook is the single lint-staged line; the old biome autofix + re-stage loop
    // is gone (biome:fix stays a manual script — the hook never invokes it).
    expect(hook).toContain("pnpm exec lint-staged");
    expect(hook).not.toContain("biome:fix");
    expect(hook).not.toContain("git add");
  });

  it("lint-staged pins biome check (no --write) for the staged ts domain", () => {
    // Existence is pinned live, before the read — a missing config must fail with a
    // readable assertion instead of an ENOENT thrown by readFileSync.
    expect(existsSync(CONFIG_PATH)).toBe(true);
    const config = readFileSync(CONFIG_PATH, "utf8");
    // A staged TS violation must surface as a non-zero biome exit, not a write-back —
    // the no-fix semantics is what makes a format/lint-dirty staged set uncommittable.
    expect(config).toContain('"*.ts": ["biome check"]');
    expect(config).not.toContain("--write");
  });

  it("lint-staged catch-all keeps the validate subset gating the commit", () => {
    const config = readFileSync(CONFIG_PATH, "utf8");
    expect(config).toContain('"*": ["pnpm run precommit"]');
  });
});
