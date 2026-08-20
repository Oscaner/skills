#!/usr/bin/env node
// bin/init/install-harness.mjs — per-harness 安装器（P6b T5，取代 install-gates.mjs）。
// 用法: node install-harness.mjs [--harness h1,h2,...] [--dry-run]
// 流程：
//   1. 检测  —— command -v <cli>；仅列出已装 harness（harness-detect util）
//   2. 引导  —— install-and-use 通道：打印 probe + install hint，不写文件
//   3. 配置  —— init 通道：写 config（原生 harness 从 configs/ 派生模板）+ 复制 skills
//   4. 信任  —— grok `grok --trust`；trae Enable…；codex `/hooks`；gemini 指纹
//   5. 报告  —— 已写 / 引导 / 跳过 列表；--dry-run 只预览不写
//   6. manifest — ~/.osuperpowers/state/<harness>.json 全量同步
//     { osuperpowersVersion, files: { path → { hash, source } } }
//     source = "init" 标记自动生成的文件
//     删除仅限 manifest 追踪 + source:"init" + on-disk hash 未变
//     hash 变 = 用户改动 → 保留并报告
// 幂等：重复运行覆盖原生 config（保留用户非冲突内容：JSON 深合并 / TOML 追加）；
// 未知 --harness → stderr + exit 1；写失败 → 明确报错不静默。
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exitBlocked, exitCliMissing } from "../utils/exit.mjs";
import { detectInstalledHarnesses } from "../utils/harness-detect.mjs";
import { config } from "../utils/skills-probe.config.mjs";
import { deriveNativeHarnesses, GATE_ADAPTER_PLACEHOLDER } from "../gate/configs/native-harnesses.mjs";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIGS = path.join(PKG_ROOT, "bin", "gate", "configs");
const ADAPTERS = path.join(PKG_ROOT, "bin", "gate", "adapters");
const PLACEHOLDER = GATE_ADAPTER_PLACEHOLDER;
const HOME = process.env.HOME ?? "";

// pi 扩展 shim 模板标记 —— 用于识别「目标 .ts 文件是否为我们模板生成」。
const PI_TS_MARKER = "osuperpowers harness — Pi TS extension";

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

// harness 安装描述：per-harness 具体行为。
// install-and-use 通道：probe → install hint（不写文件）
// init 通道：native config 写入 / guide + trust
const HARNESSES = {
  claude: { channel: "install-and-use", detect: () => commandExists("claude"), hint: (p) => `/plugin marketplace add Oscaner/skills && /plugin install ${p}@oscaner-skills` },
  "cursor-agent": { channel: "install-and-use", detect: () => commandExists("cursor-agent"), hint: () => "copy skills 到 .agents/skills/ 或装 marketplace" },
  droid: { channel: "install-and-use", detect: () => commandExists("droid"), hint: () => "copy skills 到 .agents/skills/" },
  grok: {
    channel: "install-and-use",
    config: { template: path.join(CONFIGS, "grok", "osuperpowers.json"), dest: () => homePath(".grok", "hooks", "osuperpowers.json") },
    detect: () => commandExists("grok"),
    trust: "grok --trust",
  },
  qoder: { channel: "install-and-use", detect: () => commandExists("qoder"), hint: () => "装 .qoder-plugin（marketplace/本地）" },
  codex: {
    channel: "install-and-use",
    detect: () => commandExists("codex"),
    hint: () => "安装 .codex-plugin（/plugins）",
    trust: "/hooks 审查并信任 osuperpowers 钩子",
  },
  gemini: {
    channel: "install-and-use",
    hint: () => "gemini extensions install <repo-url>",
    detect: () => commandExists("gemini"),
    trust: "首次使用接受项目 hook 指纹确认",
  },
  pi: {
    channel: "install-and-use",
    detect: () => commandExists("pi"),
    config: { template: path.join(CONFIGS, "pi", "pi.ts"), dest: () => homePath(".pi", "agent", "extensions", "osuperpowers.ts") },
    hint: (p) => `pi install npm:@oscaner-skills/${p}`,
  },
  trae: {
    channel: "init",
    config: { template: path.join(CONFIGS, "trae", "hooks.json"), dest: () => homePath(".trae", "hooks.json") },
    detect: () => existsSync(homePath(".trae")),
    trust: "Enable 钩子 + sandbox/local 执行模式",
  },
  vibe: {
    channel: "init",
    config: { template: path.join(CONFIGS, "vibe", "hooks.toml"), dest: () => homePath(".vibe", "hooks.toml") },
    detect: () => commandExists("vibe"),
  },
  kiro: {
    channel: "init",
    config: { template: path.join(CONFIGS, "kiro", "hooks.json"), dest: () => homePath(".kiro", "hooks", "osuperpowers.json") },
    detect: () => commandExists("kiro"),
  },
  opencode: { channel: "init", hint: "opencode.json `plugin` 数组加 `@oscaner-skills/osuperpowers`", detect: () => commandExists("opencode") },
};

