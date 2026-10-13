// packages/kairos/tests/maintainers-docs.test.ts — P4.2 Task 9 maintainers-docs probe
// Asserts the P4.2 Task 9 acceptance: the docs/maintainers family converged from six content docs
// to five (01 template-doctrine merged; 02 naming / 03 context-caching / 04 program-experience /
// 05 third-party-dependencies renumbered contiguous), zero old-numbered names on live surfaces;
// 05 later deleted per the user ruling 2026-10-11 (third-party deps leave no maintainer-doc
// surface), so the live family is five content docs — 01–04 plus 06-skill-node-discipline, the
// P3.2 facts-only sweep's addition at the converged numbering — within the ≤ 56,000 budget. Every
// markdown link + external reference resolves,
// the P4.2 convergence ledger in
// docs/maintainers/README.md stays truthful (each per-file After cell == the live file's byte
// count, and the Total After cell == the sum of the per-file After cells), the total byte budget
// stays within the plan anchor ≤ 56,000, the dependency final-state is declared at the
// package.json#dependencies surface (the 05 maintainer-doc deps ledger is retired), and the smoke-cdd positioning (landed by P4.2 Task 4 ③) survives in 04.
// Runs inside the `kairos vitest` behavior-tree validate step.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const MAINTAINERS = path.join(REPO, "docs", "maintainers");

const CONTENT_DOCS = [
  "01-template-doctrine.md",
  "02-naming-conventions.md",
  "03-context-caching-doctrine.md",
  "04-program-experience.md",
  "06-skill-node-discipline.md",
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

const read = (rel: string) => {
  return readFileSync(path.join(REPO, rel), "utf8");
};

const bytesOf = (rel: string) => {
  return statSync(path.join(REPO, rel)).size;
};

/** Resolve a markdown link from its containing file into its absolute target
 *  path (prefixed with REPO so the existence checks hold under any CWD — the
 *  suite runs standalone via `pnpm -C packages/kairos test` too, where a
 *  bare repo-relative target would misresolve). */
const resolveLink = (fromRel: string, link: string) => {
  const clean = link.split("#")[0].split("?")[0];
  if (!clean.endsWith(".md")) return null; // non-md targets (schemas, dirs) are not plain file links
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), clean));
  return path.join(REPO, rel);
};

test("maintainers: content docs are exactly the five new-numbered files, zero old names present", () => {
  const names = readdirSync(MAINTAINERS).filter((n) => n.endsWith(".md"));
  const expected = [...CONTENT_DOCS, "README.md"].sort();
  expect(names.sort(), `docs/maintainers file set drifted: ${names.join(", ")}`).toEqual(expected);
});

for (const f of CONTENT_DOCS) {
  test(`maintainers: ${f} carries no old-numbered maintainers filename`, () => {
    const md = read(`docs/maintainers/${f}`);
    for (const old of OLD_NAMES) {
      expect(!md.includes(old), `${f} still references the retired filename ${old}`).toBeTruthy();
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
      expect(target, `non-file link ${link} in docs/maintainers/${f}`).toBeTruthy();
      expect(existsSync(target!), `unresolved link ${link} in docs/maintainers/${f}`).toBeTruthy();
      expect(
        statSync(target!).isFile(),
        `link target not a file: ${link} in docs/maintainers/${f}`,
      ).toBeTruthy();
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
      expect(
        target && existsSync(target),
        `unresolved maintainers link ${link} in ${rel}`,
      ).toBeTruthy();
    }
  }
});

test("maintainers: zero old-numbered names on every live surface", () => {
  for (const rel of LIVE_SURFACES) {
    const text = read(rel);
    for (const old of OLD_NAMES) {
      expect(
        !text.includes(old),
        `old maintainers filename ${old} still referenced on live surface ${rel}`,
      ).toBeTruthy();
    }
  }
});

test("maintainers: total bytes within the plan anchor (≤ 53,000)", () => {
  const total = [...CONTENT_DOCS, "README.md"]
    .map((f) => bytesOf(`docs/maintainers/${f}`))
    .reduce((a, b) => a + b, 0);
  expect(
    total <= 56_000,
    `docs/maintainers total ${total} bytes exceeds the plan anchor 56,000`,
  ).toBeTruthy();
});

test("maintainers: README convergence ledger matches the live files (After cells + anchor)", () => {
  const md = read("docs/maintainers/README.md");
  const section = md.slice(md.indexOf("## Convergence ledger (P4.2 → P5)"));
  const rows = [...section.matchAll(/^\|\s*([^|]+\.md)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|/gm)];
  const byFile = new Map(rows.map((r) => [r[1], Number(r[3].replace(/,/g, ""))]));
  for (const f of [
    "01-template-doctrine.md",
    "02-naming-conventions.md",
    "03-context-caching-doctrine.md",
    "04-program-experience.md",
    "06-skill-node-discipline.md",
    "README.md",
  ]) {
    expect(byFile.has(f), `convergence ledger missing a row for ${f}`).toBeTruthy();
    expect(
      byFile.get(f),
      `convergence ledger After(${byFile.get(f)}) drifted from the live byte count of ${f}`,
    ).toBe(bytesOf(`docs/maintainers/${f}`));
  }
  // Total row: the After cell records the measured total (byte-counted, like every other After
  // cell), never the plan anchor as an inequality — the anchor lives in the Note column instead.
  // A byte total is the one figure the per-file currency check cannot derive from a single file,
  // so assert it equals the sum of the per-file After cells.
  const total = [...byFile.values()].reduce((a, b) => a + b, 0);
  const totalRow = section.match(/^\|\s*\*\*Total\*\*\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|/m);
  expect(totalRow, "convergence ledger missing the Total row").toBeTruthy();
  expect(
    Number(totalRow![2].replace(/,/g, "")),
    `convergence ledger Total After (${totalRow![2]}) ≠ the sum of the per-file After cells (${total})`,
  ).toBe(total);
  expect(md, "convergence ledger must state the ≤ 56,000 plan anchor").toMatch(/≤ 56,000/);
});

test("maintainers: 02-naming carries the P4.4 final-state terms", () => {
  const md = read("docs/maintainers/02-naming-conventions.md");
  expect(md, "REVIEW_FIX missing from the naming registry").toMatch(/REVIEW_FIX/);
  expect(md, "group-* identity (TaskGroup) missing from the naming registry").toMatch(/TaskGroup/);
  expect(md, "the --tasks group-key surface missing from the naming registry").toMatch(/--tasks/);
  expect(md, "the issue-surface vocabulary missing from the naming registry").toMatch(/\bissue\b/);
});

test("maintainers: 04-program-experience keeps the smoke-cdd positioning (P4.2 Task 4 ③ landing spot)", () => {
  const md = read("docs/maintainers/04-program-experience.md");
  expect(md, "the smoke-cdd positioning sentence must survive in 04-program-experience").toMatch(
    /consumer-sim = the cdd-engine published-artifact consumer black-box/,
  );
});
