// bin/utils/skills-probe.mjs — CDD pre-flight 的 per-harness 上游技能插件可用性探测库。
// 探测路径 SOT：docs/research/2026-08-16-harness-plugin-availability.md。
// probeSkills(harness, { requiredPlugins, cwd, env }) → { missing: [{plugin, reason, installHint}], probeFailed }
// 契约：exec 抛错 → probeFailed: true（fail-open —— 调用方不因探测失败而阻断）；
// 探测顺序 CLI/list → glob（版本段 glob 不 pin；env 层为 hook-context-only 扩展，P6a 不实现）。
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { config } from "./skills-probe.config.mjs";

// ~ 展开：env.HOME 优先，回退 os.homedir()。CLAUDE_PLUGIN_ROOT 等 hook-only env 不在探测路径内。
function expandHome(p, env) {
  const home = env?.HOME ?? homedir();
  if (p === "~") return home;
  if (p.startsWith("~/")) return path.join(home, p.slice(2));
  return p;
}

// 版本 glob 不 pin（research §2.1）：cacheGlob "…/<plugin>/*/skills/" 仅检查任一版本目录含 skills/。
function globHasSkills(pattern) {
  const starIdx = pattern.indexOf("*");
  if (starIdx === -1) return existsSync(pattern);
  const prefix = pattern.slice(0, starIdx);
  const suffix = pattern.slice(starIdx + 1);
  let entries;
  try {
    entries = readdirSync(prefix);
  } catch {
    return false;
  }
  return entries.some((entry) => {
    const candidate = path.join(prefix, entry);
    try {
      return statSync(candidate).isDirectory() && existsSync(path.join(candidate, suffix));
    } catch {
      return false;
    }
  });
}

// claude enabledPlugins 匹配：接受裸名（superpowers）或带 marketplace 后缀（superpowers@oscaner）。
function isEnabled(enabledPlugins, plugin) {
  return enabledPlugins.some((id) => {
    const s = String(id ?? "");
    return s === plugin || s === `${plugin}@oscaner` || s.startsWith(`${plugin}@`);
  });
}

// claude plugin list --json → enabledPlugins（兼容 installedPlugins[].enabled 形状）；畸形 JSON → null。
function parseEnabledPlugins(out) {
  let data;
  try {
    data = JSON.parse(out);
  } catch {
    return null;
  }
  if (Array.isArray(data.enabledPlugins)) return data.enabledPlugins;
  if (Array.isArray(data.installedPlugins)) {
    return data.installedPlugins.filter((p) => p.enabled).map((p) => p.id ?? p.name ?? "");
  }
  return [];
}

// plugin-list（claude）：CLI tier → enabledPlugins；缺失者用缓存 glob 区分 installed-but-disabled
// （缓存命中但未启用）vs not-installed。exec 抛错/畸形 JSON → probeFailed（fail-open）。
function probePluginList(harnessCfg, { requiredPlugins, env }) {
  let out;
  try {
    out = execFileSync("claude", ["plugin", "list", "--json"], {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return { missing: [], probeFailed: true };
  }
  const enabled = parseEnabledPlugins(out);
  if (enabled === null) return { missing: [], probeFailed: true };
  const missing = [];
  for (const plugin of requiredPlugins) {
    if (isEnabled(enabled, plugin)) continue;
    const cachePattern = expandHome(harnessCfg.cacheGlob.replaceAll("<plugin>", plugin), env);
    const cached = globHasSkills(cachePattern);
    missing.push(
      cached
        ? { plugin, reason: "installed-but-disabled", installHint: `/plugin install ${plugin}@oscaner` }
        : { plugin, reason: "not-installed", installHint: harnessCfg.installHint(plugin) },
    );
  }
  return { missing, probeFailed: false };
}

// skill-dir（cursor-agent/droid/opencode）：任一 dir（相对 cwd）下存在 <plugin>/ 目录 → 可用。
function dirHasPlugin(cwd, dirs, plugin) {
  return dirs.some((dir) => {
    try {
      return statSync(path.join(path.resolve(cwd, dir), plugin)).isDirectory();
    } catch {
      return false;
    }
  });
}

function probeSkillDirs(harnessCfg, { requiredPlugins, cwd }) {
  const missing = [];
  for (const plugin of requiredPlugins) {
    if (dirHasPlugin(cwd, harnessCfg.dirs, plugin)) continue;
    missing.push({ plugin, reason: "not-installed", installHint: harnessCfg.installHint(plugin) });
  }
  return { missing, probeFailed: false };
}

// package-list（pi）：pi list 含 @oscaner-skills/<p> → available。piDirCopyPlugins（无 pi key）
// 走 skill-dir 探测 + 目录复制指引。
function probePackageList(harnessCfg, { requiredPlugins, cwd, env }) {
  let out;
  try {
    out = execFileSync("pi", ["list"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return { missing: [], probeFailed: true };
  }
  const missing = [];
  for (const plugin of requiredPlugins) {
    if (config.piDirCopyPlugins.includes(plugin)) {
      if (!dirHasPlugin(cwd, harnessCfg.dirs, plugin)) {
        missing.push({ plugin, reason: "not-installed", installHint: "copy skills 到 .pi/skills/ 或 .agents/skills/" });
      }
      continue;
    }
    if (out.includes(`@oscaner-skills/${plugin}`)) continue;
    missing.push({ plugin, reason: "not-installed", installHint: harnessCfg.installHint(plugin) });
  }
  return { missing, probeFailed: false };
}

const PROBES = {
  "plugin-list": probePluginList,
  "skill-dir": probeSkillDirs,
  "package-list": probePackageList,
};

// 入口：按 config.harnesses[harness].probe 分派。未知 harness / 未知 probe → probeFailed（fail-open）。
export async function probeSkills(
  harness,
  { requiredPlugins = config.requiredPlugins, cwd = process.cwd(), env = process.env } = {},
) {
  const entry = config.harnesses[harness];
  const probe = entry && PROBES[entry.probe];
  if (!probe) return { missing: [], probeFailed: true };
  return probe(entry, { requiredPlugins, cwd, env });
}
