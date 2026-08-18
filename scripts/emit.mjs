#!/usr/bin/env node
/**
 * Unified emit tool.
 *
 * Replaces `scripts/emit-marketplace.mjs` and the former per-plugin generator
 * scripts (`packages/osuperpowers-router/build/generate-all.sh` + render-*).
 * Derives `marketplace/source.json` from packages/ + vendors/ (package-as-source)
 * and generates every first-party artifact:
 *
 *  - repo-root marketplace manifests (`.claude-plugin/` + `.cursor-plugin/`)
 *  - the derived `marketplace/source.json` aggregate (emit product)
 *  - cursor wrapper manifests for vendored (non-plugin-root) plugins
 *  - per-harness thin manifests for first-party plugins, all pointing at the
 *    canonical `./skills/` tree:
 *      claude  → `.claude-plugin/plugin.json`
 *      cursor  → `.cursor-plugin/plugin.json`
 *      codex   → `.codex-plugin/plugin.json`
 *      qoder   → `.qoder-plugin/plugin.json`
 *      kimi    → `.kimi-plugin/plugin.json`
 *      gemini  → `gemini-extension.json` + `GEMINI.md`
 *      shared  → `.agents/skills/` copy (engineering only — no vendored upstream)
 *    plus the overrides hooks/self-check tables and engineering PreToolUse
 *    hooks, and version consistency per `packages/osuperpowers/.version-bump.json`.
 *
 * `--check` mode generates into a temp tree and diffs every produced path
 * against the on-disk tree (drift → exit 1), and flags committed product files
 * the generator no longer produces (stale extras under the emit-owned product
 * roots → exit 1). Emit products are committed, so a fresh clone has them for
 * the comparison; CI runs `pnpm run emit --check` directly against the
 * committed tree (no write pass).
 */

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdtempSync,
  existsSync,
  readdirSync,
  cpSync,
  chmodSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import {
  resolveVersion,
  claudeMarketplaceEntry,
  cursorWrapperManifest,
  assertCursorPathsExist,
  assertPrereleasePrefix,
  claudeMarketplaceDocument,
  cursorMarketplaceDocument,
  repoRootFromImportMeta,
  isPluginRoot,
} from "./lib/marketplace-utils.mjs";
import {
  generatedBanner,
  claudePluginManifest,
  cursorPluginManifest,
  codexPluginManifest,
  kimiPluginManifest,
  geminiExtension,
  geminiMarkdown,
  engineeringHooksFor,
  qoderPluginManifest,
  assertAdapterPathsExist,
} from "./lib/emit/manifests.mjs";
import { deriveSource } from "./lib/emit/source.mjs";
import {
  loadTargets,
  promptExpansionScript,
  piRouterScript,
  cursorDetectScript,
  cursorEnforceScript,
  claudeSelfCheckMd,
  cursorSelfCheckMdc,
  overridesHooksFor,
  overridesCursorManifest,
  overridesCodexManifest,
} from "./lib/emit/overrides.mjs";
import {
  findStaleCommittedFiles,
  pruneStaleAgentsNamespaces,
} from "./lib/emit/orchestrate.mjs";

const root = repoRootFromImportMeta(import.meta.url);
const checkMode = process.argv.includes("--check");

/** Repo-relative paths produced by the last emitAll run (for --check diff). */
const generatedPaths = [];

/**
 * Repo-relative directories fully owned by the emit tool — every file inside
 * is generator output. `--check` walks these to flag stale committed product
 * files the generator no longer produces (compareTrees alone iterates only
 * generated paths, so a vanished product would silently linger on disk).
 * Wrapper roots (`cursor-plugins/<name>`) are appended at emit time for
 * non-plugin-root plugins.
 */
const productRoots = [
  ".claude-plugin",
  ".cursor-plugin",
  "packages/osuperpowers/.claude-plugin",
  "packages/osuperpowers/.cursor-plugin",
  "packages/osuperpowers/.codex-plugin",
  "packages/osuperpowers/.kimi-plugin",
  "packages/osuperpowers/.qoder-plugin",
  "packages/osuperpowers/hooks",
  "packages/osuperpowers/.agents",
  "packages/osuperpowers-router/.claude-plugin",
  "packages/osuperpowers-router/.cursor-plugin",
  "packages/osuperpowers-router/.codex-plugin",
  "packages/osuperpowers-router/hooks",
  "packages/osuperpowers-router/bin",
  "packages/osuperpowers-router/build/generated",
];

