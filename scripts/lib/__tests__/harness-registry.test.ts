// scripts/lib/__tests__/harness-registry.test.ts — C1 harness-abstraction tests
// (pi-harness-p2 Task 1). The harness registry is the single manifest builder truth —
// the emit side consumes Harness.manifest directly and no competing builder remains.
// Byte pins: the manifest builders and source.json descriptor slots must match the
// committed emit products byte-for-byte (marketplace/source.json + per-package
// .claude-plugin / .cursor-plugin manifests), so any drift now fails immediately.
// Row key-order assertions are pixel-level (Object.keys), not JSON-semantic.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { sourceService } from "../../emit/source.ts";
import { countSkillsWithMarkdown, EXPECTED } from "../../validate/kairos.ts";
import type { OscanerFields, PiValidationCtx, PluginSource } from "../harness-registry.ts";
import { claudeHarness, cursorHarness, harnessRegistry, piHarness } from "../harness-registry.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OS_PKG_DIR = join(REPO_ROOT, "packages/kairos");

/** The live kairos source.json row (same byte shape the byte pins target). */
function kairosRow(): PluginSource {
  const row = sourceService.derive(REPO_ROOT).plugins.find((p) => p.name === "kairos");
  if (row === undefined) throw new Error("kairos row not derived from source.json");
  return row;
}

/** The manifest builder's version face — the derived kairos row always carries the version slot. */
function versionOf(row: PluginSource): string {
  if (row.version === undefined) {
    throw new Error("derived kairos row is missing its version slot");
  }
  return row.version;
}

/** The live kairos `oscaner` descriptor (the sourceJson input). */
function kairosOsc(): OscanerFields {
  // JSON boundary: package.json parsed as its oscaner descriptor.
  const pkg = JSON.parse(readFileSync(join(OS_PKG_DIR, "package.json"), "utf8")) as {
    oscaner: OscanerFields;
  };
  return pkg.oscaner;
}

/** The source.json row key-slot order the registry descriptor slots must produce. */
const ROW_KEY_ORDER = [
  "name",
  "contentRoot",
  "cursor",
  "version",
  "description",
  "author",
  "homepage",
  "repository",
  "license",
  "claude",
];

/**
 * Assembled source.json plugin row fixture — the key-slot band the registry descriptor slots
 * produce (cursor after contentRoot, claude after the metadata block, hooks last). All slots
 * optional for the assemble loop's incremental build.
 */
interface PluginRowFixture {
  name?: string;
  contentRoot?: string;
  cursor?: PluginSource["cursor"];
  version?: string;
  description?: string;
  author?: PluginSource["author"];
  homepage?: string;
  repository?: string;
  license?: string;
  claude?: PluginSource["claude"];
  hooks?: unknown;
}

/** Fixture row face: PluginSource plus a display-only hooks.cursor key the manifest never reads. */
type HooksFixtureRow = PluginSource & { hooks?: { claude?: string; cursor?: string } };

/**
 * Assemble a plugin row the way the T2 source.ts shape layouts it — registry
 * descriptor slots (cursor after contentRoot, claude after the metadata block,
 * hooks last) around the package metadata band.
 */
function assemblePluginRow(osc: OscanerFields, metadata: PluginSource): PluginRowFixture {
  const row: PluginRowFixture = {
    name: metadata.name,
    contentRoot: metadata.contentRoot,
  };
  const cursorDesc = cursorHarness.sourceJson(osc);
  if (cursorDesc !== undefined) row.cursor = cursorDesc;
  // Metadata band — after contentRoot, before claude (the pinned column order).
  if (metadata.version !== undefined) row.version = metadata.version;
  if (metadata.description !== undefined) row.description = metadata.description;
  if (metadata.author !== undefined) row.author = metadata.author;
  if (metadata.homepage !== undefined) row.homepage = metadata.homepage;
  if (metadata.repository !== undefined) row.repository = metadata.repository;
  if (metadata.license !== undefined) row.license = metadata.license;
  const claudeDesc = claudeHarness.sourceJson(osc);
  if (claudeDesc !== undefined) row.claude = claudeDesc;
  if (osc.hooks !== undefined) row.hooks = osc.hooks;
  return row;
}

// ---------------------------------------------------------------------------
// registry: iteration order + resolve
// ---------------------------------------------------------------------------

test("all() iterates in the fixed source.json slot order [cursor, claude, pi]", () => {
  expect(harnessRegistry.all().map((h) => h.id)).toEqual(["cursor", "claude", "pi"]);
});

test("registers exactly the three singleton harnesses", () => {
  expect(harnessRegistry.all()).toEqual([cursorHarness, claudeHarness, piHarness]);
});

test("resolve() returns the matching harness by id", () => {
  expect(harnessRegistry.resolve("cursor")).toBe(cursorHarness);
  expect(harnessRegistry.resolve("claude")).toBe(claudeHarness);
  expect(harnessRegistry.resolve("pi")).toBe(piHarness);
});

