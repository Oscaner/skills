// packages/cdd-engine/src/artifacts/base-branch.ts — workspace artifact single-authority layer
// (Task 8 port of base-branch.mjs; P5 spec §2.2; ex lib/state/workspace-artifacts.mjs).
// base-branch path resolution + schema validation single point: one implementation kills the
// base-branch 3↔4-value drift (source enum takes the SKILL schema's 4 values: plan-field /
// branch-upstream / conversation-context / user-confirmed). The orchestrator never writes —
// always through writeBaseBranch.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { invariant } from "../infra/exit.ts";

/** BASE_BRANCH_SOURCES: the source field's 4-value enum sole definition (canonical).
 * Fixes the base-branch schema-table 3-value drift missing conversation-context (SKILL schema wins). */
export const BASE_BRANCH_SOURCES = [
  "plan-field",
  "branch-upstream",
  "conversation-context",
  "user-confirmed",
] as const;

export type BaseBranchSource = (typeof BASE_BRANCH_SOURCES)[number];

export function baseBranchPath({ workspace }: { workspace: string }): string {
  return path.join(workspace, "base-branch.json");
}

/** briefPath: the brief file path's single derivation point (`<ws>/tasks-<groupKey>-brief.md` —
 * the group-keyed artifact of the P4.3 group dispatch; `--tasks 1` → `tasks-1-brief.md` — the
 * task runner's buildCtx takes ctx.briefPath through this function (consumers must not inline
 * the same shape literal, or the single authority is nominal only). */
export function briefPath({ workspace, tasks }: { workspace: string; tasks: string }): string {
  return path.join(workspace, `tasks-${tasks}-brief.md`);
}

/** validateBaseBranch(obj) → {ok:true} | {ok:false, errors: []}.
 * Schema: { base: non-empty string, source: enum(4 values), confirmed_at: ISO8601-shaped } — all
 * three required. confirmed_at is written as ISO by writeBaseBranch, but the read side (cdd
 * base-branch get) validates existing artifacts (possibly hand-written / legacy): missing /
 * non-string / malformed timestamp → errors, never silently pass (the §2.3 get contract's
 * "schema-invalid → non-zero exit"; F10-governed hand populations are exactly what's validated).
 * ISO8601 loose shape: `YYYY-MM-DDTHH:MM…` containing a T. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;
export function validateBaseBranch(
  obj: unknown,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const o = obj as Record<string, unknown> | null | undefined;
  if (!o || typeof o.base !== "string" || o.base === "") {
    errors.push("base is required and must be a non-empty string");
  }
  if (!BASE_BRANCH_SOURCES.includes(o?.source as BaseBranchSource)) {
    errors.push(`source must be one of: ${BASE_BRANCH_SOURCES.join(", ")}`);
  }
  if (!o || typeof o.confirmed_at !== "string" || !ISO_DATE_RE.test(o.confirmed_at)) {
    errors.push(`confirmed_at is required and must be ISO8601 (YYYY-MM-DDTHH:MM…), got: ${JSON.stringify(o?.confirmed_at)}`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/** writeBaseBranch({base, source, workspace, force}) — the engine's only write entry (idempotency
 * matrix):
 *   absent           → write + confirmed_at=now;
 *   exists+same base → rewrite the file with base authority unchanged (source updated,
 *     confirmed_at preserved — semantically a no-op);
 *   exists+diff base → throw (existing authority untouched); force overwrites (new base → new
 *     confirmed_at).
 * Entry validates via validateBaseBranch first (clone with a confirmed_at stub before checking) —
 * prevents a missing-base / illegal-source silent write of a schema-invalid artifact
 * (JSON.stringify drops undefined keys). The CLI layer (Task 3) is a planned validation gate, but
 * this module claims to be the engine's only write entry — it must hold its own input guard, not
 * rely on downstream. Writes pre-pended with mkdirSync(dirname, {recursive:true}) for workspace
 * bootstrap — determine-base runs before implement, when the workspace dir does not exist yet
 * (naming.resolveWorkspace doesn't mkdir), otherwise the first set would ENOENT. Returns the
 * target path. */
export function writeBaseBranch({
  base,
  source,
  workspace,
  force = false,
}: {
  base: string;
  source: string;
  workspace: string;
  force?: boolean;
}): string {
  const gate = validateBaseBranch({ base, source, confirmed_at: new Date().toISOString() });
  if (!gate.ok) {
    // Block form: the template reads gate.errors, which only exists on the {ok:false} arm — an
    // eager `invariant(gate.ok, \`…${gate.errors.join(…)}\`)` would crash the happy path (the
    // argument is evaluated regardless of the condition).
    invariant(false, `writeBaseBranch: invalid args — ${gate.errors.join("; ")}`);
  }
  const target = baseBranchPath({ workspace });
  const existing = existsSync(target) ? (JSON.parse(readFileSync(target, "utf8")) as Record<string, unknown>) : null;
  const sameBase = !!existing && existing.base === base;
  if (existing && !sameBase && !force) {
    invariant(
      false,
      `existing base-branch "${existing.base as string}" differs from requested "${base}"; set --force to override`,
    );
  }
  // base authority unchanged (same base) → preserve the original confirmed_at + body; diff base +
  // force → new confirmation timestamp. confirmed_at preservation only when the existing value is
  // a valid ISO string — missing/illegal (F10-governed hand-written legacy) falls back to
  // new Date().toISOString(), never copies undefined (JSON.stringify would silently drop the key →
  // re-produce a schema-incomplete artifact).
  const existingConfirmedAt =
    typeof existing?.confirmed_at === "string" && ISO_DATE_RE.test(existing.confirmed_at)
      ? existing.confirmed_at
      : null;
  const confirmed_at = sameBase && existingConfirmedAt ? existingConfirmedAt : new Date().toISOString();
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify({ base, source, confirmed_at }, null, 2));
  return target;
}