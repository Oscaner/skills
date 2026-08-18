/**
 * osuperpowers-router artifact generators.
 *
 * JS port of the former `packages/osuperpowers-router/build/render-*.sh`
 * Python generators. Each function is pure: given parsed targets (and, for the
 * self-check tables, the version + template text), it returns the artifact
 * text/document. The unified emit tool wires file I/O.
 *
 * The two cursor hook scripts (detect/enforce) embed per-target JSON into a
 * Node template; the templates live in `scripts/templates/` and are
 * substituted here (via `{{TARGETS_JSON}}` / `{{READ_RES_JSON}}`).
 */

import { readFileSync } from "node:fs";
import { generatedBanner, hooksFor } from "./manifests.mjs";

/** Escape a slug the way Python `re.escape` does (hyphens included). */
function pyEscape(s) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Parse overrides.manifest.json into target rows.
 * @param {string} manifestPath repo-relative path
 */
export function loadTargets(manifestPath) {
  const data = JSON.parse(readFileSync(manifestPath, "utf8"));
  return data.targets.map((row) => {
    if (typeof row.overrides !== "string" || !row.overrides.includes(":")) {
      throw new Error(
        `expected superpowers: prefix in overrides, got ${row.overrides}`,
      );
    }
    const [upstreamPlugin, upstream_slug] = row.overrides.split(":");
    if (upstreamPlugin !== "superpowers") {
      throw new Error(
        `expected superpowers: prefix, got ${row.overrides}`,
      );
    }
    if (typeof row.name !== "string" || !row.name.includes(":")) {
      throw new Error(`name must be plugin-qualified, got ${row.name}`);
    }
    const [namePlugin, nameSkill] = row.name.split(":");
    return {
      name: row.name,
      overrides: row.overrides,
      source: row.source ?? null,
      upstream_slug,
      plugin: namePlugin,
      skill: nameSkill,
    };
  });
}

/** Repo-relative SKILL.md suffix for the target's own skill body. */
export function targetSkillSuffix(t) {
  if (t.source) {
    let src = t.source;
    if (src.startsWith("./")) src = src.slice(2);
    return src.endsWith(".md") ? src : `${src}/SKILL.md`;
  }
  if (t.plugin === "mattpocock-skills") {
    return `skills/osuperpowers/${t.skill}/SKILL.md`;
  }
  return `skills/${t.skill}/SKILL.md`;
}

/** Match a bare /upstream-slug in a user prompt (Cursor detect + shared). */
export function bareSlashPromptRegex(slug) {
  return `(?i)(^|\\s)/${pyEscape(slug)}(\\s|$)`;
}

/** Claude Code UserPromptExpansion matcher for a bare /upstream-slug. */
export function ccMatcherBareSlash(slug) {
  return bareSlashPromptRegex(slug);
}

/** File-path patterns that indicate manual attach of upstream SKILL.md. */
export function attachPathRegexes(slug) {
  const s = pyEscape(slug);
  return [
    `(?i)/skills/${s}/SKILL\\.md$`,
    `(?i)/vendors/superpowers/skills/${s}/SKILL\\.md$`,
    `(?i)/\\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/${s}/SKILL\\.md$`,
    `(?i)/\\.cursor/skills/(superpowers/)?${s}/SKILL\\.md$`,
  ];
}

