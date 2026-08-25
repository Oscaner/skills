# P1 engine-fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复引擎跨仓库 workspace 解析 bug（#173）、删除 cdd-review.mjs 的 --prompt 旁路（#169）、删除 cli-task 孤儿技能，为后续 digraph 重构 phase 稳定引擎地基。

**Architecture:** runTask 入口新增 resolveRepoRoot 统一解析（有效 plan → plan 派生分支；仅无 plan 时 CDD_WORKSPACE 直设分支；永不回退 cwd），repoRoot 显式下传 5 个受影响点；cdd-review.mjs 收窄为 --template 唯一入口；cli-task 连带引用全清。

**Tech Stack:** Node.js ESM（bin/engine/*.mjs）、node:test、bash fixture（git init）。

## Global Constraints

- 输出契约不变：H1 四行、退出码语义（0/1/2/3）、handoff schema 均保持。
- 测试基线不回退：12 文件 124 测试 + 本计划新增/迁移用例全绿；验证入口 `pnpm run validate`（glob 展开），不裸用 `node --test <目录>`。
- vendored 子模块不可改（vendors/superpowers 的 sdd-workspace / review-package bash 脚本不动）。
- invokeCli 与 probeSkills 的 cwd 语义维持现状（non-goal，见 P1 spec §2.1 第 4/5 点）。
- 破坏性变更允许但须记入偏差表与 P10 changeset breaking 标注（本计划的 3 项已记录于 P1 spec Section 3）。
- 不 commit 除非任务步骤显式要求；changeset 仅在 P10 统一建。
- 语言政策：SKILL.md 英文主源，zh-CN 镜像同步修改。

---

### Task 1: resolveRepoRoot 统一解析 + resolveWorkspace 签名改造

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs:44-61`（resolveWorkspace）、`:377-460`（runTask 入口顺序）
- Test: `packages/osuperpowers/bin/engine/tests/runner.test.mjs`（新增 describe 块）

**Interfaces:**
- Consumes: `gitToplevel(cwd)`（contract.mjs，已有）
- Produces: `resolveRepoRoot({ planFile, env, ledgerPath })` → `{ plan, repoRoot }` 或抛 `RunBlocked`；`resolveWorkspace({ planFile, env, repoRoot })`（第 3 参数由 cwd 改为 repoRoot）

- [ ] **Step 1: 写失败测试——跨仓核心用例**

在 `runner.test.mjs` 顶部 import 区：`execFileSync` 已有（L10）勿重复；`resolveRepoRoot` 加入 L16-17 现有 runner import 列表（Step 6 直测需要）；文件末尾新增：

```js
// ---- P1 #173 跨仓回归（plan 派生分支）----
// （execFileSync 文件顶部已 import，勿重复声明）

function gitInit(dir) {
  execFileSync("git", ["init", "-q"], { cwd: dir });
  // -c 内联身份：无全局 user.name/email 的环境（CI runner）也能 commit
  execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t",
    "commit", "--allow-empty", "-q", "-m", "init"]);
}

test("runTask #173: plan 在仓库 A、cwd 在仓库 B → workspace 落于 A，B 内无 .superpowers", async () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-a-")));
  const repoB = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-b-")));
  gitInit(repoA);
  gitInit(repoB);
  const planFile = path.join(repoA, "plan.md");
  writeFileSync(planFile, "# Plan\n\n### Task 1: x\nbody\n");
  execFileSync("git", ["-C", repoA, "add", "-A"]);
  execFileSync("git", ["-C", repoA, "commit", "-q", "-m", "plan"]); // 保持 repoA 干净——commit-contract 校验工作树
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-ws-")); // CDD_WORKSPACE 不设
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...cleanEnv(), PLAN_FILE: planFile }, // 见下方 cleanEnv 说明：无 CDD_WORKSPACE
    cwd: repoB, noExit: true,
  });
  assert.equal(res.exitCode, 0);
  const slug = path.basename(planFile, ".md");
  assert.ok(existsSync(path.join(repoA, ".superpowers", "cdd", slug)), "workspace under A");
  assert.ok(!existsSync(path.join(repoB, ".superpowers")), "no .superpowers in B");
});
```

注：现有 `baseEnv(ws)` helper 恒设 CDD_WORKSPACE；跨仓用例需一个不含 CDD_/PLAN_FILE 泄漏的 `cleanEnv()`（复用 baseEnv 的过滤循环、不传 ws）。若实现后该用例失败信息为 RunBlocked "cannot resolve repo root" 即证明 TDD 红。

- [ ] **Step 2: 运行确认失败**

Run: `node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs`
Expected: **整文件模块加载失败**（`SyntaxError: The requested module '../lib/runner.mjs' does not provide an export named 'resolveRepoRoot'`）——Step 1 已把该导出名加入 import 列表而实现尚不存在，此即本步 TDD 红信号；「workspace 落 B / not in a git repo」的逐用例行为失败在 Step 3 实现后才可观察

- [ ] **Step 3: 实现 resolveRepoRoot + 改造 resolveWorkspace**

`runner.mjs` 中，`backfillPlanFromLedger` 之后新增：

```js
// 有效 plan 三来源合成（opt ‖ env.PLAN_FILE ‖ ledger backfill）。
// resolveRepoRoot 的分支判断与错误信息均基于该有效 plan（#173：永不回退 cwd）。
// 分支规则：
//   有有效 plan → plan 派生分支：existsSync 前置（"plan file not found"）→
//     repoRoot = gitToplevel(dirname(plan))，失败 → "not in a git repo"；
//     workspace = <repoRoot>/.superpowers/cdd/<slug>/
//   无有效 plan 且有 CDD_WORKSPACE → 直设分支（现行为）：workspace = env 原值；
//     repoRoot = gitToplevel(workspace)，允许 null（下游容忍）
//   两者皆无 → RunBlocked "cannot resolve repo root: provide --plan or CDD_WORKSPACE"
export function resolveRepoRoot({ planFile, env, ledgerPath }) {
  let plan = planFile || env.PLAN_FILE || "";
  if (!plan && ledgerPath) plan = backfillPlanFromLedger(ledgerPath);
  if (plan) {
    if (!existsSync(plan)) throw new RunBlocked(`plan file not found: ${plan}`);
    const root = gitToplevel(path.dirname(plan));
    if (!root) throw new RunBlocked("not in a git repo");
    return { plan, repoRoot: root };
  }
  if (env.CDD_WORKSPACE) {
    return { plan: "", repoRoot: gitToplevel(env.CDD_WORKSPACE) ?? "" };
  }
  throw new RunBlocked("cannot resolve repo root: provide --plan or CDD_WORKSPACE");
}
```

改造 `resolveWorkspace` 为纯派生（不再自己取根）：

```js
export function resolveWorkspace({ planFile, env, repoRoot }) {
  if (planFile || env.PLAN_FILE) {
    if (!repoRoot) throw new RunBlocked("not in a git repo");
    const plan = planFile || env.PLAN_FILE;
    const slug = path.basename(plan, ".md");
    if (!slug || slug === "." || slug === "..") throw new RunBlocked(`cannot derive workspace name from: ${plan}`);
    const base = path.join(repoRoot, ".superpowers", "cdd");
    mkdirSync(path.join(base, slug), { recursive: true });
    writeFileSync(path.join(base, ".gitignore"), "*\n");
    return path.join(base, slug);
  }
  if (env.CDD_WORKSPACE) return env.CDD_WORKSPACE;
  throw new RunBlocked("CDD_WORKSPACE unset and --plan not provided");
}
```

runTask 入口重排（步骤 1 registry gate 之后）：

```js
  // 2. 有效 plan 合成 + repoRoot 解析（#173：入口统一，永不回退 cwd）+ workspace
  let workspace;
  let repoRoot;
  let plan;
  try {
    const rr = resolveRepoRoot({ planFile, env: baseEnv, ledgerPath: baseEnv.CDD_LEDGER });
    plan = rr.plan;
    repoRoot = rr.repoRoot; // 存入作用域——Task 2 的 brief/review-package/scripts-dir 调用点使用
    workspace = resolveWorkspace({
      planFile: rr.plan || "",          // 有效 plan（含 env.PLAN_FILE / backfill 来源）→ 派生分支
      env: rr.plan ? {} : baseEnv,      // 无有效 plan → 直设分支读 baseEnv.CDD_WORKSPACE
      repoRoot: rr.repoRoot,
    });
  } catch (e) {
    if (e instanceof RunBlocked) return finish(1, [], e.message, noExit);
    throw e;
  }
```

（后续步骤 4 的旧 backfill 行删除——plan 已在此处定稿；步骤 5 task-review 的 `if (!plan)` 检查保持不变。`rr.plan` 已含 env.PLAN_FILE 来源，故 resolveWorkspace 的派生分支以 `planFile: rr.plan` 单参驱动。）

- [ ] **Step 4: 迁移基线用例 2（review-package not executable——自 Task 2 前移）+ 运行确认全绿**

**backfill 收紧使该基线用例在本步即红**（plan 不可用 → BLOCK 消息变为 'task-review mode requires plan path'，stderr 断言 /review-package not executable:/ 失败），故其 fixture 迁移必须与 Task 1 同步完成（Global Constraints：基线不回退）：fixture 的 dir 改为 `gitInit(dir)`；baseEnv 显式注入 `CDD_LEDGER: path.join(dir, "progress.md")` 与 `CDD_TASK_BRIEF`/`CDD_HANDOFF_PATH` 指向 `<dir>/.superpowers/cdd/plan/` 下预写文件；断言不变。（Task 2 Step 6 原迁移步骤随之取消。）

Run: `node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs`
Expected: 全部 PASS（含既有用例——CDD_WORKSPACE-only 用例走直设分支不受影响）

- [ ] **Step 5: 迁移基线用例 1（brief auto-generate）+ 补 plan-not-found 用例**

「brief 不存在 + plan 可用」用例：`planDir` 改为 `gitInit(mkdtempSync(...))`；**写完 plan.md 后 `git add -A && git commit`（保持 plan 仓库工作树干净——commit-contract 校验）**。**本步仅做 fixture 迁移与 workspace 落点断言（workspace 现派生于 `<planDir>/.superpowers/cdd/<slug>/`——原 `CDD_TASK_BRIEF` env 与 existsSync 断言随之改指新派生路径）**；TASK_BASE == planDir HEAD 的断言**移至 Task 2 Step 1**（generateBrief 的 repoRoot 下传在 Task 2 才落地，本步时 generateBrief 仍收 cwd=REPO_ROOT，断言必然红）。新增：

```js
test("runTask #173: plan 路径不存在 → 'plan file not found'", async () => {
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...baseEnv(tmpdir()), PLAN_FILE: "/nonexistent/plan.md" },
    noExit: true,
  });
  assert.equal(res.exitCode, 1);
});
```

Run: `node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs`
Expected: PASS

- [ ] **Step 6: 补齐 spec §2.4 剩余用例（BLOCKED / 直设双变体 / both-given）**

```js
test("runTask #173: 无 plan 无 CDD_WORKSPACE → 'cannot resolve repo root'", async () => {
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: cleanEnv(), cwd: mkdtempSync(path.join(tmpdir(), "cdd-bare-")), noExit: true,
  });
  assert.equal(res.exitCode, 1);
});
```

直设双变体（实现时以 `cleanEnv()` 加 `CDD_WORKSPACE` 构造 env）。**两变体均须**：`CDD_TASK_BRIEF` 与 `CDD_HANDOFF_PATH` 指到仓库外路径（mkdtemp 下），brief 预写含 `TASK_BASE:` 行——否则步骤 4.5 BLOCKED 'brief missing and plan unavailable'；git 目录变体的 workspace 即仓库本身，若 brief/handoff 写入仓库内未提交文件会触发 commit-contract 拦截（exit 1 而非断言的 0）。**spec §2.4#4 的 repoRoot 断言经 resolveRepoRoot 直测落地**（resolveRepoRoot 已导出）：

```js
test("resolveRepoRoot #173: CDD_WORKSPACE 直设 → repoRoot=git toplevel；裸 TMPDIR → 空串", () => {
  const wsGit = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-ws-git-")));
  gitInit(wsGit);
  assert.equal(resolveRepoRoot({ env: { CDD_WORKSPACE: wsGit } }).repoRoot, wsGit);
  const bare = mkdtempSync(path.join(tmpdir(), "cdd-ws-bare-"));
  assert.equal(resolveRepoRoot({ env: { CDD_WORKSPACE: bare } }).repoRoot, "");
});
```

- git 目录黑盒变体：ws = `gitInit(mkdtempSync(...))`，env 含 `CDD_WORKSPACE: ws` → exit 0。
- 裸 TMPDIR 黑盒变体：CDD_WORKSPACE 指向非 git mkdtemp → 同样 exit 0（容忍语义，repoRoot=null 不阻塞；非 git 树 commit-contract fail-open，无拦截问题）。

both-given 用例：

```js
test("runTask #173: CDD_WORKSPACE 与 plan 同给 → workspace 落 plan 派生路径，env 被忽略", async () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-both-")));
  gitInit(repoA);
  const planFile = path.join(repoA, "plan.md");
  writeFileSync(planFile, "# Plan\n\n### Task 1: x\nbody\n");
  execFileSync("git", ["-C", repoA, "add", "-A"]);
  execFileSync("git", ["-C", repoA, "commit", "-q", "-m", "plan"]); // 保持 repoA 干净——commit-contract 校验工作树
  const ignored = mkdtempSync(path.join(tmpdir(), "cdd-ws-ignored-"));
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...cleanEnv(), CDD_WORKSPACE: ignored, PLAN_FILE: planFile },
    cwd: repoA, noExit: true,
  });
  assert.equal(res.exitCode, 0);
  assert.ok(existsSync(path.join(repoA, ".superpowers", "cdd", "plan")), "workspace derived from plan");
  assert.ok(!existsSync(path.join(ignored, ".superpowers")), "env workspace ignored");
});
```

Run: `node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/runner.mjs packages/osuperpowers/bin/engine/tests/runner.test.mjs
git commit -m "fix(engine): resolve repo root from plan file path, never cwd (#173)"
```


### Task 2: repoRoot 全量下传（scripts-dir / relpath / brief / review-package）

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`（findSuperpowersScriptsDir / relpathFromRepo / runReviewPackage / generateBrief 调用点）、`packages/osuperpowers/bin/engine/lib/brief.mjs`
- Test: `packages/osuperpowers/bin/engine/tests/runner.test.mjs`、`packages/osuperpowers/bin/engine/tests/brief.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `resolveRepoRoot` 返回 `{ plan, repoRoot }`（runTask 作用域内已有 `repoRoot` 变量）
- Produces: `findSuperpowersScriptsDir(repoRoot)`（参数语义变更：传 repoRoot 非 cwd）、`generateBrief(plan, taskNum, outPath, repoRoot)`、`runReviewPackage(..., { cwd: repoRoot })`

- [ ] **Step 1: 写失败测试——brief TASK_BASE 取 plan 仓库 HEAD + review-package 子进程 cwd**

runner.test.mjs 跨仓用例后追加：

```js
test("runTask #173: brief auto-generate 时 TASK_BASE 取 plan 仓库 A 的 HEAD", async () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-a2-")));
  const repoB = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-repo-b2-")));
  gitInit(repoA);
  gitInit(repoB);
  const planFile = path.join(repoA, "plan.md");
  writeFileSync(planFile, "# Plan\n\n### Task 1: x\nbody\n");
  execFileSync("git", ["-C", repoA, "add", "."]);
  execFileSync("git", ["-C", repoA, "commit", "-q", "-m", "plan"]); // HEAD 含 plan commit
  const briefPath = path.join(mkdtempSync(path.join(tmpdir(), "cdd-ws2-")), "task-1-brief.md");
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: { ...cleanEnv(), PLAN_FILE: planFile, CDD_TASK_BRIEF: briefPath },
    cwd: repoB, noExit: true,
  });
  assert.equal(res.exitCode, 0);
  const head = execFileSync("git", ["-C", repoA, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.match(readFileSync(briefPath, "utf8"), new RegExp(`^TASK_BASE: ${head.slice(0, 7)}`, "m"));
});
```

brief.test.mjs 新增（generateBrief 直测，回归钉死 repoRoot 参数语义——现状已绿，Task 2 实现后保持绿）：

```js
test("generateBrief #173: 第 4 参数为 repoRoot —— cwd 无关，取传入目录所在仓库 HEAD", () => {
  const repoA = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-brief-a-")));
  const repoB = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-brief-b-")));
  gitInit(repoA);
  gitInit(repoB);
  const planFile = path.join(repoA, "plan.md");
  writeFileSync(planFile, "# Plan\n\n### Task 1: x\nbody\n");
  execFileSync("git", ["-C", repoA, "add", "-A"]);
  execFileSync("git", ["-C", repoA, "commit", "-q", "-m", "plan"]);
  const out = path.join(mkdtempSync(path.join(tmpdir(), "cdd-brief-out-")), "task-1-brief.md");
  // process.cwd() 与 repoA 无关（测试进程 cwd 在 oscaner-skills）——断言仅由第 4 参数决定
  generateBrief(planFile, 1, out, repoA);
  const head = execFileSync("git", ["-C", repoA, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.match(readFileSync(out, "utf8"), new RegExp(`^TASK_BASE: ${head.slice(0, 7)}`, "m"));
});
```

（brief.test.mjs 顶部需补 `execFileSync` import 与本地 `gitInit` helper——该文件当前无此依赖。）

review-package 子进程 cwd 断言用例（spec §2.4 #5，DI scriptsDir + 记录 spawn cwd）：

```js
test("runTask #173: review-package 子进程在 repoRoot 内执行", async () => {
  // fixture 同「review-package 不可执行」用例结构，但 review-package 可执行且为记录脚本：
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "cdd-rp-cwd-")));
  gitInit(dir);
  writeFileSync(path.join(dir, "plan.md"), "# Plan\n### Task 1: test\n");
  const ledger = path.join(mkdtempSync(path.join(tmpdir(), "cdd-ledger-")), "progress.md");
  writeFileSync(ledger, `# CDD ledger — plan: ${path.join(dir, "plan.md")}\n`);
  const ws = path.join(dir, ".superpowers", "cdd", "plan");
  mkdirSync(ws, { recursive: true });
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\nTASK_BASE: abc123\n");
  const spawnLog = path.join(mkdtempSync(path.join(tmpdir(), "cdd-spawnlog-")), "cwd.txt");
  const scripts = path.join(dir, "fake-scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, "review-package"),
    `#!/usr/bin/env bash\npwd > "${spawnLog}"\necho wrote /nonexistent/x: 0`);
  chmodSync(path.join(scripts, "review-package"), 0o755);
  // claude 存根过 preflight（对齐基线「review-package 不可执行」夹具——非 dry-run 必须有 CLI 在 PATH）：
  const binDir = mkdtempSync(path.join(tmpdir(), "cdd-rp-bin-"));
  writeFileSync(path.join(binDir, "claude"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(path.join(binDir, "claude"), 0o755);
  const origPath = process.env.PATH;
  const res = await runTask("claude", 1, {
    mode: "task-review", probeSkills: NOOP_PROBE,
    env: { ...cleanEnv(), CDD_WORKSPACE: ws, CDD_LEDGER: ledger,
           CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md"), CDD_TASK_REVIEW_FIXED_POINT: "HEAD",
           PATH: `${binDir}${path.delimiter}${origPath}` },
    cwd: mkdtempSync(path.join(tmpdir(), "cdd-elsewhere-")),
    scriptsDir: scripts, noExit: true,
  });
  process.env.PATH = origPath;
  assert.equal(readFileSync(spawnLog, "utf8").trim(), dir); // 子进程 pwd == repoRoot
});
```

注：runTask opts 需透传 `scriptsDir` DI 参数至 runReviewPackage（现仅在单测直调 runReviewPackage 时支持；本步骤给 runTask 增加同名 opt 转发——属测试 seam 扩展，不改行为）。该用例预期先 FAIL（spawn cwd 为调用方 cwd 非 repoRoot），Step 3 实现后转绿。

- [ ] **Step 2: 运行确认失败**

Run: `node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs packages/osuperpowers/bin/engine/tests/brief.test.mjs`
Expected: runner 新用例 FAIL（TASK_BASE 取自 cwd=repoB 的 HEAD）；brief.test.mjs 直测为回归钉死（现状已绿，Step 4 保持绿即可）——本步 Expected 仅 runner 侧 FAIL

- [ ] **Step 3: 实现——4 个下传点**

runner.mjs：
```js
// findSuperpowersScriptsDir：参数改名 repoRoot（submodule 探测从项目仓库找 vendors）
export function findSuperpowersScriptsDir(repoRoot) {
  if (repoRoot) {
    const probe = path.join(repoRoot, "vendors", "superpowers", ...);  // 同现有逻辑
    ...
  }
  // cache 回退不变
}
```

```js
// relpathFromRepo：第二参数改收 repoRoot（无根回退绝对路径不变）
function relpathFromRepo(abs, repoRoot) {
  const resolved = path.resolve(abs);
  if (repoRoot && resolved.startsWith(`${repoRoot}/`)) return resolved.slice(repoRoot.length + 1);
  return resolved;
}
```

runReviewPackage 内两处：
```js
const scriptsDir = scriptsDirOverride ?? findSuperpowersScriptsDir(repoRoot);
...
const res = await spawnCapture("bash", [reviewPkg, plan, base, head, outFile], { cwd, env });
// 注：runReviewPackage 的选项键保持 `cwd`（签名不变，直测 source-compatible）——
// 语义变更在调用方：runTask 步骤 5 现传入 repoRoot 作为该值。
```
（`|| cwd` 兜底 CDD_WORKSPACE-only 且非 git 目录场景——与 P1 spec §2.1「下游容忍」一致。）

runTask 步骤 5 调用点：`await runReviewPackage(plan, taskReviewBase, taskReviewHead, env.CDD_HANDOFF_PATH, { cwd: repoRoot || cwd, env, scriptsDir: opts.scriptsDir })`（`cwd` 键传 repoRoot 值——语义变更在调用方，runReviewPackage 签名不变）。

**runTask scriptsDir DI 透传（Step 1 review-package-cwd 用例的前置）**：runTask opts 解构处补 `scriptsDir = opts.scriptsDir`，并经上行的 `scriptsDir` 键转发给 runReviewPackage——否则该用例的 `scriptsDir: scripts` 被静默丢弃，findSuperpowersScriptsDir 回退真实 HOME plugin cache，测试失败原因难辨。属测试 seam 扩展，不改生产行为。

runTask 步骤 4.5 brief 调用点：`generateBrief(plan, taskNum, briefPath, repoRoot || cwd)`。

brief.mjs：仅注释更新（参数名 cwd → repoRoot，语义即「取该目录所在仓库的 HEAD」——实现已满足，直测钉死即可）。

- [ ] **Step 4: 运行测试确认绿**

Run: `node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs packages/osuperpowers/bin/engine/tests/brief.test.mjs`
Expected: 全部 PASS

- [ ] **Step 5: （已取消——基线用例 2 迁移前移至 Task 1 Step 4，backfill 收紧使其在 Task 1 即红）**

- [ ] **Step 6: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/runner.mjs packages/osuperpowers/bin/engine/lib/brief.mjs packages/osuperpowers/bin/engine/tests/
git commit -m "fix(engine): thread repoRoot through scripts-dir/relpath/brief/review-package (#173)"
```


### Task 3: 删除 cdd-review.mjs 的 --prompt（#169）

**Files:**
- Modify: `packages/osuperpowers/bin/engine/cdd-review.mjs`（L6 头注释、L41-53 usage/help、L57/L69-71 解析、L102-107 校验）
- Test: `packages/osuperpowers/bin/engine/tests/review.test.mjs`（15 用例改写）

**Interfaces:**
- Consumes: 无
- Produces: cdd-review.mjs CLI 仅接受 `--harness <name> --template <name> [--param KEY=VALUE...] [--handoff PATH]`；`--prompt` 为 unknown flag → exit 2

- [ ] **Step 1: 改写测试为 template-only 契约（先红）**

review.test.mjs 全量改写规则：

| 现用例（以名称索引，行号随文件漂移不作为索引） | 改写 |
|---|---|
| 「缺 --prompt / 未知 flag → exit 2」 | 改名「缺 --template / 未知 flag → exit 2」：`runExec(["--bogus", "x"])` 与 `runExec(["--harness","claude"])` 均 exit 2；新增 `runExec(["--harness","claude","--prompt","y"])` → stderr 含 `unknown argument: --prompt` 且 exit 2（防回归断言，字面量豁免见 Global Constraints） |
| text passthrough 系列（claude / droid / codex-not-supported / pi） | `["--harness","<name>","--prompt","hello world"]` → `["--harness","<name>","--template","spec-review","--param","DOC=/test.md","--param","PASS=completeness"]`；mock CLI 断言从「stdout == prompt」改为「stdout 含模板渲染产物特征串」（如 `Review the spec document at **/test.md**`） |
| pi stream-json 多行 pretty-printed | **位于 runner.test.mjs（invokeCli 直测，prompt 为函数入参）——无需改动**，勿在 review.test.mjs 中寻找 |
| task-review-prefix 合成（CDD_MODE=task-review） | 同上替换，断言 prefix 拼在模板渲染结果前 |
| handoff 写入系列（DONE / BLOCKED） | 同上替换 |
| template 不存在 | 不变 |
| placeholder 缺失 | 不变 |
| --template + --prompt 互斥 | 删除（--prompt 已不存在） |
| query-param 转义 | 不变 |

- [ ] **Step 2: 运行确认失败**

Run: `node --test packages/osuperpowers/bin/engine/tests/review.test.mjs`
Expected: 改写后用例 FAIL（实现仍支持 --prompt，但 unknown-flag 用例红——现实现接受 --prompt 不报错）

- [ ] **Step 3: 实现——删除 --prompt**

cdd-review.mjs：
1. L6 头注释：`(--prompt <text> | --template <name> [--param KEY=VALUE...])` → `--template <name> [--param KEY=VALUE...]`
2. L43/L50 usage/help 字符串同步改写
3. 删 L57 `let prompt = "";`
4. 删 L69-71 `case "--prompt":` 分支
5. L102-107 改为：
```js
if (!harness) usage();
if (!templateName) {
  process.stderr.write(`${NAME}: --template is required\n`);
  usage();
}
```
6. L109-111 删条件包装，直接 `const prompt = renderTemplate(templateName, params, NAME);`

- [ ] **Step 4: 运行测试确认绿**

Run: `node --test packages/osuperpowers/bin/engine/tests/review.test.mjs`
Expected: 全部 PASS

- [ ] **Step 5: 单测级 --prompt 验证（全仓扫描移至 Task 4 之后——此时 cli-task 仍含 `--prompt` 引用）**

Run: `grep -rn '\-\-prompt' packages/osuperpowers/bin/engine/cdd-review.mjs packages/osuperpowers/bin/engine/lib/`
Expected: 零输出（引擎源码内归零；全仓终验在 Task 4 Step 5）

- [ ] **Step 6: Commit**

```bash
git add packages/osuperpowers/bin/engine/cdd-review.mjs packages/osuperpowers/bin/engine/tests/review.test.mjs
git commit -m "fix(engine): drop --prompt from cdd-review, require --template (#169)"
```


### Task 4: 删除 cli-task 技能 + 全部引用清理

**Files:**
- Delete: `packages/osuperpowers/skills/cli-task/`（SKILL.md + SKILL.zh-CN.md）
- Modify: `packages/osuperpowers/README.md:28`、`packages/osuperpowers/README.zh-CN.md:28`、`packages/osuperpowers/docs/controller-handoff.md:3`、`packages/osuperpowers/docs/controller-handoff.zh-CN.md:3`、`packages/osuperpowers/skills/cli-select/SKILL.md:3`、`packages/osuperpowers/skills/cli-select/SKILL.zh-CN.md`（description 行）、`scripts/lib/emit/manifests.mjs`（kimiInstructions 文案）、**`scripts/lib/emit/emit.test.mjs`（geminiMarkdown fixture，L332 输入数组与 L339 期望字符串各删 cli-task 行）**、`packages/osuperpowers/.agents/skills/` 与 `GEMINI.md`、`.kimi-plugin/plugin.json`（emit 再生）

**Interfaces:**
- Consumes: 无
- Produces: 全仓（限定搜索树）无 `cli-task` 字样；emit 产物再生一致

- [ ] **Step 1: 删目录**

```bash
git rm -r packages/osuperpowers/skills/cli-task
```

- [ ] **Step 2: 清理引用（每处一行编辑）**

1. README.md L28 删表格行 `| \`cli-task\` | CDD Engine | Single-task CDD execution |`
2. README.zh-CN.md L28 删对应行
3. controller-handoff.md L3：`cli-driven-development, cli-task / cli-select, and the orchestrator skill` → `cli-driven-development, cli-select, and the orchestrator skill`
4. controller-handoff.zh-CN.md L3 同步
5. cli-select/SKILL.md description：`Referenced by cli-driven-development / cli-task.` → `Referenced by cli-driven-development.`
6. cli-select/SKILL.zh-CN.md description 同步
7. scripts/lib/emit/manifests.mjs kimiInstructions：`(cli-select, cli-task, cli-driven-development)` → `(cli-select, cli-driven-development)`
8. scripts/lib/emit/emit.test.mjs geminiMarkdown fixture：输入 skills 数组与期望 GEMINI.md 字符串各删 `@./skills/cli-task/SKILL.md` 行

