// packages/osuperpowers/tests/brainstorming-zhcn-mirror.test.mjs — parity guard
// for the brainstorming skill's zh-CN mirror (Task 3, P14 digraph refactor).
//
// The zh-CN SKILL.zh-CN.md is a mirror of the English SKILL.md. This guard
// verifies structural parity at the seams that the P14 digraph refactor added:
//   - the four new digraph node anchors (read-program / claim-phase /
//     sync-overall / user-confirm-commit?) appear in BOTH files' mermaid block;
//   - Invariant rows I1–I7 are present in both files;
//   - the three new Failure Modes terminal rows (overall-parse-failed /
//     overall-sync-failed) are present in both files.
//
// Prose translation quality is out of scope (human review). This guard only
// asserts that the Chinese mirror did not silently drop structural elements
// when the English source changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// tests/ → osuperpowers/ → packages/ → repo root
const SKILL_DIR = path.resolve(HERE, "..", "skills", "brainstorming");
const EN = readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf8");
const ZH = readFileSync(path.join(SKILL_DIR, "SKILL.zh-CN.md"), "utf8");

function mermaidBlock(src) {
  const m = src.match(/```mermaid\n([\s\S]*?)```/);
  assert.ok(m, "mermaid block must exist");
  return m[1];
}
const enDigraph = mermaidBlock(EN);
const zhDigraph = mermaidBlock(ZH);

// The four node-anchor ids are ASCII identifiers shared across both files
// (the brief requires identical anchor names so cross-file anchors stay
// consistent). Presence in the digraph block is the seam.
const NODE_ANCHORS = [
  "read-program",
  "claim-phase",
  "sync-overall",
  "user-confirm-commit?",
];

for (const anchor of NODE_ANCHORS) {
  test(`digraph anchor ${anchor} present in EN`, () => {
    assert.ok(
      enDigraph.includes(anchor),
      `EN digraph missing anchor ${anchor}`,
    );
  });
  test(`digraph anchor ${anchor} present in zh-CN`, () => {
    assert.ok(
      zhDigraph.includes(anchor),
      `zh-CN digraph missing anchor ${anchor}`,
    );
  });
}

// Invariant rows I1..I7 must appear in both files as a table row marker
// `| I<n> |`.
const INVARIANTS = ["I1", "I2", "I3", "I4", "I5", "I6", "I7"];
for (const id of INVARIANTS) {
  test(`invariant ${id} present in EN`, () => {
    assert.ok(EN.includes(`| ${id} |`), `EN missing invariant row ${id}`);
  });
  test(`invariant ${id} present in zh-CN`, () => {
    assert.ok(
      ZH.includes(`| ${id} |`),
      `zh-CN missing invariant row ${id}`,
    );
  });
}

// The three new Failure Modes terminal rows reference these terminal ids.
const TERMINALS = ["overall-parse-failed", "overall-sync-failed"];
for (const term of TERMINALS) {
  test(`failure-mode terminal ${term} present in EN`, () => {
    assert.ok(EN.includes(term), `EN missing failure terminal ${term}`);
  });
  test(`failure-mode terminal ${term} present in zh-CN`, () => {
    assert.ok(
      ZH.includes(term),
      `zh-CN missing failure terminal ${term}`,
    );
  });
}

// The new node definitions (read-program / claim-phase / sync-overall /
// user-confirm-commit?) must have a section heading in both files.
const NODE_HEADINGS = [
  "### `read-program`",
  "### `claim-phase`",
  "### `sync-overall`",
  "### `user-confirm-commit?`",
];
for (const h of NODE_HEADINGS) {
  test(`node heading ${h} present in EN`, () => {
    assert.ok(EN.includes(h), `EN missing node heading ${h}`);
  });
  test(`node heading ${h} present in zh-CN`, () => {
    assert.ok(ZH.includes(h), `zh-CN missing node heading ${h}`);
  });
}
