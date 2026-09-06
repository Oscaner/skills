# P2 基础设施整治 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 scripts/ 全面重组为域目录 + run.mjs 单入口，采用成熟第三方依赖替换自维护组件，重构 CI workflows（composite actions + smoke），统一 Issue Templates。

**Architecture:** 先原地落地依赖（ajv/semver/execa/tinyglobby/cpSync/vitest）+ 死代码清理，再按域拆分至 `scripts/{emit,validate,release,rulesets}/` + 顶层 `run.mjs` 分发，随后 composite actions + workflow 重命名 + smoke 接入，最后统一 Issue Templates 与全量调用面清零。

**Tech Stack:** commander v15 / execa v9 / ajv v8 / semver / vitest / tinyglobby、Node ≥22（CI setup-node 24，本地 `fnm use`）、pnpm workspace、GitHub Actions composite actions。

## Global Constraints

- **vendored 子模块不可改**（`vendors/` 只读；验收 grep 排除 `--exclude-dir=vendors`）。
- **入口命名**：`run.mjs` 唯一顶层入口，子命令 `verb-object` 一致。
- **scripts 依赖锁 6 个**：commander / execa / ajv / semver / vitest / tinyglobby（其余一律用 Node 内置）。
- **每 Task 提交前** `pnpm run validate`（husky 前置钩子强制执行）必须全绿 —— 任何中间态不得破坏 12 块校验。
- **Node**：CI `setup-node` 24；本地开发 `.nvmrc` v24（用 fnm）。
- **不 commit 除非用户要求**；spec/plan 提交立即，dev 提交在 executing-plans 逐 task 完成（用户已授权 CDD 流程）。
- **禁止 attribution / co-author / AI-generation trailers**；**禁止 git worktree**。
- **base = develop**。
- **不改消费者面**：本 phase 不修改 `packages/osuperpowers` skill 内容与 `packages/cdd-engine` 产物（仅新增 smoke fixture，测试物，不进发布包）→ **无 changeset**。
- 涉及 `skills/*.md` / `docs/*.md` / `packages/*/package.json` / `hooks/` 的任何改动都必须先 `pnpm run emit`。

---

### Task 1: 底座 —— 依赖 + vitest.config + lib 测试迁移

**Files:**
- Modify: `package.json`（devDependencies + scripts）
- Create: `vitest.config.mjs`
- Modify: `scripts/lib/version-utils.test.mjs` / `scripts/lib/submodule-tags.test.mjs` / `scripts/lib/publish-vendor.test.mjs` / `scripts/lib/bump-chain.test.mjs` / `scripts/lib/first-party-publish.test.mjs` / `scripts/lib/emit/emit.test.mjs`（node:test → vitest）
- Modify: `scripts/ci-validate.mjs`（block 7）

**Interfaces:**
- Consumes: 无
- Produces: 根 `pnpm run test` = `vitest run`；root deps: commander/execa/ajv/semver/tinyglobby (dependencies), vitest (devDependencies)

- [ ] **Step 1: 安装依赖**
  Run: `pnpm add commander execa ajv semver tinyglobby && pnpm add -D vitest`
  Expected: root package.json devDependencies + dependencies 更新，lockfile 更新。

- [ ] **Step 2: 建 vitest.config.mjs**
  Create `vitest.config.mjs`:
  ```js
  import { defineConfig } from "vitest/config";
  export default defineConfig({
    test: { include: ["scripts/**/*.test.mjs"] },
  });
  ```
  vitest 不显式跑 osuperpowers（P3 前 node:test）与 cdd-engine（5b1 独立套件）。

- [ ] **Step 3: 显式测试文件迁移 node:test → vitest**
  For each of the 6 listed `scripts/lib/*.test.mjs`（含 `scripts/lib/emit/emit.test.mjs`）:
  - `import { describe, it } from "node:test"` → `import { describe, it, expect } from "vitest"`
  - `import assert from "node:assert/strict"` → 移除；`assert.equal(a, b)` → `expect(a).toBe(b)`；`assert.ok(x)` → `expect(x).toBeTruthy()`；`assert.match(s, re)` → `expect(s).toMatch(re)`；`assert.ok(...) or throws` → `expect(() => ...).toThrow()`
  - `--` 每文件迁移后跑：`pnpm exec vitest run scripts/lib/<file>.test.mjs`
  Expected: PASS。

- [ ] **Step 4: 更新 root package.json scripts**
  ```jsonc
  "test": "vitest run"
  ```
  （`emit`/`emit:check`/`validate`/`version` 保持现有 `node scripts/*.mjs` 形式不变 —— 由 Task 7-9 改投 run.mjs。）

- [ ] **Step 5: 切换 ci-validate.mjs block 7 → vitest**
  `scripts/ci-validate.mjs` block 7（当前 `node --test scripts/lib/...6 个显式文件`）替换为：
  ```js
  subprocessStep("7. scripts unit tests (vitest)", "pnpm", ["exec", "vitest", "run"]);
  ```

- [ ] **Step 6: 验证提交**
  Run: `pnpm run validate`
  Expected: block 7 vitest 全绿，其余 11 块绿，ALL PASS。
  Commit: `chore(scripts): add commander/execa/ajv/semver/tinyglobby/vitest + vitest config`

---

### Task 2: ajv —— validate-marketplace python 依赖迁移 + python 移除

**Files:**
- Modify: `scripts/validate-marketplace.mjs`（`validateSourceSchemaJson` python 段 → ajv）
- Modify: `.github/workflows/ci.yml`（移除 setup-python + pip install 步骤）
- Delete: `requirements-dev.txt`

