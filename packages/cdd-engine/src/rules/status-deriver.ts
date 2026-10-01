// packages/cdd-engine/src/rules/status-deriver.ts — StatusDeriver (C5 command-contract plane, T3):
// the two stdout status axes — review judgment axis + work-type axis — in ONE class (zero bare
// functions, constructor-injection, zero module-level mutable state). The C5 D1-D3 dual axes:
//
//   review judgment axis — CHANGES_REQUESTED (any blocker finding) / REVIEW_FIX (warn/nit only —
//   the closure state) / APPROVED (empty findings). Engine-derived at finalization, never the agent.
//
//   work axis — COMPLETED (declared APPROVED) / BLOCKED (everything else). Implement/fix rounds'
//   stdout capsule face; the handoff carrier keeps its schema-legal APPROVED/BLOCKED status — the
//   capsule COMPLETED is the same conclusion rendered on the work axis (stdout-only, never persisted).
//
// The derivation semantics are absorbed from their former inline homes (single-source rule):
//   - the judgment-axis core of artifacts/handoff/finalize.ts#rollupStatus (finalize delegates);
//   - the APPROVED|BLOCKED collapse of return-block.ts#implementStatusFromReturnLine (the APPROVED
//     fold spells COMPLETED on the output axis).
export class StatusDeriver {
  /** Review judgment axis — the findings roll-up core (former finalize.ts rollupStatus
   *  judgment): empty → APPROVED; warn/nit only → REVIEW_FIX (closure state — the fix loop closes,
   *  no re-review preview); any blocker →
   *  CHANGES_REQUESTED. Severity values follow the canonical contract (blocker | warn | nit);
   *  non-array / non-severity entries degrade to the conservative baseline, never a throw. */
  deriveReviewStatus(findings: ReadonlyArray<{ severity?: string }> = []): string {
    const hasBlocker = findings.some((f) => f?.severity === "blocker");
    if (hasBlocker) return "CHANGES_REQUESTED";
    return findings.length > 0 ? "REVIEW_FIX" : "APPROVED";
  }

  /** Work axis — the implement/fix round conclusion fold: APPROVED (the agent/engine declared
   *  canonical success conclusion) → COMPLETED; everything else (BLOCKED / TIMEOUT / absent) →
   *  BLOCKED. The handoff carrier keeps its schema-legal value; this is the stdout-visible axis. */
  workStatus(declared: string | undefined): string {
    return declared === "APPROVED" ? "COMPLETED" : "BLOCKED";
  }
}
