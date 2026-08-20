# vendor 随发 release（npm 装配发布 + tag + Release）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让三个 vendored 插件（superpowers / mattpocock-skills / impeccable）在每次 publish 模式 release 时随 first-party 一起完成 npm 装配发布，并以 registry 全量一致性差集保证每个 npm 版本都有 git tag + GitHub Release（Release notes 含上游同步说明）。

**Architecture:** `publish-vendor.mjs` 变为「装配发布 + 待打 tag 清单输出」单一入口：resolve → probe（skip-if-published 三态）→ publish（EPUBLISHCONFLICT 归一化）→ registry 全量差集 → 单行 JSON 数组输出到 stdout（人类日志全部走 stderr）。`release.yml` 新增 `publish-vendor` job（裸赋值捕获 `to_tag`，退出码传播）与 `release-vendor` matrix job（tag/Release 幂等建置），`release-plugin` / `sync-develop` 阻塞在 `publish-vendor` 之后保证原子性。

**Tech Stack:** Node 24（`.nvmrc` 约束，`fnm use`），node:test 单测（`scripts/lib/publish-vendor.test.mjs`），GitHub Actions（changesets/action + softprops/action-gh-release），pnpm workspace，npm registry。

## Global Constraints

（spec `docs/superpowers/specs/2026-08-19-vendor-publish-release-design.md` 的逐字要求，每个任务隐式包含）

- Conventional commits；无 attribution / co-author trailer；禁用 git worktree
- 发布包名统一 `@oscaner-skills/*`；tag / Release 名 `<插件名>@<版本>`（无 scope 前缀，`${{ matrix.name }}@${{ matrix.version }}`）
- **stdout 契约**：脚本 stdout 恒为单行合法 JSON 数组（最小 `[]`）；人类日志全部走 stderr（现状 `console.log` 的 `OK — …` / `staged at …` 必须迁 stderr）
- probe 三态：exit0→skip；stderr 含 `E404`/`Not found`→publish；其他→probe-error（**release 中止**，绝不判为已发布/未发布）
- EPUBLISHCONFLICT → 归一化为已发布 skip + 进差集（同轮补齐 tag/Release）
- 无 `--force` 强制发布通道；`--dry-run` 仅装配检查（不 probe、不发布、stdout `[]`）
- workflow 捕获用**裸赋值** `to_tag=$(node scripts/publish-vendor.mjs)`（GH 默认 bash `-eo pipefail` → 退出码传播；禁止 `echo "$(node …)"`）
- tag 源 vendor（superpowers / mattpocock）submodule HEAD 无匹配 tag → `resolveVendorVersion` 抛错（现有行为，不承诺降级）
- 装配配置面（spec §4.3）：pi key 齐备、上游 manifests 原样、mattpocock thin gemini——`--dry-run` 必查
- 一致性单向保证：npm 版本 → tag + Release；反向（unpublish 残留）不处理
- 不手工编辑派生文件；不修改上游 `vendors/` 内容；`pnpm run emit:check` 保持绿
- **不需要 changeset**：本改动只涉及 `scripts/` + `.github/` + 文档，不改 `packages/*` 插件内容，不触发插件版本发布
- 每个任务实现后必须跑：`node scripts/lib/publish-vendor.test.mjs` 相关用例 + 该任务声明的验证命令

---

## File Structure

| Path | 责任 | 改动 |
|---|---|---|
| `scripts/lib/publish-vendor.mjs` | 装配 + 发布 + 差集核心库 | Modify：新增纯函数 + I/O 封装 + `publishAll` 流程重写 |
| `scripts/lib/publish-vendor.test.mjs` | 单测（node:test） | Modify：新增纯函数用例 |
| `scripts/publish-vendor.mjs` | CLI 入口（bin） | Modify：stdout=单行 JSON；日志→stderr；dry-run 输出 `[]` |
| `.github/workflows/release.yml` | 发布流水线 | Modify：+`publish-vendor` / +`release-vendor` / needs 变更 / 头部流程注释 |
| `.changeset/README.md` | 发布流程文档 | Modify：`## Release flow` 段 |
| `README.md` | 仓库英文文档 | Modify：发布章节（129-131 行附近） |
| `README.zh-CN.md` | 仓库中文文档 | Modify：发布章节（129-131 行附近） |
| `marketplace/README.md` | 市场文档 | Modify：`Vendored plugins` 段（第 24 行） |

