#!/usr/bin/env node
// bin/os-init/install-gates.mjs — os-init gates 安装器（P4b T7）。
// 用法: node install-gates.mjs [--harness trae,vibe,kiro,grok,pi,opencode,gemini,qoder,codex] [--dry-run]
// 流程（对齐 spec §2.5）：
//   1. 检测  —— command -v <harness>；trae 无 CLI → 检查 ~/.trae 目录存在
//   2. 引导  —— 包通道 harness（pi/opencode/gemini/qoder/codex）打印安装命令 + trust 下一步，不写文件
//   3. 配置  —— 原生 harness 集合从 gate/configs/ 派生（见 native-harnesses.mjs：
//              含 {{GATE_ADAPTER}} 占位符模板的目录 = 原生），复制 configs/<h>/ 模板 → 机器路径；
//              模板内 {{GATE_ADAPTER}} 占位符替换为包内 adapter 绝对路径（安装时解析）
//   4. 信任  —— 原生 harness 打印 trust 下一步（grok `grok --trust`；trae Enable…）；
//              包通道 codex/gemini 也打印 trust 下一步
//   5. 报告  —— 已写 / 引导 / 跳过 列表；--dry-run 只预览不写
// 幂等：重复运行覆盖原生 config（保留用户非冲突内容：JSON 深合并 / TOML 追加）；
// 未知 --harness → stderr + exit 1；写失败 → 明确报错不静默。
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveNativeHarnesses, GATE_ADAPTER_PLACEHOLDER } from "../gate/configs/native-harnesses.mjs";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIGS = path.join(PKG_ROOT, "bin", "gate", "configs");
const ADAPTERS = path.join(PKG_ROOT, "bin", "gate", "adapters");
const PLACEHOLDER = GATE_ADAPTER_PLACEHOLDER;
const HOME = process.env.HOME ?? "";

const homePath = (...seg) => path.join(HOME, ...seg);

function commandExists(name) {
  const pathVar = process.env.PATH ?? "";
  for (const dir of pathVar.split(":")) {
    if (!dir) continue;
    try {
      const st = statSync(path.join(dir, name));
      if (st.isFile() && (st.mode & 0o111) !== 0) return true;
    } catch {
      /* 该 PATH 段无此命令 */
    }
  }
  return false;
}

// harness 注册表：native 集合派生自 configs/（见 native-harnesses.mjs）—— 这里不设
// native 标志；原生 harness 带 config（模板 → 机器路径），包通道只带 guide + trust。
const HARNESSES = {
  trae: {
    config: { template: path.join(CONFIGS, "trae", "hooks.json"), dest: () => homePath(".trae", "hooks.json") },
    detect: () => existsSync(homePath(".trae")),
    trust: "Enable 钩子 + sandbox/local 执行模式",
  },
  vibe: {
    config: { template: path.join(CONFIGS, "vibe", "hooks.toml"), dest: () => homePath(".vibe", "hooks.toml") },
    detect: () => commandExists("vibe"),
  },
  kiro: {
    config: { template: path.join(CONFIGS, "kiro", "hooks.json"), dest: () => homePath(".kiro", "hooks", "engineering.json") },
    detect: () => commandExists("kiro"),
  },
  grok: {
    config: { template: path.join(CONFIGS, "grok", "engineering.json"), dest: () => homePath(".grok", "hooks", "engineering.json") },
    detect: () => commandExists("grok"),
    trust: "grok --trust",
  },
  pi: { guide: "pi install @oscaner-skills/engineering", detect: () => commandExists("pi") },
  opencode: { guide: "opencode.json `plugin` 数组加 `@oscaner-skills/engineering`", detect: () => commandExists("opencode") },
  gemini: {
    guide: "gemini extensions install <repo-url>",
    detect: () => commandExists("gemini"),
    trust: "首次使用接受项目 hook 指纹确认",
  },
  qoder: { guide: "安装 .qoder-plugin（marketplace/本地）", detect: () => commandExists("qoder") },
  codex: {
    guide: "安装 .codex-plugin（/plugins）",
    detect: () => commandExists("codex"),
    trust: "/hooks 审查并信任 engineering 钩子",
  },
};

