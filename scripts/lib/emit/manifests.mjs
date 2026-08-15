/**
 * Generic first-party per-harness manifest builders.
 *
 * These are pure functions: given a plugin descriptor (a row from
 * marketplace/source.json) and a resolved version, they return the document
 * for a single harness. The unified emit tool (`scripts/emit.mjs`) writes them
 * into each first-party plugin directory. "Thin manifest" means every harness
 * manifest points at the canonical `./skills/` tree — no per-harness copies of
 * the skill bodies (the one exception is the shared `.agents/skills/` copy,
 * which is handled by the emit orchestrator, not here).
 */

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const generatedBanner = "scripts/emit.mjs — do not edit";

/**
 * Derive first-party plugin package names from `packages/*` dirs whose
 * package.json carries the `oscaner-plugin` field (package-as-source). The
 * hand-maintained enum is gone — adding a package dir auto-joins the emit.
 * Sorted for deterministic output.
 * @param {string} packagesRoot repo-relative path to the packages/ dir
 */
export function deriveFirstPartyNames(packagesRoot) {
  if (!existsSync(packagesRoot)) return [];
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      const pkgPath = join(packagesRoot, name, "package.json");
      if (!existsSync(pkgPath)) return false;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      return Boolean(pkg["oscaner-plugin"]);
    })
    .sort();
}

/** engineering has no bundled assets — interface omits icon/logo paths. */
const DEFAULT_REPO_URL = "https://github.com/Oscaner/skills";

function keywords(plugin) {
  return plugin.claude?.keywords ?? plugin.claude?.tags ?? [];
}

/**
 * `.claude-plugin/plugin.json` — Claude Code manifest. Grok reuses this file
 * (no separate grok emit). Thin: skills/ + hooks/ point at canonical dirs.
 * `noSkills` omits the `skills` field for the overrides trigger router, which
 * ships no skill bodies (engineering keeps `skills: "./skills/"`).
 */
export function claudePluginManifest(plugin, version, { noSkills = false } = {}) {
  const m = {
    _generated: generatedBanner,
    name: plugin.name,
    description: plugin.description,
    version,
    author: plugin.author,
  };
  if (!noSkills) m.skills = "./skills/";
  // Hooks path comes from the `oscaner-plugin.hooks` mapping (single SOT);
  // the fallback keeps the canonical default when a plugin carries no mapping.
  m.hooks = plugin.hooks?.claude ?? "./hooks/hooks.json";
  if (plugin.license) m.license = plugin.license;
  if (plugin.claude?.category) m.category = plugin.claude.category;
  const kw = keywords(plugin);
  if (kw.length) m.keywords = kw;
  return m;
}

/** `.cursor-plugin/plugin.json` — thin manifest, no per-harness skill copy. */
export function cursorPluginManifest(plugin, version) {
  const m = {
    _generated: generatedBanner,
    name: plugin.name,
    displayName: plugin.cursor?.displayName ?? plugin.name,
    description: plugin.description,
    version,
    author: plugin.author,
  };
  if (plugin.license) m.license = plugin.license;
  const kw = keywords(plugin);
  if (kw.length) m.keywords = kw;
  m.skills = "./skills/";
  m.hooks = plugin.hooks?.cursor ?? "./hooks/hooks-cursor.json";
  return m;
}

/**
 * `.qoder-plugin/plugin.json` — Qoder plugin manifest (Claude-mirror plugin).
 * Completes the sibling shape: skills + hooks（plugin-root `hooks/hooks.json`
 * 自动发现通道，manifest 位于 `.qoder-plugin/` 故 manifest-relative 为
 * `./hooks/hooks.json`；emit 按 `oscaner-plugin.hooks.qoder` 写文件）。
 */
export function qoderPluginManifest(plugin, version) {
  const m = {
    _generated: generatedBanner,
    name: plugin.name,
    version,
    description: plugin.description,
  };
  if (plugin.author) m.author = plugin.author;
  if (plugin.license) m.license = plugin.license;
  const kw = keywords(plugin);
  if (kw.length) m.keywords = kw;
  m.skills = "./skills/";
  m.hooks = "./hooks/hooks.json";
  return m;
}