依赖序：Task 1（纯函数）→ Task 2（I/O 接线 + stdout 契约）→ Task 3（工作流，消费 `to_tag` 契约）→ Task 4（文档，落在最后以保证内容真实）。

---

### Task 1：纯函数 + 单测

**Files:**
- Modify: `scripts/lib/publish-vendor.mjs`（新增 export 项，不改现有函数）
- Modify: `scripts/lib/publish-vendor.test.mjs`（新增测试块）

**Interfaces:**
- Produces: `decideProbe` / `collectGaps` / `resolveUpstreamTag` — Task 2 在 `publishAll` 中消费

- [ ] **Step 1：添加 `decideProbe` + `collectGaps` + `resolveUpstreamTag` 到 `scripts/lib/publish-vendor.mjs` 顶部导出区**

```js
/** @param {"exit0"|"E404"|"error"} probeResult */
export function decideProbe(probeResult) {
  if (probeResult === "exit0") return "skip";
  if (probeResult === "E404") return "publish";
  throw new Error(`probe error (${probeResult}) — aborting release`);
}

/**
 * @param {string[]} allVersions   合并后版本列表（registryVersions ∪ publishedThisRun 去重）
 * @param {Set<string>} tagIndex   已有 tag 的 `version` 集合
 * @param {Set<string>} releaseIndex  已有 Release 的 `version` 集合
 * @returns {{ version: string }[]}
 */
export function collectGaps(allVersions, tagIndex, releaseIndex) {
  return allVersions
    .filter((v) => !tagIndex.has(v) || !releaseIndex.has(v))
    .map((version) => ({ version }));
}

/**
 * @param {string}   version 当前版本
 * @param {{ headVersion: string|null, headTag: string|null }} ctx
 * @param {(tagRef: string) => boolean} tagExists  注入的 tag 探测（纯函数可注入 stub）
 * @returns {string|null} upstreamTag（null = 双失败 → 省略）
 */
export function resolveUpstreamTag(version, ctx, tagExists) {
  if (ctx.headVersion === version && ctx.headTag) return ctx.headTag;
  const candidates = [`v${version}`, `skill-v${version}`];
  for (const tag of candidates) {
    if (tagExists(`refs/tags/${tag}`)) return tag;
  }
  return null;
}
```

- [ ] **Step 2：在 `scripts/lib/publish-vendor.test.mjs` 中添加对应纯函数测试**

```js
// ---------------------------------------------------------------------------
// decideProbe — 三态判定
// ---------------------------------------------------------------------------

test("decideProbe — exit0 → skip", () => {
  assert.equal(decideProbe("exit0"), "skip");
});

test("decideProbe — E404 → publish", () => {
  assert.equal(decideProbe("E404"), "publish");
});

test("decideProbe — error → throws", () => {
  assert.throws(() => decideProbe("error"), /probe error.*aborting release/);
});

// ---------------------------------------------------------------------------
// collectGaps — 全量差集
// ---------------------------------------------------------------------------

test("collectGaps — version with tag+release → excluded", () => {
  const tagIdx = new Set(["6.2.0"]);
  const relIdx = new Set(["6.2.0"]);
  assert.deepEqual(collectGaps(["6.2.0"], tagIdx, relIdx), []);
});

test("collectGaps — missing tag → included", () => {
  const tagIdx = new Set();
  const relIdx = new Set(["6.2.0"]);
  assert.deepEqual(collectGaps(["6.2.0"], tagIdx, relIdx), [{ version: "6.2.0" }]);
});

test("collectGaps — missing release → included", () => {
  const tagIdx = new Set(["6.2.0"]);
  const relIdx = new Set();
  assert.deepEqual(collectGaps(["6.2.0"], tagIdx, relIdx), [{ version: "6.2.0" }]);
});

test("collectGaps — TOCTOU union via caller: registry+publishedThisRun both included", () => {
  // caller unions: [...registryVersions, publishedThisRun]
  // gap function sees unified list and filters purely by tag/release presence
  const allVersions = ["6.0.0", "6.2.0"]; // 6.2.0 just published this run, 6.0.0 from registry
  const tagIdx = new Set(["6.0.0"]);     // 6.0.0 has tag
  const relIdx = new Set(["6.0.0", "6.2.0"]); // 6.2.0 has release (created by release-vendor last run?)
  // → 6.0.0: tag+release both present → excluded; 6.2.0: tag missing → included
  assert.deepEqual(collectGaps(allVersions, tagIdx, relIdx), [{ version: "6.2.0" }]);
});

test("collectGaps — all present → empty", () => {
  const allVersions = ["1.0.0", "1.1.0"];
  const tagIdx = new Set(["1.0.0", "1.1.0"]);
  const relIdx = new Set(["1.0.0", "1.1.0"]);
  assert.deepEqual(collectGaps(allVersions, tagIdx, relIdx), []);
});

// ---------------------------------------------------------------------------
// resolveUpstreamTag — 三级链
// ---------------------------------------------------------------------------

test("resolveUpstreamTag — version matches HEAD → returns headTag", () => {
  const tag = resolveUpstreamTag("6.2.0", { headVersion: "6.2.0", headTag: "v6.2.0" }, () => false);
  assert.equal(tag, "v6.2.0");
});

test("resolveUpstreamTag — fall through to upstream probe → returns matched tag", () => {
  const probe = (ref) => ref === "refs/tags/v6.0.0";
  const tag = resolveUpstreamTag("6.0.0", { headVersion: "6.2.0", headTag: "v6.2.0" }, probe);
  assert.equal(tag, "v6.0.0");
});

test("resolveUpstreamTag — skill-v candidate for impeccable", () => {
  const probe = (ref) => ref === "refs/tags/skill-v4.0.4";
  const tag = resolveUpstreamTag("4.0.4", { headVersion: "4.0.4", headTag: "skill-v4.0.4" }, probe);
  assert.equal(tag, "skill-v4.0.4");
});

test("resolveUpstreamTag — both probes fail → returns null", () => {
  const tag = resolveUpstreamTag("2.0.0", { headVersion: "1.0.0", headTag: "v1.0.0" }, () => false);
  assert.equal(tag, null);
});
```

