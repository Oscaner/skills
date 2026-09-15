// tests/helpers.mjs — 跨测试文件共享的 git fixture / 生命周期路径 / 进程组能力 helper。
// git init + 空提交（-c 内联身份：无全局 user.name/email 的环境（CI runner）也能 commit）。
import { execFileSync, execSync, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

// 进程组回收能力探针（spec §2.6「环境不允许时 skip 保护」）：
// detached 组 + kill(-pgid) 在部分 CI 容器（Ubuntu runner sandbox）下不可靠 —— 组提升失败或
// kill(-pgid) 不达组内成员，导致 teardownAll 后标记进程仍存活。探针实测：能派生 detached 组、
// 能以 kill(-pgid,0) 观察、且能连根 SIGKILL → true 才运行依赖进程组语义的测试；否则 skip。
export function processGroupReapingSupported() {
  try {
    const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { detached: true, stdio: "ignore" });
    const observable = (() => { try { process.kill(-child.pid, 0); return true; } catch { return false; } })();
    const killable = (() => { try { process.kill(-child.pid, "SIGKILL"); return true; } catch { return false; } })();
    return observable && killable;
  } catch {
    return false;
  }
}

// 标记进程计数（CI 实测：Linux 下 `sh -c "pgrep -f P1LLWC | wc -l"` 的命令行含模式本身会被
// pgrep -f 自匹配 → 计数恒 ≥1。括号技巧 `[P]1LLWC`：正则仍匹配其他进程里的字面 P1LLWC，
// 但执行 shell 的 cmdline 是 `[P]1LLWC`（带括号）不匹配 → 自匹配消除，macOS/Linux 行为一致）。
export function pgrepCount(marker) {
  const pat = `[${marker[0]}]${marker.slice(1)}`;
  return Number(execSync(`pgrep -f "${pat}" | wc -l`).toString().trim());
}

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

// CDD_LIFECYCLE_PATH —— 历史形态是「每 fork 注入唯一 tmp 路径」，用以避免跨 fork 共享
// <repoRoot>/.osuperpowers/cdd/lifecycle.json 时启动 reapStale 误杀并发在途组（spec §2.2 A）。
// P4 §2.4.1 删除 bin 侧读取点后该注入**已 inert**：lifecycle 路径改为纯派生（无 env 缝），
// 落点恒为 <repoRoot>/.osuperpowers/cdd/lifecycle.json —— 并发 fork 在仓根下**共用同一文件**。
// 并发隔离现由 reapStale 的 owner 存活判定承担（lib/lifecycle/proc.mjs pidAlive：ownerPid ≠ 本进程
// 且 owner 确证已死才判孤儿），不再依赖路径分离。helper 与各调用点的 env 注入保留至
// §2.4.4「测试缝删净」一并退场。
export function forkLifecyclePath(tag) {
  return path.join(os.tmpdir(), `cdd-lifecycle-${tag}-${process.pid}.json`);
}

// 单根权威（lib/root.mjs）打桩 —— 同一 seam 的构造知识集中在此，避免各测试文件各写一份。
// 两条 vi.mock 提升语义（实测，改前请先读）：
//   ① 工厂本体在 **import 阶段**即被调用（被 mock 的模块首次被 import 时），故取值必须以 thunk
//      传入：`mockRoot(() => REPO_ROOT)`。直传模块级 const 会在那一刻求值并 TDZ
//      （实测 `Cannot access 'REPO_ROOT' before initialization`）；thunk 把求值推迟到方法被调用时。
//      三处调用点一律用 thunk 形态，避免同一 helper 出现两种写法。
//   ② 本 helper 的 import 必须排在**任何 transitively 加载 lib/root.mjs 的 import 之前**
//      （如 run-task.mjs / lib/cli/*），否则 `mockRoot` 这个绑定自身在工厂被调用时尚未初始化。
export function mockRoot(resolve) {
  return { initRoot: resolve, getRoot: resolve };
}
