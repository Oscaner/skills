# release 随发 vendors：装配发布 + tag + Release（上游同步说明）

## Header

- **Version**: v1.2 · 2026-08-19
- **Status**: Draft（待 CLI spec review + 用户评审）
- **Phase**: standalone（release 流水线接线，P7 系列之后的新需求）
- **Dependencies**: P7 系列（P4a 落地的 `packages/` + `vendors/` 布局、`publish-vendor.mjs`、changesets 发布链）
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Constraints**:
  - Conventional commits，无 attribution / co-author trailer
  - 禁用 git worktree
  - `pnpm run validate` 必须保持通过
  - 派生文件（marketplace / manifests）不手工编辑，只改 SOT 后重 emit
  - 不碰上游 vendors 内容；装配只发生在构建期

## §0 Document scope

**问题陈述**：`release.yml` 在 publish 模式（`hasChangesets == 'false'`）下只发布两个 first-party 包（`@oscaner-skills/osuperpowers`、`@oscaner-skills/osuperpowers-router`），`release-plugin` matrix 只为它们建 git tag + GitHub Release。三个 vendored submodule 插件（`superpowers` / `mattpocock-skills` / `impeccable`）虽由 `pnpm run emit` 装配进 marketplace manifests 并随 release 的 `pnpm run emit` 步骤输出，但 **`@oscaner-skills/{superpowers, mattpocock-skills, impeccable}` 至今未发布到 npm**，也没有本仓库侧的 tag / GitHub Release。

`scripts/publish-vendor.mjs`（P4a 交付，自 `eb42a49`）已实现装配，但**接线未完成，且发布安全面缺失**——现有实现无 skip-if-published、无条件 `npm publish`（重跑必然 EPUBLISHCONFLICT 失败）、stdout 有人类日志。本阶段补齐接线 + 发布安全面，并按用户补充扩展到 tag + GitHub Release（含上游同步说明）。

**已确认的范围决策（brainstorming grilling）：**

1. **发布产物**：npm 装配发布为**主**；同时为**已发布到 npm 的** vendor 版本（含历史）创建 git tag + GitHub Release。
2. **Release notes**：不 `generate_release_notes`，自定义 body 说明**与上游同步**（upstream repo + 对应 tag）。
3. **原子性**：vendor 发布失败 = 整次 release 失败；`release-plugin` / `sync-develop` 阻塞在 `publish-vendor` 之后。
4. **幂等**：skip-if-published 默认开（版本已在 registry 则跳过发布）；**无强制发布通道**（见 §4.1）。
5. **三端一致性（tag / Release / npm）**：**每个已发布到 npm 的 vendor 版本都必须有本仓库的 `name@version` tag + 对应 GitHub Release**。`publish-vendor` 每次 publish 后对 registry 全量版本做差集探测，缺失即列入输出（无论是否本轮发布）；tag-exists / release-exists 检查再兜底幂等。
6. **实现顺序**：本地 `--dry-run` 验证装配产物 → 再接线 CI。

## §1 现状与 gap

| 事实 | 值 |
|---|---|
| first-party npm 发布 | `changeset publish`（publish 模式），`@oscaner-skills/osuperpowers` + `osuperpowers-router` |
| first-party tag/Release | `release-plugin` matrix：`osuperpowers@X` / `osuperpowers-router@X.Y.Z-router.a.b.c` |
| vendors npm 现状 | **三个 `@oscaner-skills/*` 均 NOT PUBLISHED**（`npm view` 验证） |
| 装配脚本 | `scripts/publish-vendor.mjs`（`eb42a49`，P4a）存在但未被 workflow 调用；无条件 `npm publish`、stdout 含日志 |
| 版本源 | `resolveVendorVersion`：`.claude-plugin/plugin.json` version 优先（impeccable=4.0.4）；无则 `vX.Y.Z` tag（superpowers=6.2.0 / mattpocock-skills=1.1.0），**两者皆无 → 抛错** |
| 上游 tag at HEAD | superpowers `v6.2.0`；mattpocock-skills `v1.1.0`；impeccable `cli-v3.5.0` / `ext-v1.3.1` / `skill-v4.0.4`（`skill-v` 匹配 npm 版本 4.0.4） |

