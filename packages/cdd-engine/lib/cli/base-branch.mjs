// packages/cdd-engine/lib/cli/base-branch.mjs — `cdd base-branch set/get` action 主体
// （P5 spec §2.3 / task-3 brief）。纯 artifact 命令——唯一目标 `--plan <path>` → resolveWorkspace(plan)
// （.osuperpowers/cdd/<slug>/）。复用 workspace-artifacts 单一权威层（writeBaseBranch /
// validateBaseBranch / baseBranchPath）——CLI 只承担目标解析 + 报错面，写语义零复制。
import { existsSync, readFileSync } from "node:fs";

import { writeBaseBranch, validateBaseBranch, baseBranchPath } from "../state/workspace-artifacts.mjs";
import { resolveWorkspace } from "../handoff/naming.mjs";
import { getRoot, resolveDocArg } from "../root.mjs";
import { exitWithCode } from "../exit.mjs";

// resolveBaseBranchWorkspace(opts) → { workspace }。目标解析唯一落点：`--plan` 提供 →
// 先经 resolveDocArg 归一（仓根相对 → 绝对；不存在 → exit 1 三行诊断）再入
// resolveWorkspace（workspaceSlug 收敛 slug）；缺 `--plan` → CDD 必须 --plan → 明确报错 exit 2。
// base-branch 不经 resolveTargetDoc，是 `--plan` 的独立入口（read point ④）——两段不可只做后者，
// 否则该命令保留第二套坐标系（仓根相对归一根本不发生）。
export function resolveBaseBranchWorkspace(opts) {
  if (!opts.plan) {
    process.stderr.write("cdd base-branch: missing --plan — the sole target is --plan <path>\n");
    exitWithCode(2);
  }
  const root = opts.root ?? getRoot();
  const normalizedPlan = resolveDocArg(opts.plan, root, "plan");
  return { workspace: resolveWorkspace(normalizedPlan, root) };
}

// runBaseBranchSet(opts)：`set --base <branch> --source <enum> --plan <path> [--force]`。
// base/source 组必填（writeBaseBranch 入参 gate 兜底同语义）。
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

// runBaseBranchGet(opts)：`get --plan <path>`。目标缺失 → 明确报『base-branch artifact 缺失』+ exit 非零
// （orchestrator 判定未确定 base，走推断链路）；schema 非法 → errors + exit 非零（不静默返回坏值）；
// 合法 → stdout JSON（artifact 自身即返回载体）。
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