- [ ] **Step 3：运行测试验证新增用例通过**

Run: `node scripts/lib/publish-vendor.test.mjs --test-name-pattern="decideProbe|collectGaps|resolveUpstreamTag"`
Expected: 全部 PASS（新增 8 条用例）

- [ ] **Step 4：Commit**

```bash
git add scripts/lib/publish-vendor.mjs scripts/lib/publish-vendor.test.mjs
git commit -m "feat: add publish-vendor probe/gap pure helpers"
```

---

### Task 2：I/O 接线 + stdout JSON 契约

**Files:**
- Modify: `scripts/lib/publish-vendor.mjs`（新增 I/O helpers + 重写 `publishAll`）
- Modify: `scripts/publish-vendor.mjs`（bin：stdout=JSON，日志→stderr）

**Interfaces:**
- Consumes: Task 1 的 `decideProbe` / `collectGaps` / `resolveUpstreamTag`
- Produces: `publishAll` 现在向 stdout 写单行 JSON 数组（`to_tag` 契约），供 Task 3 的 workflow 消费

- [ ] **Step 1：验证现状问题——dry-run 输出不是 JSON**

Run: `node scripts/publish-vendor.mjs --dry-run`
观察 stdout：包含 `OK — dry-run complete for @oscaner-skills/*` 和 `staged at …` 文本（不是 JSON）
结论：当前 bin 的 `console.log` 输出污染了 stdout，需要迁移 stderr

- [ ] **Step 2：在 `scripts/lib/publish-vendor.mjs` 新增 I/O helpers**

在文件顶部（现有 import 之后、现有 export 函数之前）加入以下 helpers：

```js
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** npm view stderr 判定：含 E404/Not found → "E404"；否则 → "error" */
export function classifyProbeError(stderr) {
  if (/E404|Not found/i.test(stderr)) return "E404";
  return "error";
}

/** 三态探测：npm view <name>@<version> → "exit0" | "E404" | "error" */
export function probeRegistryVersion(name, version) {
  const { status, stderr } = spawnSync("npm", ["view", `${name}@${version}`, "version"], { encoding: "utf8" });
  if (status === 0) return "exit0";
  return classifyProbeError(stderr ?? "");
}

/** 枚举已发布版本；E404 返回 []（未首次发布） */
export function listRegistryVersions(name) {
  try {
    const { stdout } = spawnSync("npm", ["view", name, "versions", "--json"], { encoding: "utf8" });
    return JSON.parse(stdout ?? "[]");
  } catch {
    return [];
  }
}

/** git ls-remote 检查 tag 是否存在于 origin */
export function probeTagExists(name, version) {
  const { status } = spawnSync(
    "git",
    ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${name}@${version}`],
    { stdio: "ignore" },
  );
  return status === 0;
}