**Interfaces:**
- Consumes: root dep `ajv`（Task 1）
- Produces: `validateMarketplaceSources()` 校验不再依赖 python；`marketplace/source.json` 由 ajv draft-07 直接校验

- [ ] **Step 1: 写失败测试（ajv 校验 source.json）**
  In `scripts/validate-marketplace.mjs`，替换 `validateSourceSchemaJson()`:
  ```js
  import Ajv from "ajv";
  const ajv = new Ajv();
  function validateSourceSchemaJson() {
    const source = JSON.parse(readFileSync(join(root, "marketplace/source.json"), "utf8"));
    const schema = JSON.parse(readFileSync(join(root, "marketplace/source.schema.json"), "utf8"));
    const validate = ajv.compile(schema);
    if (!validate(source)) {
      throw new Error(`source.json schema invalid:\n${validate.errors.map(e => `  ${e.instancePath || "/"} ${e.message}`).join("\n")}`);
    }
    console.log("OK — source.json schema");
  }
  ```
  若 ajv 校验失败 → schema/数据漂移，修复后继续（source.json 预期当前合规）。

- [ ] **Step 2: 跑通**
  Run: `node scripts/validate-marketplace.mjs`
  Expected: 三条 OK（schema / source.json / wrapper paths / marketplace sources），**不再输出 SKIP 分支**（python 路径不可达）。

- [ ] **Step 3: 删除 python 依赖**
  - Delete `requirements-dev.txt`
  - `.github/workflows/ci.yml`：删除 `actions/setup-python@v7` + `pip install -r requirements-dev.txt` 两步。

- [ ] **Step 4: 验证提交**
  Run: `pnpm run validate` + `grep -r "requirements-dev\|setup-python" .github/` 为空
  Expected: ALL PASS。
  Commit: `refactor(scripts): replace python jsonschema with ajv + drop requirements-dev.txt`

---

### Task 3: semver —— version-utils 标准段替换

**Files:**
- Modify: `scripts/lib/version-utils.mjs`（`parseSemver`/`computeNextIndependentVersion` → semver 包）
- Test: `scripts/lib/version-utils.test.mjs`（Task 1 已 vitest 化）

**Interfaces:**
- Consumes: root dep `semver`（Task 1）
- Produces: `computeNextIndependentVersion(current, bumpLevel)` 保持签名不变（内部 semver.inc）；`parseSemver` 保持返回 `{major,minor,patch} | null`

- [ ] **Step 1: 替换实现**
  `scripts/lib/version-utils.mjs`：
  ```js
  import { parse as semverParse, inc as semverInc } from "semver";
  const BUMP_LEVELS = new Set(["major", "minor", "patch"]);
  export function parseSemver(version) {
    const p = semverParse(version);
    return p && !p.prerelease.length && !p.build.length ? { major: p.major, minor: p.minor, patch: p.patch } : null;
  }
  export function computeNextIndependentVersion(current, bumpLevel) {
    // 保留既有错误契约：未知 bumpLevel → Unknown bump level（semver.inc 对非法 level 返回 null，需前置校验）
    if (!BUMP_LEVELS.has(bumpLevel)) throw new Error(`Unknown bump level: ${bumpLevel}`);
    const next = semverInc(current, bumpLevel);
    if (!next) throw new Error(`Invalid semver: ${current}`);
    return next;
  }
  ```
  `parseRouterVersion` / `computeNextVersion` **不动**（Task 4 删除）。

- [ ] **Step 2: 测试确认**
  Run: `pnpm exec vitest run scripts/lib/version-utils.test.mjs`
  Expected: acquire PASS（含既有 major/minor/patch 用例）。

- [ ] **Step 3: 验证提交**
  Run: `pnpm run validate`
  Expected: ALL PASS。
  Commit: `refactor(scripts): use semver package for standard version parse/bump`

---

### Task 4: 死代码删除 —— router 全清（修复 release 崩溃）

**Files:**
- Modify: `scripts/version-packages.mjs`（删 71-103 行 router 段 + 183 行 `versioned.push` + 151-153 陈旧注释 + 211-213 死 execSync）
- Modify: `scripts/bump-submodule.mjs`（删 42-43、55-77 router 块 + sync-router 死调用）
- Modify: `scripts/lib/version-utils.mjs`（删 `parseRouterVersion` + `computeNextVersion`）
- Modify: `scripts/emit.mjs` 第 6 行注释（router 引用改写）

**Interfaces:**
- Consumes: —
- Produces: `version-packages.mjs` 有 changeset 时不再 ENOENT 崩溃；`version-utils` 不再导出 router 函数

- [ ] **Step 1: 修崩溃（测试先行）**
  Run: `node -e "import('./scripts/version-packages.mjs').then(()=>console.log('LOADED OK'))"`
  当前 Expected（修复前）: CRASH ENOENT。修复后 LOADED OK。
  注意：该 import 触发 `getChangesets(root)` —— 若共享 .changeset/ 无待发 changeset 会早退；验证点 = 不再 ENOENT。

- [ ] **Step 2: 删除 version-packages.mjs router 内容**
  - 删 `// ---- osuperpowers-router ... ----` 段（`overridesPkgPath`…`overridesEntry` 整块）
  - 删 `versioned.push("osuperpowers-router")`（保留 osuperpowers）
  - 删 `// Sync osuperpowers version...` 注释块中 `router.md` / `sync-router-versions.mjs` 陈旧引用（保留「SKILL.md 为 stamp SOT」语义）
  - 删末尾 `sync-router-versions.mjs` 的 `DRY`/`execSync` 死分支
  - import 移除 `computeNextVersion, parseRouterVersion`

