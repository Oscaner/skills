// packages/osuperpowers/tests/presentation-surface.test.mjs — P4.2 Task 8 presentation-surface probe
// Asserts the README family and CLAUDE.md satisfy the P4.2 Task 8 acceptance — the three-stage
// README skeleton (positioning → philosophy → behavior), the no-harness positioning sentence,
// the four cdd philosophy anchors, the CLAUDE.md positioning sentence + Non-goal #1 exception +
// surviving single-source wording, the zh mirror three-set sync, and the P4.1 behavior
// zero-divergence guarantees. Runs inside the `osuperpowers node:test behavior tree` validate
// step; tests/ is not a shipped surface (absent from the pack whitelist).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");

const POSITIONING_SENTENCE =
  "A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.";

const PHILOSOPHY_HEADING = "## The cdd philosophy";
const OSP_PHILOSOPHY_HEADING = "## The osuperpowers philosophy";

// The P4.1-era behavior section headings — the root README's behavior layer must carry every
// one after the philosophy layer, in this order (carried over, zero rewrite).
const ROOT_BEHAVIOR_HEADINGS = [
  "What this is",
  "Plugins",
  "Installation",
  "Quick start",
  "Architecture",
  "Per-package docs",
  "Development",
  "License",
];

// The engine's actual top-level CLI surface (parse.ts canonical set: implement / review / fix /
// base-branch / schema / issue) — README surfaces must document all of it, issue included
// (the P4.2 Task 6 `cdd issue render` addition), else the behavior claim drifts from the
// landing behavior.
const CDD_SUBCOMMANDS = ["implement", "review", "fix", "base-branch", "schema", "issue"];

function read(rel) {
  return readFileSync(path.join(REPO, rel), "utf8");
}

/** Top-level `## ` headings in document order — the sync statement's "top-level sections
 *  correspond one by one" contract; `###`, the language row and the badge block are not
 *  sections. */
function headingsOf(md) {
  return md
    .split("\n")
    .filter((l) => /^## /.test(l))
    .map((l) => l.replace(/^## /, ""));
}

/** A section's text from its heading up to the next top-level heading (or EOF). */
function sectionOf(md, heading) {
  const start = md.indexOf(heading);
  assert.ok(start !== -1, `heading not found: ${heading}`);
  const next = md.indexOf("\n## ", start + 1);
  return md.slice(start, next === -1 ? undefined : next);
}

test("root README: positioning sentence present without the word harness", () => {
  const md = read("README.md");
  assert.ok(md.includes(POSITIONING_SENTENCE), "positioning sentence missing from README.md");
  assert.ok(
    !/\bharness\b/i.test(POSITIONING_SENTENCE),
    "positioning sentence must not carry the word harness",
  );
  assert.match(POSITIONING_SENTENCE, /continuously-discovered development/);
  assert.match(POSITIONING_SENTENCE, /AI coding skills/);
});

test("root README: three-stage skeleton ordered (positioning → philosophy → behavior)", () => {
  const md = read("README.md");
  const pos = md.indexOf(POSITIONING_SENTENCE);
  const phil = md.indexOf(PHILOSOPHY_HEADING);
  const behavior = md.indexOf("## What this is");
  assert.ok(pos !== -1, "positioning sentence missing");
  assert.ok(phil !== -1, "philosophy section heading missing");
  assert.ok(behavior !== -1, "behavior layer heading (## What this is) missing");
  assert.ok(pos < phil, "positioning sentence must precede the philosophy section");
  assert.ok(phil < behavior, "philosophy section must precede the behavior layer");
});

test("root README: the cdd philosophy walkthrough carries the four anchors", () => {
  const md = read("README.md");
  const section = sectionOf(md, PHILOSOPHY_HEADING);
  // anchor 1 — what cdd is (the discipline is defined here)
  assert.match(section, /cdd/, "cdd token missing");
  assert.match(section, /continuously-discovered development/i, "cdd definition anchor missing");
  // anchor 2 — design motivation
  assert.match(section, /[Ww]hy/, "design-motivation anchor missing");
  assert.match(section, /design/i, "design wording missing");
  // anchor 3 — the three-mode chain (implement → review → fix)
  assert.match(section, /implement/i, "implement anchor missing");
  assert.match(section, /review/i, "review anchor missing");
  assert.match(section, /\bfix\b/i, "fix anchor missing");
  assert.match(section, /chain/i, "mode-chain anchor missing");
  // anchor 4 — convergence discipline (Review Convergence + convergence vocabulary)
  assert.match(section, /Review Convergence/, "Review Convergence anchor missing");
  assert.match(section, /convergence/i, "convergence discipline anchor missing");
});

test("root README: all P4.1 behavior sections carried after the philosophy layer", () => {
  const md = read("README.md");
  const start = md.indexOf(PHILOSOPHY_HEADING);
  assert.ok(start !== -1, "philosophy heading must exist before the behavior check");
  const body = md.slice(start);
  let prev = 0;
  for (const heading of ROOT_BEHAVIOR_HEADINGS) {
    const idx = body.indexOf(`## ${heading}`);
    assert.ok(
      idx !== -1 && idx >= prev,
      `behavior section "## ${heading}" missing or out of order after the philosophy layer`,
    );
    prev = idx;
  }
});

test("CLAUDE.md: positioning sentence + Non-goal #1 exception + single-source wording", () => {
  const md = read("CLAUDE.md");
  assert.ok(md.includes(POSITIONING_SENTENCE), "positioning sentence missing from CLAUDE.md");
  // Non-goal #1 exception — the only cdd CLI additions are the discovery-type schema get and
  // the pure-rendering issue render (both zero-enforcement)
  assert.match(md, /schema get/, "Non-goal #1 schema get exception missing");
  assert.match(md, /cdd issue render/, "Non-goal #1 cdd issue render exception missing");
  assert.match(md, /no new subcommand/i, "Non-goal #1 zero-new-subcommand statement missing");
  // the Package-as-source + single-source core phrasing must survive the rewrite
  assert.match(md, /Package-as-source/, "Package-as-source wording must remain");
  assert.match(md, /single source/i, "single-source wording must remain");
});

test("osuperpowers README: philosophy walkthrough present (cdd as the distributed discipline)", () => {
  const md = read("packages/osuperpowers/README.md");
  assert.match(md, /^## The osuperpowers philosophy$/m, "osuperpowers philosophy section missing");
  const section = sectionOf(md, OSP_PHILOSOPHY_HEADING);
  assert.match(section, /cdd/i, "cdd anchor missing in osuperpowers philosophy");
  assert.match(section, /implement|review|fix/, "mode-chain/engine anchor missing in osuperpowers philosophy");
});

test("zh mirror set: exactly the root + two package mirrors, zero others", () => {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".zh-CN.md")) found.push(path.relative(REPO, p));
    }
  };
  walk(REPO);
  found.sort();
  assert.deepEqual(
    found,
    ["README.zh-CN.md", "packages/cdd-engine/README.zh-CN.md", "packages/osuperpowers/README.zh-CN.md"],
    `zh-CN mirror set drifted from the root + two-package three: ${found.join(", ")}`,
  );
});

