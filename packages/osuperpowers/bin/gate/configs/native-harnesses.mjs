// gate/configs/native-harnesses.mjs — 原生 harness 集合派生（P4b T11 / T7 warn）。
// 原生 = configs/<name>/ 下含 {{GATE_ADAPTER}} 占位符模板的目录。新增原生 harness =
// 加 configs/<name>/ 模板即可，无需改 install-harness.mjs 注册表 / 测试的硬编码列表
// （此前 trae/vibe/kiro/grok 在 3 处重复，加第 5 个要协调改 3 处 —— 派生消除）。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const GATE_ADAPTER_PLACEHOLDER = "{{GATE_ADAPTER}}";

const CONFIGS = path.dirname(fileURLToPath(import.meta.url));

// 返回 configs/ 下含占位符模板的原生 harness 名（排序，确定性输出）。
export function deriveNativeHarnesses(configsDir = CONFIGS) {
  if (!existsSync(configsDir)) return [];
  const result = [];
  for (const entry of readdirSync(configsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(configsDir, entry.name);
    const hasPlaceholder = readdirSync(dir).some((f) => {
      try {
        return readFileSync(path.join(dir, f), "utf8").includes(GATE_ADAPTER_PLACEHOLDER);
      } catch {
        return false;
      }
    });
    if (hasPlaceholder) result.push(entry.name);
  }
  return result.sort();
}
