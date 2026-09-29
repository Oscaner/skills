// scripts/lib/first-party.ts — first-party package discovery (pi-harness-p2 T2).
// Package discovery is a repo concern, not a harness one, so deriveFirstPartyNames
// lives as its own lib module (spec C2 responsibility split): the emit toolchain
// consumes it through the ManifestService delegation (scripts/emit/manifests.ts),
// and future consumers (the validate wiring guard) read the same shared declaration
// set from scripts/lib.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Derive first-party plugin package names from `packages/*` dirs whose
 * package.json carries the `oscaner` field (package-as-source). The hand-maintained
 * enum is gone — adding a package dir auto-joins the emit. Sorted for
 * deterministic output.
 * @param {string} packagesRoot repo-relative path to the packages/ dir
 */
export function deriveFirstPartyNames(packagesRoot): string[] {
  if (!existsSync(packagesRoot)) return [];
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      const pkgPath = join(packagesRoot, name, "package.json");
      if (!existsSync(pkgPath)) return false;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      return Boolean(pkg.oscaner);
    })
    .sort();
}