/** `.codex-plugin/plugin.json` — skills/ + PreToolUse gate hooks + interface. */
export function codexPluginManifest(plugin, version) {
  const m = {
    _generated: generatedBanner,
    name: plugin.name,
    version,
    description: plugin.description,
    author: plugin.author,
  };
  if (plugin.license) m.license = plugin.license;
  const kw = keywords(plugin);
  if (kw.length) m.keywords = kw;
  m.skills = "./skills/";
  // codex 插件 hooks 走 plugin-root `hooks/hooks.json` 自动发现通道（manifest 位于
  // `.codex-plugin/`，故 manifest-relative 是 `./hooks/hooks.json`；emit 按
  // `oscaner-plugin.hooks.codex`（package-relative）写文件到 `.codex-plugin/hooks/`）。
  // cdd-gate 内容由 `hooks/hooks.json` 生成器产出。
  m.hooks = "./hooks/hooks.json";
  m.interface = codexInterface(plugin);
  return m;
}

/** `.kimi-plugin/plugin.json` — skills + sessionStart + tool-mapping prose. */
export function kimiPluginManifest(plugin, version) {
  const m = {
    _generated: generatedBanner,
    name: plugin.name,
    version,
    description: plugin.description,
    author: plugin.author,
  };
  if (plugin.license) m.license = plugin.license;
  const kw = keywords(plugin);
  if (kw.length) m.keywords = kw;
  m.skills = "./skills/";
  m.sessionStart = { skill: "os-init" };
  m.skillInstructions = kimiInstructions(plugin);
  m.interface = kimiInterface(plugin);
  return m;
}

/**
 * `gemini-extension.json` — names GEMINI.md as the context file and carries the
 * BeforeTool cdd-gate hook. `${extensionPath}` is Gemini's documented extension
 * variable for the extension's own directory.
 */
export function geminiExtension(plugin, version) {
  return {
    _generated: generatedBanner,
    name: plugin.name,
    description: plugin.description,
    version,
    contextFileName: "GEMINI.md",
    hooks: {
      BeforeTool: [
        {
          matcher: "write_file|replace|run_shell_command",
          hooks: [
            {
              type: "command",
              command: "${extensionPath}/bin/gate/adapters/gemini.mjs",
              timeout: 60000,
            },
          ],
        },
      ],
    },
  };
}

/** `GEMINI.md` — @-import every skill body (sorted) for Gemini discovery. */
export function geminiMarkdown(plugin, skillNames) {
  return (
    `<!-- ${generatedBanner} -->\n` +
    [...skillNames].sort().map((s) => `@./skills/${s}/SKILL.md`).join("\n") +
    "\n"
  );
}

/**
 * `package.json#pi` — pure skills package plus (for engineering) the pi TS gate
 * extension. Vendored assemblies call with no extensions (pure-skills key); the
 * engineering emit passes the gate adapter path so the pi package ships the
 * in-process gate.
 * @param {{ extensions?: string[] }} [opts]
 */
export function piPackageKey({ extensions = [] } = {}) {
  const key = { skills: ["./skills"] };
  if (extensions.length > 0) key.extensions = extensions;
  return key;
}

/**
 * engineering PreToolUse cdd-gate hooks 共享形状（Write|Edit + Bash 两组，各一个
 * type:command hook）。claude/codex/qoder 三份逐字复制的共同结构 —— 只差 adapter
 * 命令；per-harness 生成器传入命令即可（matcher 组固定，改动只在一处）。
 */
function cddGatePreToolUseHooks(command) {
  return {
    _generated: generatedBanner,
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [
            {
              type: "command",
              command,
            },
          ],
        },
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              command,
            },
          ],
        },
      ],
    },
  };
}

/**
 * engineering Claude PreToolUse hooks (cdd gate on Write|Edit|Bash).
 * Only engineering carries the gate — the overrides router plugin ships
 * no PreToolUse hooks (see `overrides.mjs` claudeHooksJson).
 */
export function engineeringClaudeHooks() {
  return cddGatePreToolUseHooks("${CLAUDE_PLUGIN_ROOT}/bin/gate/adapters/claude.mjs");
}

/** engineering Cursor preToolUse hook (cdd gate). */
export function engineeringCursorHooks() {
  return {
    _generated: generatedBanner,
    version: 1,
    hooks: {
      preToolUse: [{ command: "./bin/gate/adapters/cursor.mjs" }],
    },
  };
}

/**
 * engineering Codex PreToolUse hooks (cdd gate). Codex plugin hooks are read
 * from the plugin-root `hooks/hooks.json` the `.codex-plugin/plugin.json`
 * manifest references. Codex documents no plugin-root env var, so the command
 * is a relative path (`../bin/gate/adapters/codex.mjs` from the plugin root /
 * hooks dir) instead of the Claude `${CLAUDE_PLUGIN_ROOT}` compat var.
 */
