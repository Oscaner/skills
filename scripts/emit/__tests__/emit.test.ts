import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { emitService } from "../all.ts";
import { BASE_PRODUCT_ROOTS, compareService } from "../compare.ts";
import { generatedBanner, manifestService } from "../manifests.ts";
import { emitOrchestrator } from "../orchestrate.ts";
import { SOURCE_TOP, sourceService } from "../source.ts";

// First-party versions are read from the live package.json SOTs so these
// assertions hold at any released version. A stale hardcoded version broke the
// Release workflow's pre-commit gate whenever version-packages.ts bumped the
// tree before committing (emit reads the bumped package.json, so asserts must
// expect the bumped version).
const readPkgVersion = (rel) =>
  JSON.parse(readFileSync(new URL(`../../../${rel}/package.json`, import.meta.url), "utf8"))
    .version;
const OS_VERSION = readPkgVersion("packages/osuperpowers");

const OS_ENG = {
  name: "osuperpowers",
  version: OS_VERSION,
  description: "Standalone osuperpowers skills: orchestration + cli-* family + CDD engine.",
  author: { name: "Oscaner Miao", email: "oscaner1997@gmail.com" },
  license: "MIT",
  claude: {
    category: "osuperpowers",
    keywords: ["osuperpowers", "cli", "cdd", "harness"],
  },
};

// ---------------------------------------------------------------------------
// manifests.ts — generic first-party per-harness manifest builders
// ---------------------------------------------------------------------------

test("claudePluginManifest emits osuperpowers claude manifest (thin, skills, no hooks field)", () => {
  const m = manifestService.claudePluginManifest(OS_ENG, OS_VERSION);
  expect(m).toEqual({
    _generated: generatedBanner,
    name: "osuperpowers",
    description: "Standalone osuperpowers skills: orchestration + cli-* family + CDD engine.",
    version: OS_VERSION,
    author: { name: "Oscaner Miao", email: "oscaner1997@gmail.com" },
    license: "MIT",
    skills: "./skills/",
    category: "osuperpowers",
    keywords: ["osuperpowers", "cli", "cdd", "harness"],
  });
  expect(!("hooks" in m)).toBeTruthy();
});

test("cursorPluginManifest points skills at canonical ./skills/, no hooks", () => {
  const m = manifestService.cursorPluginManifest(OS_ENG, OS_VERSION);
  expect(m.name).toBe("osuperpowers");
  expect(m.displayName).toBe("osuperpowers");
  expect(m.skills).toBe("./skills/");
  expect(!("hooks" in m)).toBeTruthy();
  expect(m.version).toBe(OS_VERSION);
  expect(m.license).toBe("MIT");
  expect(m._generated).toBeTruthy();
  expect(m._generated).toMatch(/scripts\/run\.ts/);
});

test("claudePluginManifest emits hooks only for non-canonical hook files", () => {
  // A non-default `oscaner-plugin.hooks.claude` (an additional hook file beyond
  // the auto-loaded standard) is still emitted in manifest.hooks.
  const custom = manifestService.claudePluginManifest(
    {
      ...OS_ENG,
      hooks: { claude: "./hooks/claude.json", cursor: "./hooks/cursor.json" },
    },
    OS_VERSION,
  );
  expect(custom.hooks).toBe("./hooks/claude.json");
  // The canonical ./hooks/hooks.json is auto-loaded by Claude Code — naming it
  // in manifest.hooks duplicates the load and fails plugin startup, so it is
  // omitted even when `oscaner-plugin.hooks.claude` maps to it explicitly.
  const canonical = manifestService.claudePluginManifest(
    { ...OS_ENG, hooks: { claude: "./hooks/hooks.json" } },
    OS_VERSION,
  );
  expect(!("hooks" in canonical)).toBeTruthy();
});

test("cursorPluginManifest never emits a hooks field (gate hooks removed)", () => {
  const m = manifestService.cursorPluginManifest(
    {
      ...OS_ENG,
      hooks: { claude: "./hooks/claude.json", cursor: "./hooks/cursor.json" },
    },
    OS_VERSION,
  );
  expect(!("hooks" in m)).toBeTruthy();
});

