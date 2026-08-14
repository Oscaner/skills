import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));
const readText = (rel) => readFileSync(join(root, rel), "utf8");

describe("first-party publish wiring", () => {
  it("flags both first-party packages publishable (private: false)", () => {
    for (const pkg of ["engineering", "superpowers-overrides"]) {
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

  it("release.yml publish step runs changeset publish, not bare changeset tag", () => {
    const yml = readText(".github/workflows/release.yml");
    assert.match(yml, /publish:\s*pnpm exec changeset publish/);
    assert.doesNotMatch(yml, /publish:\s*pnpm exec changeset tag/);
  });

  it("release.yml wires npm auth for changeset publish", () => {
    const yml = readText(".github/workflows/release.yml");
    assert.match(yml, /NPM_TOKEN/);
  });
});
