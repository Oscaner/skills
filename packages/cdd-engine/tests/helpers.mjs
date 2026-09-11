// tests/helpers.mjs — 跨测试文件共享的 git fixture / 生命周期路径 helper。
// git init + 空提交（-c 内联身份：无全局 user.name/email 的环境（CI runner）也能 commit）。
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

export function gitInit(dir) {
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t",
    "commit", "--allow-empty", "-q", "-m", "init"]);
}

// 在已 init 的仓库 add+commit（保持工作树干净——commit-contract 校验）。
// 同样 -c 内联身份：裸 git commit 在无全局身份的 CI runner 上会失败（PR #177 CI 实测）。
export function gitCommit(dir, message = "plan") {
  execFileSync("git", ["-C", dir, "add", "-A"]);
  execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t",
    "commit", "-q", "-m", message]);
}

// 唯一 CDD_LIFECYCLE_PATH（每 fork 独立）—— vitest pool:'forks' 并发下各 fork 注入独立 tmp 路径，
// 避免共享 <cwd>/.superpowers/cdd/lifecycle.json 时启动 reapStale 误杀并发在途组（spec §2.2 A）。
export function forkLifecyclePath(tag) {
  return path.join(os.tmpdir(), `cdd-lifecycle-${tag}-${process.pid}.json`);
}
