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

export const generatedBanner = "scripts/emit.mjs — do not edit";

/** First-party plugins that receive the full per-harness emit. */
export const FIRST_PARTY_NAMES = ["superpowers-overrides", "os-engineering"];

/** os-engineering has no bundled assets — interface omits icon/logo paths. */
const DEFAULT_REPO_URL = "https://github.com/Oscaner/skills";

function keywords(plugin) {
  return plugin.claude?.keywords ?? plugin.claude?.tags ?? [];
}

/**
 * `.claude-plugin/plugin.json` — Claude Code manifest. Grok reuses this file
 * (no separate grok emit). Thin: skills/ + hooks/ point at canonical dirs.
 */
export function claudePluginManifest(plugin, version) {
  const m = {
    name: plugin.name,
    description: plugin.description,
    version,
    author: plugin.author,
    skills: "./skills/",
    hooks: "./hooks/hooks.json",
  };
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
  m.hooks = "./hooks/hooks-cursor.json";
  return m;
}

/** `.codex-plugin/plugin.json` — skills/ + empty hooks + interface. */
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
  m.hooks = {};
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

/** `gemini-extension.json` — thin: names GEMINI.md as the context file. */
export function geminiExtension(plugin, version) {
  return {
    name: plugin.name,
    description: plugin.description,
    version,
    contextFileName: "GEMINI.md",
  };
}

/** `GEMINI.md` — @-import every skill body (sorted) for Gemini discovery. */
export function geminiMarkdown(plugin, skillNames) {
  return [...skillNames]
    .sort()
    .map((s) => `@./skills/${s}/SKILL.md`)
    .join("\n") + "\n";
}

/** `package.json#pi` — pure skills package, no runtime extensions. */
export function piPackageKey() {
  return { skills: ["./skills"] };
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