/** Standalone repo-relative product files (not inside a product root). */
const productFiles = [
  "marketplace/source.json",
  "packages/osuperpowers/gemini-extension.json",
  "packages/osuperpowers/GEMINI.md",
];

function writeText(outRoot, rel, content) {
  const p = join(outRoot, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  generatedPaths.push(rel);
}

function writeJsonDoc(outRoot, rel, data) {
  writeText(outRoot, rel, JSON.stringify(data, null, 2) + "\n");
}

function readJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

// ---------------------------------------------------------------------------
// osuperpowers
// ---------------------------------------------------------------------------

function emitOsEngineering(outRoot, plugin) {
  const version = resolveVersion(root, plugin).version;
  const contentRoot = plugin.contentRoot;
  const pluginDir = join(root, contentRoot);

  // Canonical skills list (12 emitters + os-init).
  const skillsDir = join(pluginDir, "skills");
  const skillNames = readdirSync(skillsDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() && existsSync(join(skillsDir, d.name, "SKILL.md")),
    )
    .map((d) => d.name)
    .sort();

  writeJsonDoc(
    outRoot,
    `${contentRoot}/.claude-plugin/plugin.json`,
    claudePluginManifest(plugin, version),
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/.cursor-plugin/plugin.json`,
    cursorPluginManifest(plugin, version),
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/.codex-plugin/plugin.json`,
    codexPluginManifest(plugin, version),
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/.qoder-plugin/plugin.json`,
    qoderPluginManifest(plugin, version),
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/.kimi-plugin/plugin.json`,
    kimiPluginManifest(plugin, version),
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/gemini-extension.json`,
    geminiExtension(plugin, version),
  );
  writeText(
    outRoot,
    `${contentRoot}/GEMINI.md`,
    geminiMarkdown(plugin, skillNames),
  );
  // Per-harness hooks written at the paths named by `oscaner-plugin.hooks`
  // (claude → hooks/hooks.json, cursor → hooks/hooks-cursor.json). The mapping
  // is the single SOT — adding a harness mapping here produces its hooks file.
  for (const [harness, rel] of Object.entries(plugin.hooks ?? {})) {
    writeJsonDoc(
      outRoot,
      `${contentRoot}/${rel.replace(/^\.\//, "")}`,
      engineeringHooksFor(harness),
    );
  }

  emitAgentsSkillsCopy(outRoot, contentRoot);

  // I3 guard: generated hooks commands must resolve to real adapter files
  // (runs in write + --check modes; fail loud on a missing adapter).
  assertAdapterPathsExist(plugin, pluginDir, version);
}

/**
 * Shared `.agents/skills/` copy for codex/gemini/pi/qoder/opencode scanners.
 * Contains ONLY the engineering skills namespace — upstream superpowers
 * skills are NOT vendored (os-* Read Upstream is a when-available enhancement).
 */
function emitAgentsSkillsCopy(outRoot, contentRoot) {
  const outAgents = join(outRoot, contentRoot, ".agents", "skills");
  const namespaces = [
    ["engineering", join(root, "packages/osuperpowers/skills")],
  ];
  // Prune stale namespace dirs (deleted source, or a namespace no longer
  // emitted) before re-copying, so a skill removed from skills/ can't linger
  // in the committed .agents/skills/ tree and escape the --check diff.
  pruneStaleAgentsNamespaces(outAgents, namespaces);
  // Re-copy each namespace from source so deletions inside a skill dir also
  // disappear (cpSync alone merges and would leave stale files behind).
  for (const [ns, sourceRoot] of namespaces) {
    if (!existsSync(sourceRoot)) continue;
    const dest = join(outAgents, ns);
    rmSync(dest, { recursive: true, force: true });
    cpSync(sourceRoot, dest, { recursive: true });
  }
  collectTree(outAgents, `${contentRoot}/.agents/skills`);
}

function collectTree(absDir, relPrefix) {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const abs = join(absDir, entry.name);
    const rel = `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      collectTree(abs, rel);
    } else {
      generatedPaths.push(rel);
    }
  }
}

// ---------------------------------------------------------------------------
// osuperpowers-router
// ---------------------------------------------------------------------------

function emitOverrides(outRoot, plugin) {
  const contentRoot = plugin.contentRoot;
  const pluginDir = join(root, contentRoot);
  const targets = loadTargets(join(pluginDir, "overrides.manifest.json"));
  const pkg = JSON.parse(
    readFileSync(join(pluginDir, "package.json"), "utf8"),
  );
  const version = pkg.version;
  // Manifest `name` is the plugin name (osuperpowers-router), NOT the npm
  // package name (@oscaner-skills/osuperpowers-router) — the plugin name is
  // what marketplace install/resolve uses.
  const meta = {
    name: plugin.name,
    description: pkg.description,
    author: pkg.author,
    license: pkg.license,
  };

  writeJsonDoc(
    outRoot,
    `${contentRoot}/.claude-plugin/plugin.json`,
    claudePluginManifest(plugin, version, { noSkills: true }),
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/.cursor-plugin/plugin.json`,
    overridesCursorManifest(meta, version, plugin.hooks),
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/.codex-plugin/plugin.json`,
    overridesCodexManifest(meta, version),
  );
  // Per-harness hooks written at the paths named by `oscaner-plugin.hooks`
  // (claude → hooks/hooks.json router, cursor → hooks/hooks-cursor.json
  // detect/enforce). The mapping is the single SOT — adding a harness mapping
  // here produces its hooks file.
  for (const [harness, rel] of Object.entries(plugin.hooks ?? {})) {
    writeJsonDoc(
      outRoot,
      `${contentRoot}/${rel.replace(/^\.\//, "")}`,
      overridesHooksFor(harness, targets),
    );
  }

  const binScripts = [
    [
      "bin/prompt-expansion.mjs",
      promptExpansionScript(targets),
    ],
    [
      "bin/pi-router.ts",
      piRouterScript(targets),
    ],
    [
      "bin/cursor-detect.mjs",
      cursorDetectScript(
        targets,
        readFileSync(join(root, "scripts/templates/cursor-detect.mjs"), "utf8"),
      ),
    ],
    [
      "bin/cursor-enforce.mjs",
      cursorEnforceScript(
        targets,
        readFileSync(join(root, "scripts/templates/cursor-enforce.mjs"), "utf8"),
      ),
    ],
  ];
  for (const [rel, content] of binScripts) {
    writeText(outRoot, `${contentRoot}/${rel}`, content);
    if (outRoot === root) chmodSync(join(outRoot, contentRoot, rel), 0o755);
  }

  writeText(
    outRoot,
    `${contentRoot}/build/generated/claude-self-check.md`,
    claudeSelfCheckMd(
      targets,
      version,
      readFileSync(join(pluginDir, "build/templates/claude-self-check.md"), "utf8"),
    ),
  );
  writeText(
    outRoot,
    `${contentRoot}/build/generated/cursor-self-check.mdc`,
    cursorSelfCheckMdc(
      targets,
      version,
      readFileSync(join(pluginDir, "build/templates/self-check.mdc"), "utf8"),
    ),
  );
}

// ---------------------------------------------------------------------------
// Marketplace documents (repo root) + cursor wrappers
// ---------------------------------------------------------------------------

function emitMarketplaceDocs(outRoot, source) {
  const claudePlugins = [];
  const cursorMarketplacePlugins = [];

  for (const plugin of source.plugins) {
    const resolved = resolveVersion(root, plugin);
    assertCursorPathsExist(root, plugin);

    claudePlugins.push(claudeMarketplaceEntry(plugin, resolved));
    cursorMarketplacePlugins.push({
      _generated: generatedBanner,
      name: plugin.name,
      source: isPluginRoot(plugin)
        ? `./${plugin.contentRoot}`
        : `cursor-plugins/${plugin.name}`,
      description: plugin.description,
    });

    if (!isPluginRoot(plugin)) {
      productRoots.push(`cursor-plugins/${plugin.name}`);
      writeJsonDoc(
        outRoot,
        `cursor-plugins/${plugin.name}/.cursor-plugin/plugin.json`,
        cursorWrapperManifest(plugin, resolved),
      );
    }
  }

  writeJsonDoc(
    outRoot,
    ".claude-plugin/marketplace.json",
    claudeMarketplaceDocument(source, claudePlugins),
  );
  writeJsonDoc(
    outRoot,
    ".cursor-plugin/marketplace.json",
    cursorMarketplaceDocument(source, cursorMarketplacePlugins),
  );
}

// ---------------------------------------------------------------------------
// Version consistency (mimic superpowers .version-bump.json)
// ---------------------------------------------------------------------------

function assertVersionBump() {
  const plugin = "packages/osuperpowers";
  const bumpPath = join(root, plugin, ".version-bump.json");
  if (!existsSync(bumpPath)) return;
  const bump = JSON.parse(readFileSync(bumpPath, "utf8"));
  const pkgVersion = readJson("packages/osuperpowers/package.json").version;
  for (const f of bump.files) {
    const abs = join(root, plugin, f.path);
    if (!existsSync(abs)) continue; // not materialized on disk — checked via --check diff
    const doc = JSON.parse(readFileSync(abs, "utf8"));
    const val = f.field.split(".").reduce((o, k) => o?.[k], doc);
    if (val !== pkgVersion) {
      throw new Error(
        `version drift: ${plugin}/${f.path} ${val} != ${pkgVersion} (run pnpm run emit)`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function emitAll(outRoot) {
  const source = deriveSource(root);
  assertPrereleasePrefix(root, source);

  for (const plugin of source.plugins) {
    if (plugin.name === "osuperpowers-router") emitOverrides(outRoot, plugin);
    if (plugin.name === "osuperpowers") emitOsEngineering(outRoot, plugin);
  }

  emitMarketplaceDocs(outRoot, source);

  // source.json is itself a derived emit product (package-as-source).
  writeJsonDoc(outRoot, "marketplace/source.json", source);

  // osuperpowers no longer uses the cursor wrapper — the wrapper must be gone.
  const staleWrapper = join(outRoot, "cursor-plugins/engineering");
  if (existsSync(staleWrapper)) {
    throw new Error(
      `stale cursor wrapper: cursor-plugins/engineering/ must be deleted (plugin-root emit)`,
    );
  }
}

function compareTrees(generatedRoot) {
  const generatedSet = new Set(generatedPaths);
  for (const rel of generatedPaths) {
    const committed = join(root, rel);
    const generated = join(generatedRoot, rel);
    if (!existsSync(committed)) {
      console.error(`MISSING committed file: ${rel} — run pnpm run emit`);
      process.exit(1);
    }
    if (!existsSync(generated)) {
      console.error(`MISSING generated file: ${rel}`);
      process.exit(1);
    }
    try {
      execSync(`diff -u "${committed}" "${generated}"`, { stdio: "pipe" });
    } catch (e) {
      console.error(`DRIFT: ${rel}\n${e.stdout?.toString() ?? ""}`);
      process.exit(1);
    }
  }
  const stale = findStaleCommittedFiles({
    generatedSet,
    productRoots,
    productFiles,
    extraStale: ["cursor-plugins/engineering/"],
    root,
  });
  if (stale.length > 0) {
    console.error(
      "STALE committed product file(s) — generator no longer produces them (delete):",
    );
    for (const rel of stale) console.error(`  ${rel}`);
    process.exit(1);
  }
  assertVersionBump();
  console.log("OK — emit fresh");
}

if (checkMode) {
  const tempRoot = mkdtempSync(join(tmpdir(), "oscaner-emit-"));
  try {
    emitAll(tempRoot);
    compareTrees(tempRoot);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
} else {
  emitAll(root);
  console.log("OK — emitted unified first-party manifests");
}
