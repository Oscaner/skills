// packages/cdd-engine/src/infra/root.mjs — engine src 内唯一的 cwd → repoRoot 转换点。
// P4 design §2.4.1：validator 断言本转换点在 engine bin+lib 内恰好 1 处，且在此文件。
// 同时承载路径类实参的唯一归一函数 resolveDocArg（§2.4.2 单一坐标系）。
// Task 5 换底：git 判定经 infra/git.ts（simple-git 单点），不再经 rules/commit.mjs 手写 helper。
import { existsSync } from "node:fs";
import path from "node:path";

import { gitTopLevel } from "./git.ts";
import { exitWithCode } from "./exit.mjs";

let _root = null;

export async function initRoot() {
  // ↓ 全 engine 唯一的 cwd 读取点（token 只在此行出现，注释一律写成散文，见 Step 6）
  _root = await gitTopLevel(process.cwd());
  if (!_root) {
    process.stderr.write("CDD_BLOCKED: not in a git repository\n  Run cdd from within a git repository.\n");
    process.exit(1);
  }
  return _root;
}

export function getRoot() {
  if (!_root) throw new Error("initRoot() not called — call from bin/cdd.mjs entry first");
  return _root;
}

// 内容路径入参的唯一归一函数：仓根相对（绝对路径直用）。不保留 cwd 相对回落。
// 退出码 = 1（§2.4.2 表：路径不存在属「运行期不可继续」——**不是** 2「用法 / 环境错」）。
// 诊断恒为三行（行数即断言锚点，不得增删）。
// 退出经 exitWithCode（THROW ExitRequested，非直调 process.exit）：本函数在 withLifecycle 内被调用
// （cli/review.mjs / cli/fix.mjs 经 resolveTargetDoc），直调 process.exit 会短路其 finally 的
// stopIdleMonitor/teardownAll —— run 边界连根回收即死代码（src/infra/exit.mjs:6-10 的仓标准）。
export function resolveDocArg(arg, root, flag = "path") {
  if (path.isAbsolute(arg)) {
    if (existsSync(arg)) return arg;
    process.stderr.write(
      `CDD_BLOCKED: --${flag} not found: ${arg}\n` +
      `  Absolute path does not exist.\n` +
      `  Hint: pass a repo-root-relative path instead.\n`);
    exitWithCode(1);
  }
  const resolved = path.join(root, arg);
  if (existsSync(resolved)) return resolved;
  process.stderr.write(
    `CDD_BLOCKED: --${flag} not found: ${arg}\n` +
    `  Tried (against repo root ${root}): ${resolved}\n` +
    `  Hint: cdd resolves paths against the repo root. Verify the path is correct relative to the repo root.\n`);
  exitWithCode(1);
}
