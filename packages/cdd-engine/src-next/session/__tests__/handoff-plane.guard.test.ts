// packages/cdd-engine/src-next/session/__tests__/handoff-plane.guard.test.ts
// The handoff-plane audit (colocated after the D17 six-premise ownership-migration:
// the root guard's checkHandoffPlane assertion face re-homed into the session test
// plane — the engine's own suite holds the engine's own declaration checks). The two
// legs read the engine's single source (`session/handoff-schema.ts` — the projected
// writable subsets + the two projections), never a parallel table:
//
//   ① the plane-distinctive exclusives — the judge exclusive (`findings`) never
//      rides the work projection, the work exclusive (`status`) never rides the judge
//      projection (the SHARED carrier rows — artifacts / notes — are both-plane by
//      design; the exclusives ARE the plane);
//   ② the retired face vocabulary — the live engine surface carries no `"delivery"`
//      face literal (the carrier plane is `work` / `judge`, derived from the op — an
//      op-family table never re-declares it);
//   ③ the prompt-injection projection — `schemaText(plane)` parses byte-identically
//      to the projected node (the projection IS the writable plane — zero
//      engine-only metadata to strip).
//
// Zero module-level bare functions — the read/scan helpers are `const` (the P5
// zero-`function`-declaration discipline).

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { planSourceOf } from "../../__tests__/support/plan-source.ts";
import { stripComments } from "../../__tests__/support/strip-comments.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { HandoffSchema } from "../handoff-schema.ts";
import { Ledger } from "../ledger.ts";
import { ArtifactRegistry } from "../round-artifacts.ts";

describe("the handoff-plane audit — the projected writable subsets (the engine's own declaration checks)", () => {
  it("① the plane-distinctive exclusives — findings never rides work; status never rides judge", () => {
    const schema = new HandoffSchema();
    const work = schema.planeSchema("work");
    const judge = schema.planeSchema("judge");
    expect(work.properties ?? {}).not.toHaveProperty("findings");
    expect(judge.properties ?? {}).not.toHaveProperty("status");
  });

  it("② the live engine surface carries no retired face literal — the carrier plane is `work` / `judge`", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const sources = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.parentPath.includes("__tests__"))
      .map((e) => join(e.parentPath, e.name));
    expect(sources.length).toBeGreaterThan(0);
    const offenders = sources.filter((p) => readFileSync(p, "utf8").includes('"delivery"'));
    expect(offenders).toEqual([]);
  });

  it("③ the prompt-injection projection — the schemaText fence parses to the projected writable subset", () => {
    const schema = new HandoffSchema();
    for (const plane of ["work", "judge"] as const) {
      const text = schema.schemaText(plane, false);
      const fence = text.split("```json\n")[1]?.split("\n```")[0];
      expect(fence, `the ${plane} projection carries a \`\`\`json fence`).toBeDefined();
      if (fence === undefined) continue;
      const parsed = JSON.parse(fence) as unknown;
      expect(parsed, `the ${plane} fence parses to the projected node`).toEqual(
        schema.planeSchema(plane),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// P36 T8 — the legacy spellings are no longer RECOGNIZED (spec §3): five symbol
// families leave the ledger, and the old carriers become observations. The doors
// below run over the production sources (comments stripped — prose may name a retired
// symbol, code may not) and match on symbol boundaries: `#lineWordOf` (an unrelated
// live member of the board) and a comment's example are outside the scan surface.
// ---------------------------------------------------------------------------

describe("P36 T8 — the retired spellings are gone (spec §3)", () => {
  /** `src-next` — the engine's own source plane. */
  const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

  /** Every production source under `src-next` (fixtures are the fixtures' business). */
  const productionSources = (): readonly { readonly path: string; readonly text: string }[] =>
    readdirSync(SRC_ROOT, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .filter((entry) => !entry.parentPath.includes("__tests__"))
      .map((entry) => {
        const path = join(entry.parentPath, entry.name);
        return { path, text: stripComments(readFileSync(path, "utf8")) };
      });

  /** The files whose code carries one symbol — the door's judgment. */
  const carriersOf = (pattern: RegExp): readonly string[] =>
    productionSources()
      .filter((source) => pattern.test(source.text))
      .map((source) => source.path.slice(SRC_ROOT.length + 1));

  it("① the retired row key and its line-word set are gone", () => {
    expect(carriersOf(/RETIRED_SPEC_KEY\b/)).toEqual([]);
    expect(carriersOf(/RETIRED_SPEC_LINE_KEYS\b/)).toEqual([]);
  });

  it("② the retired `spec-<op>-<round>.json` carrier name is gone", () => {
    expect(carriersOf(/#retiredCarrierName\b/)).toEqual([]);
  });

  it("③ the cycle-less implement read rung is gone", () => {
    expect(carriersOf(/#legacyCarrierName\b/)).toEqual([]);
  });

  it("④ the old row-key mapping is gone", () => {
    expect(carriersOf(/#ownerRow\b/)).toEqual([]);
  });

  it("⑤ the retired line-word mapping is gone — and `#lineWordOf` stays outside the boundary", () => {
    expect(carriersOf(/#lineWord\b/)).toEqual([]);
    // the door is not vacuous: the SAME scan surface sees the live sibling member
    expect(carriersOf(/#lineWordOf\b/)).toContain(join("face", "board-view.ts"));
  });

  it("a retired workspace's carriers are observations, never a dispatch refusal", () => {
    const repo = mkdtempSync(join(tmpdir(), "handoff-legacy-"));
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "legacy").ensure();
    try {
      writeFileSync(join(workspace.path, "spec-review-1.json"), "{}\n", "utf8");
      writeFileSync(join(workspace.path, "tasks-1-implement.json"), "{}\n", "utf8");
      const artifacts = new ArtifactRegistry();
      // two DIFFERENT exits (spec §3.3): `spec` is no row word at all, while the
      // cycle-less implement name attributes to a cycle-less `draft` identity
      expect(artifacts.attribute("spec-review-1.json")).toBeNull();
      const attributed = artifacts.attribute("tasks-1-implement.json");
      expect(attributed?.kind).toBe("draft");
      expect(attributed?.identity).toEqual({
        domain: "round",
        line: "tasks-1",
        op: "implement",
      });
      // the cycle-less identity's own rendered name IS the file's name ⇒ `ok`, never
      // `misplaced` (the gate's only blocking arm never fires on it)
      expect(
        artifacts.read({ domain: "round", line: "tasks-1", op: "implement" }, "draft", workspace)
          .kind,
      ).toBe("ok");
      // no progress record claims either file ⇒ both ride the observation face
      const ledger = new Ledger(
        workspace,
        new ConfigLoader(),
        planSourceOf(workspace.root.basis),
        artifacts,
      );
      expect(ledger.orphanHandoffs()).toEqual(["spec-review-1.json", "tasks-1-implement.json"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
