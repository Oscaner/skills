# init harness

`init harness` 安装 per-harness 的 osuperpowers 配置（原生 config 写入 + 包通道引导 + 信任仪式），让 os-*/cli-* 触发自检在所有已装 harness 上生效。

## Usage

```text
/init harness [--harness …] [--dry-run]
```

## Rules

### Rule: Run Installer

先跑 `/init harness`（检测/引导/写原生 config/信任）—— 底层从**已安装包**运行
`node <plugin-root>/bin/init/install-harness.mjs`（`<plugin-root>` = marketplace 实际
安装 osuperpowers 的位置，不是源 checkout 的 `node <repo>/packages/...` 路径）：

1. 检测 —— harness-detect util（`command -v <cli>`；`cli` 源 = `config.harnesses[h].cli ?? h`）
2. 引导 —— install-and-use 通道：打印 probe + install hint，不写文件
3. 配置 —— init 通道：native harness 写 config（从 configs/ 派生模板）+ 复制 skills
4. 信任 —— grok 打印 `grok --trust`；trae 打印 Enable + sandbox/local 执行模式

未知 `--harness` → 工具 exit 1；`--dry-run` 只预览不写任何文件；重复运行幂等（JSON 深合并 / TOML 追加，保留用户非冲突内容）。

### Rule: Trust Ceremony

config 写入 ≠ 信任生效。agent 剩余角色 = 执行/引导信任仪式：grok `grok --trust`、codex `/hooks`、gemini 首次接受指纹、trae Enable + sandbox/local 执行模式。

### Rule: Summarize

汇总报告各 harness 状态：已写 config（生效）/ 引导包通道（需用户装包）/ 跳过（未检测）+ 需人工信任步骤。

## Red Flags

- 「跑完 installer 就算装好」→ config 写入 ≠ 信任生效；信任仪式（grok --trust / trae Enable / codex /hooks / gemini 指纹）需引导用户执行
- 「对未检测 harness 报失败」→ 未检测 harness 跳过是预期行为，汇总中说明即可
- 「直接写不预览」→ 首次运行先 `--dry-run` 预览将写路径
