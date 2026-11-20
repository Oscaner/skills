// packages/cdd-engine/src-next/contract/__tests__/rules-severity.test.ts
// P41 T1 — the severity base (design spec §1.3). Three legs, each with its pair:
//
//   · the DECLARED table — every row that PREDATES this phase's shape gate states its
//     tier (`block`) and its closed-document exemption (`false`), on both scopes alike;
//     the six shape rows this phase adds start at `warn` and sit outside that roster,
//     so a later task adding or flipping one never rewrites this file;
//   · the DRAFT/STAMP split — a strategy's `finding()` hands back a draft with no
//     `severity` key, and `Contract.stamped` is the one place the tier is joined to it;
//   · the INJECTED policy — a test rule's declared tier reaches its findings (warn
//     stays warn, block reads block), so the tier is the declaration's fact and never
//     the finding's own, while a malformed body's `doc-syntax` finding stamps its own
//     tier because it is not a declared rule.
//
// The `warn` probe runs on an INJECTED registry and touches no shipped row, so a later
// phase flipping the six shape rows to `block` never rewrites this file.
//
// Zero module-level bare functions — the helpers are `const` (the repository's
// zero-`function`-declaration discipline).

import { describe, expect, it } from "vitest";
import type { FindingDraft, JudgeContext } from "../invariants.ts";
import { Invariant } from "../invariants.ts";
import { Contract } from "../judge.ts";
import { type DocRuleDeclaration, RULE_REGISTRY } from "../rules.ts";

/** A strategy that emits exactly one finding through the base class's `finding()` —
 *  the draft face every real strategy uses. It also keeps the context it was handed,
 *  so the draft arm can re-run it outside the coordinator. */
class ProbeInvariant extends Invariant {
  readonly name = "probe-rule";

  static captured: JudgeContext | undefined;

  evaluate(ctx: JudgeContext): FindingDraft[] {
    ProbeInvariant.captured = ctx;
    return [this.finding(ctx, "probe-field", "probe message", "probe fix")];
  }
}

/** One injected declaration over the probe — the tier and the exemption are the only
 *  cells a round flips. */
const probeDeclaration = (
  severity: "block" | "warn",
  skipWhenClosed = false,
): DocRuleDeclaration => ({
  scope: "doc",
  id: "probe-rule",
  docKeys: ["phase-spec"],
  severity,
  skipWhenClosed,
  create: () => new ProbeInvariant(),
});

/** A parseable phase-spec carrier — the probe is the only declared rule, so its one
 *  finding is the whole judgment. */
const SPEC_CARRIER = [
  "---",
  "title: S",
  "doc-type: phase-spec",
  "version: v0.1",
  "date: 2026-11-20",
  "slug: x-p1",
  "program: x",
  "---",
  "",
  "## Design",
  "",
  "body",
  "",
].join("\n");

/** A plan whose first task block carries the reserved `#### DependsOn` twice — the
 *  parse face throws, so the judgment materializes the one `doc-syntax` finding. */
const BROKEN_PLAN = [
  "---",
  "title: Test Plan",
  "doc-type: plan",
  "version: v1.0",
  "date: 2026-10-09",
  "slug: x-p3",
  "---",
  "",
  "### Task 1: task",
  "",
  "#### DependsOn",
  "2, 3",
  "",
  "#### DependsOn",
  "4",
  "",
].join("\n");

const specInput = (docKey: "phase-spec" | "plan" = "phase-spec") => ({
  docKey,
  path: docKey === "plan" ? "docs/kairos/plans/x-p3.md" : "docs/kairos/specs/x-p1-design.md",
  content: docKey === "plan" ? BROKEN_PLAN : SPEC_CARRIER,
  root: ".",
});

/** The rows that predate the P41 shape gate — the twenty-four doc rows and the two
 *  ledger rows — named as an explicit roster. The tier assertion below is about THESE
 *  rows only: the phase's six new shape rows start at `warn` and are flipped by its last
 *  task, so neither their arrival nor their flip touches this list. */
