---
"@oscaner-skills/cdd-engine": major
---

feat!: dispatch 输入面命名收口——`--findings` → `--reviews`（D51）:

- **缺陷（命名背离）** — 旗标名与它指向的物件不是同一个东西：`--findings` 指向的是**评审轮的产出文档**（`.kairos/cdd/<slug>/…-review-<N>.json`），不是 findings 本身。旁证就在同一条通道行里——`ARGV_CHANNEL.findings.help` 早已写作 "the source review handoff JSON path"。fix child 读的是**整份 review handoff JSON**（findings · artifacts · notes），`--findings` 让消费者以为只投喂 findings 数组，心智负担与事实相反。
- **修（一次收口，全 live 面）** —
  - argv 通道键 `findings` → `reviews`（`--reviews`）；命令声明的键行与 `REQUIRED_GROUPS.fix.branch` 要求组同步；
  - `PathArgs.findings` → `PathArgs.reviews` · `Cli#funnel` 归一化分支 · `CliLifecycle#reviews` · prompt token `INPUT_FINDINGS` → `INPUT_REVIEWS`；
  - `Route` 的 fix 跳 `findings` → `reviews`（`session/next.ts` · `face/route-render.ts` `#flag("reviews")`）· `Round.findingsPath` → `Round.reviewsPath`。
- **不动面** — 领域词 findings **保留**：`Round.findings` 行集、`CARRIER_FINDINGS` 载体声明、`#findingsList` 种子、严重度枚举，全部照旧；历史面（既有 changeset / 既往 phase 的 plan / spec / CHANGELOG）不追改。
- **破坏性迁移** — `cdd fix --findings <path>` 不再被解析（`unknown option '--findings'`）；`next:` 字面与 `--help` 示例改渲染 `--reviews`。旧轮次 handoff 文件本身**不改名**（`<slug>-review-<N>.json` 照旧），调用面把旗标改写 `--reviews` 即可。
- **连带** — `docs/maintainers/02-naming.md` 的 `blocker` 术语行随改名（`--reviews`）；`docs/maintainers/README.md` 收敛账本的 After 细胞随字节实况重锚（02-naming 5,261 → 5,260 · 总 14,048 → 14,047）。
- **回归** — `pnpm -C packages/cdd-engine test` 43 文件 / 718 例全绿（含 `channel-closure.guard` 的通道闭包断言）；三面 typecheck 清白。