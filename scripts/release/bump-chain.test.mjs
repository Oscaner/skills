import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SUBMODULE_PATHS } from "./submodule-tags.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** @param {string} rel repo-relative path */
const read = (rel) => readFileSync(join(root, rel), "utf8");

// plugin.json per vendored submodule. mattpocock-skills has NO version field —
// its version derives from the release tag (see marketplace-utils resolveVersion).
const VENDORED_PLUGIN_JSON = {
  "mattpocock-skills": "vendors/mattpocock-skills/.claude-plugin/plugin.json",
  superpowers: "vendors/superpowers/.claude-plugin/plugin.json",
  impeccable: "vendors/impeccable/plugin/.claude-plugin/plugin.json",
};

// The bump chain writes these on a superpowers bump (bump-submodule.mjs).
// router deleted — only marketplace/source.json remains.
const SUPERPOWERS_BUMP_TARGETS = [
  "marketplace/source.json",
];

describe("submodule bump chain — vendors/ + packages/ migration contract", () => {
  it("maps all three submodules to vendors/<name>", () => {
    expect(Object.keys(SUBMODULE_PATHS).sort()).toEqual([
      "impeccable",
      "mattpocock-skills",
      "superpowers",
    ]);
    for (const [name, submodulePath] of Object.entries(SUBMODULE_PATHS)) {
      expect(submodulePath).toBe(`vendors/${name}`);
      expect(existsSync(join(root, submodulePath))).toBeTruthy();
    }
  });

  it("resolves a parseable plugin.json for every vendored submodule", () => {
    for (const [, pluginJson] of Object.entries(VENDORED_PLUGIN_JSON)) {
      expect(existsSync(join(root, pluginJson))).toBeTruthy();
      expect(
        () => JSON.parse(read(pluginJson)),
      ).not.toThrow();
    }
  });

  it("keeps the submodule-sync matrix in lockstep with SUBMODULE_PATHS", () => {
    const yaml = read(".github/workflows/submodule-sync.yml");
    const m = yaml.match(/submodule:\s*\[([^\]]+)\]/);
    expect(m).toBeTruthy();
    const matrix = m[1].split(",").map((s) => s.trim());
    expect(
      matrix.slice().sort(),
    ).toEqual(Object.keys(SUBMODULE_PATHS).sort());
  });

  it("resolves bump paths through the script, not hard-coded layout, in the reusable workflow", () => {
    const yaml = read(".github/workflows/bump-submodule-reusable.yml");
    expect(yaml).toMatch(/node scripts\/run\.mjs bump-submodule\b/);
    expect(
      yaml,
    ).not.toMatch(/vendors\/(superpowers|impeccable|mattpocock-skills)\b/);
  });

  it("targets superpowers bump write files (marketplace/source.json)", () => {
    for (const rel of SUPERPOWERS_BUMP_TARGETS) {
      expect(existsSync(join(root, rel))).toBeTruthy();
    }
  });

  it("has no stale root plugins/ layout literals in the bump scripts", () => {
    const stale = /(?<!cursor-)plugins\/(?:superpowers|impeccable|mattpocock-skills)/;
    for (const rel of [
      "scripts/release/bump-submodule.mjs",
    ]) {
      expect(read(rel)).not.toMatch(stale);
    }
  });
});
