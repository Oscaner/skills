// packages/cdd-engine/lib/root.mjs — engine bin+lib 内唯一的 cwd → repoRoot 转换点。
// P4 design §2.4.1：validator 断言本转换点在 engine bin+lib 内恰好 1 处，且在此文件。
import { gitToplevel } from "./contract/commit.mjs";

let _root = null;

export function initRoot() {
  // ↓ 全 engine 唯一的 cwd 读取点（token 只在此行出现，注释一律写成散文，见 Step 6）
  _root = gitToplevel(process.cwd());
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