## §2 目标设计总览

```
push main → release（changeset publish，first-party）
  → publish-vendor（npm 装配发布 + 待打 tag/Release 清单；skip-if-published 幂等）  ← hasChangesets=='false' gate
  → release-vendor（tag + GitHub Release，registry 全量差集缺项）
  → release-plugin（不变）+ sync-develop（不变），全部 needs [release, publish-vendor]
```

- 每次 publish 模式 push 都跑；skip-if-published + **registry 全量一致性差集** + tag-exists/release-exists 保证幂等收敛（无版本变化且三端一致时零发布、零新 tag）。
- 首次发布将产生 3 个 vendor npm 包 + 3 个 tag + 3 个 GitHub Release；此后 submodule 不动则不产生。
- **version 模式（`hasChangesets == 'true'`）** 下两个新 job 均不运行，vendor 发布顺延到下次 publish 模式 push —— 见 §3.4。

## §3 release.yml 改动

### §3.1 新增 `publish-vendor` job

```yaml
publish-vendor:
  needs: release
  if: needs.release.outputs.hasChangesets == 'false'
  runs-on: ubuntu-latest
  outputs:
    to_tag: ${{ steps.publish.outputs.to_tag }}
  steps:
    - uses: actions/checkout@v7        # submodules: recursive, fetch-depth: 0
    - uses: actions/setup-node@v7      # node-version: 22, registry-url: https://registry.npmjs.org
    - id: publish
      run: |
        to_tag=$(node scripts/publish-vendor.mjs)
        echo "to_tag=$to_tag" >> "$GITHUB_OUTPUT"
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- 无 `pnpm install` 步骤：`publish-vendor.mjs` 是零依赖纯 ESM（lib 内部 import，无第三方包）。
- `setup-node` 的 `registry-url` + job env `NODE_AUTH_TOKEN` 是 plain `npm publish` 的 GH Actions 认证约定（repo 无 `.npmrc`；现有 changesets publish 的认证由 changesets/action 内部处理，不能复用）。
- **退出码传播**：用裸赋值 `to_tag=$(node …)` 而非 `echo "$(node …)"`——赋值命令的退出码 = 命令替换的退出码，`set -e`（GHA 默认）可捕获 `node` 的非零退出（probe-error 中止 / publish 失败 → job 失败 → 下游阻断）。`echo "$(cmd)"` 会把 node 的失败吞成 0（echo 自身成功），是接线反模式。
- **stdout 传输契约**（与 §4.2 不变量配套）：脚本**仅向 stdout 输出单行合法 JSON 数组**，人类日志全部走 stderr；`$(…)` 在双引号内不对输出重解析，JSON 内的引号安全。空数组（registry 全量一致、无缺失）→ matrix `include: []` → `release-vendor` 零组合**跳过成功**。
- `to_tag` job output = 待打 tag/Release 集（**registry 全量一致性差集**，见 §4.2）。

### §3.2 新增 `release-vendor` job

```yaml
release-vendor:
  needs: [release, publish-vendor]
  if: needs.release.outputs.hasChangesets == 'false'
  runs-on: ubuntu-latest
  strategy:
    matrix:
      include: ${{ fromJSON(needs.publish-vendor.outputs.to_tag) }}
  steps:
    - checkout (submodules: recursive, fetch-depth: 0)
    - run: Read version  # ${{ matrix.version }}
    - run: Check tag already exists + release-exists（镜像 release-plugin 的幂等逻辑）
    - run: git tag "${{ matrix.name }}@${{ matrix.version }}" + push   # tag 已存在则跳过
    - uses: softprops/action-gh-release@v3   # generate_release_notes: false
      with:
        tag_name: ${{ matrix.name }}@${{ matrix.version }}
        body: "Assembled from upstream [${{ matrix.upstreamRepo }}](https://github.com/${{ matrix.upstreamRepo }}) @ `${{ matrix.upstreamTag }}`."
