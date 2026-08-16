# os-engineering P6a2 阶段设计：交付补齐（安装即用诚实化）

## Header

- **Version**: v1.0 · 2026-08-17
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering overall v2.9](2026-08-10-os-engineering-overall.md)
- **Depends on**: P5（CDD 引擎全迁 Node）+ P6a 引擎加固（前置检查/cli-review，本阶段前或并行）

## §0 Incremental warning

> P6a2 增量。跨阶段约定见 [overall v2.9](2026-08-10-os-engineering-overall.md)；冲突以 overall 为准。

## §1 Constraints pointer

- 不重复 overall 约定；冲突以 overall 为准。
- **交付补齐（P6a2 起）**：所有「声称安装即用」的 harness 必须真做到 —— 经 marketplace/npm/extension 装包即带 skills + gate hooks；做不到的（opencode/trae/vibe/kiro）诚实归 os-init（`os-init harness` 复制）。
- **os-init harness（P6a2 落位）**：per-harness 明确选择（只列已装 harness + 多选）；每次跑做版本 check + manifest 全量同步（自动增删改，无询问）。
- **`os-init gates` 弃用**（per-harness 取代）；`harness-detect` util 抽自 cdd-select 供共用。
- Conventional commits、无 attribution；禁 git worktree；`pnpm run validate` 保持通过。

## §2 Design body

### 2.0 范围（grilling 确认）

P6a2 交付补齐，6 项（均围绕「安装即用诚实化」）：

1. **pi key 补齐** —— engineering/overrides emit 顶层 `pi` key（`pi.skills: ["./skills"]`）→ `pi install` 注册 skills。gate extension 的 pi 交付（.ts 适配）**延迟待办**（overall §4）。
2. **gemini mattpocock-extension** —— vendored 装配为 mattpocock 生成 `gemini-extension.json`（+ 上游自带则 **error guard** 改用上游）。
3. **grok 归安装即用** —— 分类为 marketplace 通道（os-init harness grok 只指引 marketplace 安装）；原生 config 可选高级项。
4. **os-init harness（per-harness）** —— `harness-detect` util 抽自 cdd-select（只列已装 harness）→ 多选 → per-harness install → manifest 全量同步。
5. **qoder/codex manifest 补全** —— 修 P4b review 的 experimental 项（codex hooks 路径、qoder metadata-only）→ 真安装即用。
6. **P6a 前置检查对齐** —— probe 矩阵按最终通道分类（安装即用缺失 = exit 3 + 指引；os-init 缺失 = 提示 `os-init harness`）。

### 2.1 Component 1: pi key 补齐

- `scripts/lib/emit/manifests.mjs`：`piPackageKey()` 扩展 —— first-party（engineering/overrides）emit 顶层 `pi` key：`{ skills: ["./skills"] }`（显式声明，pi 自动发现包根 skills/）。
- `packages/engineering/package.json` + `superpowers-overrides/package.json`：发布时带顶层 `pi` key（emit 生成）。
- 验证：`pi install @oscaner-skills/engineering` → `pi list` 见 skills。
- **gate extension 延迟**（overall §4）：`pi.mjs` 需 `.ts` 版才能经 pi 包加载 —— 不在本阶段。

### 2.2 Component 2: gemini mattpocock-extension

- `publish-vendor.mjs` 装配 mattpocock-skills：生成 `gemini-extension.json`（薄 manifest：name/version + skills 目录 + GEMINI.md 引用；复用 `geminiExtension`/`geminiMarkdown` 逻辑）。
- **error guard**：装配前探测 `vendors/mattpocock-skills/` 是否已有上游 `gemini-extension.json` —— 有则**报错**（「上游已自带，改用上游，停用我们的装配生成」），不静默覆盖。
- first-party 若有缺 gemini-extension 也补（与 engineering 现有一致）。

### 2.3 Component 3: os-init harness（per-harness）

**`harness-detect` util**（`bin/utils/harness-detect.mjs`，抽自 cdd-select）：
- `detectInstalledHarnesses(registry) → [{ harness, cli, status }]` —— `command -v <cli>` 存在即已装。
- cdd-select + os-init harness + P6a 前置检查共用。

**`os-init harness` 交互**：
```
os-init harness                       # 只列已装 harness（多选菜单）
os-init harness grok,qoder            # 显式指定
os-init gates                         # 弃用（移除）
```

