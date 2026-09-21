// packages/cdd-engine/src/infra/__tests__/helpers.ts
// git init + 空提交（-c 内联身份：无全局 user.name/email 的环境（CI runner）也能 commit）。
import { execFileSync, execSync, spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
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

// stderr 捕获 seam（P6 T10：dispatch.base/docs/task 三测试文件共用——各文件自写
// bind→swap→try/finally→restore 五段即复制；集中单点避免各测试文件各写一份）。模式：
//   const cap = captureStderr();
//   try { ... } finally { cap.restore(); }
//   expect(cap.text).toContain(...);
export function captureStderr() {
  const buf: string[] = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((s: unknown) => { buf.push(String(s)); return true; }) as typeof process.stderr.write;
  return {
    get text() { return buf.join(""); },
    restore() { process.stderr.write = origWrite; },
  };
}

// stdout capture seam (T5 ④: stdout-visibility assertion for the docs exit-gate BLOCKED diagnosis — isomorphic with captureStderr).
export function captureStdout() {
  const buf: string[] = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((s: unknown) => { buf.push(String(s)); return true; }) as typeof process.stdout.write;
  return {
    get text() { return buf.join(""); },
    restore() { process.stdout.write = origWrite; },
  };
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

// ---- Doc-contract-valid chain (plan + spec + parent overall) (Task 29, spec T7.8) ----
// A three-doc fixture that passes every docContractValidate contract (the dispatch hook now gates
// every real dispatch on it, so any lifecycle-test repo asserting a real dispatch past pre-flight
// must carry a valid chain). Single shared source — runner / progress-owner fixture builders all
// call commitValidDocs instead of writing a bare `# Plan` file.
const VALID_PLAN_BODY = [
  "# Plan",
  "",
  "**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)",
  "",
  "## Constraints",
  "",
  "- boundary one",
  "",
  "### Task 1: x",
  "body",
  "",
].join("\n");
const VALID_SPEC_BODY = [
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)",
  "",
].join("\n");
const VALID_OVERALL_BODY = [
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "|---|---|---|---|---|---|---|",
  "| P1 | phase one | [Pending] | Pending | | none |",
  "",
  "## Change history",
  "",
  "| Version | date | summary |",
  "|---|---|---|",
  "| v1.0 | 2026-09-21 | Initial |",
  "",
].join("\n");

/** commitValidDocs(dir, planRel?, planBody?) — write the valid spec + parent overall and the plan
 * (default the canonical valid body; a fixture may pass its own planBody) into the repo and commit
 * them (clean tree — commit-contract premise). Returns the plan's repo-relative path. */
export function commitValidDocs(dir, planRel = path.join("docs", "osuperpowers", "plans", "plan.md"), planBody = VALID_PLAN_BODY) {
  const planAbs = path.join(dir, planRel);
  mkdirSync(path.dirname(planAbs), { recursive: true });
  writeFileSync(planAbs, planBody);
  const specRel = path.join("docs", "osuperpowers", "specs", "plan-design.md");
  const specAbs = path.join(dir, specRel);
  mkdirSync(path.dirname(specAbs), { recursive: true });
  writeFileSync(specAbs, VALID_SPEC_BODY);
  const overallAbs = path.join(dir, path.join("docs", "osuperpowers", "specs", "plan-overall.md"));
  mkdirSync(path.dirname(overallAbs), { recursive: true });
  writeFileSync(overallAbs, VALID_OVERALL_BODY);
  gitCommit(dir);
  return planRel;
}

/** writeBranchChain(dir, planName) — a doc-contract-valid chain for the given branch-lane plan
 * (T3 ④: the branch channel's base-default docContractValidate audits its `--plan` ref, so every
 * branch fixture plan must carry plan → `**Spec:**` → Parent program → overall with a green four
 * tables — the overall's only phase is all-pending, so all six audit faces no-op). Returns the
 * plan's absolute path (the branch fixtures pass it as `--plan`/runBranchReview`.plan). */
export function writeBranchChain(dir, planName) {
  const plansDir = path.join(dir, "docs", "osuperpowers", "plans");
  const specsDir = path.join(dir, "docs", "osuperpowers", "specs");
  mkdirSync(plansDir, { recursive: true });
  mkdirSync(specsDir, { recursive: true });
  const baseName = String(planName).replace(/\.md$/, "");
  const specName = `${baseName}-design.md`;
  const overallName = `${baseName}-overall.md`;
  const planAbs = path.join(plansDir, planName);
  writeFileSync(planAbs, [
    "# Plan",
    "",
    `**Spec:** [${specName}](docs/osuperpowers/specs/${specName})`,
    "",
    "## Constraints",
    "",
    "- boundary one",
    "",
    "### Task 1: x",
    "body",
    "",
  ].join("\n"));
  writeFileSync(path.join(specsDir, specName), [
    "- **Version**: v1.0 · 2026-09-21",
    "",
    `- **Parent program**: [${overallName} v1.0](./${overallName})`,
    "",
  ].join("\n"));
  writeFileSync(path.join(specsDir, overallName), [
    "- **Version**: v1.0 · 2026-09-21",
    "",
    "## Phase inventory",
    "",
    "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
    "|---|---|---|---|---|---|---|",
    "| P1 | phase one | [Pending] | Pending | | none |",
    "",
    "## Change history",
    "",
    "| Version | date | summary |",
    "|---|---|---|",
    "| v1.0 | 2026-09-21 | Initial |",
    "",
  ].join("\n"));
  return planAbs;
}

// 单根权威（src/infra/root.ts）打桩 —— 同一 seam 的构造知识集中在此，避免各测试文件各写一份。
// 两条 vi.mock 提升语义（实测，改前请先读）：
//   ① 工厂本体在 **import 阶段**即被调用（被 mock 的模块首次被 import 时），故取值必须以 thunk
//      传入：`mockRoot(() => REPO_ROOT)`。直传模块级 const 会在那一刻求值并 TDZ
//      （实测 `Cannot access 'REPO_ROOT' before initialization`）；thunk 把求值推迟到方法被调用时。
//      三处调用点一律用 thunk 形态，避免同一 helper 出现两种写法。
//   ② 本 helper 的 import 必须排在**任何 transitively 加载 src/infra/root.ts 的 import 之前**
//      （如 src/dispatch/task.ts / src/cli/*），否则 `mockRoot` 这个绑定自身在工厂被调用时尚未初始化。
export function mockRoot(resolve) {
  return { initRoot: resolve, getRoot: resolve };
}
