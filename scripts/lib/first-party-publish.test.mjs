import { describe, it, expect } from "vitest";
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
  if (start === -1) throw new Error("changesets/action step not found in release.yml");
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
      expect(p.private).toBe(false);
    }
  });

  it("sets changesets access to public (scoped @oscaner-skills/* need public)", () => {
    const cfg = readJson(".changeset/config.json");
    expect(cfg.access).toBe("public");
  });

  it("release.yml changesets/action step runs changeset publish, not bare changeset tag", () => {
    const step = changesetsActionStep(readText(".github/workflows/release.yml"));
    expect(step).toMatch(/publish:\s*pnpm exec changeset publish/);
    expect(step).not.toMatch(/publish:\s*pnpm exec changeset tag/);
  });

  it("release.yml changesets/action step wires npm auth for changeset publish", () => {
    const step = changesetsActionStep(readText(".github/workflows/release.yml"));
    expect(step).toMatch(/NPM_TOKEN:\s*\$\{\{ secrets\.NPM_TOKEN \}\}/);
  });
});
