# SDD Token 效率 — Phase pack-sp：Superpowers Cursor plugin-root

- **Version**: v1.1 · 2026-08-05
- **Status**: Draft
- **Author**: kang · Cursor Agent
- **Program**: [overall v1.9](2026-08-05-sdd-token-efficiency-overall.md)
- **Phase ID**: pack-sp
- **Depends on**: **pack** impl merge（`emitMode: plugin-root` emit 分支已存在）；**不**依赖 pack release

> Phase increment only. Cross-phase conventions in [overall](2026-08-05-sdd-token-efficiency-overall.md); overall wins on conflict.

## Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| pack non-goals：「不迁移其它 plugin wrapper」（v1.7 前 overall §pack 范围） | **pack-sp** 仅迁 **superpowers**（submodule 已有 upstream `.cursor-plugin`）；mattpocock / impeccable **仍 wrapper** | Yes — v1.9 · 2026-08-05 |
| pack non-goals（pack design）：「不迁移 superpowers wrapper」 | superseded **for superpowers only** by pack-sp | Yes — v1.9 |

## Goal

1. **superpowers** Cursor Team Marketplace 改为 **plugin-root**：`source` → `./plugins/superpowers`，读 upstream submodule 内 `.cursor-plugin/plugin.json`（`./skills/`、`./hooks/hooks-cursor.json`）。
2. **删除**冗余 wrapper `cursor-plugins/superpowers/`（emit 从 `source.json` 生成的 `../../plugins/...` 版 manifest）。
3. 新增 **`cursor-plugins/README.md`** — 记录 **hybrid emit 规则**：何时 wrapper、何时 `emitMode: plugin-root`、upstream 未来新增 `.cursor-plugin` 时的升级步骤。

**不变**：submodule `plugins/superpowers/` 内任何文件；hook 脚本与逻辑；mattpocock-skills / impeccable wrapper 模式。

## Non-goals

- 不修改 upstream superpowers 6.2.0 源码或 `.cursor-plugin` 内容
- 不迁移 mattpocock-skills、impeccable（无 upstream `.cursor-plugin`）
- 不修改 `superpowers-overrides`（pack 已完成）
- 不为 submodule **生成** oscaner 侧 `.cursor-plugin`
- 不重跑 penf / pack 完整 CURSOR-SMOKE blocking

## Grilling record（pack-sp shared understanding）

| # | 决策 |
|---|------|
| 1 | 评估范围 **C** — emit 架构层：wrapper 有无存在价值 |
| 2 | 首要动机 **A** — 减 drift / 单源 |
| 3 | 终态 **A** — 按能力分流：有 upstream `.cursor-plugin` → plugin-root；否则 wrapper |
| 4 | superpowers 排期 **A** — 纳入 SDD program 为新 phase |
| 5 | 依赖 **B** — pack impl merge 即可；与 p0 并行 |
| 6 | 新增 **`cursor-plugins/README.md`** — upstream 将来有 `.cursor-plugin` 时改 `emitMode` 的操作手册 |

## Background：wrapper 价值判断

| Plugin | contentRoot 有 `.cursor-plugin`？ | wrapper 价值（动机 A） |
|--------|-----------------------------------|------------------------|
| superpowers-overrides | ✅（pack generated） | **无** — pack 已删 |
| **superpowers** | ✅（upstream submodule） | **无** — wrapper 仅为 `../../` 路径重写 + metadata 重复 |
| mattpocock-skills | ❌ | **有** — oscaner 从 `source.json` 合成 Cursor manifest |
| impeccable | ❌ | **有** — 同上 |

## Architecture

### Hybrid emit 规则（program 长期）

```
contentRoot/.cursor-plugin/plugin.json 存在？
  YES → source.json: { "cursor": { "emitMode": "plugin-root" } }
        Cursor marketplace source → ./<contentRoot>
        不生成 cursor-plugins/<name>/
  NO  → source.json: cursor.displayName + cursor.skills (+ hooks?)
        emit → cursor-plugins/<name>/.cursor-plugin/plugin.json
```

### Before（pack-sp 前）

```
marketplace/source.json (superpowers)
  cursor.displayName / skills / hooks → ../../plugins/superpowers/...

emit → cursor-plugins/superpowers/.cursor-plugin/plugin.json

Cursor marketplace source → cursor-plugins/superpowers
```

### After（pack-sp）

```
plugins/superpowers/.cursor-plugin/plugin.json  ← upstream（真源）

marketplace/source.json (superpowers)
  cursor: { "emitMode": "plugin-root" }

Cursor marketplace source → ./plugins/superpowers

cursor-plugins/superpowers/  ← 删除
```

## Deliverables

### D1 — source.json superpowers plugin-root

Replace `superpowers.cursor` with:

```json
"cursor": { "emitMode": "plugin-root" }
```

Remove `displayName`, `skills`, `hooks`.

### D2 — Delete wrapper + emit refresh