test("resolve() throws for an unknown id, carrying the id text", () => {
  expect(() => harnessRegistry.resolve("bogus")).toThrow(/bogus/);
  expect(() => harnessRegistry.resolve("bogus", "some-package")).toThrow(/bogus/);
});

// ---------------------------------------------------------------------------
// assertBidirectional — both defect directions
// ---------------------------------------------------------------------------

test("assertBidirectional flags a registered harness no package declares", () => {
  // only claude declared → the cursor row is registered-but-unwired
  expect(() =>
    harnessRegistry.assertBidirectional({ "@oscaner-skills/kairos": ["claude"] }),
  ).toThrow(/cursor/);
});

test("assertBidirectional flags a declared id absent from the registry", () => {
  // every registry row declared plus one unknown id → the declared-side check fires
  expect(() =>
    harnessRegistry.assertBidirectional({ "some-package": ["cursor", "claude", "pi", "bogus"] }),
  ).toThrow(/bogus/);
});

test("assertBidirectional passes when the declaration set matches the registry", () => {
  expect(() =>
    harnessRegistry.assertBidirectional({
      "@oscaner-skills/kairos": ["cursor", "claude", "pi"],
    }),
  ).not.toThrow();
});

// ---------------------------------------------------------------------------
// manifest byte pins — .claude-plugin / .cursor-plugin products
// ---------------------------------------------------------------------------

test("ClaudeHarness.manifest byte-pins the .claude-plugin product", () => {
  const row = kairosRow();
  const product = JSON.parse(readFileSync(join(OS_PKG_DIR, ".claude-plugin/plugin.json"), "utf8"));
  const m = claudeHarness.manifest(row, versionOf(row));
  expect(m).toEqual(product);
  expect(Object.keys(m)).toEqual(Object.keys(product));
});

test("CursorHarness.manifest byte-pins the .cursor-plugin product", () => {
  const row = kairosRow();
  const product = JSON.parse(readFileSync(join(OS_PKG_DIR, ".cursor-plugin/plugin.json"), "utf8"));
  const m = cursorHarness.manifest(row, versionOf(row));
  expect(m).toEqual(product);
  expect(Object.keys(m)).toEqual(Object.keys(product));
});

test("ClaudeHarness.manifest emits hooks only for non-canonical hook files", () => {
  const row: HooksFixtureRow = {
    ...kairosRow(),
    hooks: { claude: "./hooks/claude.json", cursor: "./hooks/cursor.json" },
  };
  expect(claudeHarness.manifest(row, versionOf(row)).hooks).toBe("./hooks/claude.json");
  // the canonical ./hooks/hooks.json is auto-loaded by Claude Code and must stay
  // omitted even when `oscaner.hooks.claude` maps to it explicitly
  const canonical = claudeHarness.manifest(
    { ...row, hooks: { claude: "./hooks/hooks.json" } },
    versionOf(row),
  );
  expect("hooks" in canonical).toBe(false);
});

test("ClaudeHarness.manifest omits the skills field under noSkills", () => {
  const row = kairosRow();
  const m = claudeHarness.manifest(row, versionOf(row), { noSkills: true });
  expect("skills" in m).toBe(false);
  expect(m.name).toBe("kairos");
});

test("CursorHarness.manifest never emits a hooks field", () => {
  const row: HooksFixtureRow = {
    ...kairosRow(),
    hooks: { claude: "./hooks/claude.json", cursor: "./hooks/cursor.json" },
  };
  const m = cursorHarness.manifest(row, versionOf(row));
  expect("hooks" in m).toBe(false);
});

// ---------------------------------------------------------------------------
// sourceJson descriptor contributions
// ---------------------------------------------------------------------------

test("CursorHarness.sourceJson always contributes the plugin-root emit descriptor", () => {
  expect(cursorHarness.sourceJson({})).toEqual({ emitMode: "plugin-root" });
  expect(cursorHarness.sourceJson({ claude: {} })).toEqual({ emitMode: "plugin-root" });
});

test("ClaudeHarness.sourceJson aggregates keywords keeping values from both sources", () => {
  const osc = {
    claude: { category: "kairos", keywords: ["claude-src"] },
    keywords: ["top-level"],
  };
  expect(claudeHarness.sourceJson(osc)).toEqual({
    category: "kairos",
    keywords: ["top-level"],
  });
});

test("ClaudeHarness.sourceJson falls back to claude.keywords without a top-level keywords", () => {
  expect(claudeHarness.sourceJson({ claude: { category: "x", keywords: ["a"] } })).toEqual({
    category: "x",
    keywords: ["a"],
  });
});

test("ClaudeHarness.sourceJson is undefined when the package has no claude field", () => {
  expect(claudeHarness.sourceJson({})).toBeUndefined();
  expect(claudeHarness.sourceJson({ contentRoot: "." })).toBeUndefined();
});

test("PiHarness.sourceJson contributes no row slot", () => {
  expect(piHarness.sourceJson({})).toBeUndefined();
});