test(".version-bump.json tracks the versioned emit manifest set (.claude-plugin + .cursor-plugin)", () => {
  const bump = JSON.parse(readFileSync("packages/osuperpowers/.version-bump.json", "utf8"));
  const paths = bump.files.map((f) => f.path);
  for (const p of [".claude-plugin/plugin.json", ".cursor-plugin/plugin.json"]) {
    expect(paths.includes(p)).toBeTruthy();
  }
});

test("deriveFirstPartyNames discovers packages with oscaner-plugin (sorted)", () => {
  expect(manifestService.deriveFirstPartyNames("packages")).toEqual(["osuperpowers"]);
});

test("deriveFirstPartyNames ignores dirs without oscaner-plugin / package.json", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-fp-"));
  try {
    mkdirSync(join(tmp, "real"), { recursive: true });
    writeFileSync(
      join(tmp, "real", "package.json"),
      JSON.stringify({ name: "real", "oscaner-plugin": { contentRoot: "." } }),
    );
    // has package.json but no oscaner-plugin → excluded
    mkdirSync(join(tmp, "helper"), { recursive: true });
    writeFileSync(join(tmp, "helper", "package.json"), JSON.stringify({ name: "helper" }));
    // no package.json → excluded
    mkdirSync(join(tmp, "empty"), { recursive: true });
    expect(manifestService.deriveFirstPartyNames(tmp)).toEqual(["real"]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// source.ts — source.json derivation (package-as-source)
// ---------------------------------------------------------------------------

test("deriveSource top-level fields come from emit constants", () => {
  const source = sourceService.derive(".");
  expect(source.name).toBe(SOURCE_TOP.name);
  expect(source.owner).toEqual(SOURCE_TOP.owner);
  expect(source.metadata).toEqual(SOURCE_TOP.metadata);
  expect(source.$schema).toBe(SOURCE_TOP.$schema);
});

test("deriveSource enumerates first-party packages in stable order", () => {
  const source = sourceService.derive(".");
  expect(source.plugins.map((p) => p.name)).toEqual(["osuperpowers"]);
  // schema-required fields present on every plugin
  for (const p of source.plugins) {
    expect(p.name).toBeTruthy();
    expect(p.description).toBeTruthy();
    expect(p.author?.name).toBeTruthy();
    expect(p.contentRoot).toBeTruthy();
    expect(p.cursor).toBeTruthy();
  }
});

test("deriveSource first-party entries carry oscaner-plugin + package metadata", () => {
  const source = sourceService.derive(".");
  const eng = source.plugins.find((p) => p.name === "osuperpowers");
  expect(eng).toEqual({
    name: "osuperpowers",
    version: OS_VERSION,
    description: "Standalone osuperpowers skills: orchestration + cli-* family + CDD engine.",
    author: { name: "Oscaner Miao", email: "oscaner1997@gmail.com" },
    contentRoot: "packages/osuperpowers",
    homepage: "https://github.com/Oscaner/skills",
    repository: "https://github.com/Oscaner/skills",
    license: "MIT",
    claude: {
      category: "osuperpowers",
      keywords: ["osuperpowers", "cli", "cdd", "harness"],
    },
    cursor: { emitMode: "plugin-root" },
  });

  // router deleted — router assertions removed
});

// ---------------------------------------------------------------------------
// orchestrate.ts — stale-product detection
// ---------------------------------------------------------------------------

test("findStaleCommittedFiles flags emitted products no longer generated", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-stale-"));
  try {
    // productRoot dir with one current and one stale product file
    mkdirSync(join(tmp, "products"));
    writeFileSync(join(tmp, "products/kept.json"), "{}\n");
    writeFileSync(join(tmp, "products/stale.json"), "{}\n");
    // standalone product file that IS still generated
    writeFileSync(join(tmp, "standalone.json"), "{}\n");
    // retired whole-directory product (cursor wrapper) that must be gone
    mkdirSync(join(tmp, "cursor-plugins/osuperpowers"), { recursive: true });

    const stale = emitOrchestrator.findStaleCommittedFiles({
      generatedSet: new Set(["products/kept.json", "standalone.json"]),
      productRoots: ["products"],
      productFiles: ["standalone.json"],
      extraStale: ["cursor-plugins/osuperpowers/"],
      root: tmp,
    });
    expect(stale.sort()).toEqual(["cursor-plugins/osuperpowers/", "products/stale.json"]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("findStaleCommittedFiles returns empty when every product is generated", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-fresh-"));
  try {
    mkdirSync(join(tmp, "products"));
    writeFileSync(join(tmp, "products/kept.json"), "{}\n");
    const stale = emitOrchestrator.findStaleCommittedFiles({
      generatedSet: new Set(["products/kept.json"]),
      productRoots: ["products"],
      productFiles: [],
      root: tmp,
    });
    expect(stale).toEqual([]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("writeJsonDoc/writeText write into outRoot (mkdir -p) and track generatedPaths", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-writers-"));
  try {
    const generatedPaths = [];
    emitOrchestrator.writeText(tmp, "a/b.txt", "hello", generatedPaths);
    emitOrchestrator.writeJsonDoc(tmp, "c/d.json", { ok: true }, generatedPaths);
    expect(generatedPaths).toEqual(["a/b.txt", "c/d.json"]);
    expect(readFileSync(join(tmp, "a/b.txt"), "utf8")).toBe("hello");
    expect(JSON.parse(readFileSync(join(tmp, "c/d.json"), "utf8"))).toEqual({ ok: true });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("emitAll into a temp tree produces the full product set and tracks every path", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-emitall-"));
  try {
    const generatedPaths = [];
    emitService.emitAll(tmp, { generatedPaths });
    for (const rel of [
      "marketplace/source.json",
      ".claude-plugin/marketplace.json",
      ".cursor-plugin/marketplace.json",
      "packages/osuperpowers/.claude-plugin/plugin.json",
      "packages/osuperpowers/.cursor-plugin/plugin.json",
    ]) {
      expect(existsSync(join(tmp, rel))).toBe(true);
      expect(generatedPaths.includes(rel)).toBe(true);
    }
    // the shared .agents/skills/ namespace copy is retired — no .agents paths
    // are produced and no hidden .agents tree exists in the product set
    expect(generatedPaths.some((r) => r.includes("/.agents/"))).toBe(false);
    expect(existsSync(join(tmp, "packages/osuperpowers/.agents"))).toBe(false);
    // the drift-check product-root set no longer owns the .agents tree
    expect(BASE_PRODUCT_ROOTS.some((r) => r.includes("/.agents"))).toBe(false);
    // every recorded path resolves to a real temp-tree file, no duplicates
    for (const rel of generatedPaths) {
      expect(existsSync(join(tmp, rel))).toBe(true);
    }
    expect(new Set(generatedPaths).size).toBe(generatedPaths.length);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("emitAll returns an identical wrapper-root set per run (no shared-state accumulation)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-emitall-roots-"));
  try {
    const wrapperRoots = emitService.emitAll(tmp, { generatedPaths: [] });
    // vendor cursor wrappers retired with the self-maintenance surface — no
    // wrapper roots remain (osuperpowers runs plugin-root in-repo)
    expect(wrapperRoots).toEqual([]);
    // a second emit returns the identical set — the base product-root constant
    // is never mutated (regression: marketplace used to push into the exported
    // shared array, so repeated emitAll calls accumulated wrappers)
    expect(emitService.emitAll(tmp, { generatedPaths: [] })).toEqual(wrapperRoots);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("assertVersionBump validates the passed committedRoot, not the module root", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-version-bump-"));
  try {
    const pluginRoot = join(tmp, "packages", "osuperpowers");
    mkdirSync(pluginRoot, { recursive: true });
    writeFileSync(join(pluginRoot, "package.json"), JSON.stringify({ version: "1.0.0" }));
    mkdirSync(join(pluginRoot, ".claude-plugin"), { recursive: true });
    writeFileSync(
      join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ version: "9.9.9" }),
    );
    writeFileSync(
      join(pluginRoot, ".version-bump.json"),
      JSON.stringify({ files: [{ path: ".claude-plugin/plugin.json", field: "version" }] }),
    );
    // staged manifest (9.9.9) drifts from staged package.json (1.0.0) → must
    // throw on the passed root; closing over the module root would read the
    // in-sync repo root instead and pass silently
    expect(() => compareService.assertVersionBump(tmp)).toThrow(/version drift/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// overrides.mjs — router deleted, all tests below removed (#209)
// ---------------------------------------------------------------------------