const MIRROR_PAIRS = [
  ["README.md", "README.zh-CN.md"],
  ["packages/osuperpowers/README.md", "packages/osuperpowers/README.zh-CN.md"],
  ["packages/cdd-engine/README.md", "packages/cdd-engine/README.zh-CN.md"],
];

for (const [en, zh] of MIRROR_PAIRS) {
  test(`zh mirror sync: ${zh} keeps positional heading parity with ${en}`, () => {
    const enMd = read(en);
    const zhMd = read(zh);
    assert.match(zhMd, /\[中文\]/, `language switch row missing in ${zh}`);
    assert.match(zhMd, /Mirror 同步声明/, `mirror sync declaration missing in ${zh}`);
    const enHeadings = headingsOf(enMd);
    const zhHeadings = headingsOf(zhMd);
    assert.equal(
      zhHeadings.length,
      enHeadings.length,
      `top-level section count drifted between ${en} (${enHeadings.length}) and ${zh} (${zhHeadings.length})`,
    );
    for (let i = 0; i < zhHeadings.length; i++) {
      assert.ok(zhHeadings[i].length > 0, "empty heading position in mirror");
    }
  });
}

test("P4.1 behavior: root README plugin table version matches the package manifest", () => {
  const pkg = JSON.parse(read("packages/osuperpowers/package.json"));
  const md = read("README.md");
  const row = sectionOf(md, "## Plugins").match(/^\|\s*\*\*osuperpowers\*\*\s*\|\s*([^\s|]+)\s*\|/m);
  assert.ok(row, "osuperpowers plugin table row missing in README.md");
  assert.equal(row[1], pkg.version, "plugin table version drifts from packages/osuperpowers/package.json");
});

test("P4.1 behavior: osuperpowers README skill inventory equals the shipped skills", () => {
  const skillsDir = path.join(REPO, "packages/osuperpowers/skills");
  const actual = readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && statSync(path.join(skillsDir, e.name, "SKILL.md")).isFile())
    .map((e) => e.name)
    .sort();
  const md = read("packages/osuperpowers/README.md");
  const table = md.slice(md.indexOf("## Skills"), md.indexOf("## Installation"));
  assert.ok(md.includes("## Skills"), "osuperpowers README Skills section missing");
  const rows = [...table.matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)].map((m) => m[1]).sort();
  assert.equal(rows.length, 8, "skill table must carry exactly the shipped 8 skills");
  assert.deepEqual(rows, actual, "README skill table rows drift from the shipped skills");
});

test("P4.1 behavior: cdd-engine README documents every CLI subcommand (issue included)", () => {
  const md = read("packages/cdd-engine/README.md");
  const cli = sectionOf(md, "## CLI");
  for (const cmd of CDD_SUBCOMMANDS) {
    assert.match(
      cli,
      new RegExp(`^\\|\\s*\`${cmd}\``, "m"),
      `cdd-engine README CLI table missing the \`${cmd}\` row`,
    );
  }
});

test("P4.1 behavior: osuperpowers README names the full CLI surface (issue render included)", () => {
  const md = read("packages/osuperpowers/README.md");
  const cli = sectionOf(md, "## CDD engine CLI");
  assert.match(
    cli,
    /implement \/ review \/ fix \/ base-branch \/ schema \/ issue/,
    "osuperpowers README must name the full CLI surface (implement / review / fix / base-branch / schema / issue)",
  );
  assert.match(cli, /cdd schema get/, "osuperpowers README must mention cdd schema get");
  assert.match(cli, /cdd issue render/, "osuperpowers README must mention cdd issue render");
});

test("P4.1 behavior: harness claims stay at the verified pair (claude + cursor-agent)", () => {
  const root = read("README.md");
  assert.match(
    root,
    /consumable across multiple AI coding harnesses \(verified on \*\*Claude Code\*\* and \*\*Cursor Agent\*\*\)/,
    "root README must keep the P6 B1 neutral multi-harness claim with the verified pair",
  );
  assert.doesNotMatch(root, /8 harnesses|Trae|Vibe|Kiro|OpenCode/, "unverified harness claims leaked back into README.md");
  const eng = read("packages/cdd-engine/README.md");
  assert.match(eng, /harness registry|harness/, "cdd-engine README harness wording missing");
});