- [ ] **Step 3: 删除 bump-submodule.mjs router 块**
  - 删 `if (bumpName === "superpowers")` 内 router 分支（`currentOverrides`…`execSync(sync-router)`），超级幂 bump 仅保留 checkout + semverChanged 记录
  - import 移除 `computeNextVersion`

- [ ] **Step 4: 删除 version-utils router 函数**
  - 删 `parseRouterVersion` + `computeNextVersion` + `parseSemver` 不再依赖的注释
  - `emit.mjs` 第 6 行注释改为：「Derives `marketplace/source.json` from packages/ + vendors/ (package-as-source) and generates every first-party artifact」—— 移除 `osuperpowers-router/build` 引用

- [ ] **Step 5: 清理 .changeset/README.md router 引用**
  `.changeset/README.md` 中 **全部** `packages/osuperpowers-router` 提及删除（首段「Run `pnpm changeset` when you change behavior…」及其余各处；该文件 `node scripts/version-packages.mjs` → run.mjs 由 Task 14 更新）。

- [ ] **Step 6: grep + validate 提交**
  Run: `grep -rn "osuperpowers-router\|sync-router-versions\|parseRouterVersion\|computeNextVersion" scripts/ CLAUDE.md README.md README.zh-CN.md .changeset/ docs/maintainers/` 为空；`pnpm run validate`
  Expected: grep 无命中；ALL PASS。
  Commit: `fix(scripts): purge router dead code (osuperpowers-router removed) — fix version-packages crash`

---

### Task 5: execa —— spawn 统一

**Files:**
- Modify: `scripts/emit.mjs`（`diff -u` execSync → execa）
- Modify: `scripts/bump-submodule.mjs`（execSync → execa）
- Modify: `scripts/version-packages.mjs`（残留 execSync → execa）
- Modify: `scripts/gh-branch-rulesets.mjs`（execSync → execa）
- Modify: `scripts/lib/publish-vendor.mjs`（execSync/spawnSync → execa `$` 模板）
- Modify: `scripts/lib/submodule-tags.mjs`（execSync → execa）
- Modify: `scripts/validate-marketplace.mjs`（已无 python 残留的 spawn —— 确认移除）

**Interfaces:**
- Consumes: root dep `execa`（Task 1）
- Produces: `scripts/` 下 `child_process` 零引用；错误处理用 execa rejection（`reject:true` 或 try/catch `stderr`）

- [ ] **Step 1: 逐文件替换**
  模式标准：
  - `execSync(cmd, { stdio: "inherit", cwd })` → `execaCommandSync(cmd, { cwd, stdio: "inherit" })`（业务等同步场景）
  - `execSync(cmd, { encoding: "utf8" })` → `execaCommandSync(cmd, { cwd }).stdout.trim()`
  - spawnSync + stdout 解析 → `execaSync`
  - `execSync('diff -u ...')`（emit compare）→ `execaSync("diff", ["-u", c, g], { stdio:"pipe", cwd: root })`；仍非零捕获 stderr 报 DRIFT
  每文件后跑该文件的既有验证（validate-marketplace / bump / emit --check 冒烟）。

- [ ] **Step 2: grep 清零**
  Run: `grep -rn "child_process" scripts/`
  Expected: 空。

- [ ] **Step 3: 验证提交**
  Run: `pnpm run validate`
  Expected: ALL PASS。
  Commit: `refactor(scripts): unify subprocess spawning on execa`

---

### Task 6: tinyglobby + fs.cpSync —— 手写 walk/copyTree 清零

**Files:**
- Modify: `scripts/ci-validate.mjs`（`walk` → tinyglobby `glob`）
- Modify: `scripts/emit.mjs`（`collectTree` / `generatedPaths` 收集 → tinyglobby）
- Modify: `scripts/lib/publish-vendor.mjs`（`copyTree` → `fs.cpSync` with filter）

**Interfaces:**
- Consumes: root dep `tinyglobby`（Task 1）；Node 内置 `fs.cpSync`
- Produces: `scripts/` 下无 `function walk(` / `copyTree`

- [ ] **Step 1: ci-validate walk 替换**
  `walk(dir)` → `glob("**/*", { cwd: dir, absolute: true, dot: true })`（**`dot: true` 必须** —— 产品目录 `.claude-plugin/` / `.agents/` 等为隐藏目录，缺省 glob 会漏）。`checkZeroResidue` 与 lib-tests 发现改 glob。

- [ ] **Step 2: emit collectTree / 扫描替换**
  `collectTree(absDir)`（emitAgentsSkillsCopy 内）→ `glob("**/*", { cwd: absDir, absolute: true, dot: true })`。`--check` 的 stale 扫描（`findStaleCommittedFiles` 消费的 productRoots 递归）也换 tinyglobby：`glob("**/*", { cwd: root, absolute: true, dot: true })` 后按 `productRoots` 前缀过滤。

- [ ] **Step 3: copyTree → cpSync**
  `scripts/lib/publish-vendor.mjs` `copyTree(src, dest)` → `cpSync(src, dest, { recursive: true, filter: (p) => !COPY_EXCLUDE.has(path.basename(p)) })`，删除手写实现与 `COPY_EXCLUDE` 若保持 + 导入 `cpSync` from `node:fs`。**同步更新 `scripts/lib/publish-vendor.test.mjs` 对 copyTree 的断言**（该测试直接 import/call copyTree —— 改为断言 `cpSync` 语义（排除集合生效）或删除对应用例），保持 vitest 绿。

