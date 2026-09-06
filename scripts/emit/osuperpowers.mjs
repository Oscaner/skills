/**
 * osuperpowers emit — per-harness thin manifests + PreToolUse gate hooks +
 * shared `.agents/skills/` copy.
 *
 * `generatedPaths` records every repo-relative path produced (the emit-check
 * drift diff input); all writers are passed in, no module-level state.
 */

import { readdirSync, existsSync, rmSync, cpSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "tinyglobby";
import { resolveVersion } from "../lib/marketplace-utils.mjs";
import {
  claudePluginManifest,
  cursorPluginManifest,
  codexPluginManifest,
  kimiPluginManifest,
  geminiExtension,
  geminiMarkdown,
  osuperpowersHooksFor,
  qoderPluginManifest,
  assertAdapterPathsExist,
} from "./manifests.mjs";
import {
  writeJsonDoc,
  writeText,
  pruneStaleAgentsNamespaces,
} from "./orchestrate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Recursively collect absolute paths of every file under `dir`
 * (`dot: true` — the shared copy target lives in the hidden `.agents/` tree).
 */
export function collectTree(dir) {
  return globSync("**/*", { cwd: dir, absolute: true, dot: true });
}

export function emitOsuperpowers(outRoot, plugin, generatedPaths) {
  const version = resolveVersion(root, plugin).version;
  const contentRoot = plugin.contentRoot;
  const pluginDir = join(root, contentRoot);

  // Canonical skills list (12 emitters + init).
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
    generatedPaths,
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/.cursor-plugin/plugin.json`,
    cursorPluginManifest(plugin, version),
    generatedPaths,
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/.codex-plugin/plugin.json`,
    codexPluginManifest(plugin, version),
    generatedPaths,
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/.qoder-plugin/plugin.json`,
    qoderPluginManifest(plugin, version),
    generatedPaths,
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/.kimi-plugin/plugin.json`,
    kimiPluginManifest(plugin, version),
    generatedPaths,
  );
  writeJsonDoc(
    outRoot,
    `${contentRoot}/gemini-extension.json`,
    geminiExtension(plugin, version),
    generatedPaths,
  );
  writeText(
    outRoot,
    `${contentRoot}/GEMINI.md`,
    geminiMarkdown(plugin, skillNames),
    generatedPaths,
  );
  // Per-harness hooks written at the paths named by `oscaner-plugin.hooks`
  // (claude → hooks/hooks.json, cursor → hooks/hooks-cursor.json). The mapping
  // is the single SOT — adding a harness mapping here produces its hooks file.
  for (const [harness, rel] of Object.entries(plugin.hooks ?? {})) {
    writeJsonDoc(
      outRoot,
      `${contentRoot}/${rel.replace(/^\.\//, "")}`,
      osuperpowersHooksFor(harness),
      generatedPaths,
    );
  }

  emitAgentsSkillsCopy(outRoot, contentRoot, generatedPaths);

  // I3 guard: generated hooks commands must resolve to real adapter files
  // (runs in write + --check modes; fail loud on a missing adapter).
  assertAdapterPathsExist(plugin, pluginDir, version);
}

/**
 * Shared `.agents/skills/` copy for codex/gemini/pi/qoder/opencode scanners.
 * Contains ONLY the osuperpowers skills namespace — upstream superpowers
 * skills are NOT vendored (osuperpowers Read Upstream is a when-available enhancement).
 */
export function emitAgentsSkillsCopy(outRoot, contentRoot, generatedPaths) {
  const outAgents = join(outRoot, contentRoot, ".agents", "skills");
  const namespaces = [
    ["osuperpowers", join(root, "packages/osuperpowers/skills")],
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
  // Record every copied file so the drift diff sees the hidden `.agents/` tree.
  for (const abs of collectTree(outAgents)) {
    generatedPaths.push(`${contentRoot}/.agents/skills/${relative(outAgents, abs)}`);
  }
}