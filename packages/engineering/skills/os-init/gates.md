# os-init gates

`os-init gates` 安装跨 harness 的 engineering gate（原生 config 写入 + 包通道引导 + 信任仪式），让 os-*/cli-* 触发自检在所有已装 harness 上生效。

## Usage

```text
/os-init gates [--harness …] [--dry-run]
```

## Rules

### Rule: Run Installer

先跑 `node <repo>/packages/engineering/bin/os-init/install-gates.mjs`（检测/引导/写原生 config/信任）：

1. 检测 —— `command -v <harness>`；trae 无 CLI → 检查 `~/.trae` 目录
2. 引导 —— 包通道 harness（pi/opencode/gemini/qoder/codex）打印安装命令，不写文件
3. 配置 —— 无包通道 4 个（trae/vibe/kiro/grok）复制 `configs/<h>/` 模板 → 机器路径
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
