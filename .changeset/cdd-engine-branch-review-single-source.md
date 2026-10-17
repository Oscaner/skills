---
"@oscaner-skills/cdd-engine": patch
---

fix: P9 branch-review-1 八项 findings 收口（值对象单形 / 品牌无 cast / 漏斗单落点 / 单源剥离器）:

- **F2 值对象双形收口** — `WorkspaceRoot` 构造一处持 `RepoRoot` basis（`WorkspaceRoot.basis`）；`ledger`/`workspace`/`lifecycle`/`cli`/`board-view`/`capsule` 经持有的值对象转换，删 8 处 per-call `new RepoRoot(...)` 重裹 + board-view `#phaseBoard`/`#programBoard` 的 `repoRoot`+`root` 双参（改持 `root` 单参）。
- **F3 品牌 airtight** — `Cli#funnel`→`#relativizePath` 返 `RepoPath`（`relativize` 直产品牌），`Capsule#rel` 返 `RepoPath`；删 `cli.ts` 的 `docRel`/`planRel`/`specRel` 与 `capsule.ts` 的 `#docClassOf` 四处 `as RepoPath`，裸 `string` 无法经 cast 洗过 §2.2 编译门。
- **F6 漏斗唯一落点** — schema `--output skeleton <target>` 与 base `--plan` 经同一 `#relativizePath`（relativize+warn 单站点），删 `#warnOutsideRepo`；「输入漏斗唯一落点」字面成立（每值仍恰归一一次）。
- **F7 `RunInput` 路径字段品牌化** — 新增 `PathArgs`（`plan`/`spec`/`findings: RepoPath | null`）；funnel 把三键从通用 `args` 移入 `paths`，scene/dispatch 取用零 downcast。
- **F8 `#resolveSpecLink` 单源** — 契约 `FileExistenceInvariant.targetPath`（absolute · repoRoot-relative-if-exists · doc-dir-relative）提为复用静态方法，`Cli#resolveSpecLink` 委派之；未来契约变更不再静默发散。
- **F4 去重剥离器** — 新增 `__tests__/support/strip-comments.ts`，`repo-root.guard.test.ts` 与 `zero-dep.test.ts` 共用一份长度保持 comment/string 剥离器，手写启发边界不再各锚一份。
- **F9 edge-conditions loop 族定源** — 契约 `digraph.nextLoopConditions` 为该族权威源（消费者面 digraph 边标签词汇，运行时 `next:` 不产此串）；guard 头注 + 契约槽 docstring 记明「status ← words.ts · route ← next.ts 为引擎派生，loop 族归契约」，非静默第二表。
- **F1（defer）** — `contract→infra` 平面导入为设计既定（T5/§2.8 `infra/doc-roots.ts` 无依赖叶破环 · 下行 base-plane 导入），按裁定不动。
- **回归** — 引擎 vitest 672/672 · kairos vitest 83/83 · root vitest 10/10 · `pnpm run validate` ALL PASS · typecheck ×3 净 · 零裸函数净 · biome 净 · EOF 恰一 newline · emit fresh。
