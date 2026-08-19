import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

// The bump chain writes these on a superpowers bump (bump-submodule.mjs +
// sync-router-versions.mjs). A move back to root plugins/ layout breaks them.
const SUPERPOWERS_BUMP_TARGETS = [
  "packages/osuperpowers-router/package.json",
  "packages/osuperpowers-router/.claude-plugin/plugin.json",
  "packages/osuperpowers-router/CHANGELOG.md",
  "marketplace/source.json",
];

describe("submodule bump chain — vendors/ + packages/ migration contract", () => {
  it("maps all three submodules to vendors/<name>", () => {
    assert.deepEqual(Object.keys(SUBMODULE_PATHS).sort(), [
      "impeccable",
      "mattpocock-skills",
      "superpowers",
    ]);
    for (const [name, submodulePath] of Object.entries(SUBMODULE_PATHS)) {
      assert.equal(submodulePath, `vendors/${name}`);
      assert.ok(existsSync(join(root, submodulePath)), `${submodulePath} missing`);
    }
  });

  it("resolves a parseable plugin.json for every vendored submodule", () => {
    for (const [name, pluginJson] of Object.entries(VENDORED_PLUGIN_JSON)) {
      assert.ok(existsSync(join(root, pluginJson)), `${pluginJson} missing`);
      assert.doesNotThrow(
        () => JSON.parse(read(pluginJson)),
        `${name} plugin.json must be valid JSON`,
      );
    }
  });

  it("keeps the submodule-sync matrix in lockstep with SUBMODULE_PATHS", () => {
    const yaml = read(".github/workflows/submodule-sync.yml");
    const m = yaml.match(/submodule:\s*\[([^\]]+)\]/);
    assert.ok(m, "matrix.submodule list not found in submodule-sync.yml");
    const matrix = m[1].split(",").map((s) => s.trim());
    assert.deepEqual(
      matrix.slice().sort(),
      Object.keys(SUBMODULE_PATHS).sort(),
      "workflow matrix must cover every SUBMODULE_PATHS entry and nothing more",
    );
  });

  it("resolves bump paths through the script, not hard-coded layout, in the reusable workflow", () => {
    const yaml = read(".github/workflows/bump-submodule-reusable.yml");
    assert.match(yaml, /node scripts\/bump-submodule\.mjs/);
    assert.doesNotMatch(
      yaml,
      /vendors\/(superpowers|impeccable|mattpocock-skills)\b/,
      "workflow must not hard-code the vendor layout — path resolution stays in the script",
    );
  });

  it("targets packages/osuperpowers-router/ for superpowers bump writes", () => {
    for (const rel of SUPERPOWERS_BUMP_TARGETS) {
      assert.ok(existsSync(join(root, rel)), `${rel} missing`);
    }
  });

  it("has no stale root plugins/ layout literals in the bump scripts", () => {
    const stale = /(?<!cursor-)plugins\/(?:superpowers|impeccable|mattpocock-skills|osuperpowers-router)/;
    for (const rel of [
      "scripts/bump-submodule.mjs",
      "scripts/sync-router-versions.mjs",
    ]) {
      assert.doesNotMatch(read(rel), stale, `${rel} reverts to root plugins/ layout`);
    }
  });
});
