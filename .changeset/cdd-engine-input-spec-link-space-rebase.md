---
"@oscaner-skills/cdd-engine": patch
---

fix: plan review `INPUT_SPEC` 重基为 repoRoot 相对（D46 · 治 D44③ 回归）:

- **回归根因**：`INPUT_SPEC` 原样取 plan 头的 `**Spec:**` 链接 target——**markdown 链接空间**（`../specs/X.md`，相对 plan 所在目录）。plan-review 子进程 spawn cwd = repoRoot，`../specs/X` 解到**仓库外**，reviewer 打不开自己的设计 spec（P6+ 四个在库 plan 全用此形）。
- **修**：`cli#sceneOf` 的 `case "plan"` 产出 `specLink` 处，把链接 target 经 `#rebaseSpecLink` 重基为 **repoRoot 相对** token——解析镜像 doc-contract 自身的链判定（`#targetExists`：绝对直取 · repoRoot 形存在则取 · 否则 plan 目录形），与 argv 路径同属「路径事实」共用一个基准。
- **pin**：新增 link-space 回归用例（`conformingPlan(.., "../specs/p3-design.md")` → `INPUT_SPEC` 为 repoRoot 相对且文件可达）；`conformingPlan` 增 `specTarget` 形参（默认保留原 repoRoot 形）。
