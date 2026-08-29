// packages/osuperpowers/tests/brainstorming-zhcn-mirror.test.mjs — parity guard
// for the brainstorming skill's zh-CN mirror (Task 3, P14 digraph refactor).
//
// The zh-CN SKILL.zh-CN.md is a mirror of the English SKILL.md. This guard
// verifies structural parity at the seams that the P14 digraph refactor added:
//   - the four new digraph node anchors (read-program / claim-phase /
//     sync-overall / user-confirm-commit?) appear in BOTH files' mermaid block;
//   - Invariant rows I1–I7 are present in both files;
//   - the two distinct Failure Modes terminal ids (overall-parse-failed /
//     overall-sync-failed) are present in both files — the three new EN rows
//     collapse to two ids, the third reusing overall-sync-failed.
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
// tests/ → (up one level to package root) → skills/brainstorming
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

// Assert that every item appears in both the EN and zh-CN source under the
// same needle shape. `fmt` maps an item to the exact substring searched for
// (defaults to the item itself); `getEn`/`getZh` supply the haystack so the
// digraph anchors can be scoped to the mermaid block while everything else is
// matched against the full file.
function bothFilesContain(label, items, getEn, getZh, fmt = (x) => x) {
  for (const item of items) {
    const needle = fmt(item);
    test(`${label} ${item} present in EN`, () => {
      assert.ok(getEn().includes(needle), `EN missing ${label} ${item}`);
    });
    test(`${label} ${item} present in zh-CN`, () => {
      assert.ok(getZh().includes(needle), `zh-CN missing ${label} ${item}`);
    });
  }
}

// The four node-anchor ids are ASCII identifiers shared across both files
// (the brief requires identical anchor names so cross-file anchors stay
// consistent). Presence in the digraph block is the seam.
const NODE_ANCHORS = [
  "read-program",
  "claim-phase",
  "sync-overall",
  "user-confirm-commit?",
];
bothFilesContain("digraph anchor", NODE_ANCHORS, () => enDigraph, () => zhDigraph);

// Invariant rows I1..I7 must appear in both files as a table row marker
// `| I<n> |`.
//
// NOTE: skill-authoring.md §4 documents an "Invariants table capped at 5"
// convention. P14 intentionally extends the brainstorming skill to 7 rows by
// adding I6 (Register-before-grill) and I7 (Serial-phase) gates; the upstream
// osuperpowers:brainstorming source carries I1-I7, so this is a pre-existing standard
// tension, not a regression introduced by the mirror. The parity guard tracks
// the real source (I1–I7) rather than the cap so a future collapse to 5 forces
// a visible test edit instead of silently drifting.
const INVARIANTS = ["I1", "I2", "I3", "I4", "I5", "I6", "I7"];
bothFilesContain("invariant", INVARIANTS, () => EN, () => ZH, (id) => `| ${id} |`);

// The two distinct Failure Modes terminal ids the P14 refactor added.
const TERMINALS = ["overall-parse-failed", "overall-sync-failed"];
bothFilesContain("failure-mode terminal", TERMINALS, () => EN, () => ZH);

// The new node definitions (read-program / claim-phase / sync-overall /
// user-confirm-commit?) must have a section heading in both files.
const NODE_HEADINGS = [
  "### `read-program`",
  "### `claim-phase`",
  "### `sync-overall`",
  "### `user-confirm-commit?`",
];
bothFilesContain("node heading", NODE_HEADINGS, () => EN, () => ZH);
