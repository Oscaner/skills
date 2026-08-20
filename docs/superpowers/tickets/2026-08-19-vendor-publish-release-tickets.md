# Tickets: vendor 随发 release

来自 spec `docs/superpowers/specs/2026-08-19-vendor-publish-release-design.md` 的 vendor 装配发布 + registry 全量一致性差集。参考实施计划：`docs/superpowers/plans/2026-08-19-vendor-publish-release.md`。

Work the **frontier**: any ticket whose blockers are all done. For a purely linear chain that means top to bottom.

---

## T1：publish-vendor 纯函数 + 单测

**What to build:** `decideProbe`（probe 三态判定）、`collectGaps`（registry 全量差集过滤）、`resolveUpstreamTag`（三级解析链）三个纯函数，每个在 `scripts/lib/publish-vendor.mjs` 导出，在 `scripts/lib/publish-vendor.test.mjs` 有完整 node:test 用例覆盖。可独立 `node scripts/lib/publish-vendor.test.mjs --test-name-pattern` 验证，不依赖 I/O 或 npm registry。

**Blocked by:** None — can start immediately.

- [ ] `decideProbe("exit0")` → `"skip"`；`decideProbe("E404")` → `"publish"`；`decideProbe("error")` → throw `aborting release`
- [ ] `collectGaps(allVersions, tagIndex, releaseIndex)` 正确：tag+release 齐备 → 排除；缺 tag → 入列；缺 release → 入列；全集满 → `[]`
- [ ] `resolveUpstreamTag(v, ctx, probe)`：HEAD 匹配 → headTag；上游 v`version` tag → 对应 tag；`skill-v` tag → 对应 tag；双失败 → `null`
- [ ] 现有测试回归 ALL PASS（`node scripts/lib/publish-vendor.test.mjs`）

---

## T2：publish-vendor I/O 接线 + stdout JSON 契约

**What to build:** 将 T1 纯函数接入真实 I/O（npm view、git ls-remote、gh release view、npm publish），重写 `publishAll` 为两阶段流程（Phase 1: stage + probe + publish；Phase 2: registry 全量差集 → 单行 JSON 数组输出到 stdout），bin 的 `console.log` 迁移 stderr、dry-run 输出 `[]`。可独立验证 dry-run 产物完整性 + stdout 契约 + probe 手动探测。

**Blocked by:** T1（纯函数定义被本 ticket 消费）

- [ ] `npm view` probe 三态正确区分（exit0 / E404 / 其他错误）
- [ ] EPUBLISHCONFLICT 归一化为 skip + 接差集判定
- [ ] `npm publish` 成功 → 记录进 `publishedThisRun`
- [ ] stdout 恒为单行合法 JSON 数组（最小 `[]`）；人类日志全部走 stderr
- [ ] dry-run 不探测、不发布；stdout 输出 `[]`；stderr 正常显示 `OK` + `staged at`
- [ ] 现有测试回归 ALL PASS

---

## T3：release.yml 工作流接线

**What to build:** 在 `.github/workflows/release.yml` 新增 `publish-vendor` job（裸赋值捕获 `to_task=$(node …)` 保证退出码传播）和 `release-vendor` matrix job（tag/Release 幂等建置，Release body 含上游同步说明），`release-plugin` / `sync-develop` needs 改为 `[release, publish-vendor]`（原子性），头部流程注释更新。YAML parse 验证 + emit:check 无 drift。

**Blocked by:** T2（stdout JSON 契约 + 退出码传播被 workflow 消费）

- [ ] `publish-vendor` job 正确调用 `publish-vendor.mjs`，裸赋值捕获 `to_tag`，`NODE_AUTH_TOKEN` 认证就位
- [ ] `release-vendor` job 从 `fromJSON(needs.publish-vendor.outputs.to_tag)` 动态矩阵创建 tag + GitHub Release
- [ ] tag-exists / release-exists 幂等跳过；`include: []` → 零组合跳过成功
- [ ] `release-plugin` + `sync-develop` needs 包含 `publish-vendor`（原子性）
- [ ] YAML parse 无语法错误 + `emit:check` 无 drift
- [ ] 头部注释更新为 `release → publish-vendor → release-vendor / release-plugin / sync-develop`

---

## T4：文档更新 + 全量验证

**What to build:** 更新 `.changeset/README.md`（Release flow + Vendor 发布段）、`README.md` / `README.zh-CN.md`（vendor 随发说明）、`marketplace/README.md`（vendored 段补一句）。运行全量验证 `pnpm run validate`（含 emit:check / plugin resolution / skill dirs / hooks / overrides / engine tests / version sync），最终 dry-run 签名确认 stdout JSON + 装配产物完整性。

**Blocked by:** T3（全部代码改动完成后，文档描述才是真实行为）

- [ ] `.changeset/README.md` Release flow 段 + 新增 Vendor 发布段
- [ ] `README.md` + `README.zh-CN.md` 发布章节各追加一句 vendor 随发说明
- [ ] `marketplace/README.md` vendored 段补「随 release 发布到 npm」
- [ ] `pnpm run validate` ALL PASS
- [ ] 最终 dry-run：stdout `[]` + stderr OK + staged at + 装配产物（pi key / LICENSE / mattpocock thin gemini）完整