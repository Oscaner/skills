// scripts-next/lib/first-party.ts — first-party package discovery (package-as-source).
// The emit orchestrator derives `marketplace/source.json` from every `packages/*` dir
// whose package.json carries the `oscaner` field — ONE discovery gate shared by the
// emit + validate faces. The single-source rule: a package joins the marketplace by
// declaring `oscaner`, and any consumer of the first-party set passes through here.
//
// Module-level exports are types / the declared data + one discovery function — the
// plan's zero-bare-function discipline admits pure read services.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** The first-party package `package.json#oscaner` surface the emit derives from. */
export interface OscanerFields {
  contentRoot?: string;
  harnesses?: string[];
  keywords?: string[];
  claude?: { category?: string; keywords?: string[]; displayName?: string };
  hooks?: { claude?: string };
}

/** The first-party plugin source row — the emit's per-plugin derivation target. */
export interface PluginSource {
  name: string;
  contentRoot: string;
  version?: string;
  description?: string;
  author?: { name: string; email?: string } | string;
  homepage?: string;
  repository?: string;
  license?: string;
  cursor?: { emitMode?: string } | { displayName?: string; skills?: string; hooks?: string };
  claude?: { category?: string; keywords?: string[] };
  hooks?: { claude?: string };
}

/**
 * Derive the first-party plugin package names — the directories under `packages/`
 * whose package.json carries the `oscaner` field (the marketplace's membership
 * gate). Never a second literal list.
 */
export function firstPartyNames(packagesRoot: string): string[] {
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      try {
        const pkg = JSON.parse(
          readFileSync(path.join(packagesRoot, entry.name, "package.json"), "utf8"),
        ) as { oscaner?: unknown };
        return pkg.oscaner !== undefined;
      } catch {
        return false;
      }
    })
    .map((entry) => entry.name)
    .sort();
}
