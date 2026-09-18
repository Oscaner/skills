// packages/cdd-engine/src/artifacts/handoff/naming.ts — handoff artifact contract derivation layer
// (Task 8 port of naming.mjs), the single consumer of the canonical handoff-namespace section
// (engine-config.json#handoffNamespace, Task 5 单文件归并: family names / round semantics / status /
// phase / prev table). The name is the single truth; roundPattern derives from it (scan/concrete
// shapes); the prev table drives Stopping + the runner's fixed-point reads. workspaceSlug /
// resolveWorkspace implement workspaceRoot + slugRule (.osuperpowers/cdd/<slug>/).
// Task 8 (spec §2.13 glob row): the legacy readdirSync directory scan in resolveNextRound is
// collected into tinyglobby (globSync) — the repo's shared glob toolchain, no hand-written walk.
import path from "node:path";
import { globSync } from "tinyglobby";

import { loadEngineConfig } from "../../infra/config.ts";

const NAMESPACE = loadEngineConfig().handoffNamespace;
const { families } = NAMESPACE;

/** workspaceRoot: the single truth of the runtime workspace base path segment (`.osuperpowers/cdd`).
 * workspaceSlug / resolveWorkspace / task workspace derivation unify on this constant — no
 * consumer hard-codes the literal. */
export const workspaceRoot = NAMESPACE.workspaceRoot;

export interface HandoffParams {
  task?: number | string;
  base7?: string;
  head7?: string;
  round?: number | string;
}

// familyKey(op, type) → canonical family key (`${op}.${type}`). Internal helper, not public API.
function familyKey(op: string, type: string): string {
  return `${op}.${type}`;
}

function family(op: string, type: string): { name: string; round?: string; prev?: Record<string, string> } {
  const f = families[familyKey(op, type)];
  if (!f) throw new Error(`unknown handoff family: ${op}.${type}`);
  return f;
}

/** familyConfig(op, type) → canonical family config (live reference to the canonical families
 * object — readonly contract, callers must not mutate the returned object). After
 * template-contract.json#reviews shed the artifact axis, schema/return/fixTemplate live here
 * (templates.ts reviewArtifactConfig and cdd fix read through this module; naming never
 * duplicates the literals). */
export function familyConfig(
  op: string,
  type: string,
): { name: string; round?: string; prev?: Record<string, string> } {
  return family(op, type);
}

// Placeholder concrete replacement (regexp escaping is roundPattern's concern, not applied here).
function fillName(name: string, params: HandoffParams = {}): string {
  return name
    .replaceAll("{task}", String(params.task ?? ""))
    .replaceAll("{base7}", params.base7 ?? "")
    .replaceAll("{head7}", params.head7 ?? "")
    .replaceAll("{round}", String(params.round ?? ""));
}

/** roundPattern(op, type, params) → ^...$ RegExp, two shapes:
 *   scan shape (params.task absent — workspace round scanning): {round}→(\d+), {task}→\d+,
 *     {base7}/{head7}→[0-9a-f]{7} — wide (any task/ref of the family hits the round capture group);
 *   concrete shape (params provides {task}/{base7}/{head7} — Stopping prev / round validation):
 *     placeholders → literals, exact-ref match.
 * Shape discrimination = params.task presence (task family), no probe flag.
 * Note: the single `.` escape below also covers `..` (branch's base7..head7 segment is escaped
 * char-by-char to `\.\.`) — no separate handling needed. */
export function roundPattern(op: string, type: string, params: HandoffParams = {}): RegExp {
  const f = family(op, type);
  const taskPinned = ["task"].includes(type) && params.task != null;
  let pattern = f.name
    .replaceAll("{round}", "(\\d+)")
    .replaceAll("{task}", taskPinned ? String(params.task) : "\\d+")
    .replaceAll("{base7}", params.base7 ? params.base7 : "[0-9a-f]{7}")
    .replaceAll("{head7}", params.head7 ? params.head7 : "[0-9a-f]{7}")
    .replaceAll(".", "\\.");
  return new RegExp(`^${pattern}$`);
}

