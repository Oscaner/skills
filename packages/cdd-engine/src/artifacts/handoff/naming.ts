// packages/cdd-engine/src/artifacts/handoff/naming.ts — handoff artifact contract derivation layer
// (Task 8 port of naming.mjs), the single consumer of the canonical handoff-namespace section
// (engine-config.json#handoffNamespace, Task 5 单文件归并: family names / round semantics / status /
// phase / prev table). The name is the single truth; roundPattern derives from it (scan/concrete
// shapes); the prev table drives Convergence + the runner's fixed-point reads. workspaceSlug /
// resolveWorkspace implement workspaceRoot + slugRule (.osuperpowers/cdd/<slug>/).
// Task 8 (spec §2.13 glob row): the legacy readdirSync directory scan in resolveNextRound is
// collected into tinyglobby (globSync) — the repo's shared glob toolchain, no hand-written walk.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "tinyglobby";
import { TaskGroup } from "../../domain/task-group.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { CddExitError, invariant } from "../../infra/exit.ts";

const NAMESPACE = new ConfigLoader().handoffNamespace();
const { families } = NAMESPACE;

/** workspaceRoot: the single truth of the runtime workspace base path segment (`.osuperpowers/cdd`).
 * workspaceSlug / resolveWorkspace / task workspace derivation unify on this constant — no
 * consumer hard-codes the literal. */
export const workspaceRoot = NAMESPACE.workspaceRoot;

export interface HandoffParams {
  /** The dispatch group's canonical key string (TaskGroup#key() — comma-joined full list:
   * `--tasks 1` → `"1"` · `--tasks 1,2` → `"1,2"`) — fills the canonical `{tasks}` placeholder of
   * the task handoff families. The key IS the group identity (no second form). */
  tasks?: string;
  base7?: string;
  head7?: string;
  round?: number | string;
}

/** Scan-shape key grammar: the TaskGroup key pattern's body without its ^…$ anchors (the
 * roundPattern scan placeholder — the key grammar's single source is GROUP_KEY_PATTERN; no second
 * hand-written scan regex). */
function scanGroupKeyPattern(): string {
  const src = TaskGroup.GROUP_KEY_PATTERN.source;
  return src.startsWith("^") && src.endsWith("$") ? src.slice(1, -1) : src;
}

// familyKey(op, type) → canonical family key (`${op}.${type}`). Internal helper, not public API.
function familyKey(op: string, type: string): string {
  return `${op}.${type}`;
}

function family(
  op: string,
  type: string,
): { name: string; round?: string; prev?: Record<string, string> } {
  const f = families[familyKey(op, type)];
  invariant(f, `unknown handoff family: ${op}.${type}`);
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
    .replaceAll("{tasks}", params.tasks ?? "")
    .replaceAll("{base7}", params.base7 ?? "")
    .replaceAll("{head7}", params.head7 ?? "")
    .replaceAll("{round}", String(params.round ?? ""));
}

/** roundPattern(op, type, params) → ^...$ RegExp, two shapes:
 *   scan shape (params.tasks absent — workspace round scanning): {round}→(\d+), {tasks}→ the
 *     TaskGroup key grammar (GROUP_KEY_PATTERN body: \d+(?:,\d+)* — any task group of the family
 *     hits the round capture group), {base7}/{head7}→[0-9a-f]{7} — wide (any group/ref of the
 *     family hits the round capture group);
 *   concrete shape (params provides {tasks}/{base7}/{head7} — Convergence prev / round validation):
 *     placeholders → literals, exact-ref match.
 * Shape discrimination = params.tasks presence (task family), no probe flag.
 * Note: the single `.` escape below also covers `..` (branch's base7..head7 segment is escaped
 * char-by-char to `\.\.`) — no separate handling needed. */
export function roundPattern(op: string, type: string, params: HandoffParams = {}): RegExp {
  const f = family(op, type);
  const groupPinned = ["task"].includes(type) && params.tasks != null;
  const pattern = f.name
    .replaceAll("{round}", "(\\d+)")
    .replaceAll("{tasks}", groupPinned ? String(params.tasks) : scanGroupKeyPattern())
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
 * Shape discrimination via opts: no tasks pin → wide scan (cross-group rounds); task family with
 * {tasks} → groupPinned exact-group rounds (cdd task review derivation prevents cross-group mixing);
 * branch with concrete base7/head7 → per-ref rounds. All cdd consumers (spec/plan/branch/task)
 * go through this layer.
 * glob via tinyglobby (Task 8): a top-level `*` scan of the workspace replaces the legacy
 * readdirSync walk — same result set, shared toolchain. Missing workspace (ENOENT) → default
 * round 1; real errors rethrow (same fail-open semantics as the legacy catch). */
export function resolveNextRound(
  workspace: string,
  op: string,
  type: string,
  opts: HandoffParams = {},
): number {
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
 * arithmetic (Convergence prev). Work-type with no prev (implement) → null. */
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
  const prevExpr = f.prev?.[round === 1 ? "round1" : "roundR"] ?? f.prev?.roundR;
  if (prevExpr) {
    const [prevFamily, roundRef] = prevExpr.split(":");
    const [prevOp, prevType] = prevFamily.split(".");
    let prevRound = round;
    if (roundRef === "R-1") prevRound = round - 1; // :R / :R-1 relative-round conversion
    const prevParams: HandoffParams & { round?: number | string } = { ...opts, round: prevRound };
    if (families[prevFamily].round === "fixed") delete prevParams.round; // implement has no round
    return path.join(workspace, handoffName(prevOp!, prevType!, prevParams));
  }
  // Same-family round-1 arithmetic (Convergence prev): only for review families without a prev
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
  invariant(root, "resolveWorkspace: root required (injected from src/infra/root.mjs)");
  return path.join(root, NAMESPACE.workspaceRoot, workspaceSlug(doc));
}

/** materializeWorkspace({ plan, repoRoot }) — the workspace DIRECTORY bootstrap single point
 * (P6 T24 C: the second hand-written workspace derivation — task.ts's former inline — converges
 * here; naming is the single workspace authority alongside resolveWorkspace). Plan → the
 * plan-derived slug directory, created with a `.gitignore` `*\n` (workspace artifacts never
 * pollute the repo tree). Errors are recoverable orchestration failures (bad plan / non-git root)
 * → CddExitError kind "run-blocked" (exit 1) — the task dispatch resolves them to its run-blocked
 * exit face, exactly the former RunBlocked contract. */
export function materializeWorkspace({
  plan,
  repoRoot,
}: {
  plan: string;
  repoRoot: string;
}): string {
  if (!repoRoot) throw new CddExitError("not in a git repo", { exitCode: 1, kind: "run-blocked" });
  const slug = workspaceSlug(plan);
  if (!slug || slug === "." || slug === "..") {
    throw new CddExitError(`cannot derive workspace name from: ${plan}`, {
      exitCode: 1,
      kind: "run-blocked",
    });
  }
  const base = path.join(repoRoot, workspaceRoot);
  mkdirSync(path.join(base, slug), { recursive: true });
  writeFileSync(path.join(base, ".gitignore"), "*\n");
  return path.join(base, slug);
}
