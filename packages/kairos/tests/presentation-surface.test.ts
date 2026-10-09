// packages/kairos/tests/presentation-surface.test.ts — P4.2 Task 8 presentation-surface probe
// Asserts the README family and CLAUDE.md satisfy the P4.2 Task 8 acceptance — the three-stage
// README skeleton (positioning → philosophy → behavior), the no-harness positioning sentence,
// the four cdd philosophy anchors, the CLAUDE.md positioning sentence + Non-goal #1 exception +
// surviving single-source wording, the zh mirror three-set sync, and the P4.1 behavior
// zero-divergence guarantees. P4 (pi-harness) adds the verified-triple harness-claim pin, the
// skill inventory dir × SKILL.md name: double-pin, the nominal mapping-table data-derivation pin
// (lexicon ids/clis/markers + registry ship), and the zero old-name-identity / zero osuperpowers /
// zero cursor-agent (binary-column data value excepted) residue pins. Runs inside the
// `kairos node:test behavior tree` validate step; tests/ is not a shipped surface (absent from
// the pack whitelist).
//
// npm-source resolution residual (registered v1.21 overall): the pi install path
// (`pi install npm:@oscaner-skills/kairos`) depends on pi accepting scoped packages at the npm
// registry layer — a known residual the P4 consumer story records rather than gates; content-level
// verification and publish-source reproducibility carry the acceptance semantics (see the
// pi-harness overall spec P1). This comment is the P4 continuation of that registration.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { HOSTS, type HostId } from "../../cdd-engine/src-next/face/host.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");

const POSITIONING_SENTENCE =
  "A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.";

const PHILOSOPHY_HEADING = "## The cdd philosophy";
const OSP_PHILOSOPHY_HEADING = "## The kairos philosophy";

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

// The engine's actual top-level CLI surface (the parse canonical set: implement / review / fix /
// base / schema / issue — T20 converged the base command face) — README surfaces must document
// all of it, issue included (the P4.2 Task 6 `cdd issue render` addition), else the behavior
// claim drifts from the landing behavior.
const CDD_SUBCOMMANDS = ["implement", "review", "fix", "base", "schema", "issue"];

function read(rel: string) {
  return readFileSync(path.join(REPO, rel), "utf8");
}

/** Top-level `## ` headings in document order — the sync statement's "top-level sections
 *  correspond one by one" contract; `###`, the language row and the badge block are not
 *  sections. */