test("PiHarness.manifest is unreachable (pi is an inline distribution)", () => {
  expect(() => piHarness.manifest({ name: "x", contentRoot: "." }, "0.0.0")).toThrow(/PiHarness/);
});

// ---------------------------------------------------------------------------
// PiHarness.validatePackage — live package + temporary broken packages
// ---------------------------------------------------------------------------

test("PiHarness.validatePackage passes the live kairos package (five assertions)", () => {
  const pkg = JSON.parse(readFileSync(join(OS_PKG_DIR, "package.json"), "utf8"));
  expect(() =>
    piHarness.validatePackage(pkg, {
      pkgRoot: OS_PKG_DIR,
      expectedCount: EXPECTED,
      countSkills: countSkillsWithMarkdown,
    }),
  ).not.toThrow();
});

test("claude/cursor harnesses carry the no-op package contract", () => {
  // the no-op contract ignores both faces — real ctx values keep the call type-honest
  const noopCtx: PiValidationCtx = {
    pkgRoot: ".",
    expectedCount: EXPECTED,
    countSkills: countSkillsWithMarkdown,
  };
  expect(() => claudeHarness.validatePackage({}, noopCtx)).not.toThrow();
  expect(() => cursorHarness.validatePackage({}, noopCtx)).not.toThrow();
});

/** Seed a `./skills` dir with `count` SKILL.md-bearing subdirectories. */
function seedSkillsDir(root: string, count: number) {
  const dir = join(root, "skills");
  for (let i = 0; i < count; i++) {
    mkdirSync(join(dir, `skill-${i}`), { recursive: true });
    writeFileSync(join(dir, `skill-${i}`, "SKILL.md"), `# skill ${i}\n`);
  }
}

test("PiHarness.validatePackage throws when pi declares an extensions key", () => {
  const root = mkdtempSync(join(tmpdir(), "oscaner-pi-"));
  try {
    const pkg = {
      name: "broken",
      keywords: ["pi-package"],
      pi: { skills: ["./skills"], extensions: ["./hooks"] },
      files: ["skills/"],
    };
    expect(() =>
      piHarness.validatePackage(pkg, {
        pkgRoot: root,
        expectedCount: EXPECTED,
        countSkills: countSkillsWithMarkdown,
      }),
    ).toThrow(/extensions/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PiHarness.validatePackage throws when a pi.skills path resolves to the wrong count", () => {
  const root = mkdtempSync(join(tmpdir(), "oscaner-pi-"));
  try {
    const pkg = {
      name: "broken",
      keywords: ["pi-package"],
      pi: { skills: ["./skills"] },
      files: ["skills/"],
    };
    seedSkillsDir(root, EXPECTED - 1);
    expect(() =>
      piHarness.validatePackage(pkg, {
        pkgRoot: root,
        expectedCount: EXPECTED,
        countSkills: countSkillsWithMarkdown,
      }),
    ).toThrow(new RegExp(`expected ${EXPECTED} skills`));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PiHarness.validatePackage throws on a files-closure gap", () => {
  const root = mkdtempSync(join(tmpdir(), "oscaner-pi-"));
  try {
    const pkg = {
      name: "broken",
      keywords: ["pi-package"],
      pi: { skills: ["./skills"] },
      files: ["README.md"], // skills/ missing from the whitelist
    };
    seedSkillsDir(root, EXPECTED);
    expect(() =>
      piHarness.validatePackage(pkg, {
        pkgRoot: root,
        expectedCount: EXPECTED,
        countSkills: countSkillsWithMarkdown,
      }),
    ).toThrow(/must be covered by a package files whitelist entry/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PiHarness.validatePackage throws on a missing pi.skills dir", () => {
  const root = mkdtempSync(join(tmpdir(), "oscaner-pi-"));
  try {
    const pkg = {
      name: "broken",
      keywords: ["pi-package"],
      pi: { skills: ["./skills"] },
      files: ["skills/"],
    };
    expect(() =>
      piHarness.validatePackage(pkg, {
        pkgRoot: root,
        expectedCount: EXPECTED,
        countSkills: countSkillsWithMarkdown,
      }),
    ).toThrow(/must resolve on disk/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// derived row key order — pixel-level, not JSON-semantic
// ---------------------------------------------------------------------------

test("registry-derived plugin row keeps the source.json byte key order", () => {
  const derived = kairosRow();
  const row = assemblePluginRow(kairosOsc(), derived);
  expect(Object.keys(row)).toEqual(ROW_KEY_ORDER);
  expect(row).toEqual(derived);
});

test("a hooks declaration lands in the last row slot", () => {
  const derived = kairosRow();
  const osc = { ...kairosOsc(), hooks: { claude: "./hooks/claude.json" } };
  const row = assemblePluginRow(osc, derived);
  expect(Object.keys(row)).toEqual([...ROW_KEY_ORDER, "hooks"]);
  expect(row.hooks).toEqual({ claude: "./hooks/claude.json" });
});
