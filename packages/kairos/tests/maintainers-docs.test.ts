// packages/kairos/tests/maintainers-docs.test.ts — P4.2 Task 9 maintainers-docs probe
// Asserts the P4.2 Task 9 acceptance: the docs/maintainers family converged from six content docs
// to five (01 template-doctrine merged; 02 naming / 03 context-caching / 04 program-experience /
// 05 third-party-dependencies renumbered contiguous), zero old-numbered names on live surfaces,
// every markdown link + external reference resolves, the P4.2 convergence ledger in
// docs/maintainers/README.md stays truthful (each per-file After cell == the live file's byte
// count, and the Total After cell == the sum of the per-file After cells), the total byte budget
// stays within the plan anchor ≤ 53,000, the dependency final-state tokens (the P4.4
// retirements + the P3.2 shell-strip) are registered in 02/05, and the smoke-cdd positioning (landed by P4.2 Task 4 ③) survives in 04.
// Runs inside the `kairos node:test behavior tree` validate step.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const MAINTAINERS = path.join(REPO, "docs", "maintainers");

const CONTENT_DOCS = [
  "01-template-doctrine.md",
  "02-naming-conventions.md",
  "03-context-caching-doctrine.md",
  "04-program-experience.md",
  "05-third-party-dependencies.md",
];

// The six retired filenames — zero residue on live surfaces (docs/maintainers + root CLAUDE/README
// + the README family). Frozen history (docs/kairos plans/specs) references them and is not
// a live surface; it is deliberately excluded.
const OLD_NAMES = [
  "01-data-driven-templates.md",
  "02-template-doctrine.md",
  "03-naming-conventions.md",
  "04-context-caching-doctrine.md",
  "05-program-experience.md",
  "06-third-party-dependencies.md",
];

// Live surfaces that may reference maintainers docs.
const LIVE_SURFACES = [
  ...CONTENT_DOCS.map((f) => `docs/maintainers/${f}`),
  "docs/maintainers/README.md",
  "CLAUDE.md",
  "README.md",
  "README.zh-CN.md",
  "packages/kairos/README.md",
  "packages/kairos/README.zh-CN.md",
  "packages/cdd-engine/README.md",
  "packages/cdd-engine/README.zh-CN.md",
];

function read(rel: string) {
  return readFileSync(path.join(REPO, rel), "utf8");
}

function bytesOf(rel: string) {
  return statSync(path.join(REPO, rel)).size;
}

/** Resolve a markdown link from its containing file against the repo root. */
function resolveLink(fromRel: string, link: string) {
  const clean = link.split("#")[0].split("?")[0];
  if (!clean.endsWith(".md")) return null; // non-md targets (schemas, dirs) are not plain file links
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), clean));
}

test("maintainers: content docs are exactly the five new-numbered files, zero old names present", () => {
  const names = readdirSync(MAINTAINERS).filter((n) => n.endsWith(".md"));
  const expected = [...CONTENT_DOCS, "README.md"].sort();
  assert.deepEqual(
    names.sort(),
    expected,
    `docs/maintainers file set drifted: ${names.join(", ")}`,
  );
});

for (const f of CONTENT_DOCS) {
  test(`maintainers: ${f} carries no old-numbered maintainers filename`, () => {
    const md = read(`docs/maintainers/${f}`);
    for (const old of OLD_NAMES) {
      assert.ok(!md.includes(old), `${f} still references the retired filename ${old}`);
    }
  });
}

