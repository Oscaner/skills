#!/usr/bin/env node
// bin/init/install-harness.mjs — per-harness 安装器（P6b T5，取代 install-gates.mjs）。
// 用法: node install-harness.mjs [--harness h1,h2,...] [--dry-run]
// 流程：
//   1. 检测  —— command -v <cli>；仅列出已装 harness（harness-detect util）
//   2. 引导  —— install-and-use 通道：打印 probe + install hint，不写文件
//   3. 报告  —— 已装 / 跳过 列表；--dry-run 只预览不写
// 幂等：重复运行同样只打印引导；未知 --harness → stderr + exit 1。
// 注：P5 T1 移除 Gate 子系统后，原生 gate config（configs/）+ adapter 均已删除，
// 安装器只保留 install-and-use 引导通道；本文件随后续任务（init/install-harness
// 整体删除）一并移除。
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exitBlocked, exitCliMissing } from "../utils/exit.mjs";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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

// harness 安装描述：探测 + install-and-use 引导 hint（不写文件）。
const HARNESSES = {
  claude: { detect: () => commandExists("claude"), hint: (p) => `/plugin marketplace add Oscaner/skills && /plugin install ${p}@oscaner-skills` },
  "cursor-agent": { detect: () => commandExists("cursor-agent"), hint: () => "copy skills 到 .agents/skills/ 或装 marketplace" },
  droid: { detect: () => commandExists("droid"), hint: () => "copy skills 到 .agents/skills/" },
  grok: { detect: () => commandExists("grok"), hint: (p) => `pi install npm:@oscaner-skills/${p}`, trust: "grok --trust" },
  qoder: { detect: () => commandExists("qoder"), hint: () => "装 .qoder-plugin（marketplace/本地）" },
  codex: { detect: () => commandExists("codex"), hint: () => "安装 .codex-plugin（/plugins）", trust: "/hooks 审查并信任 osuperpowers 钩子" },
  gemini: { detect: () => commandExists("gemini"), hint: () => "gemini extensions install <repo-url>", trust: "首次使用接受项目 hook 指纹确认" },
  pi: { detect: () => commandExists("pi"), hint: (p) => `pi install npm:@oscaner-skills/${p}` },
  trae: { detect: () => existsSync(homePath(".trae")), hint: () => "Enable 钩子 + sandbox/local 执行模式" },
  vibe: { detect: () => commandExists("vibe"), hint: () => "安装 vibe 插件（marketplace/本地）" },
  kiro: { detect: () => commandExists("kiro"), hint: () => "安装 kiro 插件（marketplace/本地）" },
  opencode: { detect: () => commandExists("opencode"), hint: "opencode.json `plugin` 数组加 `@oscaner-skills/osuperpowers`" },
};

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
  console.log(`osuperpowers:init harness — ${args.dryRun ? "dry-run preview（不写任何文件）" : "install"}`);
  let guided = 0;
  let skipped = 0;

  for (const name of names) {
    const h = HARNESSES[name];
    if (!h.detect()) {
      console.log(`  — ${name.padEnd(10)} not detected — 跳过`);
      skipped++;
      continue;
    }
    const hint = typeof h.hint === "function" ? h.hint() : (h.hint ?? "");
    console.log(`  · ${name.padEnd(10)} detected — 引导: ${hint}`);
    if (h.trust) console.log(`     ${name.padEnd(10)} 下一步: ${h.trust}`);
    guided++;
  }

  console.log(`完成 — 引导: ${guided}, 跳过(未检测): ${skipped}`);
}

main().catch((e) => {
  console.error(`osuperpowers:init harness: ${e.message}`);
  exitBlocked(e.message);
});