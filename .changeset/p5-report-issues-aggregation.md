---
"@oscaner-skills/osuperpowers": minor
---

P5 report-issues 聚合形态 + renderer/表单/label 收敛（report-issue → report-issues）。

**改名与聚合流程精炼：**

- `report-issue` → `report-issues`：skill 目录 / SKILL.md frontmatter / context 引用 / finding-meta components / README / emit 产物全面更名，新复数名含防回渗守卫（词边界 `\breport-issue\b`）。
- findings 聚合流程重构为单趟主动聚合（explore-current-session → collect → reform → confirm → dedup → create-issue? 分支）：中性 topic 直出标题（取消 `[Session report] <slug> <date>` 壳前缀），单新 issue 聚合全部 findings + dedup links；全部 open-dedup 命中 → 不建空 issue、仅报链接清单（report-links-only）。
- dedup 单趟拉取 + 90 天窗口（运行期物化 ISO 绝对日期查询句）。
- report-meta 精简至终态 2+1：per-finding `Skill`/`Step` 两字段 + issue 级 `Harness` 一行；`kind`/`date`/`standalone` 语汇删除。

**renderer 单模式重构：**

- 裸调用单入口直出聚合 body（删 `--mode` / renderComment / renderTitle / 模式分派；renderMasterBody 收敛为聚合渲染）；CLI 入参结构校验失败 exit 1 + 违规字段路径。

**ISSUE_TEMPLATE 瘦身 + label 收敛：**

- 表单 3 → 2（删 `session_report.yml` + session-type 下拉 + `sessionTypes` 枚举）；`resolveDropdownOptions` 函数删除，唯一 dropdown 直引 `enums.components`。
- labels 单点 SOT 迁 `reportDef.labels` = `["osuperpowers","cdd-engine"]`；GitHub label rename `cdd` → `cdd-engine`（历史 issue 随迁）。

**renderYml/yaml 隔离为 emit-only 模块（非依赖新增）：**

- 手写 YAML builder（emitScalar / isPlainUnsafe）替换为 `yaml.stringify`，但其载体 `render-yaml.mjs` 隔离为 **emit-only 模块**（仅 `scripts/emit/*.mjs` 消费）——`yaml` 只入仓库根 devDependencies（emit 工具链），osuperpowers `package.json#dependencies` **零新增**，消费者运行时入口零 `yaml` import、**零新增依赖**。