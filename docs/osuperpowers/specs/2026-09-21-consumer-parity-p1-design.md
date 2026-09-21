# 消费者面一致性（Consumer Parity）— P1 Design Spec

- **Version**: v1.0 · 2026-09-21
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)
- **Parent program**: [2026-09-21-consumer-parity-overall.md](./2026-09-21-consumer-parity-overall.md) · v1.7
- **Depends on**: 无（program 起点）

---

## Section 0: Incremental warning

> P1 增量仅限本 phase。跨 phase 约定见 [overall v1.7](./2026-09-21-consumer-parity-overall.md)；overall 冲突时 overall 胜。

本 spec 只做 **P1（分歧面审计 + 判定登记 + 13 件 frozen 文档清理 + S5 单行修正）** 的设计增量。engine 执法改动（P2 全量审计）、仓库面退役（P3）、发布闭环（P4）不属于本 phase，仅以"上游输入契约 / 下游交接物"形式出现。

## Section 1: Constraints pointer

> 不重复 overall 约定；overall 冲突时 overall 胜。

引下列 overall v1.7 条目，不重述正文：
- **判据定式**（C1 可达性 / C2 结构性 / C3 退化——useless 必删、无历史叙述豁免）：overall Program charter · Cross-cutting + v1.7 change-history
- **Non-goals**：不新增 cdd CLI 子命令 · 不改 emit/marketplace/changeset 内部流水（doc-structure 渲染目标例外）· 不把本仓 GitHub issue 注册语义强加消费者 · 不改 README/CLAUDE.md harness 宣称类
- **约束**：允许 breaking · 唯一执法面 = engine lifecycle（本仓无 scripts 侧兜底）· spec/plan 结构定义同源派生（P2 载体）· engine 零文档写入 · 本仓=canary
- **语言**：Strategy B（spec/plan 中文）

## Section 2: Design body

本 phase 增量 = **分歧面逐项审计 + 判定登记（triage 判定表）+ shim 清单 + 13 件 frozen 文档清理（裁决 A）+ S5 修正**。核心产出物是**判定表与处置表的落盘**——执法改动不在此 phase 实现（P2），仓库面退役不在此 phase（P3）。

### 2.1 判据应用（overall v1.7 定式，本 spec 只给裁定结论）

| 分歧项 | 现执法位置 | 判据命中 | 判定 | P2 delta（未镜像集） |
|---|---|---|---|---|
| ① 双向 backfill 声明 ↔ 列 | scripts-only（`overall-consistency.ts` backfill claim↔column 双向；engine 无对应） | C1 | → engine 全量审计 | **新增**（engine 无此检查） |
| ② 文档存在性 glob（plan/design 存在） | scripts-only（slug glob；engine 仅 plan `**Spec:**` 解析） | C1 | → engine 全量审计 | **新增**（存在性 glob） |
| ③ 依赖图成员（dep-graph + Dependency 列 ∈ Phase ids） | scripts-only（engine 无 graph 校验） | C1 | → engine 全量审计 | **新增** |
| ④ phase 注册完整性 | engine necessary subset 已有 `plan 携带 phase id → parent 注册`（类 Class-B 局部）；scripts 全量面不存在 | C1 | 随必要子集并入全量审计（不单列） | **扩全**（现有子集→全量） |
| ⑤ 锚点注册域（锚点 ∈ overall Issue inventory 表行；无锚 no-op） | scripts-only（`#NNN#issuecomment-\d+` registry） | C1 | → engine 通用自证（无锚 no-op） | **新增** |
| ⑥ issue 行 well-formed | scripts-only（row-shape/Phase ∈ ids） | C1 | → 并入 engine 判据面 | **新增** |

**已镜像（engine necessary subset 现持有，不迁移、不双实现）**：change-history 严格递增（③ 子面）· Class A（plan `**Spec:**` 解析 + label==basename）· Class B（plan `**Parent program**` → `*-overall.md` + version lineage）· 占位符 `{{…}}` 零容忍。

**未镜像集 = P2 全量审计的精确 delta**（上表"新增/扩全"五行 + Class C 通用路径锚点）——本判表是 P2 scope 的机械输入契约。

### 2.2 Shim 清单（S1–S6，四分类）