/** gh release view 检查 Release 是否存在（runner 注入 GITHUB_TOKEN env） */
export function probeReleaseExists(name, version) {
  const { status } = spawnSync("gh", ["release", "view", `${name}@${version}`], { stdio: "ignore" });
  return status === 0;
}

/** 解析 .gitmodules，返回 vendor 上游 owner/repo（GitHub 返回 "owner/repo"，非 GitHub 返回 null） */
export function readGitmodules(root, vendorName) {
  const content = readFileSync(join(root, ".gitmodules"), "utf8");
  const sectionRegex = /\[submodule "([^"]+)"\][^[]*?url\s*=\s*([^\n]+)/gs;
  for (const [, subName, url] of content.matchAll(sectionRegex)) {
    if (subName === vendorName) {
      const m = url.trim().match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      return m ? `${m[1]}/${m[2]}` : null;
    }
  }
  return null;
}

/** git ls-remote 探测上游 repo 是否有指定 tag（host 非 GitHub → false） */
export function probeUpstreamTagExists(root, vendorName, tagRef) {
  const upstreamRepo = readGitmodules(root, vendorName);
  if (!upstreamRepo) return false;
  const url = `https://github.com/${upstreamRepo}.git`;
  const { status } = spawnSync("git", ["ls-remote", "--exit-code", "--tags", url, tagRef], { stdio: "ignore" });
  return status === 0;
}

/** 取 submodule HEAD 上匹配 TAG_PATTERNS 的 tag（null = 无匹配） */
function headTagAtHead(root, vendorName) {
  const submodulePath = join(root, SUBMODULE_PATHS[vendorName]);
  try {
    const { stdout } = spawnSync("git", ["-C", submodulePath, "tag", "--points-at", "HEAD"], { encoding: "utf8" });
    return stdout.split("\n").find((t) => t && TAG_PATTERNS[vendorName].test(t)) ?? null;
  } catch {
    return null;
  }
}
```

> 注意：`spawnSync`（非 `execSync`）用于捕获 stdout+stderr 以支持 EPUBLISHCONFLICT 解析（Step 4），保持一致性。

- [ ] **Step 3：重写 `publishAll`（`scripts/lib/publish-vendor.mjs`）**

替换现有 `publishAll` 函数体（保持签名和导出不变）。新实现：

```js
/**
 * Assemble + publish every vendor; 输出 registry 全量差集到 stdout。
 * @param {string} root repo root
 * @param {{ dryRun?: boolean }} opts
 */