/** Regexes matching the target skill's own SKILL.md path. */
export function targetSkillReadRegexes(plugin, skill) {
  const p = pyEscape(plugin);
  const s = pyEscape(skill);
  if (plugin === "mattpocock-skills") {
    return [`(?i)/${p}/(?:[^/]*/)?skills/osuperpowers/${s}/SKILL\\.md$`];
  }
  return [`(?i)/${p}/(?:[^/]*/)?skills/${s}/SKILL\\.md$`];
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

/** `bin/prompt-expansion.mjs` — command_name → target injection router. */
export function promptExpansionScript(targets) {
  const mapLines = targets.map(
    (t) =>
      `  "${t.overrides}": "${t.name}",\n  "/${t.upstream_slug}": "${t.name}"`,
  );
  const lines = [
    "#!/usr/bin/env node",
    `// ${generatedBanner}`,
    'import { readFileSync } from "node:fs";',
    "",
    'const input = readFileSync(0, "utf8");',
    'let commandName = "";',
    "try {",
    "  const parsed = JSON.parse(input);",
    '  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {',
    '    commandName = parsed.command_name ?? "";',
    "  }",
    "} catch {",
    '  // not JSON — treat raw stdin as the command (bare /slug test harness)',
    "}",
    'if (!commandName) commandName = input.trim();',
    "",
    "const MAP = {",
    mapLines.join(",\n"),
    "};",
    "",
    "const override = MAP[commandName];",
    "if (!override) process.exit(0);",
    "",
    "process.stdout.write(JSON.stringify({",
    '  additionalContext: `MANDATORY OVERRIDE — oscaner hook intercepted this turn.\\nYour FIRST tool call MUST be Skill(${override}).\\nDo NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.`,',
    "}));",
    "",
  ];
  return lines.join("\n");
}

/** `hooks/hooks.json` — Claude Code UserPromptExpansion matchers. */
export function claudeHooksJson(targets) {
  const commandHook = {
    type: "command",
    command: "${CLAUDE_PLUGIN_ROOT}/bin/prompt-expansion.mjs",
  };
  const bareParts = targets.map(
    (t) => `(${ccMatcherBareSlash(t.upstream_slug)})`,
  );
  return {
    _generated: generatedBanner,
    hooks: {
      UserPromptExpansion: [
        { matcher: "^superpowers:", hooks: [commandHook] },
        { matcher: bareParts.join("|"), hooks: [commandHook] },
      ],
    },
  };
}

/** `hooks/hooks-cursor.json` — static detect/enforce wiring. */
export function cursorHooksJson() {
  return {
    _generated: generatedBanner,
    version: 1,
    hooks: {
      beforeSubmitPrompt: [
        { command: "./bin/cursor-detect.mjs", matcher: "UserPromptSubmit" },
      ],
      preToolUse: [{ command: "./bin/cursor-enforce.mjs" }],
    },
  };
}

/**
 * Per-harness overrides hooks content, dispatched by harness name so the emit
 * orchestrator can drive writes from the `oscaner-plugin.hooks` mapping.
 */
export function overridesHooksFor(harness, targets) {
  return hooksFor(
    harness,
    {
      claude: () => claudeHooksJson(targets),
      cursor: () => cursorHooksJson(),
    },
    "overrides",
  );
}

/** `bin/pi-router.ts` — Pi TS extension trigger router (slash command → Skill transform). */
export function piRouterScript(targets) {
  const mapLines = targets.map(
    (t) => `  "${t.upstream_slug}": "${t.name}"`,
  );
  const lines = [
    "// bin/pi-router.ts — Pi TS extension trigger router（P6b T2）。",
    `// ${generatedBanner}`,
    "",
    "const MAP: Record<string, string> = {",
    mapLines.join(",\n"),
    "};",
    "",
    "export function on(pi: any): void {",
    '  pi.on("input", async (event: { text: string }, _ctx: any) => {',
    "    const text = event.text ?? \"\";",
    '    const m = text.match(/^\\/([a-z][a-z0-9-]*)/);',
    "    if (!m) return null;",
    "    const slug = m[1];",
    "    const target = MAP[slug];",
    "    if (!target) return null;",
    '    return { action: "transform", text: `Skill(${target}) ${text}` };',
    "  });",
    "}",
    "",
  ];
  return lines.join("\n");
}

function cursorDetectTargetRows(targets) {
  return targets.map((t) => ({
    name: t.name,
    skill_suffix: targetSkillSuffix(t),
    attach_res: [
      ...attachPathRegexes(t.upstream_slug),
      `(?i)/${t.upstream_slug}/SKILL\\.md$`,
    ],
  }));
}

/** `bin/cursor-detect.mjs` — attach-detection hook body. */
export function cursorDetectScript(targets, templateText) {
  return templateText.replace(
    "{{TARGETS_JSON}}",
    JSON.stringify(cursorDetectTargetRows(targets)),
  );
}

function cursorEnforceReadRes(targets) {
  const readRes = {};
  for (const t of targets) {
    readRes[t.name] = targetSkillReadRegexes(t.plugin, t.skill);
  }
  return readRes;
}

/** `bin/cursor-enforce.mjs` — read/skill gate hook body. */
export function cursorEnforceScript(targets, templateText) {
  return templateText.replace(
    "{{READ_RES_JSON}}",
    JSON.stringify(cursorEnforceReadRes(targets)),
  );
}

/** `build/generated/claude-self-check.md` — filled template. */
export function claudeSelfCheckMd(targets, version, template) {
  const rows = targets.map(
    (t) => `| \`${t.overrides}\` | \`Skill(${t.name})\` |`,
  );
  return template
    .replace("{{TRIGGER_TABLE}}", rows.join("\n"))
    .replace("{{PLUGIN_VERSION}}", version);
}

/** `build/generated/cursor-self-check.mdc` — filled template. */
export function cursorSelfCheckMdc(targets, version, template) {
  const rows = targets.map(
    (t) =>
      `| \`/${t.upstream_slug}\`, \`/superpowers:${t.upstream_slug}\`, upstream \`${t.upstream_slug}\` body | Read \`${t.name}\` via agent_skills fullPath |`,
  );
  return template
    .replace("{{TRIGGER_TABLE}}", rows.join("\n"))
    .replace("{{PLUGIN_VERSION}}", version);
}

/** `.cursor-plugin/plugin.json` for the trigger-router plugin (no skills). */
export function overridesCursorManifest(meta, version, hooks) {
  return {
    _generated: generatedBanner,
    name: meta.name,
    displayName: "Superpowers Overrides",
    description: meta.description,
    version,
    author: meta.author,
    license: meta.license,
    hooks: hooks?.cursor ?? "./hooks/hooks-cursor.json",
  };
}

/** `.codex-plugin/plugin.json` for the trigger-router plugin (no skills). */
export function overridesCodexManifest(meta, version) {
  return {
    _generated: generatedBanner,
    name: meta.name,
    description: meta.description,
    version,
    author: meta.author,
    license: meta.license,
    hooks: {},
  };
}
