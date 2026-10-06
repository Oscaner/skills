// packages/cdd-engine/src/documents/doctypes/__tests__/shipped-description-surface.test.ts — T9 2b
// the shipped description surface zero-program-history grep pin (plan §T9 step 2b · overall-v1.7
// ruling). The consumer-facing description plane — schema `description` values (config/schema/*.json)
// + the body-plane doc comments (src/documents/doctypes/body/*.ts) — states semantics only: zero
// lifecycle / program-history vocabulary. Banned phrase set (verbatim grep, comments included):
// `extension bit` / `declared surface` / `zero read/write` / `P<digits> (edge-model|extension)`. A
// bare `P<digits>` phase-id token stays legal (the phase-id grammar token) — the ban is the compound
// anchor, never `P\d+` as a whole. This file makes the plan's acceptance machine-enforced: a
// re-introduction of a banned phrase fails the engine suite (and thereby `pnpm run validate`)
// instead of passing a manual grep.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(HERE, "..", "..", "..", "..");
const SCHEMA_DIR = path.join(PKG_ROOT, "config", "schema");
const BODY_DIR = path.join(PKG_ROOT, "src", "documents", "doctypes", "body");

/** The verbatim banned phrases (the plan's T9 2b list — lifecycle / status words). */
const BANNED_PHRASES = ["extension bit", "declared surface", "zero read/write"] as const;

/** The compound phase-anchor ban — `P<digits> edge-model` / `P<digits> extension`. A bare
 *  `P<digits>` phase-id token (P1 / P2.1 / P2.1-design) is exempt: the ban never covers `P\d+`
 *  as a whole. */
const PHASE_ANCHOR = /P\d+ (?:edge-model|extension)/;

function bannedHits(text: string): string[] {
  const hits: string[] = [];
  for (const phrase of BANNED_PHRASES) {
    if (text.includes(phrase)) hits.push(`"${phrase}"`);
  }
  const match = text.match(PHASE_ANCHOR);
  if (match !== null) hits.push(`phase anchor "${match[0]}"`);
  return hits;
}

/** Every `description` string value in a schema document, in traversal order. */
function schemaDescriptionValues(file: string): string[] {
  const walk = (node: unknown): string[] => {
    if (Array.isArray(node)) return node.flatMap(walk);
    if (node !== null && typeof node === "object") {
      return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        key === "description" && typeof value === "string" ? [value] : walk(value),
      );
    }
    return [];
  };
  return walk(JSON.parse(readFileSync(file, "utf8")) as unknown);
}

describe("shipped description surface — T9 2b zero-program-history grep pin", () => {
  it("schema description values carry zero banned lifecycle vocabulary (config/schema/*.json)", () => {
    const schemaFiles = readdirSync(SCHEMA_DIR)
      .filter((name) => name.endsWith(".json"))
      .sort();
    expect(schemaFiles.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const name of schemaFiles) {
      schemaDescriptionValues(path.join(SCHEMA_DIR, name)).forEach((text, i) => {
        const hits = bannedHits(text);
        if (hits.length > 0)
          failures.push(`config/schema/${name} description #${i}: ${hits.join(", ")}`);
      });
    }
    expect(failures).toEqual([]);
  });

  it("body-plane doc comments carry zero banned lifecycle vocabulary (body/*.ts, verbatim grep incl. comments)", () => {
    const bodyFiles = readdirSync(BODY_DIR)
      .filter((name) => name.endsWith(".ts"))
      .sort();
    expect(bodyFiles.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const name of bodyFiles) {
      const hits = bannedHits(readFileSync(path.join(BODY_DIR, name), "utf8"));
      if (hits.length > 0) failures.push(`body/${name}: ${hits.join(", ")}`);
    }
    expect(failures).toEqual([]);
  });

  it("the ban is the compound anchor — a bare P<digits> phase-id token stays legal (documented exemption)", () => {
    const legal = ["phase P1 handling", "P2.1 -> P2.2", "P2.1-design marker", "P4 claim window"];
    const banned = ["P3 extension", "P2 edge-model", "P1 extension reports"];
    for (const text of legal) expect(bannedHits(text)).toEqual([]);
    for (const text of banned) expect(bannedHits(text).length).toBeGreaterThan(0);
  });
});
