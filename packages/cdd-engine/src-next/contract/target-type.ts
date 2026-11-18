// packages/cdd-engine/src-next/contract/target-type.ts
// P40 T3 — the target-type vocabulary's contract-plane home. The definition moved
// here verbatim from `session/faces.ts` (which re-exports it, so every session/ and
// render/ reader is unchanged): the pre-flight judgment resolves a declaration's
// `requiredOn` arms BY TYPE SET (`arm.types === "always" || arm.types.includes(type)`),
// so it needs the type vocabulary on its own plane — a judgment that reached into
// `session/` for it would invert the plane direction the whole extraction exists for.
//
// Zero semantic change, zero new word: this file is the same declaration, moved.

/** The target types the parameterized lifecycle serves — the CLI `--type` vocabulary,
 *  one word per target shape: the four DOCUMENT shapes (`phase-spec` · `overall` ·
 *  `plan` · `single-spec` — the declared `doc-type:` spellings) and the two NODE
 *  shapes (`wave` · `branch`). `wave` (T26 · the wave-unitary model): the task-graph
 *  face whose dispatch unit is the derived wave — the type name is the UNIT, not the
 *  graph's node granularity (the audit source stays "task-graph" · the plan's task
 *  nodes keep the task name). */
export type TargetType = "phase-spec" | "overall" | "plan" | "single-spec" | "wave" | "branch";