```

- **matrix 动态 include** 由 `publish-vendor` 的 job output 驱动（`fromJSON`），避免跨 job 提交临时文件；`include: []` → 零组合，job 跳过成功（GH Actions 行为）。
- **tag 命名**：`<插件名>@<版本>`（如 `superpowers@6.2.0`），对齐现有 `osuperpowers@X` 约定，无 scope 前缀。
- **幂等 + 全量一致性**：matrix 项 = registry 全量版本中「缺 tag 或缺 Release」者（含历史版本、含本轮刚发布者）。tag-exists / release-exists 检查分别跳过已存在者、补建缺失者——覆盖「tag push 成功、Release 创建失败」等两步骤间失败顺序与历史长尾缺口。
- **认证**：Release 经 `softprops/action-gh-release@v3` 创建（内部走 `GITHUB_TOKEN`，release.yml 已声明 `permissions: contents: write`）；workflow 级 token 由 runner 默认注入为 `GITHUB_TOKEN` env。

### §3.3 既有 job 改动（原子性）

- `release-plugin`：`needs: release` → `needs: [release, publish-vendor]`（`if` 不变）
- `sync-develop`：`needs: release` → `needs: [release, publish-vendor]`（`if` 不变）

vendor 发布失败 → `publish-vendor` job 挂 → 所有下游不跑 → 整次 release 失败。与现有「changeset publish 失败 → release job 挂 → 无 tag」的行为一致。

### §3.4 version 模式（`hasChangesets == 'true'`）行为

Version PR 创建路径下：

- `publish-vendor` / `release-vendor` **不运行**（两个新 job 均以 `=='false'` 门控，`=='true'` 时天然跳过）。
- `release` job 内的 `pnpm run emit` **照常执行**：vendor 版本由 submodule HEAD 决定，版本未变则 manifest 无漂移；版本已变则可引用一个**尚未发布**的 npm 版本。
- **顺延语义**：若 vendor 在进入 version 模式前已被 submodule bump，其 npm 发布 + tag 顺延到 **Version PR 合入后的下一次 publish 模式 push**。顺延窗口内 marketplace 引用未发布的 npm 版本 —— 与 first-party 相同的语义（版本在 Version PR 合入后的一次 push 内对齐）。与 first-party 一致，该窗口被接受；两路径最终由 skip-if-published + 全量一致性差集（§4.2）收敛，**无需人工介入**。
- 本仓库有意**不在 version 模式发布 vendor**：避免 Version PR 的 diff 引入发布产物变更与自引用，以及 Version PR 与 publish 两次 push 之间的竞态（该对抗 P4a §2.C 原意图，记入 §9 Deviations）。

## §4 `scripts/publish-vendor.mjs` 改动（清单）

1. **registry probe 三态**（§4.1）：发布前判定 已发布 / 未发布(E404) / probe 错误
2. **EPUBLISHCONFLICT 归一化**（§4.1）：撞冲突 = 已发布 skip + 接全量差集判定
3. **stdout 契约**：现有 CLI 的 `OK — …` / `staged at …` 两条 `console.log` 迁往 **stderr**；stdout 恒为单行合法 JSON 数组
4. **待打 tag 清单输出**（§4.2）：全量一致性差集项（registry 版本缺 tag/Release 者），含 upstream 元数据
5. **`--dry-run`**：装配检查专用（不做 registry probe，不发布），stdout 输出 `[]`
6. 无 `--force`：见 §4.1（已按 review 删除）

### §4.1 skip-if-published（默认开）

- 发布前 probe：`npm view @oscaner-skills/<name>@<version>` —— **三态判定**：
  - exit 0 → 已发布 → 跳过 `npm publish`，**仅跳过发布**；该版本若缺 tag / Release，仍由全量差集（§4.2）捕获输出
  - exit 非零且 stderr 含 `E404` / `Not found` → 未发布 → 执行 `npm publish`
  - exit 非零且**非 E404**（网络 / registry 故障）→ **probe error → release 中止**（绝不把瞬时故障判为已发布或未发布；UI 语义 = fail-closed）
- `npm publish` 撞 **EPUBLISHCONFLICT** → 归一化为已发布 skip+log（非错误），**并接全量差集判定**（同轮补齐 tag/Release）——覆盖 probe 与 publish 之间的 TOCTOU 窗口及 registry 索引滞后。
- 决策层纯函数化：`decideProbe(probeResult)` → `skip | publish`（E404→publish，其他→error，exit0→skip）；`shouldRepair(name, version, tagExists, releaseExists)` → tag-only 判定。均可单测。
- **无强制发布通道**：不提供 `--force`。理由：(a) npm 版本不可变，同版本重发无意义；(b) 跳过 probe 的真实效果是覆盖 probe-error → 中止的 fail-closed 分支——这正是设计要保护的安全保证；(c) unpublish 后重发属 npm 层运维操作，不属本脚本职责。强制重发的需求若出现，应走独立的运维流程评估，而非在回滚保护上加后门。
- **`--dry-run`** 模式：不做 registry probe、不发布、不探测 tag/Release；只做本地装配（包名 / 版本 / LICENSE / pi key），stdout `[]`，装配报告走 stderr。

### §4.2 待打 tag/Release 清单输出（`to_tag`）—— 全量一致性差集

- **判定原则（三端一致）**：对每个 vendor，枚举 registry 上**全部已发布版本**（`npm view <name> versions --json`），逐一探测本仓库 `name@version` tag 与 GitHub Release；**任一缺失 → 输出项**。不区分「本轮发布」与「历史版本」——workflow 对全部项同态处理。此集合天然覆盖：
  - 本轮 `npm publish` 成功者（刚发布必缺 tag → 自动入列；输出源 = `registry 已发布版本 ∪ 本轮发布列表`，规避 registry 索引滞后）
  - 「发布成功但写清单前崩溃 / tag push 成功但 Release 创建失败 / 上一轮 release-vendor 失败」等半发布状态
  - 历史版本（submodule 早已 bump）的长期缺口——**不依赖 submodule HEAD**
- 每项：
  ```json
  [{"name": "superpowers", "version": "6.2.0",
    "upstreamRepo": "obra/superpowers", "upstreamTag": "v6.2.0"}]
  ```
- **输出不变量**：stdout **恒为单行合法 JSON 数组**（最小 `[]`）；人类日志全部走 stderr；配 §3.1 的裸赋值捕获。空数组 → matrix `include: []` → `release-vendor` 跳过成功。脚本崩溃 → job 退出码非零 → job 失败（矩阵不会接到空字符串）。
- **tag 探测**：`git ls-remote --exit-code --tags origin refs/tags/<name>@<version>`；**Release 探测**：`gh release view <name>@<version>`（runner 默认注入 `GITHUB_TOKEN` env，非交互）。任一缺失 → 输出。
- `upstreamRepo` 取 `.gitmodules` 主 URL 规约化（剥 `.git` / `https://` 前缀）：host 为 `github.com` → Release body 生成超链接；host 非 github.com → 回退为纯 repo 名文本、不带链接（当前三 vendor 均 GitHub；降级分支仅为未来扩展保留）。
- `upstreamTag` 解析链（**由 version 确定性推导，无需持久化历史映射**）：
  1. version == 当前 `resolveVendorVersion(HEAD)` 且匹配 `TAG_PATTERNS` → submodule HEAD 上对应 tag（精度最高，当前版本路径）
  2. 否则向**上游仓库**探测：`git ls-remote --tags <url> refs/tags/v<version> refs/tags/skill-v<version>`（impeccable 的 plugin.json 版本 ↔ `skill-v` tag 由 `TAG_PATTERNS` 驱动）→ 命中即该 tag（历史版本路径）
  3. 皆未命中 → Release note 只写 upstream repo 名、省略 tag（可接受降级）