| # | shim 项 | 类别 | 处置 | 责任 phase |
|---|---|---|---|---|
| S1 | `scripts/validate/overall-consistency.ts`（block 12 四表守卫） | a 替换执法 | 全量审计并入 engine（C1 命中）→ 本仓执行面退役 | P2 并入 · P3 退役 |
| S2 | `scripts/validate/plan-spec-anchors.ts`（Class A/B/C + 42 用例 = 27+15） | a | A/B 已镜像保持；C + 未镜像集并入 engine；42 用例迁移/删除 | P2 · P3 |
| S3 | 活文档残留簇（writing-overall-spec SKILL:54 · add-phase-protocol:14/38/44/79 · overall-spec-template:12/36/79/146 · osuperpowers-plugin.md:116-120 · CLAUDE.md:47 · consumer-parity overall:50/59/68/91） | b 声称残留 | P3 退役时改写为 engine 执法位表述（现状声明化） | P3 |
| S4 | `smoke-cdd`（fixture + dry-run ≠ 消费者 pack→install 路径） | c 路径差异 | P3 升级 consumer-sim（pack→安装→消费者等效链）挂 release 门 | P3 |
| S5 | `run.ts:89` stale「(4-command H1 chain)」≠ 实际 5-command | d 描述漂移 | 本 phase 单行修正（见 §2.5） | P1（本 phase） |
| S6 | `.changeset` ×2「block 12 守卫」声称（backlog-cdd-engine-patch / backlog-osuperpowers-minor） | b | P4 版本化时清除（该两件在×9 整合清单） | P4 登记 |

**排除项（观察项，不入 shim 清单）**：engine 黑盒测试 `cwd=REPO_ROOT`（E2②/G4① dirty-tree 降级）——测试基建文档化行为，非绕产品面短路面。

### 2.3 13 件 frozen 文档清理处置表（裁决 A：无历史叙述豁免，useless 必删）

**处置判据**：
- **J1 主张性引用**——把 scripts-side 守卫表述为**现行/本仓 charter 执法主体、maintainer-mode dogfood 归属**的句子 → **改写为历史时态中性句**（陈述"当时由 repo 侧守卫承担；已于 consumer-parity 归位 engine lifecycle"），或删除（无保留价值）。
- **J2 执行叙述引用**——计划任务对 validate/守卫的**调用与预期输出记录**（当时时态 + 执行事实）→ **保留为历史档案**（篡改 = 伪造历史）；在处置表登记划类 + 判定为不构成现行执法主张。
- **J3 无关引用**——文件路径/commit message 归档 → 保留，登记。

| 文件 | 引用位置 | 类别 | 处置动作 |
|---|---|---|---|
| `2026-09-13-osuperpowers-overhaul-overall.md`（canonical） | :106 | J1 | 改写为历史时态中性句（"当时由 scripts/validate 承担 charter 守卫，已归位 engine"）；表格结构/四表不破坏 |
| `2026-09-13-osuperpowers-overhaul-p6-design.md` | :263（G3 行） | J1 | 改写为历史时态（G3 当时裁决 = 当时状态；现已被 consumer-parity 取代） |
| `2026-09-13-osuperpowers-overhaul-p6.md` | :134（Task 16 ①） | J1 | 改写为历史时态（任务叙述保留，守卫归属主张中性化） |
| `2026-09-13-osuperpowers-overhaul-p2.md` | :34 · :88 · :106-108 · :112 · :133 · :146 · :149 · :162-163 · :306-307 · :401（共 11 处） | J2/J3 | 全部保留为历史执行记录（block-12 当时预期输出/文件操作/commit message）；逐处登记划类，**不改写**（详见 §2.3.1） |
| 其余 9 件（overhaul p1–p5 design/plan 无 grep 命中） | — | — | 全量 grep 复查（见 Acceptance）确认零命中 |

#### §2.3.1 p2-plan 11 处划类明细（J2/J3，保留不改）

| 行 | 内容概要 | 划类 | 理由 |
|---|---|---|---|
| 34 | Task 1 Step 5 "block 12 本轮预期 SKIP" | J2 | 当时执行预期（validator 仍指旧根），历史时态 |
| 88 | "block 12（overall consistency）本轮预期打印 SKIP" | J2 | 同上 |
| 106-108 | Files 引用 `scripts/validate/overall-consistency.mjs:32,39,40,461` | J3 | 当时文件操作记录（旧 .mjs 名，已 .ts），归档 |
| 112 | "新 overall 满足 canonical 4-table 守卫；block 12 恢复启用" | J2 | 当时任务产出预期 |
| 133 | 建议的 change-history v1.7 行文案（含守卫字样） | J2 | 已入 overhaul overall 的 change-history（append-only 记录），本行是其写入指令副本 |
| 146 / 149 | Task 2 Step 3 "block 12 恢复" | J2 | 当时验证预期 |
| 162-163 | commit message "overall-consistency 单根" | J3 | 提交说明归档 |
| 306-307 | `scripts/validate/residue.mjs:3-10...` | J3 | 当时文件操作记录（旧 .mjs），归档 |
| 401 | "13 块全绿（含 block 12 的 3/4 canonical）" | J2 | 当时全量验证预期（当时 validate 13 块，现 12 块——历史事实） |

