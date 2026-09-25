/**
 * osuperpowers emit — per-harness thin manifests (.claude-plugin / .cursor-plugin).
 *
 * `generatedPaths` records every repo-relative path produced (the emit-check
 * drift diff input); all writers are passed in, no module-level state.
 */

import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVersion } from "../lib/marketplace-utils.ts";
import { claudePluginManifest, cursorPluginManifest } from "./manifests.ts";
import { writeJsonDoc } from "./orchestrate.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function emitOsuperpowers(outRoot, plugin, generatedPaths) {
  const version = resolveVersion(root, plugin).version;
  const contentRoot = plugin.contentRoot;

  // Canonical skills list (directory-discovered — no count kept here; the count is asserted
  // once, in scripts/validate/osuperpowers.ts EXPECTED/EMITTERS_LABEL).
  const skillsDir = join(root, contentRoot, "skills");
  const _skillNames = readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(skillsDir, d.name, "SKILL.md")))
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
}