- **tag 源 vendor（superpowers / mattpocock）在 submodule HEAD 无匹配 tag → `resolveVendorVersion` 已抛错 → release 失败**（与现有实现一致，仅影响「当前版本」发布路径，不影响历史版本补 tag/Release）；plugin.json 源（impeccable）无匹配 tag → 走解析链 2/3。
- **一致性边界（单向保证）**：保证「每个 npm 版本 → tag + Release」；反向（tag 存在但 npm 版本已 unpublish）不在本机制范围——unpublish 属 npm 层运维操作，残留 tag 无害。

### §4.3 发布产物的 harness 配置面（装配契约）

装配 tarball 的 harness 配置面（读者以此核对发布物完整性）：

- **pi key**（package.json `pi`）：pi harness 的消费入口。来源三态（`derivePiKey`）：上游 package.json 自带 `pi`（superpowers → 保留 extensions + skills）→ `.pi/skills/` 目录（impeccable）→ `.claude-plugin/plugin.json` skills 数组派生（mattpocock → 21 skills）。dry-run 已实测三包齐备。
- **上游自带 manifests 原样保留**：`copyTree` 只排除 `.git` / `node_modules`，上游多 harness 目录/文件（`.claude-plugin/` `.cursor-plugin/` `.codex-plugin/` `.kimi-plugin/` `.agents/` `.gemini/` `.qoder/` 等）全部进 tarball，一条不动。
- **装配新增**：`oscaner-plugin.contentRoot`（声明式元数据）；mattpocock 额外生成 **thin `gemini-extension.json` + `GEMINI.md`**（无 BeforeTool hooks——mattpocock 是 skill-only 包）。
- **不包含**：first-party 的 gate hooks（osuperpowers 专属面，vendors 装配不注入）。
- 本 spec 的发布门禁（skip-if-published / 差集 / tag）只管版本生命周期；配置面由装配契约保证，验收在 §6 / §8 检查。