- [ ] **Step 4: grep + 验证提交**
  Run: `grep -rnE "function walk\(|copyTree" scripts/` 为空；`pnpm run validate`
  Expected: 空；ALL PASS。
  Commit: `refactor(scripts): replace hand-written walk/copyTree with tinyglobby + fs.cpSync`

---

### Task 7: emit 域拆分 + run.mjs（emit / emit-check 命令）

**Files:**
- Create: `scripts/run.mjs`（Commander 分发，8 命令懒加载；本次接 emit/emit-check）
- Create: `scripts/emit/{all,check,osuperpowers,marketplace,compare}.mjs`
- Create: `scripts/emit/source.mjs` / `scripts/emit/orchestrate.mjs` / `scripts/emit/manifests.mjs`（git mv 自 `scripts/lib/emit/`）
- Modify: `scripts/lib/marketplace-utils.mjs`（generatedBanner 字面量 → `scripts/run.mjs emit`）
- Modify: `scripts/ci-validate.mjs`（block 0 → `scripts/run.mjs emit-check`）
- Modify: `package.json`（`emit`/`emit:check` → run.mjs）
- Delete: `scripts/emit.mjs`

**Interfaces:**
- Consumes: 库 `generatedBanner` / 《manifest.gemini…`》（相对 import）；root deps（Task 1-6）
- Produces: `run.mjs emit`（写）/ `run.mjs emit-check`（drift，exit 1 语义）；`emit/all.mjs` → `emitAll(outRoot, {generatedPaths})`；`emit/osuperpowers.mjs` → `emitOsuperpowers(outRoot, plugin, generatedPaths)`；`emit/marketplace.mjs` → `emitMarketplaceDocs(outRoot, source, generatedPaths)`；`emit/compare.mjs` → `compareTrees(committedRoot, generatedRoot, {generatedPaths})` + `assertVersionBump()`

- [ ] **Step 1: run.mjs 骨架**
  Create `scripts/run.mjs`：
  ```js
  #!/usr/bin/env node
  import { Command } from "commander";
  const program = new Command();
  program.name("run").description("repo automation");
  const cmd = (name, desc, fn) => program.command(name).description(desc).action(async () => { await import(fn).then(m => m.main()); });
  // emit / emit-check 先接；validate/version/publish-vendor/bump-submodule/apply-rules/smoke-cdd 后续 task 逐个接入
  program.parseAsync(process.argv).catch((e) => { console.error(e.message); process.exit(1); });
  ```
  （入口后续 Task 8-10 逐步插全；注意 commander 子命令名 `emit-check`。）

- [ ] **Step 2: git mv lib/emit → emit/ + 跨树 importer 修复**
  `git mv scripts/lib/emit/*.mjs scripts/emit/`（source/orchestrate/manifests/emit.test）。修**存量** importer：`scripts/lib/publish-vendor.mjs` 的 `./emit/manifests.mjs` → `../emit/manifests.mjs`（该文件自身 Task 9 才迁移，必须保持可加载）。旧 `scripts/emit.mjs` 的 `./lib/emit/...` imports 自本步起失效 —— 它于 Step 5 删除，**期间不得运行**（中间态注明；run.mjs emit 于 Step 4 后方可用）。

- [ ] **Step 3: emit 拆分（五文件）**
  自旧 `scripts/emit.mjs` 读取逻辑（只读，不运行）：
  - `emit/all.mjs`：`export function main()` = 现有非 check 主流程（deriveSource → emitAll(root) → 打印 OK）；`emitAll` 改造为接收 `generatedPaths` 数组并传给各 emitter
  - `emit/check.mjs`：`export function main()` = check 流程（tempRoot + emitAll + compareTrees）
  - `emit/osuperpowers.mjs`：`emitOsuperpowers` + `emitAgentsSkillsCopy` + `collectTree`（可行时用 tinyglobby，见 Task 6）
  - `emit/marketplace.mjs`：`emitMarketplaceDocs`
  - `emit/compare.mjs`：`compareTrees` + `findStaleCommittedFiles` 调用 + `assertVersionBump` + `generatedPaths`/`productRoots`/`productFiles` 常量
  - 新模块 imports（`./source.mjs` / `./manifests.mjs` / `../lib/marketplace-utils.mjs`）与 Step 2 后的落位一致；`isMain` 用 cdd-engine `realpathSync(process.argv[1]) + pathToFileURL` 模式。

- [ ] **Step 4: 命令接线 + generatedBanner**
  - `package.json`：`"emit": "node scripts/run.mjs emit"`、`"emit:check": "node scripts/run.mjs emit-check"`
  - `scripts/ci-validate.mjs` block 0：`["scripts/run.mjs", "emit-check"]`
  - `scripts/lib/marketplace-utils.mjs` 的 `generatedBanner` 字面量 `scripts/emit.mjs — do not edit` → `scripts/run.mjs emit — do not edit`

- [ ] **Step 5: 删除旧入口 + emit.test 迁入**
  - Delete `scripts/emit.mjs`
  - `scripts/emit/emit.test.mjs`（Step 2 已随 mv 入 emit/）：修 import 相对路径，vitest 断言保持
 
- [ ] **Step 6: 生成 + 全量验证 + 提交**
  Run: `node scripts/run.mjs emit`（新 banner 产物落盘）&& `node scripts/run.mjs emit-check`（exit 0）&& `pnpm run validate`
  Expected: 产物含新 banner（emit-check 通过）；ALL PASS。
  Commit: `refactor(scripts): split emit domain + introduce run.mjs dispatcher (emit/emit-check)`

---

### Task 8: validate 域拆分 + validate 命令

**Files:**
- Create: `scripts/validate/index.mjs`（组合 13 block，导出 `steps` + `main`）
- Create: `scripts/validate/{emit-check,osuperpowers,engine,gate-hooks,residue,lib-tests,submodule}.mjs`
- Move in: `scripts/validate/marketplace.mjs`（= 现 validate-marketplace.mjs，块 6）+ `scripts/validate/version-sync.mjs`（= 现 validate-version-sync.mjs，块 8-10）
- Modify: `packages/osuperpowers/tests/ci-validate.test.mjs`（import 路径）
- Modify: `package.json`（`validate` → run.mjs）
- Modify: `.github/workflows/ci.yml`（`node scripts/run.mjs validate`）
- Delete: `scripts/ci-validate.mjs` / `scripts/validate-marketplace.mjs` / `scripts/validate-version-sync.mjs`

**Interfaces:**
- Consumes: block 模块全部函数的原实现
- Produces: `scripts/validate/index.mjs` 导出 `steps`（13 名字/顺序字面保留）+ `main()`；wiring guard 原样断言通过

- [ ] **Step 1: 结构性拆分**
  `scripts/ci-validate.mjs` 逻辑按 block 归入 `scripts/validate/{emit-check,osuperpowers,engine,gate-hooks,residue,marketplace,version-sync,lib-tests,submodule}.mjs`。**每模块导出 `steps` 数组**（描述符可 1..N 个，名字字段与现 block name 逐字一致 —— 如 `osuperpowers.mjs` 导出 5b marker / skills-count / rule-reference / node:test / wiring-guard 多个描述符）。`index.mjs`：
  ```js
  import { steps as emitCheckSteps } from "./emit-check.mjs";
  import { steps as osuperpowersSteps } from "./osuperpowers.mjs";
  import { steps as engineSteps } from "./engine.mjs";
  // ...
  export const steps = [ ...emitCheckSteps, ...osuperpowersSteps, /*...13 个，原顺序 */];
  export async function main() { /* 原 runner 逻辑 */ }
  ```
  `isMain` 用 realpathSync 模式（Task 7 同款）；每模块 `node scripts/validate/<name>.mjs` 可独立直跑。

- [ ] **Step 2: 独立校验器迁入**
  `scripts/validate-marketplace.mjs` → `scripts/validate/marketplace.mjs`（块 6 调 `node scripts/validate/marketplace.mjs` 保持不变）；`scripts/validate-version-sync.mjs` → `scripts/validate/version-sync.mjs`（块 8-10 同）。

- [ ] **Step 3: guard 测试 import 更新**
  `packages/osuperpowers/tests/ci-validate.test.mjs`：`import { steps, main } from "../../../scripts/ci-validate.mjs"` → `../../../scripts/validate/index.mjs`；`VAL` 常量路径同步。断言**不改**（step 名/顺序原样）。

- [ ] **Step 4: 命令接线**
  - `package.json`：`"validate": "node scripts/run.mjs validate"`（run.mjs 该命令 action → `await import("./validate/index.mjs").then(m => m.main())`）
  - `.github/workflows/ci.yml`：`node scripts/run.mjs validate`

- [ ] **Step 5: 删除旧入口 + 验证提交**
  - Delete `scripts/ci-validate.mjs` / `scripts/validate-marketplace.mjs` / `scripts/validate-version-sync.mjs`
  - Run: `node scripts/run.mjs validate` 输出含 `== <原 block 名> ==` 全绿；`node scripts/validate/marketplace.mjs` 独立直跑 OK；`pnpm run validate`
  Expected: ALL PASS。
  Commit: `refactor(scripts): split validate suite into per-block modules + run.mjs validate`

---

### Task 9: release 域拆分（version / publish-vendor / bump-submodule 命令）

**Files:**
- Create: `scripts/release/{version-packages,bump-submodule,publish-vendor,vendor-registry,vendor-assembly,submodule-tags}.mjs`
- Modify: `scripts/lib/marketplace-utils.mjs` / `scripts/lib/version-utils.mjs` 的 import 引用（相对路径修正）
- Modify: `.github/workflows/release.yml` / `bump-submodule-reusable.yml`（内部调用 → run.mjs）
- Modify: `package.json`（`version` → run.mjs）
- Delete: `scripts/version-packages.mjs` / `scripts/bump-submodule.mjs` / `scripts/publish-vendor.mjs` / `scripts/lib/{publish-vendor,submodule-tags}.mjs`

**Interfaces:**
- Consumes: `lib/version-utils`（semver 化后）、`lib/marketplace-utils`、`emit/manifests.mjs`（thinGeminiExtension/geminiMarkdown）
- Produces: `scripts/release/publish-vendor.mjs` → `publishVendor(name, {dryRun})` + `publishAll(root, {dryRun})`；`vendor-registry.mjs` → `collectGaps/probeRegistryVersion/listRegistryVersions/probeTagExists/probeReleaseExists/resolveUpstreamTag/listVendors`；`vendor-assembly.mjs` → `ASSEMBLY_TEMPLATE/assemblyTemplate/derivePiKey/resolveVendorVersion/assemblePackageJson/copyTree→cpSync/stageVendor`；`bump-submodule.mjs` → `main(name, {dryRun})`；`version-packages.mjs` → `main()`

- [ ] **Step 1: lib/publish-vendor 拆三**
  `scripts/lib/publish-vendor.mjs` 逻辑分三：
  - `release/vendor-registry.mjs`：probe 全家 + classifyProbeError + collectGaps + resolveUpstreamTag + listVendors/readGitmodules
  - `release/vendor-assembly.mjs`：ASSEMBLY_TEMPLATE/assemblyTemplate/derivePiKey/resolveVendorVersion/assemblePackageJson/assert\*/stageVendor（copyTree 已在 Task 6 cpSync 化）
  - `release/publish-vendor.mjs`：publishVendor / publishAll / defaultStageRoot + `export function main()`
  修交叉 import（vendor-assembly ← vendor-registry 的 PROBE 常量等）。

- [ ] **Step 2: 其余 release 文件 git mv**
  `scripts/version-packages.mjs` → `release/version-packages.mjs`（+`export function main()`）；`scripts/bump-submodule.mjs` → `release/bump-submodule.mjs`（+`main(name, {dryRun})`）；`scripts/lib/submodule-tags.mjs` → `release/submodule-tags.mjs`。修所有 import（`emit/source.mjs` 的 SUBMODULE_PATHS、`lib/version-utils` 等）。

- [ ] **Step 3: 测试迁移 vitest**
  `scripts/lib/{publish-vendor,submodule-tags,bump-chain,first-party-publish}.test.mjs` → `scripts/release/`，import 路径修正，vitest 断言保持。Run: `pnpm exec vitest run scripts/release` 全绿。

- [ ] **Step 4: 命令接线 + workflow/package.json**
  - run.mjs 增加 `version [--dry-run]` / `publish-vendor [--dry-run]` / `bump-submodule <name> [--dry-run]`（后两者传参给 `main`；`version` 保留现有 `--dry-run` 语义 → AC#1/#7 的 `run.mjs version --dry-run` 可测）
  - `package.json`：`"version": "node scripts/run.mjs version"`
  - `.github/workflows/release.yml`：`version: node scripts/run.mjs version` + `to_tag=$(node scripts/run.mjs publish-vendor)`
  - `.github/workflows/bump-submodule-reusable.yml`：两处 `node scripts/bump-submodule.mjs` → `node scripts/run.mjs bump-submodule`

- [ ] **Step 5: 删除旧入口 + 验证提交**
  - Delete `scripts/{version-packages,bump-submodule,publish-vendor}.mjs` + `scripts/lib/{publish-vendor,submodule-tags}.mjs`
  - Run: `node scripts/run.mjs version`（无 changeset → `No changesets — skip`）、`node scripts/run.mjs publish-vendor --dry-run`、`node scripts/run.mjs bump-submodule --help`、`pnpm run validate`
  Expected: 各命令输出符合；ALL PASS。
  Commit: `refactor(scripts): extract release domain (version/publish-vendor/bump-submodule)`

---

### Task 10: rulesets 域 + apply-rules 命令

**Files:**
- Create: `scripts/rulesets/apply.mjs`（= 现 gh-branch-rulesets.mjs 逻辑）
- Move: `scripts/gh-branch-rulesets/{develop,main}.json` → `scripts/rulesets/`
- Delete: `scripts/gh-branch-rulesets.mjs` + 旧 json dir

**Interfaces:**
- Consumes: `execa`（Task 5）
- Produces: `scripts/rulesets/apply.mjs` → `main(target)`；`run.mjs apply-rules <protect-develop|protect-main>`

- [ ] **Step 1: git mv + 命令接线**
  `git mv scripts/gh-branch-rulesets.mjs scripts/rulesets/apply.mjs; git mv scripts/gh-branch-rulesets scripts/rulesets/configs`（或 `scripts/rulesets/` 直接收 json）。apply.mjs 内路径常量改相对。run.mjs `apply-rules <target>` 命令 + `<target>` 校验（protect-develop | protect-main；其他 → usage + exit 1）。

- [ ] **Step 2: 验证提交**
  Run: `node scripts/run.mjs apply-rules --help`；`node scripts/run.mjs apply-rules bogus` → stderr usage + exit 1；`pnpm run validate`
  Expected: ALL PASS。
  Commit: `refactor(scripts): extract rulesets domain + run.mjs apply-rules`

---

### Task 11: workflows 重构 —— composite actions + 重命名

**Files:**
- Create: `.github/actions/setup/action.yml`（checkout + pnpm + setup-node 24，无 python；token/submodules 输入）
- Create: `.github/actions/link-cdd-engine/action.yml`（`cd packages/cdd-engine && npm link` + `command -v cdd-task` 断言）
- Create: `.github/actions/install-harness/action.yml`（`npm i -g @anthropic-ai/claude-code` + hermetic HOME `node packages/osuperpowers/bin/init/install-harness.mjs --harness claude` + 断言 `$HOME/.osuperpowers/state/claude.json` 存在 —— install-harness 第 6 步写入的 manifest，确定性产物）
- Create: `.github/actions/validate/action.yml`（`pnpm install --frozen-lockfile` + `node scripts/run.mjs validate`）
- Create: `.github/workflows/pr-validate.yml`（替代 ci.yml：setup → link-cdd-engine → validate → install-harness；**smoke-cdd 步骤由 Task 12 追加**——命令彼时方存在）
- Move: `.github/workflows/main-source-gate.yml` → `pr-gate-main.yml`（header 更新）
- Move: `.github/workflows/bump-submodule-reusable.yml` → `submodule-bump.yml`（header + 内部调用更新）
- Modify: `.github/workflows/submodule-sync.yml`（引用 submodule-bump.yml）
- Modify: `.github/workflows/release.yml`（header name 微调；内部已 Task 9 更新）
- Delete: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Task 1-10（run.mjs 全部命令）；Task 2（python 移除）
- Produces: 4 个 composite action（验收 #9/#15）；新命名 workflow（验收 #10）；`pr-validate.yml` 复用 setup/link-cdd-engine/validate/install-harness

- [ ] **Step 1: 4 个 composite actions**
  按上面 Files 内容创建。setup action inputs：`node-version`（default `24`）、`token`（default `''`）、`submodules`（default `'recursive'`）。install-harness：`HOME=$RUNNER_TEMP/oshome`（mkdir 后 export），结尾断言 **`test -f "$HOME/.osuperpowers/state/claude.json"`**（install-harness 第 6 步 manifest 同步，确定性产物；config/hooks 路径由 plan 执行时按 configs/ 模板复核）。

- [ ] **Step 2: pr-validate.yml**
  ```yaml
  name: PR Validate
  on: { pull_request: { branches: [develop, main] } }
  jobs:
    validate:
      runs-on: ubuntu-latest
      steps:
        - uses: ./.github/actions/setup
        - uses: ./.github/actions/link-cdd-engine
        - uses: ./.github/actions/validate
        - uses: ./.github/actions/install-harness
        # smoke-cdd 步骤于 Task 12 追加
  ```

- [ ] **Step 3: 重命名（git mv）**
  `main-source-gate.yml` → `pr-gate-main.yml`（`name: PR Gate Main`）；`bump-submodule-reusable.yml` → `submodule-bump.yml`（`name: Submodule Bump`）；`submodule-sync.yml` 的 `uses: ./.github/workflows/bump-submodule-reusable.yml` → `submodule-bump.yml`。删除 `ci.yml`。

- [ ] **Step 4: 验证提交**
  Run: `.github/actions/{setup,validate,install-harness,link-cdd-engine}/action.yml` 存在；`ls .github/workflows/` 含 6 个新名且无 3 个旧名；grep `bump-submodule-reusable` 空；`pnpm run validate`
  Expected: ALL PASS。
  Commit: `ci: extract composite actions + rename workflows (pr-validate/pr-gate-main/submodule-bump)`

---

### Task 12: smoke-cdd 命令 + CI 接入

**Files:**
- Create: `scripts/validate/smoke-cdd.mjs`（四命令 dry-run 链 + H1 断言）
- Modify: `scripts/run.mjs`（`smoke-cdd` 命令）
- Modify: `.github/workflows/pr-validate.yml`（Task 11 已建；本 task 在 install-harness 步骤后**追加** `run: node scripts/run.mjs smoke-cdd`）

**Interfaces:**
- Consumes: cdd-engine npm link（PATH bins）；fixture `packages/cdd-engine/bin/tests/fixtures/smoke-plan.md`
- Produces: `scripts/validate/smoke-cdd.mjs` → `main()`：仅依赖 Node 内置 + execa（不 import 引擎源码）

- [ ] **Step 1: smoke-cdd.mjs**
  ```js
  import { execaCommandSync } from "execa";
  const root = process.cwd(); // repo toplevel（run.mjs 以仓库根为 cwd 调用）
  export function main() {
    const plan = "packages/cdd-engine/bin/tests/fixtures/smoke-plan.md";
    const head = execaCommandSync("git rev-parse HEAD", { cwd: root }).stdout.trim();
    const cmds = [
      ["cdd-task", "--harness", "claude", "--task", "1", "--mode", "implement", "--plan", plan],
      ["cdd-task", "--harness", "claude", "--task", "1", "--mode", "task-review", "--plan", plan],
      ["cdd-task", "--harness", "claude", "--task", "1", "--mode", "fix", "--plan", plan],
      ["branch-review", "--harness", "claude", "--plan", plan, "--base", head, "--head", head],
    ];
    for (const [i, args] of cmds.entries()) {
      const out = execaCommandSync(args.join(" "), { env: { ...process.env, CDD_DRY_RUN: "1" }, cwd: root });
      const lastBlock = out.stdout.trim().split(/\n{2,}/).at(-1) ?? "";
      const ok = /status: APPROVED/m.test(lastBlock)
        && /commits: base=/.test(lastBlock)
        && /artifacts: /.test(lastBlock)
        && /blocker: /.test(lastBlock);
      if (!ok) throw new Error(`smoke step ${i + 1}: last block is not the 4-line H1 contract: ${JSON.stringify(lastBlock)}`);
    }
    console.log("OK — cdd-engine dry-run smoke (4 commands)");
  }
  ```
  注：`--base`/`--head` 取 `git rev-parse HEAD`（经 execa）。smoke 前置 `npm link`（本地需先 `cd packages/cdd-engine && npm link`，失败给清晰提示）。

- [ ] **Step 2: run.mjs 接线 + CI 步骤追加 + fixture 已提交**
  确认 `packages/cdd-engine/bin/tests/fixtures/smoke-plan.md` 已在仓（spec 提交时已建）。run.mjs 加 `smoke-cdd` → action。pr-validate.yml 在 install-harness 步骤后追加：
  ```yaml
        - run: node scripts/run.mjs smoke-cdd
  ```

- [ ] **Step 3: 本地验证**
  Run: `cd packages/cdd-engine && npm link && cd ../.. && node scripts/run.mjs smoke-cdd; cd packages/cdd-engine && npm unlink`
  Expected: `OK — cdd-engine dry-run smoke (4 commands)`；exit 0。

- [ ] **Step 4: 提交**
  Commit: `feat(scripts): add smoke-cdd dry-run smoke (4-command H1 chain)`

---

### Task 13: Issue Templates 统一

**Files:**
- Modify: `.github/ISSUE_TEMPLATE/bug_report.yml`（labels、typo、双下拉）
- Modify: `.github/ISSUE_TEMPLATE/enhancement.yml`（同上）
- Create: `.github/ISSUE_TEMPLATE/session_report.yml`

**Interfaces:**
- Consumes: spec §2.4（component 8 选项 / severity 枚举）
- Produces: 验收 #11（双下拉 + osuperpowers label + 无 spor + session_report 存在）

- [ ] **Step 1: bug_report.yml / enhancement.yml**
  - labels: `["bug", "osuperpowers"]` / `["enhancement", "osuperpowers"]`
  - description/placeholder 全部 `spor skills` → `osuperpowers skills`
  - 新增必填 dropdown `component`（8 选项，顺序如 spec §2.4）+ 必填 dropdown `session-type`（`dogfood (CDD session)` / `standalone`）

- [ ] **Step 2: session_report.yml**
  ```yaml
  name: Session report
  description: File a dogfood/CDD session report (aggregated findings)
  labels: ["session", "osuperpowers"]
  body:
    - type: textarea  # session context: branch/date/harness/skills(多选 list)
    - type: textarea  # findings 列表，每行 `[severity] component — summary`（severity: blocker/warn/nit）
    - type: textarea  # related: overall spec / issue references
  ```

- [ ] **Step 3: 验证提交**
  Run: 字段存在性 grep（无需 YAML parser；GH 渲染前无法零依赖解析 YAML）—— `grep -l "labels:" .github/ISSUE_TEMPLATE/*.yml` → 3 文件；`grep -c "type: dropdown" .github/ISSUE_TEMPLATE/bug_report.yml` ≥ 2；`grep -ciE "spor |spor skills" .github/ISSUE_TEMPLATE/` = 0；`grep -c "osuperpowers" .github/ISSUE_TEMPLATE/session_report.yml` ≥ 1
  Expected: 断言通过。
  Expected: 无语法错；无 spor。
  Commit: `feat(issues): unify issue templates — component/session-type dropdowns + osuperpowers label + session report`

---

### Task 14: 收尾 —— 调用面清零 + 全量 validate + 残留 grep

**Files:**
- Modify: `CLAUDE.md`（CI 段 line 38 `node scripts/ci-validate.mjs` → `run.mjs validate`；Architecture details line 44-45 `scripts/emit.mjs`/`scripts/ci-validate.mjs` → `run.mjs emit`/`run.mjs validate`）
- Modify: `README.md` / `README.zh-CN.md`（`scripts/lib/publish-vendor.mjs` → `scripts/release/` 路径）
- Modify: `marketplace/README.md`（同上）
- Modify: `.changeset/README.md`（`node scripts/version-packages.mjs` → `run.mjs version`；`packages/osuperpowers-router` 引用清除）
- Modify: `docs/maintainers/osuperpowers-plugin.md`（9 处脚本路径 → run.mjs / 域内模块路径，引用计数核实）

**Interfaces:**
- Consumes: 前面全部任务
- Produces: 验收 #3/#7/#12/#14/#16 全绿；`pnpm run validate` ALL PASS

- [ ] **Step 1: 文档调用面更新**
  按 Files 列逐路径更新；`docs/maintainers` 中 `pnpm run validate step 0/1 covers this via scripts/emit.mjs --check` → `run.mjs emit-check` 等（引用计数 9 处逐一核实）。

- [ ] **Step 2: 验收 grep（AC#14/#16）**
  ```bash
  grep -rnE "scripts/ci-validate\.mjs|scripts/lib/|scripts/gh-branch-rulesets|scripts/emit\.mjs|scripts/version-packages\.mjs|scripts/publish-vendor\.mjs|scripts/bump-submodule\.mjs|scripts/validate-marketplace\.mjs|scripts/validate-version-sync\.mjs" . \
    --include="*.mjs" --include="*.json" --include="*.yml" --include="*.md" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.superpowers --exclude-dir=docs/superpowers --exclude-dir=vendors
  grep -rnE "function walk\(|copyTree" scripts/
  grep -rn "child_process" scripts/
  ```
  Expected: 三条均空。

- [ ] **Step 3: 全量验证**
  Run: `pnpm run validate`
  Expected: ALL PASS（含 guard、vitest、smoke 相关不参与 validate）。

- [ ] **Step 4: 提交**
  Commit: `docs(scripts): sync command surface to run.mjs — close out P2 infrastructure overhaul`

---

## Self-review（write-plan 内建）

- **Spec coverage → task 映射**：
  - §2.2 scripts 重组 → T7-10；§2.2.3 文件拆分 → T7/8/9；§2.2.4 死代码 → T4；§2.2.5 依赖 → T1/2/3/5/6
  - §2.3 CI/workflows → T11/12；§2.4 Issue Templates → T13；§2.6 调用面 → T14
  - Acceptance 1-16 → T1-14（逐条全覆盖）
- **Placeholder scan**：无 TBD/TODO；每步含具体命令/代码。
- **Type consistency**：`run.mjs` 命令名在 T7-10/12 逐步接入并在 T14 验收；`scripts/validate/marketplace.mjs` 独立直跑路径与 T8 step2 一致；fixture 路径在 T12/Spec §2.3.3 一致。

## Downstream note（P3）

- **Enh R**：writing-plans `user-ok?`「Fix selected」死选项移除（与 docs-review Review Stopping 对齐）—— 本 plan-review 期发现，overall v1.10 + #232 comment 5549870456 跟踪，P3 实施（不在本 P2 plan 的 task 范围）。