- Delete `cursor-plugins/superpowers/`
- `pnpm run emit` → `.cursor-plugin/marketplace.json` superpowers `source`: `./plugins/superpowers`
- Reuse pack **existing** `emitMode` branch in `emit-marketplace.mjs` / `validate-marketplace.mjs` — **无新 emit 逻辑** unless gap found in impl

### D3 — `cursor-plugins/README.md`（新建）

Sections:

1. **Why this directory exists** — wrapper mode for plugins without upstream Cursor manifest
2. **Hybrid rule** — diagram above; link `marketplace/README.md`
3. **Current plugin status table**（maintained):

| Plugin | Mode | Notes |
|--------|------|-------|
| superpowers-overrides | plugin-root | pack |
| superpowers | plugin-root | pack-sp |
| mattpocock-skills | wrapper | no upstream `.cursor-plugin` |
| impeccable | wrapper | no upstream `.cursor-plugin` |

4. **Upgrade checklist**（when upstream adds `.cursor-plugin`）:
   - Verify `<contentRoot>/.cursor-plugin/plugin.json` exists; skills/hooks paths resolve relative to contentRoot
   - Set `source.json` `cursor` → `{ "emitMode": "plugin-root" }`
   - Remove `cursor.displayName/skills/hooks`
   - Delete `cursor-plugins/<name>/`
   - `pnpm run emit && pnpm run validate`
   - Cursor users: refresh Team Marketplace

### D4 — Doc cross-links

**`cursor-plugins/README.md`**（D3）：含 hybrid 规则 + 当前 plugin 状态表 + upgrade checklist。

**`marketplace/README.md`** — 必改段落（impl 不得漏项）：

| 段落 | 变更 |
|------|------|
| `Generated outputs` 表 | 增加一行：`plugins/superpowers/.cursor-plugin/plugin.json` — Harness 列写 **「Upstream submodule（非 emit）」**；wrapper 行注明 superpowers 已迁出 |
| `Cursor install modes` — prose | 「Today only …」→ **overrides + superpowers** plugin-root；链 [cursor-plugins/README.md](../cursor-plugins/README.md) |
| `Cursor Team Marketplace` | superpowers 亦从 plugin root 安装；链 cursor-plugins README |

**可选：** `plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md` 一句 cross-link 指向 pack-sp / cursor-plugins README（superpowers 同理）

## Files to change

| 文件 | 动作 |
|------|------|
| `marketplace/source.json` | superpowers `cursor` → `{ "emitMode": "plugin-root" }` |
| `cursor-plugins/superpowers/` | **删除** |
| `.cursor-plugin/marketplace.json` | emit 刷新 |
| `cursor-plugins/README.md` | **新建**（含状态表） |
| `marketplace/README.md` | D4 三段 prose/表更新 + 链到 cursor-plugins README |
| `CLAUDE.md` | 「Marketplace → plugin → skill chain」段：superpowers 亦 plugin-root；链 `cursor-plugins/README.md` |
| `plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md` | 可选 cross-link |

**不修改：** `scripts/emit-marketplace.mjs`（除非 validate 暴露缺口）、submodule 树、`superpowers-overrides/**`

## Verification

### Automated（blocking）

- `pnpm run validate` 全绿
- `cursor-plugins/superpowers/` **不存在**
- `plugins/superpowers/.cursor-plugin/plugin.json` skills/hooks resolve
- `.cursor-plugin/marketplace.json` superpowers `source` === `./plugins/superpowers`
- `node scripts/emit-marketplace.mjs --check` 无 drift（superpowers 不在 wrapper diff 列表）

### Manual — lightweight（blocking）

- [ ] Cursor：刷新 marketplace 后 superpowers plugin 仍加载；Settings → Hooks 可见 upstream `hooks-cursor.json` hooks（如 `sessionStart`）
- [ ] 抽样：superpowers 相关 skill 仍可发现（marketplace co-install 已知限制不变）

## Acceptance criteria

- [ ] superpowers `source.json` 仅 `emitMode: plugin-root`
- [ ] wrapper 目录已删；CI 失败若 recreated
- [ ] `cursor-plugins/README.md` 含 hybrid 规则 + 状态表 + upgrade checklist
- [ ] `marketplace/README.md` — D4 三段必改（Generated outputs / install modes prose / Team Marketplace）+ 链 cursor-plugins README
- [ ] `CLAUDE.md` marketplace chain 段反映 superpowers plugin-root
- [ ] `pnpm run validate` 全绿
- [ ] Manual lightweight checklist 完成

## Out of scope (pack-sp)

- mattpocock-skills / impeccable migration
- oscaner 为 submodule 生成 `.cursor-plugin`
- overrides / penf / p0 / p1 功能

## Relationship to pack / p0 / p1

| 关系 | 说明 |
|------|------|
| **Depends on** | pack impl（`emitMode` + validate plugin-root 分支） |
| **Parallel** | p0 impl（无 handoff / emit 耦合） |
| **Reuse** | pack emit/validate 代码路径；impl 规模 ≈ pack T2+T3 子集 |
