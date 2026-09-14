# P2 — cdd review spec/plan Stopping ref 增内容状态维度（演进重审通道）— Design

- **Version**: v1.1 · 2026-09-11
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-10-session-report-246-overall.md](../specs/2026-09-10-session-report-246-overall.md) v1.9
- **Depends on**: P1 (cdd-engine 生命周期统一，已 shipped) — 无 hard 代码依赖，但 gate 所在文件族（lib/cli/review.mjs、lib/runner/run-docs.mjs、lib/runner/review-loop.mjs）同处 P1 重排后的目录布局

---

## Section 0: Incremental warning

> P2 increment only。跨 phase 约定在 [overall](2026-09-10-session-report-246-overall.md)；overall 冲突时 overall 胜。本 phase 只动 docs-type（spec/plan）review 的 Stopping ref；task/branch 的 git-range ref 机制不动；fix-mode 存续决策属 P3，不在本 phase 范围。

---

## Section 1: Constraints pointer

> 不重复 overall 约定。仓库语言政策：spec 中文（Strategy B）。改动须过 `pnpm run validate` 12 块；skills 文档改动后必须 `pnpm run emit`（`.agents/` 是派生产物，禁止手编）。vendored 子模块不可改。changeset 逐 phase（cdd-engine minor）。

---

## Section 2: Design body

