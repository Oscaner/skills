// packages/superpowers-overrides/tests/manifest-harness.test.mjs — Node port of
// manifest-harness.test.py.
//
// Asserts the per-harness manifests (cursor / codex) stay in sync with
// `package.json` and the derived marketplace `source.json`: overrides is a
// trigger router with no skill bodies, so every manifest must agree on name,
// version, description, author, license, and the hooks wiring.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "../..");

function load(p) {
  return JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));
}

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

test("cursor manifest shape", () => {
  const m = load(".cursor-plugin/plugin.json");
  assert.equal(m.name, "superpowers-overrides");
  assert.equal(m.displayName, "Superpowers Overrides");
  assert.ok(!("skills" in m), "overrides plugin has no skill bodies (trigger router only)");
  assert.equal(m.hooks, "./hooks/hooks-cursor.json");
  assert.ok("_generated" in m);
  assert.ok(isFile(path.join(ROOT, m.hooks)));
});

test("codex manifest minimal", () => {
  const m = load(".codex-plugin/plugin.json");
  assert.equal(m.name, "superpowers-overrides");
  assert.ok(!("skills" in m), "overrides plugin has no skill bodies (trigger router only)");
  assert.deepEqual(m.hooks, {});
  assert.ok(!("interface" in m));
  assert.ok(!("repository" in m));
  assert.ok("_generated" in m);
});

test("metadata matches package.json", () => {
  const pkg = load("package.json");
  const cursor = load(".cursor-plugin/plugin.json");
  const codex = load(".codex-plugin/plugin.json");
  for (const m of [cursor, codex]) {
    assert.equal(m.version, pkg.version);
    assert.equal(m.description, pkg.description);
    assert.deepEqual(m.author, pkg.author);
    assert.equal(m.license, pkg.license);
  }
});

test("description matches marketplace source", () => {
  const source = JSON.parse(readFileSync(path.join(REPO, "marketplace/source.json"), "utf8"));
  const overrides = source.plugins.find((p) => p.name === "superpowers-overrides");
  assert.ok(overrides, "superpowers-overrides missing from marketplace/source.json");
  const pkg = load("package.json");
  assert.equal(pkg.description, overrides.description);
});