test("maintainers: every markdown link inside docs/maintainers resolves", () => {
  for (const f of [...CONTENT_DOCS, "README.md"]) {
    const md = read(`docs/maintainers/${f}`);
    const links = [...md.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    for (const link of links) {
      if (link.startsWith("http") || link.startsWith("mailto:")) continue;
      const target = resolveLink(`docs/maintainers/${f}`, link);
      assert.ok(target, `non-file link ${link} in docs/maintainers/${f}`);
      assert.ok(existsSync(target), `unresolved link ${link} in docs/maintainers/${f}`);
      assert.ok(
        statSync(target).isFile(),
        `link target not a file: ${link} in docs/maintainers/${f}`,
      );
    }
  }
});

test("maintainers: CLAUDE.md + README-family references resolve to the new numbers", () => {
  for (const rel of [
    "CLAUDE.md",
    "README.md",
    "README.zh-CN.md",
    "packages/kairos/README.md",
    "packages/kairos/README.zh-CN.md",
  ]) {
    const md = read(rel);
    const links = [...md.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    for (const link of links) {
      if (!link.includes("docs/maintainers/")) continue;
      const target = resolveLink(rel, link);
      assert.ok(target && existsSync(target), `unresolved maintainers link ${link} in ${rel}`);
    }
  }
});

test("maintainers: zero old-numbered names on every live surface", () => {
  for (const rel of LIVE_SURFACES) {
    const text = read(rel);
    for (const old of OLD_NAMES) {
      assert.ok(
        !text.includes(old),
        `old maintainers filename ${old} still referenced on live surface ${rel}`,
      );
    }
  }
});

test("maintainers: total bytes within the plan anchor (≤ 53,000)", () => {
  const total = [...CONTENT_DOCS, "README.md"]
    .map((f) => bytesOf(`docs/maintainers/${f}`))
    .reduce((a, b) => a + b, 0);
  assert.ok(
    total <= 53_000,
    `docs/maintainers total ${total} bytes exceeds the plan anchor 53,000`,
  );
});

test("maintainers: README convergence ledger matches the live files (After cells + anchor)", () => {
  const md = read("docs/maintainers/README.md");
  const section = md.slice(md.indexOf("## P4.2 convergence ledger"));
  const rows = [...section.matchAll(/^\|\s*([^|]+\.md)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|/gm)];
  const byFile = new Map(rows.map((r) => [r[1], Number(r[3].replace(/,/g, ""))]));
  for (const f of [
    "01-template-doctrine.md",
    "02-naming-conventions.md",
    "03-context-caching-doctrine.md",
    "04-program-experience.md",
    "05-third-party-dependencies.md",
    "README.md",
  ]) {
    assert.ok(byFile.has(f), `convergence ledger missing a row for ${f}`);
    assert.equal(
      byFile.get(f),
      bytesOf(`docs/maintainers/${f}`),
      `convergence ledger After(${byFile.get(f)}) drifted from the live byte count of ${f}`,
    );
  }
  // Total row: the After cell records the measured total (byte-counted, like every other After
  // cell), never the plan anchor as an inequality — the anchor lives in the Note column instead.
  // A byte total is the one figure the per-file currency check cannot derive from a single file,
  // so assert it equals the sum of the per-file After cells.
  const total = [...byFile.values()].reduce((a, b) => a + b, 0);
  const totalRow = section.match(/^\|\s*\*\*Total\*\*\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|/m);
  assert.ok(totalRow, "convergence ledger missing the Total row");
  assert.equal(
    Number(totalRow[2].replace(/,/g, "")),
    total,
    `convergence ledger Total After (${totalRow[2]}) ≠ the sum of the per-file After cells (${total})`,
  );
  assert.match(md, /≤ 53,000/, "convergence ledger must state the ≤ 53,000 plan anchor");
});

test("maintainers: 02-naming carries the P4.4 final-state terms", () => {
  const md = read("docs/maintainers/02-naming-conventions.md");
  assert.match(md, /REVIEW_FIX/, "REVIEW_FIX missing from the naming registry");
  assert.match(md, /TaskGroup/, "group-* identity (TaskGroup) missing from the naming registry");
  assert.match(md, /--tasks/, "the --tasks group-key surface missing from the naming registry");
  assert.match(md, /\bissue\b/, "the issue-surface vocabulary missing from the naming registry");
});

test("maintainers: 05-deps carries the dependency final state", () => {
  const md = read("docs/maintainers/05-third-party-dependencies.md");
  assert.match(md, /@biomejs\/biome/, "biome not registered in the dependency ledger");
  // The TS6-compat shim (and the old build chain) are RETIRED — the ledger must record the
  // retirement transcription, never re-register the shim as a live dependency (token-muted prose
  // per the retired/delete face rule).
  assert.match(md, /TS6-compat shim retired/, "the TS6-compat shim retirement not recorded");
  assert.match(md, /~~`unbuild`~~ \(retired\)/, "the unbuild retirement row not recorded");
  // the P3.2 shell-strip — the old engine runtime stack is pruned and recorded with the
  // pre-strip declared versions (structural replacements, never deferred).
  assert.match(md, /P3\.2 cutover/, "the P3.2 shell-strip not recorded");
  assert.match(md, /never reintroduce a pruned package/, "the no-re-adopt rule not recorded");
  // the P3.2 lockfile versions — each lockfile version string is unique on the surface.
  assert.match(md, /7\.0\.2/, "typescript 7.0.2 not registered");
  assert.match(md, /5\.0\.3/, "vitest 5.0.3 not registered");
});

test("maintainers: 04-program-experience keeps the smoke-cdd positioning (P4.2 Task 4 ③ landing spot)", () => {
  const md = read("docs/maintainers/04-program-experience.md");
  assert.match(
    md,
    /consumer-sim = the cdd-engine published-artifact consumer black-box/,
    "the smoke-cdd positioning sentence must survive in 04-program-experience",
  );
});
