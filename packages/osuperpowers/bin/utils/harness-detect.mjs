// bin/utils/harness-detect.mjs — per-harness CLI 检测工具（P6b T5）。
// detectInstalledHarnesses(config, { env }) → [{name, installed, channel, cli}]
//   cli 源 = config.harnesses[h].cli ?? h（显式 cli 字段优先；cursor-agent = "cursor-agent"）
//   installed = command -v <cli> 存在且可执行（对齐 engine/lib/registry.mjs cliInPath）
//   channel = "install-and-use" | "init"（从 config.channel 派生）
// cdd-select + init 共用。
import { statSync } from "node:fs";
import path from "node:path";

// command -v 对齐 —— 对齐 engine/lib/registry.mjs cliInPath。
function cliInPath(cli, env) {
  const pathDirs = (env?.PATH ?? process.env.PATH ?? "").split(path.delimiter);
  for (const dir of pathDirs) {
    if (!dir) continue;
    try {
      const st = statSync(path.join(dir, cli));
      if (st.isFile() && (st.mode & 0o111) !== 0) return true;
    } catch {
      // 该目录无此二进制
    }
  }
  return false;
}

// 从 config.channel 派生 harness → channel 映射。
function buildChannelMap(channel) {
  const map = {};
  for (const [ch, harnesses] of Object.entries(channel ?? {})) {
    for (const h of harnesses) {
      map[h] = ch;
    }
  }
  return map;
}

// detectInstalledHarnesses(config, { env }) —— 返回全部 harness 的检测结果。
// 结果项：{ name, installed, channel, cli }
//   name = harness key
//   cli = config.harnesses[h].cli ?? h
//   installed = command -v <cli> 存在且可执行
//   channel = config.channel 派生的通道分类（"install-and-use" | "init" | undefined）
export function detectInstalledHarnesses(config, { env = process.env } = {}) {
  const channelMap = buildChannelMap(config.channel);
  const harnesses = config.harnesses;
  const result = [];
  for (const name of Object.keys(harnesses).sort()) {
    const h = harnesses[name];
    const cli = h.cli ?? name;
    result.push({
      name,
      installed: cliInPath(cli, env),
      channel: channelMap[name] ?? undefined,
      cli,
    });
  }
  return result;
}