- [ ] **Step 3: emit 再生 + emit 自测**

Run: `pnpm run emit && node --test scripts/lib/emit/emit.test.mjs`
Expected: GEMINI.md 不再含 `@./skills/cli-task/SKILL.md`；.agents/skills/osuperpowers/cli-task/ 消失；.kimi-plugin/plugin.json 更新；emit.test 全绿；exit 0

- [ ] **Step 4: 全仓 --prompt 终验（自 Task 3 移入——cli-task 已删，扫描可达零）**

Run: `grep -rn '\-\-prompt' packages/osuperpowers/bin packages/osuperpowers/skills packages/osuperpowers/docs scripts/lib/emit/ | grep -v "engine/tests/review.test.mjs"`
Expected: 零输出（review.test.mjs 防回归断言字面量为唯一豁免）

- [ ] **Step 5: cli-task grep 终验**

Run: `grep -rn 'cli-task' packages/osuperpowers docs scripts/lib/emit marketplace/source.json --include='*.md' --include='*.json' --include='*.mjs' | grep -v 'docs/superpowers/' | grep -v CHANGELOG || true; grep -rn 'cli-task' packages/osuperpowers -r --include='*.zh-CN.md' | grep -v CHANGELOG || true`
Expected: 零输出（docs/superpowers/{specs,plans,tickets}/ 历史文档按 spec §2.2/P10 排除清单豁免）

