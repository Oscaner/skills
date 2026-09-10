/**
 * Generic first-party per-harness manifest builders.
 *
 * These are pure functions: given a plugin descriptor (a row from
 * marketplace/source.json) and a resolved version, they return the document
 * for a single harness. The unified emit dispatcher (`scripts/run.mjs emit`)
 * writes them into each first-party plugin directory. "Thin manifest" means
 * every harness manifest points at the canonical `./skills/` tree — no
 * per-harness copies of the skill bodies (the one exception is the shared
 * `.agents/skills/` copy, which is handled by the emit orchestrator, not here).
 */

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const generatedBanner = "scripts/run.mjs emit — do not edit";

/**
 * Derive first-party plugin package names from `packages/*` dirs whose
 * package.json carries the `oscaner-plugin` field (package-as-source). The
 * hand-maintained enum is gone — adding a package dir auto-joins the emit.
 * Sorted for deterministic output.
 * @param {string} packagesRoot repo-relative path to the packages/ dir
 */
export function deriveFirstPartyNames(packagesRoot) {
  if (!existsSync(packagesRoot)) return [];
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      const pkgPath = join(packagesRoot, name, "package.json");
      if (!existsSync(pkgPath)) return false;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      return Boolean(pkg["oscaner-plugin"]);
    })
    .sort();
}

/** osuperpowers has no bundled assets — interface omits icon/logo paths. */
const DEFAULT_REPO_URL = "https://github.com/Oscaner/skills";

function keywords(plugin) {
  return plugin.claude?.keywords ?? plugin.claude?.tags ?? [];
}

/**
 * `.claude-plugin/plugin.json` — Claude Code manifest. Grok reuses this file
 * (no separate grok emit). Thin: skills/ points at the canonical dir.
 * `noSkills` omits the `skills` field for the overrides trigger router, which
 * ships no skill bodies ( osuperpowers keeps `skills: "./skills/"`).
 */
export function claudePluginManifest(plugin, version, { noSkills = false } = {}) {
  const m = {
    _generated: generatedBanner,
    name: plugin.name,
    description: plugin.description,
    version,
    author: plugin.author,
  };
  if (!noSkills) m.skills = "./skills/";
  // Claude Code auto-loads <pluginRoot>/hooks/hooks.json as the standard hooks
  // file, so manifest.hooks may only name *additional* hook files — referencing
  // the canonical file makes plugin load fail with "Duplicate hooks file
  // detected". The canonical default is therefore omitted; a non-default
  // `oscaner-plugin.hooks.claude` (an extra hook file) is still emitted.
  const claudeHooks = plugin.hooks?.claude ?? "./hooks/hooks.json";
  if (claudeHooks !== "./hooks/hooks.json") m.hooks = claudeHooks;
  if (plugin.license) m.license = plugin.license;
  if (plugin.claude?.category) m.category = plugin.claude.category;
  const kw = keywords(plugin);
  if (kw.length) m.keywords = kw;
  return m;
}

/** `.cursor-plugin/plugin.json` — thin manifest, no per-harness skill copy. */
export function cursorPluginManifest(plugin, version) {
  const m = {
    _generated: generatedBanner,
    name: plugin.name,
    displayName: plugin.cursor?.displayName ?? plugin.name,
    description: plugin.description,
    version,
    author: plugin.author,
  };
  if (plugin.license) m.license = plugin.license;
  const kw = keywords(plugin);
  if (kw.length) m.keywords = kw;
  m.skills = "./skills/";
  return m;
}

/**
 * `.qoder-plugin/plugin.json` — Qoder plugin manifest (Claude-mirror plugin).
 * Completes the sibling shape: skills（manifest-relative base：`../skills/` → 包根
 * skills/）。
 */
export function qoderPluginManifest(plugin, version) {
  const m = {
    _generated: generatedBanner,
    name: plugin.name,
    version,
    description: plugin.description,
  };
  if (plugin.author) m.author = plugin.author;
  if (plugin.license) m.license = plugin.license;
  const kw = keywords(plugin);
  if (kw.length) m.keywords = kw;
  m.skills = "../skills/";
  return m;
}

/** `.codex-plugin/plugin.json` — skills + interface. */
export function codexPluginManifest(plugin, version) {
  const m = {
    _generated: generatedBanner,
    name: plugin.name,
    version,
    description: plugin.description,
    author: plugin.author,
  };
  if (plugin.license) m.license = plugin.license;
  const kw = keywords(plugin);
  if (kw.length) m.keywords = kw;
  // codex 插件统一 manifest-relative base：manifest 位于 `.codex-plugin/`，故
  // `../skills/` → 包根 skills/。
  m.skills = "../skills/";
  m.interface = codexInterface(plugin);
  return m;
}

/**
 * `package.json#pi` — Pi key for both vendored assemblies and first-party plugins.
 * Pi packages support a `package.json` `pi` key (skills/prompts/themes delivery
 * via `pi install`). First-party emit passes `{ skills, extensions }` explicitly;
 * vendored assemblies use the default pure-skills shape.
 * @param {{ skills?: string[], extensions?: string[] }} [opts]
 */
export function piPackageKey({ skills = ["./skills"], extensions = [] } = {}) {
  const key = { skills };
  if (extensions.length > 0) key.extensions = extensions;
  return key;
}

function codexInterface(plugin) {
  return {
    displayName: plugin.cursor?.displayName ?? plugin.name,
    shortDescription: plugin.description,
    longDescription: plugin.description,
    developerName: plugin.author?.name ?? plugin.name,
    category: "Developer Tools",
    capabilities: ["Interactive", "Read", "Write"],
    defaultPrompt: [
      "I've got an idea for something I'd like to build.",
      "Let's add a feature to this project.",
    ],
    websiteURL: DEFAULT_REPO_URL,
  };
}
