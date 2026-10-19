// packages/cdd-engine/src-next/contract/__tests__/edge-conditions.guard.test.ts
// T13 ④ (spec §3.3 ④) — the edgeConditionWords real-derivation gate. The contract's
// `edgeConditionWords` docstring claimed a wording test pinned its derivation from the
// engine word table / Route lexicon, but the array had ZERO reader (a false pin: the
// declared value could drift from the engine sources silently). This gate IS that pin:
// it derives the expected set by family concatenation from the engine's OWN single
// sources and asserts the declared contract value equals it —
//   · the NEXT-LOOP phrases — the contract's own `digraph.nextLoopConditions`
//     (the contract IS the authoritative home for this one family: the phrases are
//     the SKILL-digraph edge-label vocabulary, a consumer-surface prose face the
//     runtime `next:` never emits, so no engine runtime constant carries them — see
//     the contract slot's docstring · P9 branch-review-1 F9);
//   · the review-closure status words — `CAPSULE_WORDS.status` (face/words.ts) minus
//     the failure statuses `FAILED_STATUS` (session/next.ts), cross-checked against the
//     `RoundStatus` union (session/ledger.ts — the status type's single home);
//   · the Route decision words — `ROUTE_DECISION_WORDS` (session/next.ts, the Route
//     lexicon's single home).
// A drifted engine word re-projects the expected set and fails here — never a silent
// second list. Domicile: engine suite (§3.6 — the engine-internal ④ fact).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CAPSULE_WORDS } from "../../face/words.ts";
import { FAILED_STATUS, ROUTE_DECISION_WORDS } from "../../session/next.ts";
import { SKILL_ANATOMY } from "../skill-anatomy.ts";

const SRC = fileURLToPath(new URL("../../", import.meta.url));

/** The `RoundStatus` union members declared in session/ledger.ts — the status type's
 *  single home (parsed from the source: a string-literal union carries no runtime face). */
const roundStatusMembers = (): string[] => {
  const src = readFileSync(`${SRC}/session/ledger.ts`, "utf8");
  const match = /export type RoundStatus =([^;]+);/.exec(src);
  if (match === null) throw new Error("ledger.ts RoundStatus shape changed");
  return [...(match[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
};

/** The expected engine-lexicon condition set — derived by family concatenation from
 *  the engine's own single sources (the contract's loop conditions + the word table's
 *  non-failure status vocabulary + the router's Route decision lexicon). */
const deriveExpected = (): string[] => [
  ...SKILL_ANATOMY.digraph.nextLoopConditions,
  ...CAPSULE_WORDS.status.filter((status) => !FAILED_STATUS.has(status)),
  ...ROUTE_DECISION_WORDS,
];

describe("edgeConditionWords — the real derivation pin (spec §3.3 ④)", () => {
  it("equals the family-concatenation derivation from words.ts + next.ts + the contract's loop conditions", () => {
    expect([...SKILL_ANATOMY.edgeConditionWords]).toEqual(deriveExpected());
  });

  it("carries the three families and no re-typed drift — the set is exactly loop + status + route words", () => {
    const derived = deriveExpected();
    // Each family contributes at least one word (a dropped family is a finding).
    expect(SKILL_ANATOMY.digraph.nextLoopConditions.length).toBeGreaterThan(0);
    expect(ROUTE_DECISION_WORDS.length).toBeGreaterThan(0);
    expect(CAPSULE_WORDS.status.filter((s) => !FAILED_STATUS.has(s)).length).toBeGreaterThan(0);
    expect(SKILL_ANATOMY.edgeConditionWords.length).toBe(derived.length);
    // The failure statuses are excluded (a BLOCKED/TIMEOUT round carries no closure edge).
    for (const failed of FAILED_STATUS) {
      expect(SKILL_ANATOMY.edgeConditionWords).not.toContain(failed);
    }
  });

  it("the closure status words derive from the RoundStatus union (ledger.ts — the status type's single home)", () => {
    const members = roundStatusMembers();
    const closure = CAPSULE_WORDS.status.filter((status) => !FAILED_STATUS.has(status));
    // Every closure status word is a declared RoundStatus member; the word table's
    // status vocabulary stays a subset of the type's union (never a status word the
    // carrier cannot hold — the ledger × words cross-leg).
    for (const word of closure) {
      expect(members, `"${word}" is not a declared RoundStatus member`).toContain(word);
    }
    // The failure statuses ride the same union (the exclusion is a real subset filter).
    for (const failed of FAILED_STATUS) {
      expect(members, `"${failed}" is not a declared RoundStatus member`).toContain(failed);
    }
  });
});
