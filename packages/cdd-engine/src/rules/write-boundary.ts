// packages/cdd-engine/src/rules/write-boundary.ts — changed-surface bookkeeping (writeBoundary;
// 2026-09-20 ruling — pure-soft, NEVER BLOCK). The agent's handoff `changes[]` is a changed-file
// attribution ledger (each item {file, reason}); the mechanical reconcile below checks the round's
// `git diff base..HEAD` fileset against it. A diff file NO ledger entry attributes is a booking
// gap — visible as a stderr CDD_WARN + a notes record, never a hard block: the verdict belongs to
// the review layer (template-contract scope-composition axis → normal finding → fix loop), while
// the execution layer only keeps the books. implement rounds materialize no changes[] (the return
// block is their only surface) → the diff fileset is recorded verbatim as the ledger origin, zero
// warn. No usable commits.base → skipped (docs-family carries commits{base,head} since T5 — its
// reconcile now runs like the task family when a legal base exists; unknown-base failure carriers
// skip too). Review mode → skipped (its commits describe the reviewed range, not this dispatch's
// output).

import { readJson, writeHandoff } from "../artifacts/handoff/write.ts";
import { gitDiffNameOnly, gitRevParseHead } from "../infra/git.ts";

export interface ChangedSurface {
  /** `git diff base..HEAD --name-only` fileset (the round's mechanical changed surface). */
  diffFiles: string[];
  /** diffFiles minus the changes[] ledger's file set — the booking gap (fix) / empty (implement). */
  unattributed: string[];
}

const MODES = new Set(["implement", "fix"]);

/**
 * Reconcile the round's diff fileset against the handoff `changes[]` ledger. Pure-soft:
 * gaps are alerted (stderr CDD_WARN) and recorded (notes), never BLOCKED. Returns the
 * changed-surface facts, or null when the reconcile does not apply (review mode / no handoff /
 * no legal commits.base / git error — all fail-open, zero side effects).
 */
export async function reconcileChangedSurface(
  mode: string,
  repoRoot: string | null | undefined,
  handoffPath: string,
): Promise<ChangedSurface | null> {
  if (!MODES.has(mode)) return null;
  const handoff = readJson(handoffPath);
  if (!handoff) return null;
  const commits = handoff.commits;
  const base = commits && typeof commits.base === "string" ? commits.base : null;
  if (!base) return null;
  const head = await gitRevParseHead(repoRoot ?? "");
  if (!head) return null;
  const diffFiles = await gitDiffNameOnly(repoRoot ?? "", base, head);
  if (!diffFiles) return null; // unresolvable rev / git error → skip (a diff we cannot compute is no evidence)

  if (diffFiles.length === 0) return null; // zero diff → nothing off-book, nothing to record

  const ledger: string[] = Array.isArray(handoff.changes)
    ? handoff.changes
        .filter((c) => c && typeof c.file === "string")
        .map((c) => (c as { file: string }).file)
    : [];
  const unattributed = mode === "fix" ? diffFiles.filter((f) => !ledger.includes(f)) : [];

  if (mode === "fix" && unattributed.length > 0) {
    const list = unattributed.join(", ");
    process.stderr.write(
      `CDD_WARN: changed surface off the changes[] ledger — ${list}. Booking is visible, not a block: ` +
        `the review scope axis decides (normal finding → fix loop).\n`,
    );
    const existing = typeof handoff.notes === "string" ? handoff.notes : "";
    const note = `changed-surface gap (off changes[] ledger): ${list}`;
    writeHandoff(handoffPath, { notes: existing ? `${existing}; ${note}` : note });
  } else if (mode === "implement") {
    // implement agents write no changes[] — the diff fileset IS the ledger origin; record it so
    // the review layer has the same surface the implementer saw. Zero warn (no gap possible).
    const existing = typeof handoff.notes === "string" ? handoff.notes : "";
    const note = `changed-surface ledger origin (no changes[] declared): ${diffFiles.join(", ")}`;
    writeHandoff(handoffPath, { notes: existing ? `${existing}; ${note}` : note });
  }

  return { diffFiles, unattributed };
}