- [ ] **Step 6: Commit**

```bash
git add -A packages/osuperpowers scripts/lib/emit/
git commit -m "refactor: remove orphan cli-task skill and all references (#169)"
```

### Task 5: 收尾——全量验证

**Files:**
- 无新改动（验证任务）

**Interfaces:**
- Consumes: Task 1-4 全部落地
- Produces: 验证通过信号

- [ ] **Step 1: 引擎全量测试**

Run: `pnpm run validate`
Expected: 绿（含 emit freshness / plugin resolution / engine tests / version sync 全部块）；引擎测试计数 = 124 基线 + 10 新增（Task 1 六项黑盒 + 1 项 resolveRepoRoot 直测：跨仓核心、plan-not-found、BLOCKED、resolveRepoRoot 直测、直设 git 黑盒变体、直设裸黑盒变体、both-given + Task 2 两项：brief 归属、review-package cwd；另有 brief.test.mjs 直测 1 项）− 1 删除（Task 3 互斥用例）= ≥133 全 pass

- [ ] **Step 2: 跨仓场景手动冒烟（可选但推荐）**

```bash
# fixture 准备：fake-repo-a 含初始 commit 与 plan.md
mkdir -p /tmp/fake-repo-a && cd /tmp/fake-repo-a
git init -q && git -c user.name=t -c user.email=t@t commit --allow-empty -q -m init
printf '# Plan\n\n### Task 1: x\nbody\n' > plan.md
git add -A && git -c user.name=t -c user.email=t@t commit -q -m plan

# 模拟控制器 cd 进技能仓库调脚本，plan 指向另一仓库
cd /path/to/oscaner-skills
CDD_DRY_RUN=1 node packages/osuperpowers/bin/engine/cdd-task.mjs --harness claude --task 1 --mode implement --plan /tmp/fake-repo-a/plan.md
```
Expected: workspace 提示路径在 /tmp/fake-repo-a/.superpowers/cdd/plan 下（dry-run stderr/stdout 无 BLOCKED）

- [ ] **Step 3: 确认无遗漏**

Run: `git status --porcelain`
Expected: 干净（全部已 commit）