// hook 条目签名 —— 去重键（matcher + 命令）。Cursor 形（顶层 command）与
// Claude 形（hooks[].command）都覆盖。
function hookSignature(entry) {
  const cmds = (entry.hooks ?? []).map((h) => h.command).filter(Boolean);
  if (!cmds.length && entry.command) cmds.push(entry.command);
  return `${entry.matcher ?? "*"}|${cmds.join(",")}`;
}

// JSON 深合并：模板默认值打底，用户既有值覆盖；hooks 逐事件追加模板条目（按签名去重）。
function mergeJsonHooks(existing, tmpl) {
  const out = { ...tmpl, ...existing };
  out.hooks = { ...(tmpl.hooks ?? {}), ...(existing.hooks ?? {}) };
  for (const [event, entries] of Object.entries(tmpl.hooks ?? {})) {
    const cur = Array.isArray(out.hooks[event]) ? [...out.hooks[event]] : [];
    const sigs = new Set(cur.map(hookSignature));
    const additions = entries.filter((e) => !sigs.has(hookSignature(e)));
    if (additions.length) out.hooks[event] = [...cur, ...additions];
  }
  return out;
}

// 目标已存在时合并：JSON 深合并；TOML 追加（已含同款块则跳过）。合法 JSON/TOML 之外
// 拒绝覆盖用户文件（明确报错，不静默破坏）。
async function mergeIfExists(dest, content) {
  if (!existsSync(dest)) return content;
  const existing = await readFile(dest, "utf8");
  if (!existing.trim()) return content;
  if (dest.endsWith(".json")) {
    let existingObj;
    try {
      existingObj = JSON.parse(existing);
    } catch {
      throw new Error(`${dest} 不是合法 JSON —— 拒绝覆盖用户文件，请人工处理`);
    }
    const merged = mergeJsonHooks(existingObj, JSON.parse(content));
    return `${JSON.stringify(merged, null, 2)}\n`;
  }
  // TOML：已含同款块 → 跳过；否则追加（保留用户既有 hooks 块）。
  if (existing.includes(content.trim())) return existing;
  return `${existing.replace(/\s*$/, "\n")}${content.trim()}\n`;
}

async function installNative(name, h, dryRun) {
  const adapter = path.join(ADAPTERS, `${name}.mjs`);
  const template = await readFile(h.config.template, "utf8");
  const content = template.split(PLACEHOLDER).join(adapter);
  const dest = h.config.dest();
  if (dryRun) {
    console.log(`  [dry-run] ${name.padEnd(10)} would write ${dest}`);
    if (h.trust) console.log(`  [dry-run] ${name.padEnd(10)} would print: ${h.trust}`);
    return;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, await mergeIfExists(dest, content));
  console.log(`  ✓ ${name.padEnd(10)} wrote ${dest}`);
  if (h.trust) {
    console.log(`     ${name.padEnd(10)} 下一步: ${h.trust}`);
  }
}

function parseArgs(argv) {
  const args = { harness: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") {
      args.dryRun = true;
    } else if (argv[i] === "--harness") {
      args.harness = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      console.error(`os-init gates: 未知参数 ${argv[i]}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const names = args.harness ?? Object.keys(HARNESSES);
  const unknown = names.filter((n) => !HARNESSES[n]);
  if (unknown.length) {
    console.error(`os-init gates: 未知 harness: ${unknown.join(", ")}（可用: ${Object.keys(HARNESSES).join(", ")}）`);
    process.exit(1);
  }
  const nativeSet = new Set(deriveNativeHarnesses(CONFIGS));
  console.log(`os-init gates — ${args.dryRun ? "dry-run preview（不写任何文件）" : "install"}`);
  let wrote = 0;
  let guided = 0;
  let skipped = 0;
  for (const name of names) {
    const h = HARNESSES[name];
    if (!h.detect()) {
      console.log(`  — ${name.padEnd(10)} not detected — 跳过`);
      skipped++;
      continue;
    }
    if (nativeSet.has(name)) {
      await installNative(name, h, args.dryRun); // 写失败 → 抛错 → exit 1
      wrote++;
    } else {
      console.log(`  · ${name.padEnd(10)} detected — 引导: ${h.guide}`);
      if (h.trust) console.log(`     ${name.padEnd(10)} 下一步: ${h.trust}`);
      guided++;
    }
  }
  console.log(`完成 — 写原生 config: ${wrote}, 引导包通道: ${guided}, 跳过(未检测): ${skipped}`);
}

main().catch((e) => {
  console.error(`os-init gates: ${e.message}`);
  process.exit(1);
});