**per-harness install action**：
| 通道 | 动作 |
|---|---|
| 安装即用（claude/cursor/grok/qoder/codex/gemini/pi）| probe 该 harness 已装 engineering 插件/gate？缺失 → 打印安装命令 + 信任步骤 |
| os-init（opencode/trae/vibe/kiro）| 写原生 gate config + **复制 skills** 到该 harness 目录 + 信任步骤 |

**manifest 全量同步**（每次跑）：
- manifest（`bin/os-init/state/<harness>.json`）记录：`{ engineeringVersion, files: { path → hash } }`。
- 重跑：diff manifest vs 当前工程要写的文件集 → **自动**新增/覆盖/删除（插件内部行为变更 = 全量替换，无新旧共存，**不询问**）。
- **版本 check**：manifest 的 engineeringVersion vs 当前 → 有新版打印更新命令（不自动装）。

### 2.4 Component 4: qoder/codex manifest 补全

- **codex**（`.codex-plugin`）：hooks 命令 `../bin/gate/adapters/codex.mjs` 改插件根相对 `./bin/gate/adapters/codex.mjs`；skills 路径对齐；emit 存在 guard（P4b 已加部分）。
- **qoder**（`.qoder-plugin`）：`qoderPluginManifest` 补全 skills + hooks（在 qoder 自动发现位置）；emit 测试锁路径。
- 验证：装 `.codex-plugin`/`.qoder-plugin` → skills + gate hooks 生效。

### 2.5 P6a 前置检查对齐

P6a 的 skills-probe 配置按 P6a2 最终通道分类：
- 安装即用通道（claude/cursor/grok/qoder/codex/gemini/pi）缺失 → **exit 3** + 安装指引。
- os-init 通道（opencode/trae/vibe/kiro）缺失 → **提示** `os-init harness <name>`（非故障）。

### 2.6 错误处理

- gemini-extension 上游自带 → error guard 报错（不静默覆盖）。
- os-init harness：未装 harness 显式指定 → 报「未检测到，先装 CLI」；写失败 → 明确报错。
- manifest 同步失败 → 报告差异，不静默。

### 2.7 非目标

- ❌ 不自动安装插件（只指引 + os-init 复制）。
- ❌ gate extension 的 pi 交付（.ts 适配）—— 延迟待办（overall §4）。
- ❌ 不改引擎 H6 契约 / gate 语义。
- ❌ `os-init gates` 保留（弃用移除）。

### 2.8 验收标准

- [ ] engineering/overrides 顶层 `pi` key 就位 → `pi install` 注册 skills。
- [ ] mattpocock 装配生成 gemini-extension + 上游自带 error guard。
- [ ] `harness-detect` util（抽自 cdd-select）供 cdd-select + os-init + 前置检查共用。
- [ ] `os-init harness`：只列已装、多选、per-harness install（含 skills 复制）、manifest 全量同步（版本 check + 自动增删改）。
- [ ] `os-init gates` 移除。
- [ ] codex/qoder manifest 真安装即用（skills + gate hooks，路径正确）。
- [ ] P6a 前置检查 probe 矩阵按最终通道分类。
- [ ] `pnpm run validate` ALL PASS。

## §3 Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P6 = P6a/P6b/P6c（v2.8）| 新增 P6a2 交付补齐；P6b→P6c、P6c→P6d 顺延 | Yes — v2.9 · 2026-08-17 |
| os-init gates（P4b 交付）| per-harness `os-init harness` 取代；gates 弃用 | Yes — v2.9 |
| pi 安装即用（P4b 曾声称）| pi key 补齐；gate extension .ts 交付延迟待办 | Yes — v2.9（§4）|
| grok 原生 config（P4b 曾推荐）| grok 归安装即用（marketplace）；原生可选 | Yes — v2.9 |

## §4 Notes for downstream

- **延迟待办**：pi gate extension 的 `.ts` 交付（gate adapter `pi.mjs` → `index.ts`/`.ts` 包装）—— 使 `pi install` 随包加载 gate extension。
- P6a 前置检查（skills-probe 矩阵）依赖 P6a2 的通道分类 —— 顺序 P6a2 前或并行但引用最终分类。
- research 文档 `docs/research/2026-08-16-harness-plugin-availability.md` 为探测路径 SOT。

## §5 Review

Rule 1 三个 subagent pass 通过后交用户 review，再进入 writing-plans。
