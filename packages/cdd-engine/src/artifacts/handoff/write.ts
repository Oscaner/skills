// packages/cdd-engine/src/artifacts/handoff/write.ts — handoff read/write (Task 8 port of
// write.mjs; engine is the handoff carrier's single author). Writes per
// packages/cdd-engine/config/schema/task-handoff-schema.json (docs family
// docs-handoff-schema.json; naming/workspace per engine-config.json#handoffNamespace). T7 nit2: the unified
// JSON read single point (readJson) lives here — every engine shape-sibling readJson/safeParse
// converges to this module.
// contract.mjs symbol split (spec §2.3): the three write symbols (readJson / writeHandoff /
// writeOwnHandoff) belong to this file.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Workspace } from "../../infra/workspace.ts";

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

/**
 * Shape-narrowed read of a handoff's nested `commits.base` (a full 40-char SHA — the round's diff
 * range anchor). The handoff read is `Record<string, unknown> | null`, so the nested base needs
 * the unknown shape narrowed (`"base" in commits`) before access. Missing/complex commits → null
 * (the unified miss default). A legal string base is returned verbatim — never coerced or defaulted
 * here; consumers keep their own empty-string / "unknown" handling downstream (the single home of
 * the 6-guard commits.base narrow, from rules/write-boundary.ts and dispatch/branch.ts).
 */
export function readCommitsBase(commits: unknown): string | null {
  if (
    commits != null &&
    typeof commits === "object" &&
    !Array.isArray(commits) &&
    "base" in commits &&
    typeof commits.base === "string"
  ) {
    return commits.base;
  }
  return null;
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
 * engine-config.json#handoffNamespace). Existing file → shallow merge (H6 chain-update semantics: a
 * review/validator changing status/blocker keeps task/commits/findings etc.). Parent dir auto-
 * created (through the Workspace ensure single point — T6: the workspace's directory creation
 * converges on Workspace.ensure); returns the merged full object.
 */
export function writeHandoff(
  handoffPath: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const existing = existsSync(handoffPath) ? safeParse(handoffPath) : null;
  const merged = { ...(existing ?? {}), ...data };
  Workspace.fromPath(path.dirname(handoffPath)).ensure();
  writeFileSync(handoffPath, serializeHandoff(merged));
  return merged;
}

/**
 * Full-replace write (T7: the engine is the carrier's single author, used for finalized writes).
 * NOT a shallow merge: no read-before-write, existing fields are never retained — agent-written
 * residue cannot enter the carrier (the natural semantics of a private write slot). Parent dir
 * auto-created (through the Workspace ensure single point — T6); returns the written full object.
 */
export function writeOwnHandoff(
  handoffPath: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  Workspace.fromPath(path.dirname(handoffPath)).ensure();
  writeFileSync(handoffPath, serializeHandoff(data));
  return data;
}