export function publishAll(root, { dryRun = false } = {}) {
  const stageRoot = defaultStageRoot(root);
  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(stageRoot, { recursive: true });

  // 缓存 vendor 列表 + 版本：避免 publish 循环与 gap 循环重复 listVendors + resolveVendorVersion I/O
  const vendorList = listVendors(root);
  const vendorData = vendorList.map((name) => ({ name, version: resolveVendorVersion(name, root) }));

  const publishedThisRun = []; // 成功发布 / EPUBLISHCONFLICT 归一化的 vendor name 列表

  // ── Phase 1: stage + publish ────────────────────────────────────────────
  for (const { name, version } of vendorData) {
    const dest = stageVendor(name, root, stageRoot); // stageVendor 已存在（保留 LICENSE + gemini）

    if (dryRun) {
      // dry-run：不探测、不发布，stdout 在函数末尾统一输出 []
      continue;
    }

    // probe（三态）
    const probe = probeRegistryVersion(`@oscaner-skills/${name}`, version);
    const decision = decideProbe(probe); // E404→publish / exit0→skip / error→throw（release 中止）

    if (decision === "skip") {
      process.stderr.write(`[skip] @oscaner-skills/${name}@${version} already published\n`);
      // 继续：该版本可能缺 tag/Release，由差集补建
    }

    if (decision === "publish") {
      const { status, stdout, stderr } = spawnSync(
        "npm",
        ["publish", "--access", "public"],
        { cwd: dest, encoding: "utf8" },
      );
      // 始终将 npm 日志写入 stderr（保持 stdout 清洁）
      if (stderr) process.stderr.write(stderr);
      if (status === 0) {
        process.stderr.write(`[publish] @oscaner-skills/${name}@${version} → npm\n`);
        publishedThisRun.push(name);
      } else if (/EPUBLISHCONFLICT/i.test((stdout ?? "") + (stderr ?? ""))) {
        // TOCTOU 归一化：已发布 skip + 记录进 publishedThisRun（进差集）
        process.stderr.write(`[skip] @oscaner-skills/${name}@${version} already published (EPUBLISHCONFLICT)\n`);
        publishedThisRun.push(name);
      } else {
        throw new Error(`npm publish failed for ${name}@${version}: ${(stdout ?? "") + (stderr ?? "")}`);
      }
    }
  }

  if (dryRun) {
    process.stdout.write("[]\n");
    return stageRoot; // dry-run 同样返回 stageRoot 供 bin 打印 staged at …
  }

  // ── Phase 2: registry 全量差集 ──────────────────────────────────────────
  const items = [];
  for (const { name, version: currentVersion } of vendorData) {
    const registryVersions = listRegistryVersions(`@oscaner-skills/${name}`);
    // union：registry + 本轮发布（防 TOCTOU registry 索引滞后）
    const publishedVersion = publishedThisRun.includes(name) ? currentVersion : null;
    const allVersions = [...new Set([...registryVersions, ...(publishedVersion ? [publishedVersion] : [])])];
    if (allVersions.length === 0) continue;

    // 构建本仓库 tag/release 索引
    const tagIndex = new Set();
    const releaseIndex = new Set();
    for (const v of allVersions) {
      if (probeTagExists(name, v)) tagIndex.add(v);
      if (probeReleaseExists(name, v)) releaseIndex.add(v);
    }

    const gaps = collectGaps(allVersions, tagIndex, releaseIndex);
    const upstreamRepo = readGitmodules(root, name);
    const headTag = headTagAtHead(root, name);

    for (const gap of gaps) {
      const upstreamTag = resolveUpstreamTag(gap.version, { headVersion: currentVersion, headTag }, (ref) =>
        probeUpstreamTagExists(root, name, ref),
      );
      items.push({ name, version: gap.version, upstreamRepo, upstreamTag });
    }
  }

  // ── stdout 契约：单行合法 JSON 数组（bin 不再写 stdout）──────────────────
  process.stdout.write(JSON.stringify(items) + "\n");
  return stageRoot; // 供 bin 的 stderr 打印 staged at …
}
```

- [ ] **Step 4：重写 bin（`scripts/publish-vendor.mjs`）**

将现有的 `console.log` 调用迁移至 `process.stderr.write`；bin 本身不再写 stdout——stdout 由 `publishAll` 唯一控制。

```js
#!/usr/bin/env node
import { publishAll } from "./lib/publish-vendor.mjs";
import { repoRootFromImportMeta } from "./lib/marketplace-utils.mjs";

const root = repoRootFromImportMeta(import.meta.url);
const dryRun = process.argv.includes("--dry-run");

try {
  const stageRoot = publishAll(root, { dryRun });
  process.stderr.write(`OK — ${dryRun ? "dry-run" : "publish"} complete for @oscaner-skills/*\n`);
  process.stderr.write(`staged at ${stageRoot}\n`);
} catch (err) {
  process.stderr.write(`publish-vendor failed: ${err.message}\n`);
  process.exit(1);
}
```

- [ ] **Step 5：运行 dry-run 验证 stdout 契约**

Run: `node scripts/publish-vendor.mjs --dry-run`
stdout 验证（必须精确匹配）：
```bash
node scripts/publish-vendor.mjs --dry-run > /tmp/stdout.txt 2>/tmp/stderr.txt
cat /tmp/stdout.txt    # 预期：仅 "[]" 单行
cat /tmp/stderr.txt    # 预期：包含 "OK — dry-run complete…" 和 "staged at …"
```
- [ ] **Step 6：运行全部现有单元测试（回归验证）**

Run: `node scripts/lib/publish-vendor.test.mjs`
预期：ALL PASS（确保不破坏现有 assemblePackageJson / stageVendor / derivePiKey 等）

- [ ] **Step 7：手动只读探测 registry（验证 I/O helpers 正确性，非必要但加强信心）**

Run: `node --input-type=module -e "
import { probeRegistryVersion, listRegistryVersions } from './scripts/lib/publish-vendor.mjs';
console.log('superpowers 6.2.0 probe:', probeRegistryVersion('@oscaner-skills/superpowers', '6.2.0'));
console.log('superpowers versions:', listRegistryVersions('@oscaner-skills/superpowers'));
"`
预期：两个 probe 返回 "exit0"（superpowers 6.2.0 已在 npm），versions 返回版本数组

- [ ] **Step 8：Commit**

