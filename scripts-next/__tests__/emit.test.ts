// scripts-next/__tests__/emit.test.ts — T14 emit checkables: the emit products are
// byte-identical to the committed emits (the byte check) + the single-orchestrator
// derivation facts (package-as-source).

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emitComparer, emitService, REPO_ROOT } from "../emit.ts";
import { firstPartyNames } from "../lib/first-party.ts";

describe("EmitService — the single emit orchestrator (derivation + byte-check)", () => {
  it("derives the first-party set from the oscaner gate (package-as-source)", () => {
    const names = firstPartyNames(path.join(REPO_ROOT, "packages"));
    expect(names).toContain("kairos");
  });

  it("derives the kairos source row — the plugin-root cursor slot + claude keyword reconciliation", () => {
    const source = emitService.deriveSourceDoc();
    const kairos = source.plugins.find((p) => p.name === "kairos");
    expect(kairos?.contentRoot).toBe("packages/kairos");
    expect(kairos?.cursor).toEqual({ emitMode: "plugin-root" });
    expect(kairos?.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(kairos?.claude).toEqual({
      category: "kairos",
      keywords: ["kairos", "cli", "cdd", "harness"],
    });
  });

  it("emits the full product set byte-identical to the committed emit (the byte check)", () => {
    const generatedPaths: string[] = [];
    const temp = mkdtempSync(path.join(tmpdir(), "scripts-next-emit-"));
    try {
      emitService.emitAll(temp, { generatedPaths });
      // The per-plugin manifests + the repo-root aggregates + the issue forms.
      expect(generatedPaths).toEqual(
        expect.arrayContaining([
          "packages/kairos/.claude-plugin/plugin.json",
          "packages/kairos/.cursor-plugin/plugin.json",
          "marketplace/source.json",
          ".claude-plugin/marketplace.json",
          ".cursor-plugin/marketplace.json",
          ".github/ISSUE_TEMPLATE/bug_report.yml",
          ".github/ISSUE_TEMPLATE/enhancement.yml",
        ]),
      );
      for (const rel of generatedPaths) {
        const committed = readFileSync(path.join(REPO_ROOT, rel), "utf8");
        const generated = readFileSync(path.join(temp, rel), "utf8");
        expect(committed, rel).toBe(generated);
      }
      // The drift comparer itself approves (the emitted set is fresh).
      emitComparer.compareTrees(REPO_ROOT, temp, { generatedPaths });
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("flags a stale committed product the generator no longer produces", () => {
    const stale = emitService.findStaleCommittedFiles(
      new Set(["marketplace/source.json"]),
      REPO_ROOT,
    );
    expect(stale).toContain(".claude-plugin/marketplace.json");
    // A full generated set has no stale members.
    const generatedPaths: string[] = [];
    const temp = mkdtempSync(path.join(tmpdir(), "scripts-next-stale-"));
    try {
      emitService.emitAll(temp, { generatedPaths });
      expect(emitService.findStaleCommittedFiles(new Set(generatedPaths), REPO_ROOT)).toEqual([]);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