/** handoffName(op, type, params) → concrete file name (the handoff artifact's naming single truth =
 * canonical name + parameter filling). */
export function handoffName(op: string, type: string, params: HandoffParams = {}): string {
  return fillName(family(op, type).name, params);
}

/** resolveNextRound(workspace, op, type, opts) → maxR+1 (for round:"increment" families).
 * Shape discrimination via opts: no task pin → wide scan (cross-task rounds); task family with
 * {task} → taskPinned exact task rounds (cdd task review derivation prevents cross-task mixing);
 * branch with concrete base7/head7 → per-ref rounds. All cdd consumers (spec/plan/branch/task)
 * go through this layer.
 * glob via tinyglobby (Task 8): a top-level `*` scan of the workspace replaces the legacy
 * readdirSync walk — same result set, shared toolchain. Missing workspace (ENOENT) → default
 * round 1; real errors rethrow (same fail-open semantics as the legacy catch). */
export function resolveNextRound(workspace: string, op: string, type: string, opts: HandoffParams = {}): number {
  const re = roundPattern(op, type, opts);
  let max = 0;
  let files: string[];
  try {
    files = globSync("*", { cwd: workspace, onlyFiles: true, dot: true, expandDirectories: false });
  } catch (err) {
    // Only a missing workspace (ENOENT) collapses to default round 1; real errors rethrow.
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
    return 1;
  }
  for (const f of files) {
    const m = path.basename(f).match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** prevHandoffPath(workspace, op, type, round, opts) → previous-round handoff path | null.
 * Two-mechanism boundary (canonical prev table): the cross-family prev table (review.task + all
 * fix families — runner fixed-point reads) wins; other review families → same-family round-1
 * arithmetic (Stopping prev). Work-type with no prev (implement) → null. */
export function prevHandoffPath(
  workspace: string,
  op: string,
  type: string,
  round: number,
  opts: HandoffParams = {},
): string | null {
  const f = family(op, type);
  // Cross-family dependency table first (prev table exists only on review.task and fix families).
  // round1 has no dedicated row (fix families) → falls back to the roundR entry — the dependency
  // expression is identical across rounds.
  const prevExpr = f.prev?.[round === 1 ? "round1" : "roundR"] ?? f.prev?.["roundR"];
  if (prevExpr) {
    const [prevFamily, roundRef] = prevExpr.split(":");
    const [prevOp, prevType] = prevFamily.split(".");
    let prevRound = round;
    if (roundRef === "R-1") prevRound = round - 1; // :R / :R-1 relative-round conversion
    const prevParams: HandoffParams & { round?: number | string } = { ...opts, round: prevRound };
    if (families[prevFamily].round === "fixed") delete prevParams.round; // implement has no round
    return path.join(workspace, handoffName(prevOp!, prevType!, prevParams));
  }
  // Same-family round-1 arithmetic (Stopping prev): only for review families without a prev
  // table (spec/plan/branch).
  if (op === "review" && round > 1) {
    return path.join(workspace, handoffName(op, type, { ...opts, round: round - 1 }));
  }
  return null;
}

// ---- workspace derivation (the 5th/6th derivation functions) ----
// slugRule: reviewed doc file name minus `.md` → single-layer strip of a trailing `-design` or
// `-plan` (anchored, mutually exclusive, naturally non-cascading). spec/plan (-design.md /
// -plan.md / no suffix) converge to the same value; depends only on the file name, not existence.
export function workspaceSlug(doc: string): string {
  const base = path.basename(doc).replace(/\.md$/, "");
  return base.replace(/-(?:design|plan)$/, "");
}

/** resolveWorkspace(doc, root) → <root>/<workspaceRoot>/<slug>. root is injected by the caller
 * (getRoot() / cli layer — single root authority). */
export function resolveWorkspace(doc: string, root: string): string {
  if (!root) throw new Error("resolveWorkspace: root required (injected from src/infra/root.mjs)");
  return path.join(root, NAMESPACE.workspaceRoot, workspaceSlug(doc));
}