export function codexHooksJson() {
  return cddGatePreToolUseHooks("../bin/gate/adapters/codex.mjs");
}

/**
 * engineering Qoder PreToolUse hooks (cdd gate). Qoder mirrors Claude events;
 * plugin hooks are auto-discovered at plugin-root `hooks/hooks.json`
 * (`.qoder-plugin/` is the plugin root). `QODER_PLUGIN_ROOT` is the documented
 * plugin-root env var.
 */
export function qoderHooksJson() {
  return cddGatePreToolUseHooks("${QODER_PLUGIN_ROOT}/bin/gate/adapters/qoder.mjs");
}

/**
 * Dispatch a per-harness hooks generator by harness name, fail-fast on a
 * harness with no generator. Shared by the engineering and overrides hooks
 * families so both enforce their implemented harness set (engineering:
 * claude/cursor/codex/qoder; overrides: claude/cursor) — the
 * `oscaner-plugin.hooks` mapping must never point at a file no generator
 * can produce.
 * @param {string} harness
 * @param {Record<string, () => object>} byHarness
 * @param {string} label plugin family name for the error message
 */
export function hooksFor(harness, byHarness, label) {
  const gen = byHarness[harness];
  if (!gen) {
    throw new Error(`no ${label} hooks generator for harness: ${harness}`);
  }
  return gen();
}

/**
 * Per-harness engineering hooks content, dispatched by harness name so the
 * emit orchestrator can drive writes from the `oscaner-plugin.hooks` mapping.
 */
export function engineeringHooksFor(harness) {
  return hooksFor(
    harness,
    {
      claude: engineeringClaudeHooks,
      cursor: engineeringCursorHooks,
      codex: codexHooksJson,
      qoder: qoderHooksJson,
    },
    "engineering",
  );
}

function codexInterface(plugin) {
  return {
    displayName: plugin.cursor?.displayName ?? plugin.name,
    shortDescription: plugin.description,
    longDescription: plugin.description,
    developerName: plugin.author?.name ?? plugin.name,
    category: "Developer Tools",
    capabilities: ["Interactive", "Read", "Write"],
    defaultPrompt: [
      "I've got an idea for something I'd like to build.",
      "Let's add a feature to this project.",
    ],
    websiteURL: DEFAULT_REPO_URL,
  };
}

function kimiInterface(plugin) {
  return {
    displayName: plugin.cursor?.displayName ?? plugin.name,
    shortDescription: plugin.description,
    longDescription: plugin.description,
    developerName: plugin.author?.name ?? plugin.name,
    capabilities: ["Interactive", "Read", "Write"],
    websiteURL: DEFAULT_REPO_URL,
  };
}

/** Kimi Code tool-mapping prose for the cdd/cli-* orchestration skills. */
function kimiInstructions(plugin) {
  return `Kimi Code tool mapping for ${plugin.name} skills:\n\n` +
    `- The cli-* family (cli-select, cli-task, cli-driven-development, cli-code-review) orchestrate work through the cdd engine's CLI. When a skill says to run an orchestrator, select a task, or drive a development loop, call the cdd-* scripts from the plugin's bin/ via the terminal tool.\n` +
    `- When a skill says to ask the user, ask clarifying questions, ask one question at a time, present multiple-choice options, use the terminal for a question, or wait for the user's choice, call Kimi Code's AskUserQuestion tool. Do not render those choices as plain assistant text unless AskUserQuestion is unavailable or the session is in auto permission mode.\n` +
    `- For AskUserQuestion, provide 1 question with 2-4 concrete options when possible. Put the recommended option first and suffix its label with (Recommended).\n` +
    `- When a skill refers to TodoWrite or a task checklist, use Kimi Code's TodoList tool.\n` +
    `- When a skill says Task tool (general-purpose) or asks you to dispatch an implementer/reviewer subagent, use Kimi Code's Agent tool. Do not pass general-purpose as subagent_type.\n` +
    `- For read-only codebase exploration that would take several searches, use Agent with subagent_type "explore"; for read-only planning or architecture design, use Agent with subagent_type "plan".\n` +
    `- When a skill refers to the Skill tool, use Kimi Code's native Skill tool.\n` +
    `- Use Kimi Code's Read, Write, Edit, Bash, Grep, Glob, FetchURL, WebSearch, and MCP tools by their actual exposed names.\n` +
    `- When a skill asks to search file contents, use Grep; when it asks to find files by path or pattern, use Glob; when it asks to fetch a URL, use FetchURL; when it asks to search the web, use WebSearch.`;
}