## §5 错误处理

| 场景 | 行为 |
|---|---|
| probe exit 0（已发布） | 跳过发布；缺 tag / 缺 Release → 由全量差集捕获输出驱动 release-vendor（§4.1） |
| probe 非 E404 错误（网络 / registry 故障） | **release 中止**（probe error 绝不判为已发布/未发布） |
| `npm publish` 撞 EPUBLISHCONFLICT（TOCTOU） | 归一化为已发布 skip + 接全量差集判定（同轮补齐 tag/Release） |
| vendor submodule 未 checkout | publish-vendor 报错（现有 `assertSubmoduleCheckedOut`）+ 提示 `git submodule update`，release 失败 |
| vendor LICENSE 缺失 | publish-vendor 中止（现有 `assertLicensePresent`），release 失败 |
| 某 vendor 发布失败 / `npm publish` 其他错误 | job 失败 → 下游全部阻塞（原子性），重跑幂等收敛 |
| 发布成功但写清单前崩溃 / 上一轮 tag/Release 失败 / 历史版本缺 tag | 下次运行的**全量一致性差集**自动补建，npm 不重发 |
| registry 全量一致（无缺 tag/Release 版本） | stdout `[]` → matrix include 空 → release-vendor 零组合跳过成功 |
| tag 源 vendor 无匹配上游 tag | `resolveVendorVersion` 抛错 → release 失败（与现有实现一致） |
| plugin.json 源 vendor 无匹配 tag | Release note 回退 pinned SHA，发布正常 |
| tag 或 Release 已存在（重跑） | tag-exists / release-exists 检查跳过，不报错（镜像 release-plugin） |

> §4.1 是发布安全面的**唯一规范定义点**；§5 / §8 只引用不重述。

## §6 测试