```bash
git add scripts/lib/publish-vendor.mjs scripts/publish-vendor.mjs
git commit -m "feat: publish-vendor emits to_tag gap list with stdout JSON contract"
```

---

### Task 3：release.yml 工作流接线

**Files:**
- Modify: `.github/workflows/release.yml`（+publish-vendor / +release-vendor / needs / 头部注释）

**Interfaces:**
- Consumes: Task 2 的 `to_tag` stdout JSON 契约（通过 `${{ steps.publish.outputs.to_tag }}`）

- [ ] **Step 1：更新 release.yml 头部流程注释**

将文件第 1–8 行的现有注释替换为（在第三段 `# → merge Version PR` 块末尾追加 vendors 说明）：

```yaml
# Release flow (main only):
#   develop accumulates .changeset/*.md → develop→main PR → push main
#   → changesets/action opens Version PR (target main); hasChangesets=true → tag/Release/sync skipped
#   → merge Version PR → push main again; hasChangesets=false → publish mode
#   → per-plugin matrix job pushes git tag + GitHub Release only for plugins that
#     were actually versioned (recorded in .changeset/versioned-plugins.json by
#     version-packages.mjs); plugins with no changesets are skipped — no phantom
#     baseline tag/release → sync PR.
#   Vendors (superpowers/mattpocock-skills/impeccable) co-publish in publish mode:
#     publish-vendor (npm assembly publish + registry gap sweep → to_tag JSON)
#     → release-vendor (git tag + GitHub Release per gap item; upstream-sync body).
#     release-plugin and sync-develop block on publish-vendor (atomicity).
```

- [ ] **Step 2：在 release.yml 中 `release-plugin` job 之前添加 `publish-vendor` job**

