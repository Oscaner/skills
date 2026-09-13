// packages/cdd-engine/lib/cli/base-branch.mjs — `cdd base-branch set/get` action 主体
// （P5 spec §2.3 / task-3 brief）。双场景落点统一 CLI：CDD `--plan <path>` → resolveWorkspace(plan)
// （.superpowers/cdd/<slug>/）；standalone `--scope standalone --slug <s>` →
// <gitRoot>/.superpowers/standalone/<s>/。复用 workspace-artifacts 单一权威层（writeBaseBranch /
// validateBaseBranch / baseBranchPath）——CLI 只承担 flag 边界 + 目标解析 + 报错面，写语义零复制。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { writeBaseBranch, validateBaseBranch, baseBranchPath } from "../state/workspace-artifacts.mjs";
import { resolveWorkspace } from "../handoff/naming.mjs";
import { gitToplevel } from "../contract/commit.mjs";
import { exitWithCode } from "../exit.mjs";

// STANDALONE_ROOT：standalone 场景基路径段（workspaceRoot `.superpowers/cdd` 之外的第二基路径）。
// 与 handoff-naming.workspaceRoot 同制的单真相常量 —— 不散落硬编码字面量（P5 task-1 review nit 同款）。
export const STANDALONE_ROOT = ".superpowers/standalone";

// resolveBaseBranchWorkspace(opts) → { workspace }。目标解析唯一落点，flag 边界全部在此裁决：
//   --plan 提供                     → CDD workspace（resolveWorkspace 经 workspaceSlug 收敛 slug）；
//   --scope standalone --slug 提供 → <gitRoot>/<STANDALONE_ROOT>/<slug>；
//   --plan 与 --scope/--slug 并存   → 互斥 exit 2；
//   --scope 非 standalone / scope 无 slug → 各按缺失面 exit 2（standalone 组必填）；
//   均缺                          → 默认 CDD 语义，但 CDD 必须 --plan → 明确报错 exit 2。
// git root 按进程 cwd 解析（standalone 场景；CDD 场景经 resolveWorkspace 以 plan 所在仓库为准）。
export function resolveBaseBranchWorkspace(opts) {
  const hasPlan = !!opts.plan;
  const hasScope = opts.scope != null || opts.slug != null;
  if (hasPlan && hasScope) {
    process.stderr.write("cdd base-branch: --plan and --scope/--slug are mutually exclusive\n");
    exitWithCode(2);
  }
  if (hasScope) {
    if (opts.scope !== "standalone") {
      process.stderr.write(
        "cdd base-branch: standalone scope requires --scope standalone (--slug without --scope is not a target)\n");
      exitWithCode(2);
    }
    if (!opts.slug) {
      process.stderr.write("cdd base-branch: standalone scope requires --slug <slug>\n");
      exitWithCode(2);
    }
    const root = gitToplevel(process.cwd());
    if (!root) {
      process.stderr.write("cdd base-branch: standalone scope needs a git repo (gitToplevel failed)\n");
      exitWithCode(2);
    }
    return { workspace: path.join(root, STANDALONE_ROOT, opts.slug) };
  }
  // CDD 默认语义：--plan → resolveWorkspace(plan)（workspaceSlug 收敛双 suffix）。仅当有 plan 且
  // 无 scope 才落此分支；均缺（非 hasPlan 也非 hasScope）→ CDD 需要 --plan → 明确报错 exit 2。
  if (hasPlan) {
    return { workspace: resolveWorkspace(opts.plan) };
  }
  process.stderr.write(
    "cdd base-branch: missing target — CDD scope needs --plan <path>, standalone scope needs --scope standalone --slug <slug>\n");
  exitWithCode(2);
}

// runBaseBranchSet(opts)：`set --base <branch> --source <enum> [target] [--force]`。
// base/source 组必填（standalone 显式缺参报错；CDD 侧 writeBaseBranch 入参 gate 兜底同语义）。
// 写失败（异 base 无 force / 非法 source / 缺 base）由 workspace-artifacts 抛错 → 前缀 + exit 2。
export async function runBaseBranchSet(opts) {
  const { workspace } = resolveBaseBranchWorkspace(opts);
  if (!opts.base || !opts.source) {
    process.stderr.write("cdd base-branch set: required --base <branch> and --source <source>\n");
    exitWithCode(2);
  }
  try {
    const target = writeBaseBranch({ base: opts.base, source: opts.source, workspace, force: opts.force });
    process.stdout.write(`${target}\n`);
  } catch (err) {
    process.stderr.write(`cdd base-branch set: ${err?.message ?? err}\n`);
    exitWithCode(2);
  }
}

// runBaseBranchGet(opts)：`get [target]`。目标缺失 → 明确报『base-branch artifact 缺失』+ exit 非零
// （orchestrator 判定未确定 base，走推断链路）；schema 非法 → errors + exit 非零（不静默返回坏值）；
// 合法 → stdout JSON（双场景读共用，artifact 自身即返回载体）。
export async function runBaseBranchGet(opts) {
  const { workspace } = resolveBaseBranchWorkspace(opts);
  const target = baseBranchPath({ workspace });
  if (!existsSync(target)) {
    process.stderr.write(`cdd base-branch get: missing base-branch artifact at ${target}\n`);
    exitWithCode(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(target, "utf8"));
  } catch {
    process.stderr.write(`cdd base-branch get: corrupt JSON at ${target}\n`);
    exitWithCode(2);
  }
  const vr = validateBaseBranch(parsed);
  if (!vr.ok) {
    process.stderr.write(`cdd base-branch get: invalid base-branch schema — ${vr.errors.join("; ")}\n`);
    exitWithCode(2);
  }
  process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
}