**Issue**: F5（[#246#issuecomment-5615909120](https://github.com/Oscaner/skills/issues/246#issuecomment-5615909120)，#230 follow-up）——`cdd review --type spec/plan` 内容演进无法开新 review cycle。

### §2.1 根因（高维度：review 的内容状态绑定缺失）

四 type 收敛原则：**review 绑定被审内容的状态，不是位置**。内容状态变 → 旧 review 作废 → 新 review 正当；内容状态不变 → 旧 review 仍有效 → 重跑是浪费（U1 禁止）。

| type | Stopping ref | 内容状态维度 | 演进后可开新 review |
|---|---|---|---|
| task | task commits git-range（task-N-review-{R} 族） | ✅ 提交快照 | ✅ |
| branch | `base7..head7` git-range（文件名内） | ✅ 提交快照 | ✅ |
| **spec/plan** | **仅 `doc_path`** | ❌ 无 | ❌ exit 3（F5） |

spec/plan 的 Stopping ref 只比对 `prev.doc_path === doc`（`review.mjs:132`）：内容演进不改路径 → 视为同 ref → `APPROVED + blocker=0` 硬锁。引擎对 spec/plan **没有建模「被审内容的哪个版本经过验证」**——错误消息 *"change ref to open a new review"* 指向一个对 docs 尚不存在的可变 ref，用户被叫去做不可能的事。task/branch 以 git 为内容状态 token，spec/plan 在裸文件系统上无版本、无 token。

**Fix direction**：把文档型 review 的内容状态建模为**一等字段**（content-state token），而非 gate 里的一段补丁逻辑——

1. `doc_hash`（sha256 hex）进 docs review handoff（`spec-review-{R}.json` / `plan-review-{R}.json`），记录「这轮验证过的内容」；引擎在定稿写盘时注入（载体唯一作者 T7，agent 不贡献）。
2. Stopping ref 升级为 `(doc_path, doc_hash)` 双签名：内容状态相同（hash 相同）→ 同 ref → U1 硬停；内容演进（hash 不同）→ 新 ref → 放行新一轮。legacy（无 `doc_hash`）→ 内容状态未知 → 保险按同 ref 硬停（现行为保留，不意外重开在途 workspace）。
3. 引擎自文档化——**拒绝消息按场景分写**：hash-era 内容未变 → *"编辑 doc 内容 或 新建 doc 可开新 review"*（可行）；legacy（无 doc_hash）→ *"新建 doc 或 移除陈旧 review handoff 以重开 workspace"*（legacy 下改内容不可达，不许 impossible 指引）。放行时 `CDD_INFO` 说明「内容自 round-{R} clean review 后演进 → 新 review round N」（仅 prev 为 APPROVED 时打印，见 §2.3.2）。
4. 四 type 统一表述落地到 review.md Stopping 规则（原则 + spec 演进重审路径文档化）。

### §2.2 设计决策（含破坏性更新许可下的取舍）

- **底座：内容 hash 全字节 sha256（node:crypto），不归一化**。白空格/行尾异动会触发新一轮——单轮 review dispatch 是良性代价，换取零归一化复杂度（无 .gitattributes 等价物、无版本头纪律依赖）。在 code 注释与 review.md 显式记录该选择。
- **放行方式：内容变即新 ref 自动放行，不加确认旗标/旁路面**。与 task/branch「ref 变了 engine 测不到 ref-change、靠 orchestrator 纪律」既有模型对齐（review.md §run-review 已文档化为 orchestrator obligation）；U1 的真防护（未变内容重跑）由同 hash 硬停完整保留。可选 `--evolve` 确认门、版本行感知等更保守方案被否：加旁路面=变相撕 U1；版本行感知依赖文档版本纪律（plan 无强制版本头）脆弱不可靠。
- **legacy 语义：`prev.doc_hash == null` → 视同 ref 相同 → 走既有 gate（硬停）**。新放行通道只对携 `doc_hash` 的新 handoff 打开；在途 workspace 的旧 clean review 不意外失锁。schema 中 `doc_hash` 为 optional（`additionalProperties: false` 加属性必配；`required` 不加，老 handoff 不失效）。
- **doc_hash 覆盖范围：仅 docs review-mode handoff**（review.spec / review.plan 定稿写盘）。fix-mode handoff 非 Stopping gate 读取对象，不注（YAGNI，缩小 diff）。BLOCKED 失败写盘（handoff 未写 / schema 无效两路径）同样注 hash（uniform：引擎 author 的所有 docs review 载体都带内容状态）。
- **不在 gate 侧加文件存在性硬检**：`hashFile(doc)` 对缺失文件返回 `""`（空串哨兵，与真实 hex 永不等——同 §2.3.1 规范化定义）→ 按「ref 变了」放行 → 下游 runDocsTask 自然失败。dry-run（fake 路径）不受影响（不读文件不抛错）。此边角经注释记录。
- **`--round` 语义不变**（backfill 校验，冲突 exit 2）；hash 后合法演进要么不带 `--round` 由 engine 自增，要么显式 `--round 2` 对齐 engine 推导值。
- **改动面最小化**：唯一 gate 谓词改动在 `review.mjs:129-132`（spec/plan 分支）；消息单点 `reviewStoppedError`（`review-loop.mjs:21`）；写盘注入在 `run-docs.mjs` review-mode 定稿路径。不重构为统一同 ref 判定函数（四 type 现状天然不同形，过度抽象=tech debt）。

### §2.3 组件与数据流

1. **`hashFile(doc)` helper**：`lib/runner/review-loop.mjs` 新增导出（该模块已是 review 共享逻辑驻点：`reviewStoppedError` 等）。`node:crypto` `createHash("sha256")` 读全文件 → hex；`existsSync` false / 读失败 → `""`（空串哨兵，保证与任何真实 hash 不等）。
2. **gate 升级**（`lib/cli/review.mjs` spec/plan 分支）：
   ```
   const docHash = hashFile(doc);
   if (prev && (prev.doc_path ?? "") === doc) {
     const legacy = prev.doc_hash == null;                      // 内容状态未知（pre-hash 时代 handoff）
     const contentSame = !legacy && prev.doc_hash === docHash;  // 内容未变 → 同 ref
     if (legacy || contentSame) {
       // 两类锁死场景走同一 guard，消息按 reason 分写（§2.3.4 单点）
       reviewStoppingGuard(prev, opts.type, round, doc, { reason: legacy ? "legacy" : "unchanged" });
     } else if (prev.status === "APPROVED" && docHash) {
       // 内容演进 + 既有 clean review → 新 ref → 放行 + 自文档化。
       // docHash 空串哨兵（ghost doc，§2.4）不印 CDD_INFO —— 已删文档非「演进」：静默放行、下游自然失败。
       process.stderr.write(`CDD_INFO: doc content changed since round-${round-1} clean review (${prev.doc_hash.slice(0,8)} → ${docHash.slice(0,8)}) → new review round ${round}\n`);
     }
     // 其余 prev（BLOCKED/CHANGES_REQUESTED）→ 无声放行重派（SP-4：失败轮永不锁死）
   }
   ```
   语义：legacy（hash 缺失）或 内容未变 → 既有 gate（exit 3，消息按 reason 分场景）；内容演进 + prev clean（APPROVED）→ `CDD_INFO` + 放行；ghost doc（docHash 空哨兵）→ 静默放行不印 CDD_INFO；非 clean prev 无视 hash、无声放行（SP-4）。
3. **写盘注入**（`lib/runner/run-docs.mjs` review-mode 定稿路径）：`finalizeHandoff` 后，`writeOwnHandoff(handoffPath, { ...(finalized.handoff ?? handoff), doc_hash: hashFile(doc) })`——review-mode 恒有 doc_hash 变更 → 恒写（不再复用 `persistFinalized` 的 skip-write）；fix-mode 保持原 `persistFinalized`。BLOCKED 两条失败写盘（handoff 未写 / schema 无效）同样并入 `doc_hash`。**内存返回值同步**：新写盘路径必须同时维护 runDocsTask 返回的 `{ handoff }`——`local.status = finalized.handoff.status`（warn-only rollup 覆写 APPROVED 不得丢失）+ `local.doc_hash = hashFile(doc)`，返回对象与磁盘定稿一致；docs-runner.test.mjs 既有 T5 回归（`result.handoff.status === "APPROVED"`）列为硬性断言。
4. **消息单点**：`reviewStoppingGuard` / `reviewStoppedError` 增选参 `{ reason }`（`"legacy" | "unchanged"`）——同一 guard 出口，消息按场景分写（§2.2 bullet 3）：`unchanged` → *"doc content unchanged since round-{R} clean review — edit the doc content or open a new doc to start a new review"*；`legacy` → *"pre-content-hash review handoff (no doc_hash) — content state unknown; open a new doc or remove the stale round-{R-1} review handoff to re-review"*。缺省 reason 保留现消息（task/branch 调用面不变）。

### §2.4 错误处理

| 情形 | 行为 |
|---|---|
| 内容未变 + APPROVED+0 prev | exit 3（Review Stopping，U1 保留）；reason=`unchanged` 消息：「编辑 doc 内容 或 新建 doc 可开新 review」 |
| 内容演进 + APPROVED+0 prev | `CDD_INFO` 一行（仅此场景打印，且 docHash 非空）+ 放行 review round N |
| legacy prev（无 doc_hash） | 按内容未知 → 同 ref → exit 3（现行为保留）；reason=`legacy` 消息：「新建 doc 或 移除陈旧 review handoff 以重开 workspace」——不给对 legacy 不可达的改动指引 |
| BLOCKED/TIMEOUT prev | 照旧放行（SP-4：失败轮永不锁死）；无声（无 CDD_INFO） |
| doc 文件缺失/读失败 | `hashFile` → `""` → 按 ref 变静默放行（不印 CDD_INFO——ghost doc 非演进）→ 下游 runDocsTask 自然失败 |
| `--round` 与 engine 推导不一致 | exit 2（既有 backfill 校验） |

### §2.5 测试

扩展 `cdd.test.mjs` canonical Stopping 黑盒矩阵为「内容状态表」；seed 辅助 `seedDocsReviewRound` 增可选 `docHash` 参数 + 写 doc 文件：

1. **既有用例零改动保持绿**（legacy seed 无 doc_hash + APPROVED+0 → exit 3）——回归护栏：不意外重开；其 stderr 含 `legacy` reason 可行指引（「新建 doc / 移除陈旧 review handoff」），非改动指引
2. seed `doc_hash` == 现档 hash + APPROVED+0 → **exit 3**（内容未变，U1/precise）；stderr 含 `unchanged` reason 指引（「编辑 doc 内容 或 新建 doc」）
3. seed `doc_hash` ≠ 现档 hash + APPROVED+0 → **放行**：round 自增至 2、dry-run exit 0、stderr 含 `CDD_INFO`
4. CHANGES_REQUESTED prev + 同内容同 hash → **无声放行**（blocker>0 重审权 SP-4），`CDD_INFO` 不打印（非 clean prev 自文档化抑制）；BLOCKED prev + 内容演进 → 同样无声放行（失败轮永不锁死，§2.4）
5. hash 演进 + 显式 `--round 2`（= engine 推导值）→ CDD_INFO + 放行 exit 0；`--round 1`（≠ 推导）→ exit 2 backfill 冲突——演进放行与 `--round` 共存双分支
6. spec + plan 两家族镜像（至少各一放行/硬停代表例）
7. `docs-runner.test.mjs`：review-mode 定稿 writeOwnHandoff 产物含 `doc_hash`（字段值 == hashFile(doc)）；**plan 家族镜像**（type:plan 同断言）；BLOCKED 失败写盘亦含；**fix-mode 负向对称**——fix 定稿路径维持 `persistFinalized`，产物无 `doc_hash`（防误扩展注入）；`schema-utils.test.mjs` **真实 schema 往返**（docs schema 收 doc_path+doc_hash 同携、doc_hash optional、未知属性拒）
8. 消息断言：exit-3 stderr 不再含旧「change ref to open a new review」的 impossible 措辞（unchanged + legacy 双场景）；`reason` 双消息 + `CDD_INFO` 禁打场景（非 clean prev / ghost doc）逐条对照
9. ghost doc 边角：现档被删 → hashFile `""` → 静默放行、不印 CDD_INFO（§2.4 doc 缺失行落地为断言）

### §2.6 文档

1. `packages/osuperpowers/skills/_docs/review.md`：
   - §run-review：Stopping 规则升级为四 type 统一原则表述（review 绑定内容状态 token；task/branch=git，spec/plan=doc_hash；token 变 → 新 review，token 不变 → 拒绝）
   - 新增 **Spec/plan 演进重审路径** 小节（F5 要求的文档化）：编辑 doc → `cdd review --type spec|plan` 新一轮自动放行（round 自增）；doc 未变 → exit 3；legacy handoff 保持硬停
   - 校正 orchestrator obligation（现 line 31）措辞：task/branch engine 测不到 ref-changed；spec/plan（hash 后）engine 可测内容变化——纪律按四 type 分写准确
   - Handoff output：docs review handoff 增 `doc_hash`
   - 记录 hash 尺度选择（全字节 sha256，不归一化）
2. `templates/schema/docs-handoff-schema.json`：增 `doc_hash`（optional string）
3. 消费侧 handoff-schema 文档（`packages/osuperpowers/skills/cli-driven-development/docs/handoff-schema.md`）：grep 已证该文档仅枚举 task-N-handoff 族 schema，**不含 docs review 的 doc_path 字段枚举** → 本轮无改动（无悬空条件；若未来补 docs schema 段，doc_hash 随之）

### §2.7 Acceptance criteria

- 同一 spec/plan 文档、内容未变、prior clean review（携 `doc_hash`）→ `cdd review --type spec|plan` **exit 3**（U1 完整保留）
- 同一文档、内容演进 → `cdd review --type spec|plan` **放行新一轮**（round 自增 dispatch 正常；`--round 2` 显式对齐亦可）
- legacy handoff（无 `doc_hash`）→ 硬停保留，不意外重开在途 workspace
- BLOCKED/TIMEOUT 失败轮仍可重派（SP-4 回归绿）
- 旧错误消息 impossible 指引（"change ref"）被替换为可行指引；内容演进放行有 `CDD_INFO` 自文档化
- docs review 定稿 handoff 携带 `doc_hash`（spec + plan 双族），schema 校验通过
- review.md + docs-handoff-schema 文档化 content-state-token 原则与演进重审路径；`pnpm run emit` 已跑（emit drift 无）
- `pnpm run validate` 12 块全绿
- changeset（`@oscaner-skills/cdd-engine` minor）落盘，关 #246 F5

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P2 acceptance「无复制文档到新路径重审的双文件漂移 anti-pattern」 | 以 doc_hash 内容状态 ref 关闭该通道（不借路径变化重审） | Yes — 随 commit-spec 同步 v1.10（P2 design 列回填 + change-history） |
| — | — | — |

---

## Section 4: Notes for downstream

P3（fix-mode 存续决策）与此相正交：本 phase 放行演进重审后，若该新 cycle 产生 blocker>0，其修复载体（`cdd fix --type spec|plan`）路径的存续由 P3 拍板。P2 不新建/不改动 fix 载体。

---

## Section 5: Review

Rule: Fresh-Subagent Review Passes (cdd review --type spec) 必须全过才进入用户 review 与 writing-plans。