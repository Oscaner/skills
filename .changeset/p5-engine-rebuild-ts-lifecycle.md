---
"@oscaner-skills/cdd-engine": minor
---

P5 engine 全面重建：全量 TS + unbuild、生命周期域重建、第三方收敛、CLI 换 citty（黑盒契约零变化）。

**TS 化 + 构建：**

- 全量 TypeScript + unbuild 构建（抽象基类虚方法成为编译期约束）；`main`/`exports`/`bin` → `dist/cli.mjs`，dev 与发布同走 dist 入口（`unbuild --stub` 即时加载）；`bin/cdd.mjs` 并入 `src/bin.ts`。

**CLI 换 citty（commander 移除）：**

- 顶层命令面 = implement / review / fix / base-branch（base-branch 保留嵌套 set/get），guardArgs 未知 option 拒绝；--help/usage 经 citty 声明；退出码经 bin 包装归一。

**生命周期域重建：**

- `DispatchLifecycle` 抽象基类（模板方法 run()：pre-flight → dispatch → post-flight）+ `TaskLifecycle`/`DocsLifecycle` 功能聚簇继承覆写 + hookable 注册面（dispatch:before/after 固定 hook 点）+ `PHASES` 数据化阶段表。
- **commit 边界双门**：入口门（review/fix dispatch 起点干净树校验，dirty → BLOCKED）+ 出口门（validateCommitContract）；docs 面同消费双门；`fix/docs.md` 补提交指令。

**第三方依赖收敛（spec §2.13，只维护功能逻辑）：**

- simple-git 替换手写 git（`execFileSync("git")` 零残留）、tinyglobby 收 glob、handlebars 替换占位替换循环、consola 统一日志；yaml/husky 等按边界见文档；不引清单（XState/tapable/emittery/oclif/js-yaml 等）登记于运维文档。

> **semver 说明**：全量重建为**内部形态**——engine 黑盒契约（4 子命令面 / handoff 输出 / failure 类目）零变化，skills 与消费者面零感知，400+ tests 为迁移护栏；按 minor 发布（无 breaking，亦非纯 patch 级机械改动）。