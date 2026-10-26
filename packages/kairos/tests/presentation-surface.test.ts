// packages/kairos/tests/presentation-surface.test.ts — P4.2 Task 8 presentation-surface probe
// Asserts the README family and CLAUDE.md satisfy the P4.2 Task 8 acceptance — the three-stage
// README skeleton (positioning → philosophy → behavior), the no-harness positioning sentence,
// the four cdd philosophy anchors, the CLAUDE.md positioning sentence + surviving single-source
// wording, the zh mirror three-set sync, and the P4.1 behavior
// zero-divergence guarantees. P4 (pi-harness) adds the verified harness-claim pin, the
// skill inventory dir × SKILL.md name: double-pin, the nominal mapping-table data-derivation pin
// (lexicon ids/clis/markers + registry ship), and the zero old-name-identity / zero osuperpowers
// residue pins. It also pins the four claim surfaces (root EN/zh + kairos EN/zh) to zero
// case-insensitive `cursor` hits — no unverified cursor claim survives. Runs inside the
// `kairos vitest` behavior-tree validate step; tests/ is not a shipped surface (absent from
// the pack whitelist).
//
// npm-source resolution residual (registered v1.21 overall): the pi install path
// (`pi install npm:@oscaner-skills/kairos`) depends on pi accepting scoped packages at the npm
// registry layer — a known residual the P4 consumer story records rather than gates; content-level
// verification and publish-source reproducibility carry the acceptance semantics (see the
// pi-harness overall spec P1). This comment is the P4 continuation of that registration.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { CLI_COMMANDS } from "../../cdd-engine/src-next/face/declare.ts";
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

// The engine's top-level CLI surface — DERIVED from the engine's own declaration rows
// (`face/declare.ts`'s `CLI_COMMANDS`) instead of hand-copied. The declaration is the single
// source, so every consumer surface (the engine README CLI table, the kairos README surface
// sentence, the `CLAUDE.md` engine line) is judged against it — order included.
const CDD_SUBCOMMANDS: readonly string[] = CLI_COMMANDS.map((command) => command.name);

const read = (rel: string) => {
  return readFileSync(path.join(REPO, rel), "utf8");
};

/** Top-level `## ` headings in document order — the sync statement's "top-level sections
 *  correspond one by one" contract; `###`, the language row and the badge block are not
 *  sections. */
