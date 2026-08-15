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
 * 统一 manifest-relative base：`../skills/` → 包根 skills/，hooks 命令同
 * `../bin/...` → 包根 bin/（见 qoderHooksJson）。
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
  m.skills = "../skills/";
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
  // codex 插件统一 manifest-relative base：manifest 位于 `.codex-plugin/`，故
  // `../skills/` → 包根 skills/，`./hooks/hooks.json` → `.codex-plugin/hooks/hooks.json`
  //（hooks 命令同为 `../bin/...` → 包根 bin/，见 codexHooksJson）。skills 与 hooks
  // 共用同一 base，不再混用 plugin-root 变量。
  m.skills = "../skills/";
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
 * `package.json#pi` — pure skills package key for VENDORED assemblies
 * (publish-vendor.mjs). Pi packages support a `package.json` `pi` key
 * (skills/prompts/themes delivery via `pi install`), but engineering's gate is
 * NOT delivered through it: the gate adapter is `.mjs` while pi extensions are
 * auto-discovered `*.ts` — the gate ships as a native os-init config set
 * (manual extension copy, experimental). This key carries vendored assemblies'
 * skills delivery only (`extensions` field modeled for completeness).
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
 * from `.codex-plugin/hooks/hooks.json`（manifest 引用 `./hooks/hooks.json`）。
 * Adapter 命令用 manifest-relative `../bin/...`（相对 `.codex-plugin/` → 包根
 * `bin/gate/adapters/codex.mjs`）—— 与 plugin.json 的 skills/hooks 共用同一
 * manifest-relative base，不依赖 `${PLUGIN_ROOT}` 替换（codex 通道待验证，
 * 用文档化替换变量会引入「命令指向不存在文件」风险）。
 */
export function codexHooksJson() {
  return cddGatePreToolUseHooks("../bin/gate/adapters/codex.mjs");
}

/**
 * engineering Qoder PreToolUse hooks (cdd gate). Qoder mirrors Claude events;
 * plugin hooks are auto-discovered at `.qoder-plugin/hooks/hooks.json`
 * (`.qoder-plugin/` is the plugin root). Adapter 命令同样 manifest-relative
 * `../bin/...`（相对 `.qoder-plugin/` → 包根 `bin/gate/adapters/qoder.mjs`）——
 * 与 codex 统一 base，不依赖 `QODER_PLUGIN_ROOT` 替换。
 */
export function qoderHooksJson() {
  return cddGatePreToolUseHooks("../bin/gate/adapters/qoder.mjs");
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

// 递归收集 hook 文档里所有 `command` 字符串（claude/codex/qoder 的嵌套
// hooks[].hooks[].command 与 cursor 的顶层 hooks[].command 都覆盖）。
export function collectHookCommands(doc) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (v && typeof v === "object") {
      if (typeof v.command === "string") out.push(v.command);
      for (const [k, val] of Object.entries(v)) {
        if (k !== "command") walk(val);
      }
    }
  };
  walk(doc);
  return out;
}

// 从 hook 命令提取 adapter 的 package-relative 路径。支持 `${ENV_VAR}/bin/...`
// （claude/gemini 的 plugin-root 变量）、`./bin/...`（cursor 相对插件根）与
// `../bin/...`（codex/qoder 的 manifest-relative base，相对 `.codex-plugin/` /
// `.qoder-plugin/` → 包根 bin/）；非 adapter 命令（如 `python3 /tmp/x.py`）→ null
// （guard 跳过）。guard 按捕获的 `bin/...` 后缀对 pluginDir 做存在性检查——
// 无论前缀是变量还是 `../`，目标 adapter 都在包根 `bin/gate/adapters/` 下。
const ADAPTER_CMD_RE = /^(?:\$\{[A-Za-z_]+\}\/|\.{1,2}\/)?(bin\/gate\/adapters\/[A-Za-z0-9_.-]+\.mjs)$/;
export function adapterRelFromCommand(command) {
  if (typeof command !== "string") return null;
  const m = command.match(ADAPTER_CMD_RE);
  return m ? m[1] : null;
}

/**
 * Emit guard (I3): every generated hooks command that targets a gate adapter
 * must resolve to an existing file under the plugin dir. Throws otherwise —
 * `pnpm run emit` / `emit --check` fail loud instead of shipping a broken hook
 * command. Covers the engineering per-harness hooks + gemini-extension.json.
 */
export function assertAdapterPathsExist(plugin, pluginDir, version) {
  const docs = [];
  for (const [harness] of Object.entries(plugin.hooks ?? {})) {
    docs.push(engineeringHooksFor(harness));
  }
  docs.push(geminiExtension(plugin, version));
  const missing = [];
  for (const doc of docs) {
    for (const cmd of collectHookCommands(doc)) {
      const rel = adapterRelFromCommand(cmd);
      if (rel && !existsSync(join(pluginDir, rel))) {
        missing.push(`${plugin.name}: ${rel} (from command: ${cmd})`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `emit hooks adapter guard — generated hook command adapter missing:\n  ${missing.join("\n  ")}`,
    );
  }
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