```yaml
  publish-vendor:
    needs: release
    if: needs.release.outputs.hasChangesets == 'false'
    runs-on: ubuntu-latest
    outputs:
      to_tag: ${{ steps.publish.outputs.to_tag }}
    steps:
      - uses: actions/checkout@v7
        with:
          submodules: recursive
          fetch-depth: 0
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
      - name: Assemble + publish vendored plugins, emit registry gap list
        id: publish
        run: |
          to_tag=$(node scripts/publish-vendor.mjs)
          echo "to_tag=$to_tag" >> "$GITHUB_OUTPUT"
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

> `run` 使用裸赋值 `to_tag=$(node …)` 而非 `echo "$(node …)"`：裸赋值的退出码 = node 的退出码，GH Actions 默认 bash `-eo pipefail` 会捕获非零退出（probe-error abort / publish 失败）；`echo "$(cmd)"` 会将 node 失败吞成 echo 的退出码 0——这是 spec §3.1 要求修复的 blocker 级陷阱。

- [ ] **Step 3：在 `publish-vendor` job 之后、`release-plugin` 之前添加 `release-vendor` job**

```yaml
  release-vendor:
    needs: [release, publish-vendor]
    if: needs.release.outputs.hasChangesets == 'false'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include: ${{ fromJSON(needs.publish-vendor.outputs.to_tag) }}
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - name: Check tag already exists
        id: tag-exists
        run: |
          if git ls-remote --exit-code --tags origin "refs/tags/${{ matrix.name }}@${{ matrix.version }}" >/dev/null 2>&1; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Create local tag
        if: steps.tag-exists.outputs.exists != 'true'
        run: git tag "${{ matrix.name }}@${{ matrix.version }}"

      - name: Push git tag
        if: steps.tag-exists.outputs.exists != 'true'
        run: git push origin "${{ matrix.name }}@${{ matrix.version }}"

      - name: Check if GitHub Release exists
        id: release-exists
        run: |
          if gh release view "${{ matrix.name }}@${{ matrix.version }}" >/dev/null 2>&1; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Create GitHub Release if missing
        if: steps.release-exists.outputs.exists != 'true'
        uses: softprops/action-gh-release@v3
        with:
          tag_name: ${{ matrix.name }}@${{ matrix.version }}
          generate_release_notes: false
          body: |
            Assembled from upstream [${{ matrix.upstreamRepo }}](https://github.com/${{ matrix.upstreamRepo }}) @ `${{ matrix.upstreamTag }}`.
```

> **幂等双保险**：tag-exists 跳过 git tag/push；release-exists 跳过 `softprops/action-gh-release`——重跑同一 run（或历史缺口重跑）不会重复建置，完全镜像 `release-plugin` 的幂等模式。`gh release view` 依赖 runner 默认注入的 `GITHUB_TOKEN`（workflow 已声明 `permissions: contents: write`），无需额外 env 配置。

- [ ] **Step 4：更新 `release-plugin` 和 `sync-develop` 的 `needs` 字段（原子性）**

在 `release.yml` 找到：

```yaml
  release-plugin:
    needs: release
    if: needs.release.outputs.hasChangesets == 'false'
```

改为：

```yaml
  release-plugin:
    needs: [release, publish-vendor]
    if: needs.release.outputs.hasChangesets == 'false'
```

同理，找到 `sync-develop` job：

```yaml
  sync-develop:
    needs: release
    if: needs.release.outputs.hasChangesets == 'false'
```

改为：

```yaml
  sync-develop:
    needs: [release, publish-vendor]
    if: needs.release.outputs.hasChangesets == 'false'
```

> vendor 发布失败 → `publish-vendor` job 挂 → 所有下游不跑 → 整次 release 失败（与「changeset publish 失败 → release job 挂 → 无 tag」的行为一致）。重跑幂等收敛（skip-if-published + 差集+双保险）。

- [ ] **Step 5：YAML 语法验证**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "YAML OK"
```
预期：`YAML OK`（验证 yaml 解析成功，GH Actions 特殊语法 `${{ }}` 均为字符串值，不影响解析）

- [ ] **Step 6：验证 emit 无 drift（不触碰 emit 产物）**

Run: `pnpm run emit:check`
预期：exit 0，no drift（本改动只修改 workflow，不触及 marketplace/manifests/emit 产物）

- [ ] **Step 7：Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: wire vendor publish-vendor + release-vendor jobs into release workflow"
```

---

### Task 4：文档更新 + 全量验证

**Files:**
- Modify: `.changeset/README.md`（`## Release flow` 段，第 34 行起）
- Modify: `README.md`（发布章节，第 129–131 行附近）
- Modify: `README.zh-CN.md`（发布章节，第 129–131 行附近）
- Modify: `marketplace/README.md`（`Vendored plugins` 段，第 24 行）

**Interfaces:** 无新依赖——文档只描述已实现的行为；全量验证确认所有改动不破坏 emit / validate 链

- [ ] **Step 1：更新 `.changeset/README.md` Release flow 段**

在 `## Release flow` 段（第 34 行起），在 step 3 和 step 4 之间插入 vendor 发布说明；在段尾追加 vendor 打 tag 说明：

```markdown
...（在 step 3 "merge to main" 后新增以下 step 5/6 逻辑，原有 step 4–5 重编号）:

5. publish 模式下 `publish-vendor` job 跑：对每个 vendor 执行 npm 装配发布（skip-if-published），然后枚举 registry 全量版本做差集探测（缺 tag 或 Release 的版本）—— 输出 `to_tag` JSON 数组供下一步消费；vendor 发布失败 → 整次 release 失败
6. `release-vendor` job 从 `to_tag` 矩阵逐项创建 git tag（`superpowers@6.2.0` 等）+ GitHub Release（body 注明上游同步：`Assembled from upstream <repo> @ <tag>`），重跑幂等（tag-exists / release-exists 跳过）；release-plugin / sync-develop 阻塞在 publish-vendor 之后（原子性）
```

同时在段末（当前是 `## Version scheme` 之前）追加一小段：

```markdown
## Vendor 发布

`@oscaner-skills/{superpowers,mattpocock-skills,impeccable}` 由 `publish-vendor.mjs` 在 publish 模式下随 first-party 一起发布到 npm。版本取自上游（plugin.json 或 submodule `vX.Y.Z` tag），不进 changesets。发布产物包含 pi key + 上游多 harness manifests（原文保留）+ mattpocock thin `gemini-extension.json`。

每次 publish 模式 push 都会触发全量差集探测——确保每个已发布的 npm 版本都同时拥有 `name@version` git tag + 对应 GitHub Release（registry 全量一致性）。Version 模式（hasChangesets=true）下不发 vendor，vendor 发布顺延到 Version PR 合入后的一次 publish 模式 push。
```

- [ ] **Step 2：更新 `README.md` 发布章节**

找到第 129–131 行：

```markdown
`develop` is the integration branch. Day-to-day PRs merge there. Production releases go through `develop --> main`. Version PRs, git tags, and GitHub Releases run on `main` only.

Release process: [`.changeset/README.md`](.changeset/README.md).
```

在其后追加一句：

```markdown
Vendor plugins (`@oscaner-skills/{superpowers,mattpocock-skills,impeccable}`) are assembled and published to npm alongside first-party packages during each publish-mode release, with registry full-consistency sweep ensuring every npm version has a git tag and GitHub Release. See [`.changeset/README.md#vendor-publishing`](.changeset/README.md#vendor-publishing).
```

- [ ] **Step 3：更新 `README.zh-CN.md` 发布章节**

找到第 129–131 行：

```markdown
`develop` 为集成分支，日常 PR 合入此处。生产发布通过 `develop --> main` PR。版本 PR、git tag 和 GitHub Release 仅在 `main` 上运行。

发布流程：[`.changeset/README.md`](.changeset/README.md)。
```

在其后追加一句：

```markdown
Vendored 插件（`@oscaner-skills/{superpowers,mattpocock-skills,impeccable}`）在每次 publish 模式发布时随 first-party 一起装配发布到 npm，并通过 registry 全量一致性差集保证每个 npm 版本同时拥有 git tag + GitHub Release。详见 [`.changeset/README.md` vendor 发布段](.changeset/README.md#vendor-publishing)。
```

- [ ] **Step 4：更新 `marketplace/README.md` vendored 段**

找到第 24 行（Vendored plugins 段末尾句）：

```markdown
Vendored plugins (`mattpocock-skills`, `impeccable`, `superpowers`): changes belong upstream — bump the submodule (weekly sync workflow, or `git submodule update --remote <name>`). The version resolves from the vendored `.claude-plugin/plugin.json` with a release-tag fallback, shared between `publish-vendor.mjs` and the emit chain so the published npm version and the marketplace declaration never disagree. There is no in-repo package.json to edit.
```

在该段末尾（`There is no in-repo package.json to edit.` 之后）追加：

```markdown
These vendored plugins are assembled and published to npm (`@oscaner-skills/*`) during each publish-mode release via `publish-vendor.mjs`, with skip-if-published idempotency and registry full-consistency sweep.
```

- [ ] **Step 5：运行全量验证——`pnpm run validate`**

Run: `pnpm run validate`
预期：ALL PASS（含 emit:check / plugin resolution / skill dirs / hooks / overrides build / engine tests / version sync）。本改动只改 workflow + 文档 + 新增函数，不触碰 emit 产物或 plugin manifests，validate 应当保持绿。

- [ ] **Step 6：最终 dry-run 签名确认**

Run:
```bash
node scripts/publish-vendor.mjs --dry-run > /tmp/final_stdout.txt 2>/tmp/final_stderr.txt
echo "=== stdout (must be exactly '[]') ==="
cat /tmp/final_stdout.txt
echo "=== stderr tail ==="
tail -5 /tmp/final_stderr.txt
```
预期：stdout = `[]` 单行；stderr 包含 `OK — dry-run complete` 和 `staged at …`

- [ ] **Step 7：Commit**

```bash
git add .changeset/README.md README.md README.zh-CN.md marketplace/README.md
git commit -m "docs: document vendor co-release flow in README + changeset docs"
```

---

### 实施后验收清单（spec §8 原文，实施完成时逐项核对）

- [ ] `release.yml` 含 `publish-vendor` + `release-vendor` job；`release-plugin` / `sync-develop` needs 含 `publish-vendor`
- [ ] 首次 release：三个 vendor npm 包成功发布，tag + GitHub Release 就位；重跑：全部 skip、零新 tag（幂等）
- [ ] 退出码传播：`node` 失败 → job 失败 → 下游阻断（§0 决策3）
- [ ] skip-if-published 三态生效：exit0→skip；E404→publish；probe 错误→release 中止；EPUBLISHCONFLICT→归一化 skip + 接全量差集
- [ ] `release-vendor` 只对「registry 全量差集：缺 tag 或缺 Release」建 tag / Release（body 含上游 repo + 上游 tag）
- [ ] 三端一致性：registry 每个已发布版本都有 tag + Release；历史缺口自动补建，npm 不重发
- [ ] 空输出 → `include: []` → release-vendor 跳过成功；stdout 恒单行合法 JSON 数组（脚本崩溃由退出码先行失败）
- [ ] version 模式（`hasChangesets=='true'`）两个新 job 不运行；vendor 发布顺延语义文档化
- [ ] `publish-vendor --dry-run` 装配验证通过（pi key / 上游 manifests / mattpocock thin gemini / LICENSE）
- [ ] 文档四处更新（§7 列表）
- [ ] `pnpm run validate` ALL PASS