const headingsOf = (md: string) => {
  return md
    .split("\n")
    .filter((l) => /^## /.test(l))
    .map((l) => l.replace(/^## /, ""));
};

/** A section's text from its heading up to the next top-level heading (or EOF). */
const sectionOf = (md: string, heading: string) => {
  const start = md.indexOf(heading);
  expect(start !== -1, `heading not found: ${heading}`).toBeTruthy();
  const next = md.indexOf("\n## ", start + 1);
  return md.slice(start, next === -1 ? undefined : next);
};

test("root README: positioning sentence present without the word harness", () => {
  const md = read("README.md");
  expect(
    md.includes(POSITIONING_SENTENCE),
    "positioning sentence missing from README.md",
  ).toBeTruthy();
  expect(
    !/\bharness\b/i.test(POSITIONING_SENTENCE),
    "positioning sentence must not carry the word harness",
  ).toBeTruthy();
  expect(POSITIONING_SENTENCE).toMatch(/continuously-discovered development/);
  expect(POSITIONING_SENTENCE).toMatch(/AI coding skills/);
});

test("root README: three-stage skeleton ordered (positioning → philosophy → behavior)", () => {
  const md = read("README.md");
  const pos = md.indexOf(POSITIONING_SENTENCE);
  const phil = md.indexOf(PHILOSOPHY_HEADING);
  const behavior = md.indexOf("## What this is");
  expect(pos !== -1, "positioning sentence missing").toBeTruthy();
  expect(phil !== -1, "philosophy section heading missing").toBeTruthy();
  expect(behavior !== -1, "behavior layer heading (## What this is) missing").toBeTruthy();
  expect(pos < phil, "positioning sentence must precede the philosophy section").toBeTruthy();
  expect(phil < behavior, "philosophy section must precede the behavior layer").toBeTruthy();
});

test("root README: the cdd philosophy walkthrough carries the four anchors", () => {
  const md = read("README.md");
  const section = sectionOf(md, PHILOSOPHY_HEADING);
  // anchor 1 — what cdd is (the discipline is defined here)
  expect(section, "cdd token missing").toMatch(/cdd/);
  expect(section, "cdd definition anchor missing").toMatch(/continuously-discovered development/i);
  // anchor 2 — design motivation
  expect(section, "design-motivation anchor missing").toMatch(/[Ww]hy/);
  expect(section, "design wording missing").toMatch(/design/i);
  // anchor 3 — the three-mode chain (implement → review → fix)
  expect(section, "implement anchor missing").toMatch(/implement/i);
  expect(section, "review anchor missing").toMatch(/review/i);
  expect(section, "fix anchor missing").toMatch(/\bfix\b/i);
  expect(section, "mode-chain anchor missing").toMatch(/chain/i);
  // anchor 4 — convergence discipline (Review Convergence + convergence vocabulary)
  expect(section, "Review Convergence anchor missing").toMatch(/Review Convergence/);
  expect(section, "convergence discipline anchor missing").toMatch(/convergence/i);
});

test("root README: all P4.1 behavior sections carried after the philosophy layer", () => {
  const md = read("README.md");
  const start = md.indexOf(PHILOSOPHY_HEADING);
  expect(start !== -1, "philosophy heading must exist before the behavior check").toBeTruthy();
  const body = md.slice(start);
  let prev = 0;
  for (const heading of ROOT_BEHAVIOR_HEADINGS) {
    const idx = body.indexOf(`## ${heading}`);
    expect(
      idx !== -1 && idx >= prev,
      `behavior section "## ${heading}" missing or out of order after the philosophy layer`,
    ).toBeTruthy();
    prev = idx;
  }
});

test("CLAUDE.md: positioning sentence + surviving single-source wording", () => {
  const md = read("CLAUDE.md");
  expect(
    md.includes(POSITIONING_SENTENCE),
    "positioning sentence missing from CLAUDE.md",
  ).toBeTruthy();
  // CLAUDE.md carries no cdd CLI narrative of its own: the engine line (repository layout) holds
  // the command enumeration plus its count wording, and nothing else — the consumer-facing CLI
  // reference stays in the README family, gated below. This line's enumeration ORDER and its
  // count wording must therefore both agree with `CLI_COMMANDS`; the two are the same fact, so
  // "eight-command" next to a seven-name enumeration (or the reverse) fails here.
  expect(md, "Package-as-source wording must remain").toMatch(/Package-as-source/);
  expect(md, "single-source wording must remain").toMatch(/single source/i);
  const engineLine = md.split("\n").find((line) => /`packages\/cdd-engine\/`/.test(line));
  expect(
    engineLine,
    "CLAUDE.md must keep its cdd-engine line in the repository layout",
  ).toBeTruthy();
  expect(
    engineLine,
    `CLAUDE.md engine line must enumerate the CLI surface in CLI_COMMANDS order (${CDD_SUBCOMMANDS.join(" / ")})`,
  ).toContain(CDD_SUBCOMMANDS.join(" / "));
  expect(engineLine, "CLAUDE.md engine line must carry the eight-command count wording").toContain(
    "eight-command",
  );
  expect(md, "CLAUDE.md must not keep the retired seven-command count wording").not.toMatch(
    /seven-command/,
  );
});

test("kairos README: philosophy walkthrough present (cdd as the distributed discipline)", () => {
  const md = read("packages/kairos/README.md");
  expect(md, "kairos philosophy section missing").toMatch(/^## The kairos philosophy$/m);
  const section = sectionOf(md, OSP_PHILOSOPHY_HEADING);
  expect(section, "cdd anchor missing in kairos philosophy").toMatch(/cdd/i);
  expect(section, "mode-chain/engine anchor missing in kairos philosophy").toMatch(
    /implement|review|fix/,
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
  expect(
    found,
    `zh-CN mirror set drifted from the root + two-package three: ${found.join(", ")}`,
  ).toEqual([
    "README.zh-CN.md",
    "packages/cdd-engine/README.zh-CN.md",
    "packages/kairos/README.zh-CN.md",
  ]);
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
    "许可",
  ],
  "packages/cdd-engine/README.zh-CN.md": ["包定位", "安装", "CLI", "迁移", "开发说明", "许可"],
};

for (const [en, zh] of MIRROR_PAIRS) {
  test(`zh mirror sync: ${zh} keeps positional heading parity with ${en}`, () => {
    const enMd = read(en);
    const zhMd = read(zh);
    expect(zhMd, `language switch row missing in ${zh}`).toMatch(/\[中文\]/);
    expect(zhMd, `mirror sync declaration missing in ${zh}`).toMatch(/Mirror 同步声明/);
    const enHeadings = headingsOf(enMd);
    const zhHeadings = headingsOf(zhMd);
    expect(
      zhHeadings.length,
      `top-level section count drifted between ${en} (${enHeadings.length}) and ${zh} (${zhHeadings.length})`,
    ).toBe(enHeadings.length);
    expect(
      zhHeadings,
      `zh top-level heading sequence (:${zh} drifted from the pinned expectation)`,
    ).toEqual(ZH_HEADING_SEQUENCES[zh]);
  });
}

test("P4.1 behavior: root README plugin table carries no hand-written version (single source: manifest + npm)", () => {
  const md = read("README.md");
  const table = sectionOf(md, "## Plugins");
  const row = table.match(/^\|\s*\*\*kairos\*\*\s*\|/m);
  expect(row, "kairos plugin table row missing in README.md").toBeTruthy();
  // Zero hand-written versions (P4.2 "release with no hand-pinned versions"): the README plugin
  // table must not carry a \d+.\d+.\d+ pin — version single source = package.json -> marketplace
  // manifest -> npm (version-sync keeps the machine surface consistent)
  expect(table, "README plugin table must not hand-pin a version").not.toMatch(
    /\|\s*\d+\.\d+\.\d+\s*\|/,
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
    expect(picked, `SKILL.md in ${d} missing a name: front-matter field`).toBeTruthy();
    return picked![1].trim();
  });
  expect(dirs.length, "must be exactly the shipped 6 skills").toBe(6);
  expect(dirs, "skill directory name must equal its SKILL.md front-matter name:").toEqual(names);
  for (const n of names) {
    expect(n, `every shipped skill must be a cdd-* family name: ${n}`).toMatch(/^cdd-/);
  }
  // Double-pin ② — the README claim table must equal the directory scan.
  const md = read("packages/kairos/README.md");
  const table = md.slice(md.indexOf("## Skills"), md.indexOf("## Installation"));
  expect(md.includes("## Skills"), "kairos README Skills section missing").toBeTruthy();
  const rows = [...table.matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)].map((m) => m[1]).sort();
  expect(rows.length, "skill table must carry exactly the shipped 6 skills").toBe(6);
  expect(rows, "README skill table rows drift from the shipped skills").toEqual(dirs);
});

// The P20 CLI-surface gates — three surfaces, both languages. Each is driven by a table of
// files (the same "one criterion, both mirrors" shape as BOARD_USAGE_PINS below), so a change
// made only in the EN source while its zh mirror keeps teaching the old surface fails.
const ENGINE_README_CLI_TABLES = [
  "packages/cdd-engine/README.md",
  "packages/cdd-engine/README.zh-CN.md",
];

/** The `## CLI` section's subcommand column, in document order. The row SET alone would stay
 *  green when a row is inserted at the wrong position or when the two language tables disagree
 *  on order — the extracted SEQUENCE is what the gates compare. */
const cliTableCommands = (rel: string): readonly string[] => {
  return [...sectionOf(read(rel), "## CLI").matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)].map(
    (row) => row[1]!,
  );
};

for (const rel of ENGINE_README_CLI_TABLES) {
  test(`P20 CLI surface: ${rel} lists every subcommand in CLI_COMMANDS order`, () => {
    expect(
      cliTableCommands(rel),
      `${rel}: the ## CLI table rows must equal the CLI_COMMANDS declaration, in order`,
    ).toEqual(CDD_SUBCOMMANDS);
  });
}

// P15 identity flip — the row-name loop above would stay green if a `board` row kept the
// retired positional-slug form (the row is still named `board`), so the argument form is
// pinned positively on both cdd-engine READMEs: the documented invocation must be the
// path-flag form the engine's `board` command declares (zero positionals — a positional
// argument is refused by the parser, so a stale row is a broken consumer instruction).
const BOARD_USAGE_PINS: Record<string, { usage: RegExp; retired: RegExp }> = {
  "packages/cdd-engine/README.md": {
    usage: /^\|\s*`board`\s*\|\s*`cdd board --plan <path> \/ --spec <path>`\s*\|/m,
    retired: /cdd board <slug>/,
  },
  "packages/cdd-engine/README.zh-CN.md": {
    usage: /^\|\s*`board`\s*\|\s*`cdd board --plan <path> \/ --spec <path>`\s*\|/m,
    retired: /cdd board <slug>/,
  },
};

for (const [rel, pin] of Object.entries(BOARD_USAGE_PINS)) {
  test(`P15 board usage: ${rel} documents the path-flag entry form`, () => {
    const cli = sectionOf(read(rel), "## CLI");
    expect(
      cli,
      `${rel} board row must document \`cdd board --plan <path> / --spec <path>\``,
    ).toMatch(pin.usage);
    expect(cli, `${rel} must not resurface the retired positional-slug board form`).not.toMatch(
      pin.retired,
    );
  });
}

// P15 identity flip — the two cdd-engine READMEs (EN source + zh mirror, same judgment, the
// per-language patterns below) must carry the consumer migration note. The flip is a major
// breaking change with zero dual-read, and it moves the per-run workspace key: `.kairos/cdd/`
// directories are keyed by the document's declared `slug:`, so a directory left under a
// retired file-name-derived key is not reused and the consumer may delete it by hand. The
// claim is only honest if a consumer reading either language learns all of it — the note is
// pinned section-scoped, so a heading rename or a dropped bullet fails here.
const MIGRATION_NOTES: Record<
  string,
  { heading: string; notReused: RegExp; deleteByHand: RegExp }
> = {
  "packages/cdd-engine/README.md": {
    heading: "## Migration",
    notReused: /not reused/i,
    deleteByHand: /delete it by hand/i,
  },
  "packages/cdd-engine/README.zh-CN.md": {
    heading: "## 迁移",
    notReused: /不复用/,
    deleteByHand: /手动删除/,
  },
};

for (const [rel, pin] of Object.entries(MIGRATION_NOTES)) {
  test(`P15 migration note: ${rel} documents the breaking identity flip for consumers`, () => {
    const section = sectionOf(read(rel), pin.heading);
    expect(section, `${rel} migration note must name the per-run workspace root`).toMatch(
      /\.kairos\/cdd\//,
    );
    expect(section, `${rel} migration note must mark the change major breaking`).toMatch(
      /major breaking/,
    );
    expect(section, `${rel} migration note must retire the file-name-derived identity`).toMatch(
      /file-name-derived|按文件名推演/,
    );
    expect(
      section,
      `${rel} migration note must state a stale workspace directory is not reused`,
    ).toMatch(pin.notReused);
    expect(
      section,
      `${rel} migration note must tell the consumer the stale directory is deletable by hand`,
    ).toMatch(pin.deleteByHand);
  });
}

// The kairos README surface sentence is its own consumer-facing surface, independent of the
// engine README CLI table: it names the runner and the full command enumeration inline.
const KAIROS_README_SURFACES: Record<string, string> = {
  "packages/kairos/README.md": "## CDD engine CLI",
  "packages/kairos/README.zh-CN.md": "## CDD 引擎 CLI",
};

for (const [rel, heading] of Object.entries(KAIROS_README_SURFACES)) {
  test(`P4.1 behavior: ${rel} names the full CLI surface (issue render included)`, () => {
    const cli = sectionOf(read(rel), heading);
    const surface = CDD_SUBCOMMANDS.join(" / ");
    expect(cli, `${rel}: must name the full CLI surface (${surface})`).toContain(surface);
    expect(cli, `${rel}: must mention cdd schema get`).toMatch(/cdd schema get/);
    expect(cli, `${rel}: must mention cdd issue render`).toMatch(/cdd issue render/);
  });
}

test("P4.1 behavior: harness claims stay at the verified pair (claude + pi)", () => {
  const root = read("README.md");
  expect(
    root,
    "root README must keep the neutral multi-harness claim with the verified pair",
  ).toMatch(
    /consumable across multiple AI coding harnesses \(verified on \*\*Claude Code\*\* and \*\*Pi\*\*\)/,
  );
  expect(root, "unverified harness claims leaked back into README.md").not.toMatch(
    /8 harnesses|Trae|Vibe|Kiro|OpenCode/,
  );
  // The pair-wordings ride the claim surface on all four README claim files (root EN/zh +
  // kairos EN/zh) — a triple-form regression anywhere fails; the foreign-claim ban holds.
  expect(
    read("README.zh-CN.md"),
    "root zh mirror must carry the verified pair claim wording",
  ).toMatch(/已在 \*\*Claude Code\*\* 与 \*\*Pi\*\* 上验证/);
  expect(
    read("packages/kairos/README.md"),
    "kairos README must carry the verified pair claim",
  ).toMatch(/\(verified on \*\*Claude Code\*\* and \*\*Pi\*\*\)/);
  expect(
    read("packages/kairos/README.zh-CN.md"),
    "kairos zh mirror must carry the verified pair claim wording",
  ).toMatch(/已在 \*\*Claude Code\*\* 与 \*\*Pi\*\* 上验证/);
  const eng = read("packages/cdd-engine/README.md");
  expect(eng, "cdd-engine README harness wording missing").toMatch(/harness registry|harness/);
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
 *  source), ship status from the same contract row — the nominal table has no cursor row;
 *  `cursor-agent` survives on these surfaces only as the residue case's banned token. */
/** One row of the canonical harness contract (the typed host plane, src-next/face/host.ts) —
 *  the nominal-table derivation source (id + cli + detect + ship). */
interface HarnessContractRow {
  cli?: unknown;
  detect?: { env?: string; value?: string };
  ship?: unknown;
}

const nominalRow = (contract: Record<string, HarnessContractRow>, id: string) => {
  const row = contract[id];
  expect(row, `harness contract row missing for harness ${id}`).toBeTruthy();
  expect(row.detect, `harness contract row missing detect for harness ${id}`).toBeTruthy();
  expect(row.ship, `harness contract row missing ship for harness ${id}`).toBeTruthy();
  const detect = row.detect!;
  return {
    id,
    cli: row.cli,
    marker: detect.value != null ? `${detect.env}=${detect.value}` : detect.env,
    ship: row.ship,
  };
};

/** Parse a nominal-table data row (backticked cli + marker cells stripped) into the derived shape;
 *  rows without a backticked second cell (header / separator) return null. */
const parseNominalRow = (line: string) => {
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
};

test("nominal mapping table == the harness contract (row id/cli/detect + ship) data derivation", () => {
  const contract = HOSTS as unknown as Record<string, HarnessContractRow>;
  const ids = Object.keys(contract).filter((k): k is HostId => k === "claude" || k === "pi");
  const expected = ids.map((id) => nominalRow(contract, id));
  for (const rel of Object.keys(NOMINAL_SECTION_HEADING)) {
    const md = read(rel);
    const section = sectionOf(md, NOMINAL_SECTION_HEADING[rel]);
    const rows = section
      .split("\n")
      .map(parseNominalRow)
      .filter((r) => r !== null);
    expect(
      rows,
      `${rel} nominal table must equal the lexicon + registry derivation (zero hand-written duplicates)`,
    ).toEqual(expected);
  }
});

test("zero cursor residue on the README claim surfaces (case-insensitive)", () => {
  // The banned token is `cursor-agent` — matched case-insensitively, so the retired
  // `Cursor Agent` spelling cannot slip back onto a claim surface either.
  for (const rel of CLAIM_SURFACES) {
    const md = read(rel);
    md.split("\n").forEach((line, i) => {
      expect(
        line.toLowerCase().includes("cursor"),
        `${rel}:${i + 1} unverified cursor claim on the claim surface`,
      ).toBe(false);
    });
  }
});

test("zero old-name skill identity residue on the README claim surfaces (upstream import lexemes exempt)", () => {
  for (const rel of CLAIM_SURFACES) {
    const text = read(rel);
    // (a) every kairos-qualified skill reference must be a current cdd-* name
    for (const m of text.matchAll(/\/kairos:([a-z][\w-]*)/g)) {
      expect(
        m[1],
        `${rel}: kairos-qualified skill reference must be a current cdd-* name (got "${m[1]}")`,
      ).toMatch(/^cdd-/);
    }
    // (b) bare invocable skill references (quick-start style) must be current cdd-* names;
    //     `/skill:<bare-name>` (pi flat-namespace form) and upstream lexemes are exempt
    for (const m of text.matchAll(/^\s*\/(?!skill:)([a-z][\w-]*)\s*$/gm)) {
      expect(
        m[1],
        `${rel}: bare invocable skill reference must be a current cdd-* name (got "${m[1]}")`,
      ).toMatch(/^cdd-/);
    }
    // (c) the retired identities must not resurface under the current or the retired namespace
    expect(
      text,
      `${rel}: retired skill identity referenced under the kairos/osuperpowers namespace`,
    ).not.toMatch(new RegExp(`(?:kairos|osuperpowers):(${OLD_KAIROS_SKILL_NAMES.join("|")})\\b`));
  }
});

test("zero osuperpowers residue on the README family (namespace retired with the rename)", () => {
  for (const rel of [
    ...CLAIM_SURFACES,
    "packages/cdd-engine/README.md",
    "packages/cdd-engine/README.zh-CN.md",
  ]) {
    expect(
      read(rel),
      `${rel} must carry zero osuperpowers tokens (plugin namespace retired → kairos)`,
    ).not.toMatch(/osuperpowers/);
  }
});
