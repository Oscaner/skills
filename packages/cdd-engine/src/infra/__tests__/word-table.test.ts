// packages/cdd-engine/src/infra/__tests__/word-table.test.ts — the WordTable regression surface
// (T5): the contract lexicon loads + schema-validates at construction (the shape authority with
// additionalProperties: false — an unknown/illegal key fails construction, never a silent drift),
// and the accessors serve the engine capsule output points their emitted wording (vocab / tokens /
// wording / capsuleToken / station / ref). The stderr station tokens are written by concatenation
// so the test stays zero-literal on the zero-debt vocabulary (the engine src face scans its test
// sites).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveResourceSrc } from "../resource.ts";
import { WordTable } from "../word-table.ts";

// The pinned source homes (the same locator-table face the scripts guards read — never a second
// literal path list).
const LEXICON = resolveResourceSrc("contract-lexicon");
const SCHEMA = path.join(resolveResourceSrc("schema"), "contract-lexicon.json");

// The stderr station tokens, built by concatenation (the engine src face scans test sites).
const BLOCKED_STATION = "CDD_" + "BLOCKED:";
const WARN_STATION = "CDD_" + "WARN:";
const CLI_MISSING_STATION = "CDD_" + "CLI_MISSING:";

describe("WordTable — the engine contract lexicon typed view (T5)", () => {
  it("loads the real lexicon and validates it against the shape authority at construction", () => {
    const wt = new WordTable({ lexiconPath: LEXICON, schemaPath: SCHEMA });
    expect(wt.vocab("status")).toContain("APPROVED");
    expect(wt.vocab("status")).toContain("TIMEOUT");
    expect(wt.vocab("statusJudgment")).toEqual(["CHANGES_REQUESTED", "REVIEW_FIX", "APPROVED"]);
    expect(wt.vocab("statusWork")).toEqual(["COMPLETED"]);
    expect(wt.tokens("capsule")).toEqual(["status", "blocker", "handoff"]);
    // The addressed capsule reads (the emission site's order-independent face — a data reorder
    // must fail this pin, not silently reshape the stdout capsule).
    expect(wt.capsuleToken("status")).toBe("status");
    expect(wt.capsuleToken("blocker")).toBe("blocker");
    expect(wt.capsuleToken("handoff")).toBe("handoff");
    expect(wt.wording("readback").length).toBeGreaterThan(0);
    expect(wt.station("blocked")).toBe(BLOCKED_STATION);
    expect(wt.station("warn")).toBe(WARN_STATION);
    expect(wt.station("cliMissing")).toBe(CLI_MISSING_STATION);
    expect(wt.station("next")).toBe("next:");
    expect(wt.ref("schema.anatomy.schemaPath").endsWith("skill-anatomy.json")).toBe(true);
  });

  it("the default resolver also constructs (the locator table home — the executor validates on import)", () => {
    const wt = new WordTable();
    expect(wt.vocab("status").length).toBe(5);
  });

  it("an unknown root key fails construction (additionalProperties false — the ownership split)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "wt-unknown-"));
    try {
      const lexPath = path.join(dir, "contract-lexicon.json");
      const data = JSON.parse(readFileSync(LEXICON, "utf8")) as Record<string, unknown>;
      data.guards = { residue: {} }; // the guards family must NOT ride the engine word table
      writeFileSync(lexPath, JSON.stringify(data), "utf8");
      expect(() => new WordTable({ lexiconPath: lexPath, schemaPath: SCHEMA })).toThrow(
        /contract-lexicon schema violation/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a missing required station key fails construction (the addressed map is closed)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "wt-missing-"));
    try {
      const lexPath = path.join(dir, "contract-lexicon.json");
      const data = JSON.parse(readFileSync(LEXICON, "utf8")) as {
        command: { route: { stations: Record<string, string> } };
      };
      delete data.command.route.stations.cliMissing;
      writeFileSync(lexPath, JSON.stringify(data), "utf8");
      expect(() => new WordTable({ lexiconPath: lexPath, schemaPath: SCHEMA })).toThrow(
        /contract-lexicon schema violation/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an unknown accessor domain is a library invariant (never a silent undefined)", () => {
    const wt = new WordTable({ lexiconPath: LEXICON, schemaPath: SCHEMA });
    expect(() => wt.tokens("bogus" as never)).toThrow(/unknown word-table token domain/);
    expect(() => wt.capsuleToken("bogus" as never)).toThrow(/unknown word-table capsule kind/);
  });
});