- `publish-vendor.test.mjs`：
  - `decideProbe` 三态用例（exit0→skip / E404→publish / 其他→probe-error）
  - 全量差集纯函数 `collectGaps(registryVersions, publishedThisRun, tagIndex, releaseIndex)` 用例：缺 tag 项 / 缺 release 项 / 齐备项排除 / registry 索引滞后（本轮发布列表并入）/ 空 registry → `[]`
  - `upstreamTag` 解析链用例：HEAD 命中（当前版本）/ 上游版本 tag 命中（历史版本）/ 双失败 → 省略
  - stdout 不变量断言（输出恒为单行合法 JSON 数组，最小 `[]`）
- 本地 `node scripts/publish-vendor.mjs --dry-run`：验证三个装配产物——包名 / 版本 / **pi key** / **上游 manifests 原样保留** / **mattpocock thin gemini** / LICENSE 保留（已完成，产物为 superpowers@6.2.0 / mattpocock-skills@1.1.0 / impeccable@4.0.4，配置面见 §4.3）
- `pnpm run emit:check`：无 drift（本改动不触碰 emit 产物）
- `pnpm run validate`：ALL PASS

## §7 文档更新

- `release.yml` **头部 flow 注释**：补 `release → publish-vendor → release-vendor / release-plugin / sync-develop` 的新链（现有注释只含 tag/Release/sync，会失真）。
- `.changeset/README.md`：release flow 增加 vendor 随发说明（trigger / skip-if-published / version 模式顺延 / tag 时机）。
- `README.md` + `README.zh-CN.md`：发布章节补 vendors 装配发布说明。
- `marketplace/README.md`：edit workflow 的 vendored 段补「随 release 发布到 npm」一句。

## §8 验收标准

- [ ] `release.yml` 含 `publish-vendor` + `release-vendor` job；`release-plugin` / `sync-develop` needs 含 `publish-vendor`
- [ ] 首次 release：三个 vendor npm 包成功发布，tag + GitHub Release 就位；重跑：全部 skip、零新 tag（幂等）
- [ ] 退出码传播：`node` 失败（probe-error / publish 失败）→ job 失败 → 下游阻断（§0 决策3）
- [ ] skip-if-published 三态生效：exit0→skip；E404→publish；probe 错误→release 中止；EPUBLISHCONFLICT→归一化 skip + 接全量差集
- [ ] `release-vendor` 只对「registry 全量差集：缺 tag 或缺 Release」建 tag / Release（body 含上游 repo + 上游 tag）
- [ ] **三端一致性**：registry 每个已发布版本都有 tag + Release；历史缺口（含 submodule 已 bump 的旧版本）自动补建，npm 不重发
- [ ] 空输出 → `include: []` → release-vendor 跳过成功；stdout 恒单行合法 JSON 数组（脚本崩溃由退出码先行失败）
- [ ] version 模式（`hasChangesets=='true'`）两个新 job 不运行；vendor 发布顺延语义文档化
- [ ] `publish-vendor --dry-run` 装配验证通过（§6 已列，含 §4.3 配置面检查：pi key / 上游 manifests / mattpocock thin gemini）
- [ ] 文档四处更新（§7）
- [ ] `pnpm run validate` ALL PASS

## §9 Deviations from P4a

1. **version-packages 不扩展**：P4a §2.C 写「`version-packages.mjs` 扩展处理 first-party + vendors 装配发布」。本设计采用 **release.yml 直接调用 `publish-vendor.mjs`**，`version-packages.mjs` 保持 first-party-only。
2. **version 模式不发 vendor**：P4a §2.C 把 vendors 装配发布纳入统一 pnpm changeset 链；本设计有意不在 version 模式（Version PR 创建路径）发布 vendor，发布仅发生在 publish 模式（§3.4）。

共同理由：关注点分离（version-packages 管 changeset 版本面，publish-vendor 管装配发布面）；vendors 不进 changesets（版本源是上游 tag / plugin.json，不是 changeset 计算）；幂等 + 原子性 + 待打 tag 清单输出全部收敛在 publish-vendor 单一入口，workflow 只做接线。