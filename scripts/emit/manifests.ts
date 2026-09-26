/**
 * Generic first-party per-harness manifest builders — the ManifestService domain service
 * (Task 9, Criterion ②: stateless service, zero bare-function module). Given a plugin descriptor
 * (a row from marketplace/source.json) and a resolved version, they return the document for a
 * single harness. The unified emit dispatcher (`scripts/run.ts emit`) writes them into each
 * first-party plugin directory. "Thin manifest" means every harness manifest points at the
 * canonical `./skills/` tree — no per-harness copies of the skill bodies.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const generatedBanner = "scripts/run.ts emit — do not edit";

export class ManifestService {
  /**
   * Derive first-party plugin package names from `packages/*` dirs whose
   * package.json carries the `oscaner-plugin` field (package-as-source). The
   * hand-maintained enum is gone — adding a package dir auto-joins the emit.
   * Sorted for deterministic output.
   * @param {string} packagesRoot repo-relative path to the packages/ dir
   */
  deriveFirstPartyNames(packagesRoot): string[] {
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

  /**
   * `.claude-plugin/plugin.json` — Claude Code manifest. Thin: skills/ points at
   * the canonical dir. `noSkills` omits the `skills` field for the overrides
   * trigger router, which ships no skill bodies (osuperpowers keeps
   * `skills: "./skills/"`).
   */
  claudePluginManifest(plugin, version, { noSkills = false } = {}) {
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
  cursorPluginManifest(plugin, version) {
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
}

export const manifestService = new ManifestService();

function keywords(plugin) {
  return plugin.claude?.keywords ?? plugin.claude?.tags ?? [];
}
