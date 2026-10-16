// scripts/lib/version-sync.ts — the package version sync audit step (P5 T8): every
// kairos version-carrying surface equal to the package.json SOT — the source.json
// plugin row, the claude-plugin marketplace entry (the .cursor-plugin marketplace
// carries no version row) and every `.version-bump.json` `files[]` field — plus the
// cdd-engine version format. The audit is a pure consumer of the tree:
// `.version-bump.json` is the audit configuration (consumed, never a generation
// product — the emit orchestrator never writes it), so a version drift fails the
// step with the `run the emit orchestrator` repair message.
//
// Module-level exports are the class — zero bare functions (the
// zero-bare-function discipline; every check is a static member).

import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../emit.ts";

/** The version format every carried package version must match (x.y.z). */
const VERSION_FORMAT = /^\d+\.\d+\.\d+$/;

// biome-ignore lint/complexity/noStaticOnlyClass: the version-sync audit family — the checks are static members (zero-bare-function discipline).
export class VersionSync {
  /** Read + parse a JSON document under the repo root. */
  static readJson(rel: string): Record<string, unknown> {
    return JSON.parse(readFileSync(path.join(REPO_ROOT, rel), "utf8")) as Record<string, unknown>;
  }

  /** The carried version of one package — the strict x.y.z format or the step fails. */
  static carriedVersion(rel: string, label: string): string {
    const version = VersionSync.readJson(rel).version;
    if (typeof version !== "string" || !VERSION_FORMAT.test(version)) {
      throw new Error(`Invalid ${label} version format: ${String(version)}`);
    }
    return version;
  }

  /** Run the audit — throws on mismatch, prints the converged pair on pass. */
  static run(): void {
    const kairosVersion = VersionSync.carriedVersion("packages/kairos/package.json", "kairos");
    for (const [rel, label] of [
      ["marketplace/source.json", "source.json kairos"],
      [".claude-plugin/marketplace.json", "marketplace kairos"],
    ] as const) {
      const doc = VersionSync.readJson(rel) as {
        plugins?: Array<{ name: string; version?: unknown }>;
      };
      const version = doc.plugins?.find((plugin) => plugin.name === "kairos")?.version;
      if (version !== kairosVersion) {
        throw new Error(
          `kairos version mismatch: package.json ${kairosVersion} · ${label} ${String(version)}`,
        );
      }
    }
    const bump = VersionSync.readJson("packages/kairos/.version-bump.json") as {
      files?: Array<{ path: string; field: string }>;
    };
    for (const entry of bump.files ?? []) {
      const doc = VersionSync.readJson(path.join("packages", "kairos", entry.path)) as unknown;
      const value = entry.field
        .split(".")
        .reduce(
          (node: unknown, key: string) => (node as Record<string, unknown> | undefined)?.[key],
          doc,
        );
      if (value !== kairosVersion) {
        throw new Error(
          `kairos ${entry.path} ${String(value)} != ${kairosVersion} — run the emit orchestrator`,
        );
      }
    }
    const engineVersion = VersionSync.carriedVersion(
      "packages/cdd-engine/package.json",
      "cdd-engine",
    );
    console.log(`OK — kairos ${kairosVersion} · cdd-engine ${engineVersion}`);
  }
}
