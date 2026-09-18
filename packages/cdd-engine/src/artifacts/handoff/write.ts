// packages/cdd-engine/src/artifacts/handoff/write.ts — handoff read/write (Task 8 port of
// write.mjs; engine is the handoff carrier's single author). Writes per
// packages/cdd-engine/templates/schema/task-handoff-schema.json (docs family
// docs-handoff-schema.json; naming/workspace per handoff-namespace.json). T7 nit2: the unified
// JSON read single point (readJson) lives here — every engine shape-sibling readJson/safeParse
// converges to this module.
// contract.mjs symbol split (spec §2.3): the three write symbols (readJson / writeHandoff /
// writeOwnHandoff) belong to this file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ---- handoff read/write ----

/** Unified JSON read — the historical convergence point for shape-sibling private
 * readJson/safeParse copies across src/. Missing/corrupt → null (fail-open). */
export function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// safeParse alias kept (writeHandoff's historical name; same implementation as readJson).
function safeParse(filePath: string): Record<string, unknown> | null {
  return readJson(filePath);
}

// Serialization single point (T5): the only on-disk handoff shape — JSON.stringify with full
// escaping (agent-written unescaped tokens, e.g. `\d` in a regex, never reach the carrier —
// the root-cause face of R6 / #250[1] CONTRACT_VIOLATION). Both write entries (writeHandoff
// shallow-merge / writeOwnHandoff full-replace) share it — never hand-assemble the string.
function serializeHandoff(obj: Record<string, unknown>): string {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

/**
 * Write a handoff per the task schema (docs family per docs schema; naming/workspace per
 * handoff-namespace.json). Existing file → shallow merge (H6 chain-update semantics: a
 * review/validator changing status/blocker keeps task/commits/findings etc.). Parent dir auto-
 * created; returns the merged full object.
 */
export function writeHandoff(handoffPath: string, data: Record<string, unknown>): Record<string, unknown> {
  const existing = existsSync(handoffPath) ? safeParse(handoffPath) : null;
  const merged = { ...(existing ?? {}), ...data };
  mkdirSync(path.dirname(handoffPath), { recursive: true });
  writeFileSync(handoffPath, serializeHandoff(merged));
  return merged;
}

/**
 * Full-replace write (T7: the engine is the carrier's single author, used for finalized writes).
 * NOT a shallow merge: no read-before-write, existing fields are never retained — agent-written
 * residue cannot enter the carrier (the natural semantics of a private write slot). Parent dir
 * auto-created; returns the written full object.
 */
export function writeOwnHandoff(handoffPath: string, data: Record<string, unknown>): Record<string, unknown> {
  mkdirSync(path.dirname(handoffPath), { recursive: true });
  writeFileSync(handoffPath, serializeHandoff(data));
  return data;
}