// hook 条目签名 —— 去重键（trigger/matcher + 命令）。
function hookSignature(entry) {
  const cmds = (entry.hooks ?? []).map((h) => h.command).filter(Boolean);
  if (!cmds.length && entry.command) cmds.push(entry.command);
  const scope = entry.trigger ?? entry.matcher ?? "*";
  return `${scope}|${cmds.join(",")}`;
}

// JSON 深合并：模板默认值打底，用户既有值覆盖。
function mergeJsonHooks(existing, tmpl) {
  const out = { ...tmpl, ...existing };
  const tHooks = tmpl.hooks;
  const eHooks = existing.hooks;
  if (Array.isArray(tHooks)) {
    const cur = Array.isArray(eHooks) ? [...eHooks] : [];
    const sigs = new Set(cur.map(hookSignature));
    const additions = tHooks.filter((e) => !sigs.has(hookSignature(e)));
    out.hooks = [...cur, ...additions];
    return out;
  }
  out.hooks = { ...(tHooks ?? {}), ...(eHooks ?? {}) };
  for (const [event, entries] of Object.entries(tHooks ?? {})) {
    if (!Array.isArray(out.hooks[event])) continue;
    const cur = [...out.hooks[event]];
    const sigs = new Set(cur.map(hookSignature));
    const additions = entries.filter((e) => !sigs.has(hookSignature(e)));
    if (additions.length) out.hooks[event] = [...cur, ...additions];
  }
  return out;
}

// 目标已存在时合并策略
async function mergeIfExists(dest, content) {
  if (!existsSync(dest)) return { content };
  const existing = await readFile(dest, "utf8");
  if (!existing.trim()) return { content };
  if (dest.endsWith(".json")) {
    let existingObj;
    try {
      existingObj = JSON.parse(existing);
    } catch {
      throw new Error(`${dest} 不是合法 JSON —— 拒绝覆盖用户文件，请人工处理`);
    }
    const merged = mergeJsonHooks(existingObj, JSON.parse(content));
    return { content: `${JSON.stringify(merged, null, 2)}\n` };
  }
  if (dest.endsWith(".ts")) {
    if (existing.includes(PI_TS_MARKER)) return { content };
    return { skip: true };
  }
  if (existing.includes(content.trim())) return { content: existing };
  return { content: `${existing.replace(/\s*$/, "\n")}${content.trim()}\n` };
}

// manifest 工具
function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

const OSUPERPOWERS_VERSION = JSON.parse(readFileSync(path.join(PKG_ROOT, "package.json"), "utf8")).version;

function manifestPath(harness) {
  return path.join(HOME, ".osuperpowers", "state", `${harness}.json`);
}

function readManifest(harness) {
  const p = manifestPath(harness);
  if (!existsSync(p)) return { osuperpowersVersion: OSUPERPOWERS_VERSION, files: {} };
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return { osuperpowersVersion: OSUPERPOWERS_VERSION, files: {} };
  }
}

async function writeManifest(harness, manifest) {
  const dir = path.dirname(manifestPath(harness));
  mkdirSync(dir, { recursive: true });
  await writeFile(manifestPath(harness), `${JSON.stringify(manifest, null, 2)}\n`);
}

// manifest 全量同步：清理已移除的 tracked 文件
// 删除仅限 source:"init" + on-disk hash 未变的文件（磁盘 + manifest 条目）
async function syncManifest(harness, manifest) {
  const toDelete = [];
  const toKeep = [];
  for (const [filePath, tracked] of Object.entries(manifest.files ?? {})) {
    if (tracked.source !== "init") {
      toKeep.push(filePath);
      continue;
    }
    if (!existsSync(filePath)) {
      // 磁盘文件已移除 → 清理 manifest 条目
      delete manifest.files[filePath];
      toDelete.push(filePath);
      continue;
    }
    const onDisk = readFileSync(filePath, "utf8");
    if (sha256(onDisk) === tracked.hash) {
      toDelete.push(filePath);
    } else {
      // hash 变化 = 用户改动 → 保留
      toKeep.push(filePath);
    }
  }
  for (const f of toDelete) {
    try {
      await rm(f, { recursive: false });
      delete manifest.files[f];
    } catch {
      // 删除失败 → 保留
    }
  }
  return { deleted: toDelete, kept: toKeep };
}

