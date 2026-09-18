/**
 * osuperpowers emit — per-harness thin manifests (.claude-plugin / .cursor-plugin).
 *
 * `generatedPaths` records every repo-relative path produced (the emit-check
 * drift diff input); all writers are passed in, no module-level state.
 */

import { readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVersion } from "../lib/marketplace-utils.mjs";
import { claudePluginManifest, cursorPluginManifest } from "./manifests.mjs";
import { writeJsonDoc } from "./orchestrate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function emitOsuperpowers(outRoot, plugin, generatedPaths) {
  const version = resolveVersion(root, plugin).version;
  const contentRoot = plugin.contentRoot;

  // Canonical skills list (directory-discovered — no count kept here; the count is asserted
  // once, in scripts/validate/osuperpowers.mjs EXPECTED/EMITTERS_LABEL).
  const skillsDir = join(root, contentRoot, "skills");
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
}