### 2.4 S5 单行修正（`scripts/run.ts:89`）

`run.ts` 中 `smoke-cdd` 的 command 描述当前为「(4-command H1 chain)」，实际 smoke-cdd.ts 执行**五命令** dry-run 链（implement / review task / fix task / review branch / fix branch）。单行改为「(5-command H1 chain)」。改后 `pnpm run validate` 的 scripts unit 套件（`scripts/__tests__/run.test.ts` 等）不依赖该描述文本 → 无测试改动面。

### 2.5 文字改动面汇总（经 cdd 链 review，验收③）

| 改动 | 文件 | 判据 | phase |
|---|---|---|---|
| 13 件 J1 改写（3 处） | overhaul overall:106 · p6-design:263 · p6-plan:134 | 裁决 A（useless 必删） | P1 |
| J2/J3 保留登记（11 处） | p2-plan | 历史档案（不伪造历史） | P1（登记） |
| S5 单行修正 | scripts/run.ts:89 | C3 + 描述漂移 | P1 |

### Acceptance criteria

- AC1 **判定表落盘**：本节 §2.1–2.2 的判定表 + shim 清单构成 P1 design 产物（`table/清单` 以上表为准）；每行含判据命中列 → 判定可复现。
- AC2 **13 件零现行主张**：`grep -rnE "overall-consistency|plan-spec-anchors" docs/osuperpowers/specs/2026-09-13-* docs/osuperpowers/plans/2026-09-13-*` 命中逐处可划类（J1/J2/J3，本表已登记）；J1 类改写后 `grep` J1 残留 = 0；J2/J3 保留登记齐备。**block 12 自检 2/2 仍绿**（改动不破坏 canonical four-table 结构）。
- AC3 **cdd 链 review**：本 spec 经 `cdd review --type spec` 收敛（blocker=0 + 全 finding 落地）后提交；文字改动面（§2.5 表）与 pe 判定表同步经 review。
- AC4 **S5 落地**：`scripts/run.ts:89` 描述与 smoke-cdd.ts 实际五命令一致；`pnpm run validate`（scripts unit 面）全绿。
- AC5 **零实现改动**：P1 不触碰 engine 源码、不新增 CLI 子命令、不退役守卫代码（退役 = P3）；唯一代码面改动 = S5 单行文本。

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| 验收②「13 件无残留」 | 裁决 A：frozen 照清（J1 改写 + J2/J3 登记），无历史叙述豁免——本 phase 执行面 | Yes — v1.7 · 2026-09-21 |
| 「能去掉的去、能并入 engine 的并」 | C3 判据 explicit：useless 必删（不留债务） | Yes — v1.7 |
| 无 shim 条目 | 新增 S5（run.ts:89 描述漂移，归 P1）· S6（.changeset ×2，归 P4） | Yes — v1.7 |

> `Overall updated?` 全为 Yes（v1.7 已回填）——无未登记偏差。

## Section 4: Notes for downstream

- **P2（engine lifecycle 统一抽象）**：输入契约 = §2.1「未镜像集」表（新增 ②③⑤⑥ + 扩全 ④ + Class C）+ S1/S2 并入面；harness 契约统一（docs-family fix commit 义务 concretize）为本程序 v1.4 既有登记项，不在本表内。
- **P3（仓库面退役）**：输入 = S1/S2 退役 + S3 活文档残留簇（file:line 已列）+ S4 consumer-sim + 42 用例迁移面（27+15，`scripts/validate/__tests__/`）。
- **P4（发布闭环）**：输入 = S6（两 changeset）+ ×9 旧 changesets 版本化 + pack 内容审计。
- 本 phase 无「later phases 会处理」悬空项——所有跨 phase 移交均落上游 overall（v1.7）或本 §4 指针。

## Section 5: Review

- **Baseline = committed tree**：进入 review 前工作树干净（entry gate）；review 读 dispatch 入口时的 committed tree。
- **Convergence**：blocker > 0 → fix 全部 findings → 重审；blocker = 0 → fix 全部（warn/nit 含）→ 停，不再审（Review Convergence，CLAUDE.md）。
- 本 spec 经 `cdd review --type spec --spec docs/osuperpowers/specs/2026-09-21-consumer-parity-p1-design.md` 单轮收敛。