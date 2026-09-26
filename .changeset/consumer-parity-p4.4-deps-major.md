---
"@oscaner-skills/cdd-engine": major
---

P4.4 全树 deps 升最新（cdd-engine major）——4 major 破坏面逐项消化登记：

- **execa 9 → 10（BREAKING 用例面）**：`execaCommand` / `execaCommandSync` 删除（v10 全量改数组式/template literal 调用）；本仓 consumer-sim（`scripts/validate/smoke-cdd.ts`）的 `git rev-parse HEAD` 调用迁 `execaSync("git", ["rev-parse", "HEAD"])`。其余运行时面（`execa`/`execaSync`/`extendEnv`/result `stdout`·`stderr`·`exitCode`·`timedOut`）在 v10 保留，engine 派发链（`spawnManaged` 进程组 + dry-run 五命令链）实证未破坏。
- **typescript 5 → 7（BREAKING 工具链面）**：TS7 原生（Go）移植不随包发布 JS compiler API——依赖该 API 的工具（unbuild 的 rollup-plugin-dts dts 生成）装载即抛错；修复 = 补装官方兼容包 `@typescript/typescript6`（rollup-plugin-dts 的 fallback 通道），`pnpm build`（真 dts 产物）与 `dev:stub` 恢复。编译/类型行为：native `tsc` 对本仓编译面产出与 5.9 **零新增错误锚点**（684 处 pre-existing 测试文件类型债，升级前后位置集逐位一致）。
- **vitest 3 → 5（迁移面零变更）**：使用面（`pool: 'forks'` / `globalSetup` / `maxWorkers` / `minWorkers` / `maxConcurrency` / `testTimeout` / `coverage.provider` / `include` 共置 glob）在 v5 全部保留有效；engine 套件（1010）与 scripts 套件（228）原配置全绿，无需迁移。
- **@types/node 22 → 26（类型面零新增）**：升级前后 `tsc` 错误锚点集合逐位一致，无新增 node 类型面破坏。
- **全树 caret floor 刷新**：`^0.2`→`^0.2.2`（citty）· `^7`→`^7.8.5`（semver）· `^3`→`^3.4.2`（consola）· `^4`→`^4.7.9`（handlebars）· `^6`→`^6.1.2`（hookable）· `^3.36.0`（simple-git）· `^0.2.17`（tinyglobby）· `^8.20.0`（ajv）；`pnpm outdated` 零落后、`pnpm install --frozen-lockfile` 零 diff。

> **Semver 说明**：4 major deps 升级为消费面破坏（engine 行为面随 execa 用例面/构建工具链迁移），cdd-engine 按 major 发布；`@typescript/typescript6` 仅为工具链兼容包（不禁用 TS7 native tsc）。