function headingsOf(md: string) {
  return md
    .split("\n")
    .filter((l) => /^## /.test(l))
    .map((l) => l.replace(/^## /, ""));
}

/** A section's text from its heading up to the next top-level heading (or EOF). */
function sectionOf(md: string, heading: string) {
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

test("kairos README: philosophy walkthrough present (cdd as the distributed discipline)", () => {
  const md = read("packages/kairos/README.md");
  assert.match(md, /^## The kairos philosophy$/m, "kairos philosophy section missing");
  const section = sectionOf(md, OSP_PHILOSOPHY_HEADING);
  assert.match(section, /cdd/i, "cdd anchor missing in kairos philosophy");
  assert.match(
    section,
    /implement|review|fix/,
    "mode-chain/engine anchor missing in kairos philosophy",
  );
});

test("zh mirror set: exactly the root + two package mirrors, zero others", () => {
  const found: string[] = [];
  const walk = (dir: string) => {
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
    ["README.zh-CN.md", "packages/cdd-engine/README.zh-CN.md", "packages/kairos/README.zh-CN.md"],
    `zh-CN mirror set drifted from the root + two-package three: ${found.join(", ")}`,
  );
});

const MIRROR_PAIRS = [
  ["README.md", "README.zh-CN.md"],
  ["packages/kairos/README.md", "packages/kairos/README.zh-CN.md"],
  ["packages/cdd-engine/README.md", "packages/cdd-engine/README.zh-CN.md"],
];

// The pinned, ordered top-level zh heading sequence per mirror — the mechanical meat of the
// mirror sync declaration's "each section corresponds one by one by position" claim. A zh
// rename, reorder, or mistranslation into the wrong slot fails the deep-equal below; derive
// new sequences only when a legit README rewrite renames the mirrored section (EN + zh
// together).
const ZH_HEADING_SEQUENCES: Record<string, string[]> = {
  "README.zh-CN.md": [
    "cdd 理念导览",
    "这是什么",
    "插件列表",
    "安装",
    "快速开始",
    "架构",
    "各包文档",
    "开发",
    "许可",
  ],
  "packages/kairos/README.zh-CN.md": [
    "kairos 理念导览",
    "功能",
    "技能",
    "安装",
    "快速开始",
    "CDD 引擎 CLI",
    "与上游插件共存",
    "维护者文档",
    "许可",
  ],
  "packages/cdd-engine/README.zh-CN.md": ["包定位", "安装", "CLI", "开发说明", "许可"],
};

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
    assert.deepEqual(
      zhHeadings,
      ZH_HEADING_SEQUENCES[zh],
      `zh top-level heading sequence (:${zh} drifted from the pinned expectation)`,
    );
  });
}

test("P4.1 behavior: root README plugin table carries no hand-written version (single source: manifest + npm)", () => {
  const md = read("README.md");
  const table = sectionOf(md, "## Plugins");
  const row = table.match(/^\|\s*\*\*kairos\*\*\s*\|/m);
  assert.ok(row, "kairos plugin table row missing in README.md");
  // Zero hand-written versions (P4.2 "release with no hand-pinned versions"): the README plugin
  // table must not carry a \d+.\d+.\d+ pin — version single source = package.json -> marketplace
  // manifest -> npm (version-sync keeps the machine surface consistent)
  assert.doesNotMatch(
    table,
    /\|\s*\d+\.\d+\.\d+\s*\|/,
    "README plugin table must not hand-pin a version",
  );
});

test("P4.1 behavior: kairos README skill inventory equals the shipped skills (dir × SKILL.md name double-pin)", () => {
  const skillsDir = path.join(REPO, "packages/kairos/skills");
  const dirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && statSync(path.join(skillsDir, e.name, "SKILL.md")).isFile())
    .map((e) => e.name)
    .sort();
  // Double-pin ① — every directory name must equal its SKILL.md front-matter `name:` (the G1
  // single-identity rule restated as a machine check); exactly 6 skills, all `cdd-*` family.
  const names = dirs.map((d) => {
    const md = readFileSync(path.join(REPO, "packages/kairos/skills", d, "SKILL.md"), "utf8");
    const picked = md.match(/^name:\s*(.+)$/m);
    assert.ok(picked, `SKILL.md in ${d} missing a name: front-matter field`);
    return picked[1].trim();
  });
  assert.equal(dirs.length, 6, "must be exactly the shipped 6 skills");
  assert.deepEqual(dirs, names, "skill directory name must equal its SKILL.md front-matter name:");
  for (const n of names) {
    assert.match(n, /^cdd-/, `every shipped skill must be a cdd-* family name: ${n}`);
  }
  // Double-pin ② — the README claim table must equal the directory scan.
  const md = read("packages/kairos/README.md");
  const table = md.slice(md.indexOf("## Skills"), md.indexOf("## Installation"));
  assert.ok(md.includes("## Skills"), "kairos README Skills section missing");
  const rows = [...table.matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)].map((m) => m[1]).sort();
  assert.equal(rows.length, 6, "skill table must carry exactly the shipped 6 skills");
  assert.deepEqual(rows, dirs, "README skill table rows drift from the shipped skills");
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

test("P4.1 behavior: kairos README names the full CLI surface (issue render included)", () => {
  const md = read("packages/kairos/README.md");
  const cli = sectionOf(md, "## CDD engine CLI");
  const surface = CDD_SUBCOMMANDS.join(" / ");
  assert.match(
    cli,
    new RegExp(surface),
    `kairos README must name the full CLI surface (${surface})`,
  );
  assert.match(cli, /cdd schema get/, "kairos README must mention cdd schema get");
  assert.match(cli, /cdd issue render/, "kairos README must mention cdd issue render");
});

test("P4.1 behavior: harness claims stay at the verified triple (claude + cursor-agent + pi)", () => {
  const root = read("README.md");
  assert.match(
    root,
    /consumable across multiple AI coding harnesses \(verified on \*\*Claude Code\*\*, \*\*Cursor Agent\*\*, and \*\*Pi\*\*\)/,
    "root README must keep the P6 B1 neutral multi-harness claim with the verified triple",
  );
  assert.doesNotMatch(
    root,
    /8 harnesses|Trae|Vibe|Kiro|OpenCode/,
    "unverified harness claims leaked back into README.md",
  );
  // The triple-wordings ride the T4-deployed claim surface on all four README claim files (root
  // EN/zh + kairos EN/zh) — a pair-form regression anywhere fails; the foreign-claim ban holds.
  assert.match(
    read("README.zh-CN.md"),
    /已在 \*\*Claude Code\*\*、\*\*Cursor Agent\*\* 与 \*\*Pi\*\* 上验证/,
    "root zh mirror must carry the verified triple claim wording",
  );
  assert.match(
    read("packages/kairos/README.md"),
    /\(verified on \*\*Claude Code\*\*, \*\*Cursor Agent\*\*, and \*\*Pi\*\*\)/,
    "kairos README must carry the verified triple claim",
  );
  assert.match(
    read("packages/kairos/README.zh-CN.md"),
    /已在 \*\*Claude Code\*\*、\*\*Cursor Agent\*\* 与 \*\*Pi\*\* 上验证/,
    "kairos zh mirror must carry the verified triple claim wording",
  );
  const eng = read("packages/cdd-engine/README.md");
  assert.match(eng, /harness registry|harness/, "cdd-engine README harness wording missing");
});

// ---------------------------------------------------------------------------
// P4 nominal-table + residue pins — the README claim surfaces (root EN/zh + kairos EN/zh)
// ---------------------------------------------------------------------------

const CLAIM_SURFACES = [
  "README.md",
  "README.zh-CN.md",
  "packages/kairos/README.md",
  "packages/kairos/README.zh-CN.md",
];

// The retired kairos skill identities (T1 — renamed to the cdd-* family under package/kairos).
// The pin is structural: the claim surfaces may reference kairos skills only by their current
// cdd-* names. Upstream import lexemes (`/superpowers:*`, `/mattpocock-skills:*`) stay legal
// verbatim (G2 precision rule — no word-level ban; `brainstorming` AS an upstream skill name is
// legal, only a kairos-face identity claim is pinned here).
const OLD_KAIROS_SKILL_NAMES = [
  "brainstorming",
  "cli-driven-development",
  "finishing",
  "report-issues",
  "writing-overall-spec",
  "writing-phase-spec",
  "writing-plans",
  "writing-single-spec",
];

// The kairos README nominal mapping table (## CDD engine CLI) — the per-file section heading
// differs between the EN source and its zh mirror.
const NOMINAL_SECTION_HEADING: Record<string, string> = {
  "packages/kairos/README.md": "## CDD engine CLI",
  "packages/kairos/README.zh-CN.md": "## CDD 引擎 CLI",
};

/** The data-derived nominal table row for one harness id (display form): identifier + CLI binary
 *  + host marker from the harness contract (row id + cli + detect — C8: the unique harness-data
 *  source), ship status from the same contract row — `cursor-agent` is legal ONLY as the cursor
 *  binary-column data value. */
/** One row of the canonical harness contract (the typed host plane, src-next/face/host.ts) —
 *  the nominal-table derivation source (id + cli + detect + ship). */
interface HarnessContractRow {
  cli?: unknown;
  detect?: { env?: string; value?: string };
  ship?: unknown;
}

function nominalRow(contract: Record<string, HarnessContractRow>, id: string) {
  const row = contract[id];
  assert.ok(row, `harness contract row missing for harness ${id}`);
  assert.ok(row.detect, `harness contract row missing detect for harness ${id}`);
  assert.ok(row.ship, `harness contract row missing ship for harness ${id}`);
  const detect = row.detect;
  return {
    id,
    cli: row.cli,
    marker: detect.value != null ? `${detect.env}=${detect.value}` : detect.env,
    ship: row.ship,
  };
}

/** Parse a nominal-table data row (backticked cli + marker cells stripped) into the derived shape;
 *  rows without a backticked second cell (header / separator) return null. */
function parseNominalRow(line: string) {
  const cells = line
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  if (cells.length !== 4 || !cells[1].startsWith("`")) return null;
  return {
    id: cells[0],
    cli: cells[1].replace(/`/g, ""),
    marker: cells[2].replace(/`/g, ""),
    ship: cells[3],
  };
}

test("nominal mapping table == the harness contract (row id/cli/detect + ship) data derivation", () => {
  const contract = HOSTS as unknown as Record<string, HarnessContractRow>;
  const ids = Object.keys(contract).filter(
    (k): k is HostId => k === "claude" || k === "cursor" || k === "pi",
  );
  const expected = ids.map((id) => nominalRow(contract, id));
  for (const rel of Object.keys(NOMINAL_SECTION_HEADING)) {
    const md = read(rel);
    const section = sectionOf(md, NOMINAL_SECTION_HEADING[rel]);
    const rows = section
      .split("\n")
      .map(parseNominalRow)
      .filter((r) => r !== null);
    assert.deepEqual(
      rows,
      expected,
      `${rel} nominal table must equal the lexicon + registry derivation (zero hand-written duplicates)`,
    );
  }
});

test("zero cursor-agent residue on the README claim surfaces (G2 exemption anchor retired; binary-column data value excepted)", () => {
  for (const rel of CLAIM_SURFACES) {
    const md = read(rel);
    md.split("\n").forEach((line, i) => {
      if (!line.includes("cursor-agent")) return;
      assert.match(
        line,
        /^\|\s*cursor\s*\|\s*`cursor-agent`/,
        `${rel}:${i + 1} cursor-agent outside the nominal-table binary column (registry cli data value)`,
      );
    });
  }
});

test("zero old-name skill identity residue on the README claim surfaces (upstream import lexemes exempt)", () => {
  for (const rel of CLAIM_SURFACES) {
    const text = read(rel);
    // (a) every kairos-qualified skill reference must be a current cdd-* name
    for (const m of text.matchAll(/\/kairos:([a-z][\w-]*)/g)) {
      assert.match(
        m[1],
        /^cdd-/,
        `${rel}: kairos-qualified skill reference must be a current cdd-* name (got "${m[1]}")`,
      );
    }
    // (b) bare invocable skill references (quick-start style) must be current cdd-* names;
    //     `/skill:<bare-name>` (pi flat-namespace form) and upstream lexemes are exempt
    for (const m of text.matchAll(/^\s*\/(?!skill:)([a-z][\w-]*)\s*$/gm)) {
      assert.match(
        m[1],
        /^cdd-/,
        `${rel}: bare invocable skill reference must be a current cdd-* name (got "${m[1]}")`,
      );
    }
    // (c) the retired identities must not resurface under the current or the retired namespace
    assert.doesNotMatch(
      text,
      new RegExp(`(?:kairos|osuperpowers):(${OLD_KAIROS_SKILL_NAMES.join("|")})\\b`),
      `${rel}: retired skill identity referenced under the kairos/osuperpowers namespace`,
    );
  }
});

test("zero osuperpowers residue on the README family (namespace retired with the rename)", () => {
  for (const rel of [
    ...CLAIM_SURFACES,
    "packages/cdd-engine/README.md",
    "packages/cdd-engine/README.zh-CN.md",
  ]) {
    assert.doesNotMatch(
      read(rel),
      /osuperpowers/,
      `${rel} must carry zero osuperpowers tokens (plugin namespace retired → kairos)`,
    );
  }
});
