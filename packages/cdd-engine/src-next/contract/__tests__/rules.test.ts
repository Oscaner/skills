// packages/cdd-engine/src-next/contract/__tests__/rules.test.ts
// The rule declaration surface's self-check (P21 §3.1): the registry IS the rule
// list — its row count, its id shape, the one-rule-one-strategy identity between a
// row's id and the created strategy's `name`, and the two scopes' distinct judgment
// entry shapes. A declaration drift must fail here, before any document judgment.

import { describe, expect, it } from "vitest";
import { RULE_REGISTRY } from "../rules.ts";

/** The six public rule ids the phase spec declares (§3.1) — the consumer-facing
 *  face that must be in the registry by name. */
const PUBLIC_RULE_IDS = [
  "change-history-version-unique",
  "front-matter-version-in-lineage",
  "change-history-row-not-in-other-table",
  "list-marker-not-doubled",
  "closed-wave-fits-depends-on-layers",
  "planned-tasks-vs-recorded-tasks",
] as const;

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("RULE_REGISTRY — the declaration surface", () => {
  it("declares 21 rows: 19 doc-scope + 2 ledger-scope", () => {
    const doc = RULE_REGISTRY.filter((declaration) => declaration.scope === "doc");
    const ledger = RULE_REGISTRY.filter((declaration) => declaration.scope === "ledger");
    expect(RULE_REGISTRY).toHaveLength(21);
    expect(doc).toHaveLength(19);
    expect(ledger).toHaveLength(2);
  });

  it("keeps every id unique and kebab-cased", () => {
    const ids = RULE_REGISTRY.map((declaration) => declaration.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(KEBAB);
  });

  it("is one rule = one strategy: the created strategy's name IS the row id", () => {
    for (const declaration of RULE_REGISTRY) {
      const instance = declaration.create();
      expect(instance.name, declaration.id).toBe(declaration.id);
    }
  });

  it("keeps the two scopes' judgment entry shapes distinct (doc 1 arg, ledger 2 args)", () => {
    for (const declaration of RULE_REGISTRY) {
      const instance = declaration.create();
      expect(instance.evaluate.length, declaration.id).toBe(declaration.scope === "doc" ? 1 : 2);
    }
  });

  it("declares a non-empty doc-key set per row, and every ledger row names plan", () => {
    for (const declaration of RULE_REGISTRY) {
      if (declaration.docKeys === "all") continue;
      expect(declaration.docKeys.length, declaration.id).toBeGreaterThan(0);
      if (declaration.scope === "ledger") {
        expect(declaration.docKeys, declaration.id).toContain("plan");
      }
    }
  });

  it("carries the six public rule ids of the phase spec", () => {
    const ids = new Set(RULE_REGISTRY.map((declaration) => declaration.id));
    for (const id of PUBLIC_RULE_IDS) expect(ids.has(id), id).toBe(true);
  });
});
