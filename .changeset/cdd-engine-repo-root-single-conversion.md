---
"@oscaner-skills/cdd-engine": patch
---

fix: repoRoot 唯一转换 + 输入漏斗归一 + 仓库外告警 + 推算不出 BLOCKED（P9 T2/T3 · §2.3/§2.4/§2.6/§2.10）:

- **`--root` 退役（breaking）** — `implement`/`review`/`fix`/`board` 四命令的 `--root <path>` 旗标删除（`declare.ts` 的 `ARGV_CHANNEL` 条目 + 四命令 `keys` 引用）。消费面残留 `cdd <cmd> --root X` 现在落入 commander 的 `error: unknown option '--root'`（usage 面退 2）。
- **repoRoot 唯一转换点** — 引擎生产代码 `process.cwd()` → repoRoot 的转换收为**恰好 1 处**（`Cli#rootOf` · `git.topLevel(process.cwd())`）；三注入缝（`CliOptions.cwd`/`repoRoot` · `Cli.#cwd`/`#repoRoot` · `CliLifecycle` 的 `repoRoot` 构造参数）全部退役，spawn cwd 归一为 repoRoot。机器 pin：生产面 `process.cwd()` 恰 1 处 · `git.topLevel` 转换点恰 1 处 · 三缝零残留。
- **仓库外路径接 + `CDD_WARN`** — 输入漏斗（`Cli#funnel`）对全部 path-typed argv（`--plan`/`--spec`/`--findings`）**恰好一次** `RepoRoot.relativize` → 品牌 `RepoPath`；含 `..` 分段的仓库外路径**接**（读得动即放行 · shape 判定非 location），stderr 走单一 `CDD_WARN:` 站提示「path is outside the repository」。
- **推算不出 repoRoot → `CDD_BLOCKED` 退 1** — cwd 不在任何 git 仓内（`git.topLevel` 返 null）时走既有 BLOCKED 语义：stderr 携因（`cannot resolve the repository root …`）、退出 1（非 usage 面退 2 · 零新消息面）。
- **渲染/回显面路径基准单源（D47 · §2.13）** — `runSchemaSkeleton` 的 stdout 行 + 写失败字节、`readText` 的读失败字节一律回显品牌 `RepoPath`（repoRoot 相对形），`RepoRoot.resolve` 仅喂 `fs` syscall（绝对形不落盘、不回显）。
