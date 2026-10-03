/**
 * ManifestService — the per-harness manifest builders moved into the harness
 * registry (scripts/lib/harness-registry.ts: ClaudeHarness.manifest /
 * CursorHarness.manifest / PiHarness — each harness owns its own manifest or
 * product, skipping the old builder + keyword fallback chain wholesale). This
 * service keeps the two remaining emit-side surfaces: the `generatedBanner`
 * watermark re-export (canonical literal lives in scripts/lib/generated-banner.ts)
 * and the `deriveFirstPartyNames` delegate (package discovery — a repo concern,
 * not a harness one, so it stays delegated from scripts/lib/first-party.ts).
 */

import { deriveFirstPartyNames as firstPartyNames } from "../lib/first-party.ts";

export { generatedBanner } from "../lib/generated-banner.ts";

export class ManifestService {
  /**
   * Derive first-party plugin package names from `packages/*` dirs whose
   * package.json carries the `oscaner` field (package-as-source). Delegates to
   * the shared lib discovery (scripts/lib/first-party.ts) — package discovery is
   * a repo concern, not a harness one, and the declare-side read must reach the
   * same `oscaner` gate as every other consumer.
   * @param {string} packagesRoot repo-relative path to the packages/ dir
   */
  deriveFirstPartyNames(packagesRoot: string): string[] {
    return firstPartyNames(packagesRoot);
  }
}

export const manifestService = new ManifestService();
