import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// cwd-independent root (aligned with bump-chain.test.mjs) — `node --test` may
// be invoked from any directory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));
const readText = (rel) => readFileSync(join(root, rel), "utf8");

/**
 * Extract the `changesets/action` step block from release.yml. Anchoring the
 * assertions to the step (rather than regexing the whole file) keeps them
 * meaningful when steps are added/reordered around it, and avoids a passing
 * `NPM_TOKEN` match elsewhere in the workflow. The block ends at the first
 * non-blank line no deeper than the step's own indent (a sibling step or job).
 */
function changesetsActionStep(yml) {
  const lines = yml.split("\n");
  const start = lines.findIndex((l) => l.includes("uses: changesets/action@"));
  assert.ok(start !== -1, "changesets/action step not found in release.yml");
  const stepIndent = lines[start].match(/^\s*/)[0].length;
  const block = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      block.push(line);
      continue;
    }
    if (line.match(/^\s*/)[0].length <= stepIndent) break;
    block.push(line);
  }
  return block.join("\n");
}

describe("first-party publish wiring", () => {
  it("flags first-party packages publishable (private: false)", () => {
    for (const pkg of ["osuperpowers"]) {
      const p = readJson(`packages/${pkg}/package.json`);
      assert.equal(
        p.private,
        false,
        `packages/${pkg}/package.json must have private:false so changesets/npm can publish it`,
      );
    }
  });

  it("sets changesets access to public (scoped @oscaner-skills/* need public)", () => {
    const cfg = readJson(".changeset/config.json");
    assert.equal(cfg.access, "public");
  });

  it("release.yml changesets/action step runs changeset publish, not bare changeset tag", () => {
    const step = changesetsActionStep(readText(".github/workflows/release.yml"));
    assert.match(step, /publish:\s*pnpm exec changeset publish/);
    assert.doesNotMatch(step, /publish:\s*pnpm exec changeset tag/);
  });

  it("release.yml changesets/action step wires npm auth for changeset publish", () => {
    const step = changesetsActionStep(readText(".github/workflows/release.yml"));
    assert.match(step, /NPM_TOKEN:\s*\$\{\{ secrets\.NPM_TOKEN \}\}/);
  });
});