const PRE_GATE_DOC_IDS = [
  "presence",
  "change-history-version-unique",
  "change-history-row-shape",
  "change-history-header-columns",
  "change-history-latest-matches-front-matter",
  "task-id-unique",
  "phase-id-unique",
  "domain",
  "crosslink",
  "section-order",
  "front-matter-version-in-lineage",
  "continuity",
  "residue",
  "hollow",
  "link-shape",
  "file-existence",
  "sibling-scan",
  "slug-ref",
  "cross-doc-chain",
  "section-scoped-domain",
  "change-history-row-not-in-other-table",
  "list-marker-not-doubled",
  "wave-width-at-most-three",
  "phase-design-spec-is-phase-spec",
] as const;

const PRE_GATE_LEDGER_IDS = [
  "closed-wave-fits-depends-on-layers",
  "planned-tasks-vs-recorded-tasks",
] as const;

describe("P41 T1 — every pre-gate rule row declares a tier and a closed-document posture", () => {
  it("declares `block` and `skipWhenClosed: false` on the twenty-four doc rows and the two ledger rows", () => {
    const byId = new Map(RULE_REGISTRY.map((row) => [row.id, row]));
    const rows = [...PRE_GATE_DOC_IDS, ...PRE_GATE_LEDGER_IDS].map((id) => {
      const row = byId.get(id);
      if (row === undefined) throw new Error(`the registry dropped the pre-gate row ${id}`);
      return row;
    });
    expect(rows.filter((row) => row.scope === "doc")).toHaveLength(24);
    expect(rows.filter((row) => row.scope === "ledger")).toHaveLength(2);
    for (const row of rows) {
      expect(row.severity, row.id).toBe("block");
      expect(row.skipWhenClosed, row.id).toBe(false);
    }
  });
});

describe("P41 T1 — the strategy hands back a draft; the declaration stamps the tier", () => {
  it("yields a draft carrying no `severity` key through the base class's `finding()`", () => {
    new Contract([probeDeclaration("warn")]).validate(specInput());
    const captured = ProbeInvariant.captured;
    if (captured === undefined) throw new Error("the probe ran no judgment");
    const [draft] = new ProbeInvariant().evaluate(captured);
    expect(Object.keys(draft ?? {}).sort()).toEqual(["field", "fix", "kind", "message", "path"]);
    expect(draft).not.toHaveProperty("severity");
  });

  it("stamps the injected declaration's tier — warn stays warn and block reads block", () => {
    const warnFindings = new Contract([probeDeclaration("warn")]).validate(specInput());
    expect(warnFindings).toHaveLength(1);
    expect(warnFindings[0]?.severity).toBe("warn");

    const blockFindings = new Contract([probeDeclaration("block")]).validate(specInput());
    expect(blockFindings).toHaveLength(1);
    expect(blockFindings[0]?.severity).toBe("block");
  });

  it("skips an exempted row only when the caller proves the document closed", () => {
    const contract = new Contract([probeDeclaration("block", true)]);
    expect(contract.validate(specInput())).toHaveLength(1);
    expect(contract.validate(specInput(), true)).toEqual([]);

    // A row that is NOT exempt keeps judging a closed document.
    const always = new Contract([probeDeclaration("block", false)]);
    expect(always.validate(specInput(), true)).toHaveLength(1);
  });

  it("stamps the parse face's own `doc-syntax` finding `block` — it is no declared rule", () => {
    const findings = new Contract().validate(specInput("plan"));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("doc-syntax");
    expect(findings[0]?.severity).toBe("block");
  });

  it("reports the registry it judged through, so the `checked:` face cannot drift", () => {
    // The injected set is the one both the judgment and the row face report; the
    // production construction keeps the shipped twenty-six rows.
    expect(new Contract([probeDeclaration("warn")]).ruleRows().map((row) => row.id)).toEqual([
      "probe-rule",
    ]);
    expect(new Contract().ruleRows()).toBe(RULE_REGISTRY);
  });
});
