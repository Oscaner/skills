// packages/cdd-engine/src/cli/base-branch.ts — `cdd base-branch set/get` action bodies
// (P5 spec §2.3 / task-3 brief). Pure artifact commands — the sole target `--plan <path>` →
// resolveWorkspace(plan) (.osuperpowers/cdd/<slug>/). Reuses the workspace-artifacts single
// authority layer (writeBaseBranch / validateBaseBranch / baseBranchPath) — the CLI only owns
// target resolution + the error surface; write semantics are zero-copy.
import { existsSync, readFileSync } from "node:fs";

import { baseBranchPath, validateBaseBranch, writeBaseBranch } from "../artifacts/base-branch.ts";
import { resolveWorkspace } from "../artifacts/handoff/naming.ts";
import { exitWithCode } from "../infra/exit.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";

export interface BaseBranchOpts {
  plan: string | undefined;
  root?: string;
  base?: string;
  source?: string;
  force?: boolean;
}

// resolveBaseBranchWorkspace(opts) → { workspace }. Sole target-resolution landing point:
// `--plan` provided → normalize first via resolveDocArg (repo-root-relative → absolute; missing
// → exit 1 three-line diagnostic) then resolveWorkspace (workspaceSlug converges the slug);
// missing `--plan` → CDD must have a --plan → explicit error, exit 2.
// base-branch does not go through resolveTargetDoc — it is the independent `--plan` entry
// (read point ④) — both steps must happen (the second alone would keep a second coordinate
// system: the repo-root-relative normalization would never occur).
export function resolveBaseBranchWorkspace(opts: BaseBranchOpts): { workspace: string } {
  if (!opts.plan) {
    process.stderr.write("cdd base-branch: missing --plan — the sole target is --plan <path>\n");
    exitWithCode(2);
  }
  const root = opts.root ?? getRoot();
  const normalizedPlan = resolveDocArg(opts.plan, root, "plan");
  return { workspace: resolveWorkspace(normalizedPlan, root) };
}

// runBaseBranchSet(opts): `set --base <branch> --source <enum> --plan <path> [--force]`.
// The base/source pair is required (writeBaseBranch's input-gate fallback enforces the same
// semantics). Write failure (different base without force / illegal source / missing base) →
// workspace-artifacts throws → prefix + exit 2.
export async function runBaseBranchSet(opts: BaseBranchOpts): Promise<void> {
  const { workspace } = resolveBaseBranchWorkspace(opts);
  if (!opts.base || !opts.source) {
    process.stderr.write("cdd base-branch set: required --base <branch> and --source <source>\n");
    exitWithCode(2);
  }
  try {
    const target = writeBaseBranch({
      base: opts.base,
      source: opts.source,
      workspace,
      force: opts.force,
    });
    process.stdout.write(`${target}\n`);
  } catch (err) {
    process.stderr.write(`cdd base-branch set: ${(err as Error)?.message ?? err}\n`);
    exitWithCode(2);
  }
}

// runBaseBranchGet(opts): `get --plan <path>`. Target missing → explicit "base-branch artifact
// missing" + non-zero exit (the orchestrator decides no base determined, walks the inference
// chain); schema invalid → errors + non-zero exit (never silently return a bad value); valid →
// stdout JSON (the artifact itself is the return carrier).
export async function runBaseBranchGet(opts: BaseBranchOpts): Promise<void> {
  const { workspace } = resolveBaseBranchWorkspace(opts);
  const target = baseBranchPath({ workspace });
  if (!existsSync(target)) {
    process.stderr.write(`cdd base-branch get: missing base-branch artifact at ${target}\n`);
    exitWithCode(2);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(target, "utf8"));
  } catch {
    process.stderr.write(`cdd base-branch get: corrupt JSON at ${target}\n`);
    exitWithCode(2);
  }
  const vr = validateBaseBranch(parsed);
  if (!vr.ok) {
    process.stderr.write(
      `cdd base-branch get: invalid base-branch schema — ${vr.errors.join("; ")}\n`,
    );
    exitWithCode(2);
  }
  process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
}