// 记录文件到 manifest
function trackFile(manifest, filePath, content, source = "init") {
  if (!manifest.files) manifest.files = {};
  manifest.files[filePath] = { hash: sha256(content), source };
}

// 写原生 config；返回 true（写入）/ false（跳过）/ null（dry-run）。
async function installNative(name, h, dryRun) {
  const adapter = path.join(ADAPTERS, `${name}.ts`);
  const adapterMjs = path.join(ADAPTERS, `${name}.mjs`);
  // 优先 .ts adapter（pi 通道已迁移到 pi.ts）
  const adapterPath = existsSync(adapter) ? adapter : adapterMjs;
  const template = await readFile(h.config.template, "utf8");
  const content = template.split(PLACEHOLDER).join(adapterPath);
  const dest = h.config.dest();
  if (dryRun) {
    console.log(`  [dry-run] ${name.padEnd(10)} would write ${dest}`);
    if (h.trust) console.log(`  [dry-run] ${name.padEnd(10)} would print: ${h.trust}`);
    return null;
  }
  const merged = await mergeIfExists(dest, content);
  if (merged.skip) {
    console.log(`  — ${name.padEnd(10)} skipped — ${dest} 已存在非模板生成文件（不覆盖）`);
    return false;
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  await writeFile(dest, merged.content);
  console.log(`  ✓ ${name.padEnd(10)} wrote ${dest}`);
  if (h.trust) {
    console.log(`     ${name.padEnd(10)} 下一步: ${h.trust}`);
  }
  return { written: true, dest, content: merged.content };
}

function parseArgs(argv) {
  const args = { harness: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") {
      args.dryRun = true;
    } else if (argv[i] === "--harness") {
      args.harness = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      console.error(`osuperpowers:init harness: 未知参数 ${argv[i]}`);
      exitCliMissing(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const names = args.harness ?? Object.keys(HARNESSES);
  const unknown = names.filter((n) => !HARNESSES[n]);
  if (unknown.length) {
    console.error(`osuperpowers:init harness: 未知 harness: ${unknown.join(", ")}（可用: ${Object.keys(HARNESSES).join(", ")}）`);
    exitBlocked(`unknown harness: ${unknown.join(", ")}`);
  }
  const nativeSet = new Set(deriveNativeHarnesses(CONFIGS));
  console.log(`osuperpowers:init harness — ${args.dryRun ? "dry-run preview（不写任何文件）" : "install"}`);
  let wrote = 0;
  let guided = 0;
  let skipped = 0;

  // manifest 全量同步：清理已移除的 tracked 文件（source:"init" + hash 未变 → 删除磁盘 + manifest）
  // 在 install loop 前运行，避免 installNative 刚写入的文件被误删
  for (const name of names) {
    const manifest = readManifest(name);
    const { deleted } = await syncManifest(name, manifest);
    if (deleted.length) {
      await writeManifest(name, manifest);
    }
  }

  for (const name of names) {
    const h = HARNESSES[name];
    if (!h.detect()) {
      console.log(`  — ${name.padEnd(10)} not detected — 跳过`);
      skipped++;
      continue;
    }

    const manifest = readManifest(name);

    if (nativeSet.has(name) && h.config) {
      const result = await installNative(name, h, args.dryRun);
      if (result === true || (result && result.written)) {
        wrote++;
        if (!args.dryRun && result.dest) {
          trackFile(manifest, result.dest, result.content);
          await writeManifest(name, manifest);
        }
      } else if (result === false) {
        skipped++;
      }
    } else {
      const hint = typeof h.hint === "function" ? h.hint() : (h.hint ?? "");
      console.log(`  · ${name.padEnd(10)} detected — 引导: ${hint}`);
      if (h.trust) console.log(`     ${name.padEnd(10)} 下一步: ${h.trust}`);
      guided++;
    }
  }

  console.log(`完成 — 写 config: ${wrote}, 引导: ${guided}, 跳过(未检测): ${skipped}`);
}

main().catch((e) => {
  console.error(`osuperpowers:init harness: ${e.message}`);
  exitBlocked(e.message);
});
