import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  claudePluginManifest,
  cursorPluginManifest,
  codexPluginManifest,
  kimiPluginManifest,
  geminiExtension,
  geminiMarkdown,
  piPackageKey,
  generatedBanner,
  FIRST_PARTY_NAMES,
  osEngineeringClaudeHooks,
  osEngineeringCursorHooks,
} from "./manifests.mjs";
import {
  loadTargets,
  targetSkillSuffix,
  ccMatcherBareSlash,
  promptExpansionScript,
  claudeHooksJson,
  cursorDetectScript,
  cursorEnforceScript,
  claudeSelfCheckMd,
  cursorSelfCheckMdc,
} from "./overrides.mjs";

const OS_ENG = {
  name: "os-engineering",
  version: "0.1.0",
  description:
    "Standalone engineering skills: cli-* orchestration family (select/task/driven-development/code-review) on the cdd engine.",
  author: { name: "Oscaner Miao", email: "oscaner1997@gmail.com" },
  license: "MIT",
  claude: {
    category: "engineering",
    keywords: ["engineering", "cli", "cdd", "harness", "droid", "pi"],
  },
};

const MANIFEST_PATH = "plugins/superpowers-overrides/overrides.manifest.json";

// ---------------------------------------------------------------------------
// manifests.mjs — generic first-party per-harness manifest builders
// ---------------------------------------------------------------------------

test("claudePluginManifest emits os-engineering claude manifest (thin, skills+../hooks)", () => {
  assert.deepEqual(claudePluginManifest(OS_ENG, "0.1.0"), {
    name: "os-engineering",
    description:
      "Standalone engineering skills: cli-* orchestration family (select/task/driven-development/code-review) on the cdd engine.",
    version: "0.1.0",
    author: { name: "Oscaner Miao", email: "oscaner1997@gmail.com" },
    license: "MIT",
    skills: "./skills/",
    hooks: "./hooks/hooks.json",
    category: "engineering",
    keywords: ["engineering", "cli", "cdd", "harness", "droid", "pi"],
  });
});

test("cursorPluginManifest points skills at canonical ./skills/ (no copy)", () => {
  const m = cursorPluginManifest(OS_ENG, "0.1.0");
  assert.equal(m.name, "os-engineering");
  assert.equal(m.displayName, "os-engineering");
  assert.equal(m.skills, "./skills/");
  assert.equal(m.hooks, "./hooks/hooks-cursor.json");
  assert.equal(m.version, "0.1.0");
  assert.equal(m.license, "MIT");
  assert.ok(m._generated);
  assert.match(m._generated, /scripts\/emit\.mjs/);
});

test("codexPluginManifest includes skills, empty hooks, and interface", () => {
  const m = codexPluginManifest(OS_ENG, "0.1.0");
  assert.equal(m.skills, "./skills/");
  assert.deepEqual(m.hooks, {});
  assert.equal(m.name, "os-engineering");
  assert.equal(m.version, "0.1.0");
  assert.ok(m.interface, "codex manifest must carry an interface");
  assert.equal(m.interface.displayName, "os-engineering");
  assert.ok(Array.isArray(m.interface.capabilities));
  assert.ok(m.interface.capabilities.length > 0);
});

test("kimiPluginManifest includes sessionStart + tool-mapping prose + interface", () => {
  const m = kimiPluginManifest(OS_ENG, "0.1.0");
  assert.equal(m.skills, "./skills/");
  assert.deepEqual(m.sessionStart, { skill: "os-init" });
  assert.ok(
    typeof m.skillInstructions === "string" && m.skillInstructions.length > 0,
    "kimi manifest must carry tool-mapping prose",
  );
  assert.ok(m.interface);
  assert.equal(m.interface.displayName, "os-engineering");
});

test("geminiExtension is thin: name/description/version + contextFileName", () => {
  assert.deepEqual(geminiExtension(OS_ENG, "0.1.0"), {
    name: "os-engineering",
    description:
      "Standalone engineering skills: cli-* orchestration family (select/task/driven-development/code-review) on the cdd engine.",
    version: "0.1.0",
    contextFileName: "GEMINI.md",
  });
});

test("geminiMarkdown @-imports each skill's SKILL.md sorted", () => {
  const md = geminiMarkdown(OS_ENG, [
    "os-init",
    "cli-select",
    "cli-task",
    "os-debugging",
  ]);
  assert.equal(
    md,
    "@./skills/cli-select/SKILL.md\n" +
      "@./skills/cli-task/SKILL.md\n" +
      "@./skills/os-debugging/SKILL.md\n" +
      "@./skills/os-init/SKILL.md\n",
  );
});

test("piPackageKey is a pure skills package (no runtime extensions)", () => {
  assert.deepEqual(piPackageKey(), { skills: ["./skills"] });
});

test("FIRST_PARTY_NAMES covers both per-harness emit plugins", () => {
  assert.deepEqual(FIRST_PARTY_NAMES, [
    "superpowers-overrides",
    "os-engineering",
  ]);
  assert.ok(
    FIRST_PARTY_NAMES.includes("os-engineering"),
    "os-engineering receives the per-harness emit (incl. gate hooks)",
  );
});

test("osEngineeringClaudeHooks gates Write|Edit and Bash via the cdd gate", () => {
  const hooks = osEngineeringClaudeHooks();
  const pre = hooks.hooks.PreToolUse;
  assert.equal(pre.length, 2);
  assert.equal(pre[0].matcher, "Write|Edit");
  assert.equal(pre[1].matcher, "Bash");
  for (const e of pre) {
    assert.equal(e.hooks.length, 1);
    assert.equal(e.hooks[0].type, "command");
    assert.equal(
      e.hooks[0].command,
      "${CLAUDE_PLUGIN_ROOT}/bin/override-claude-cdd-gate.sh",
    );
  }
});

test("osEngineeringCursorHooks wires the cursor cdd gate preToolUse", () => {
  const hooks = osEngineeringCursorHooks();
  assert.equal(hooks.version, 1);
  assert.deepEqual(hooks.hooks.preToolUse, [
    { command: "./bin/override-cursor-cdd-gate.sh" },
  ]);
});

// ---------------------------------------------------------------------------
// overrides.mjs — target parsing + artifact generators
// ---------------------------------------------------------------------------

test("loadTargets parses the real overrides.manifest.json", () => {
  const targets = loadTargets(MANIFEST_PATH);
  assert.equal(targets.length, 10);
  const brainstorming = targets.find(
    (t) => t.name === "os-engineering:os-brainstorming",
  );
  assert.ok(brainstorming);
  assert.equal(brainstorming.overrides, "superpowers:brainstorming");
  assert.equal(brainstorming.upstream_slug, "brainstorming");
  assert.equal(brainstorming.source, "../os-engineering/skills/os-brainstorming");
  const tdd = targets.find((t) => t.name === "mattpocock-skills:tdd");
  assert.equal(tdd.source, null);
  assert.equal(targetSkillSuffix(tdd), "skills/engineering/tdd/SKILL.md");
});

test("ccMatcherBareSlash escapes hyphens like Python re.escape", () => {
  assert.equal(
    ccMatcherBareSlash("writing-plans"),
    "(?i)(^|\\s)/writing\\-plans(\\s|$)",
  );
});

test("promptExpansionScript maps every overrides trigger to its target", () => {
  const script = promptExpansionScript(loadTargets(MANIFEST_PATH));
  assert.match(script, /^#!\/bin\/sh/);
  assert.match(script, /superpowers:brainstorming\) override="os-engineering:os-brainstorming"/);
  assert.match(script, /\/brainstorming\) override="os-engineering:os-brainstorming"/);
  assert.match(script, /superpowers:test-driven-development\) override="mattpocock-skills:tdd"/);
  assert.match(script, /\/using-git-worktrees\) override="os-engineering:os-finishing"/);
});

test("claudeHooksJson has exactly the two UserPromptExpansion matchers", () => {
  const hooks = claudeHooksJson(loadTargets(MANIFEST_PATH));
  const matchers = hooks.hooks.UserPromptExpansion.map((e) => e.matcher);
  assert.equal(matchers.length, 2);
  assert.equal(matchers[0], "^superpowers:");
  assert.match(matchers[1], /\/brainstorming/);
  assert.doesNotMatch(matchers[1], /spor-/);
  // every override target gets a bare-slash branch in the combined matcher
  assert.ok(matchers[1].includes("/writing\\-plans"), "writing-plans matcher");
  assert.ok(matchers[1].includes("/using\\-git\\-worktrees"), "using-git-worktrees matcher");
});

test("cursorDetectScript embeds target skill_suffix and attach regexes", () => {
  const template = readFileSync(
    "scripts/templates/override-cursor-detect.sh",
    "utf8",
  );
  const script = cursorDetectScript(loadTargets(MANIFEST_PATH), template);
  assert.match(script, /#!\/usr\/bin\/env bash/);
  assert.match(script, /"skill_suffix": ?"\.\.\/os-engineering\/skills\/os-brainstorming\/SKILL\.md"/);
  assert.match(script, /"name": ?"mattpocock-skills:tdd"/);
  assert.match(script, /"skill_suffix": ?"skills\/engineering\/tdd\/SKILL\.md"/);
  // attach regex for the brainstorming upstream family present
  assert.match(script, /\(\?i\)\/brainstorming\/SKILL/);
  assert.match(script, /\(\?i\)\/plugins\/superpowers\/skills\/brainstorming\/SKILL/);
});

test("cursorEnforceScript embeds read-regexes per target skill", () => {
  const template = readFileSync(
    "scripts/templates/override-cursor-enforce.sh",
    "utf8",
  );
  const script = cursorEnforceScript(loadTargets(MANIFEST_PATH), template);
  assert.match(script, /READ_RES = \{/);
  assert.match(script, /"mattpocock-skills:tdd"/);
  assert.match(script, /skills\/engineering\/tdd\/SKILL/);
  assert.match(script, /"os-engineering:os-brainstorming"/);
});

test("claudeSelfCheckMd fills the trigger table with target skill names", () => {
  const template = readFileSync(
    "plugins/superpowers-overrides/build/templates/claude-self-check.md",
    "utf8",
  );
  const md = claudeSelfCheckMd(
    loadTargets(MANIFEST_PATH),
    "6.2.0-overrides.0.15.3",
    template,
  );
  assert.match(md, /<!-- superpowers-overrides-version: 6\.2\.0-overrides\.0\.15\.3 -->/);
  assert.match(md, /\| `superpowers:brainstorming` \| `Skill\(os-engineering:os-brainstorming\)` \|/);
  assert.match(md, /\| `superpowers:test-driven-development` \| `Skill\(mattpocock-skills:tdd\)` \|/);
});

test("cursorSelfCheckMdc carries the version stamp and trigger rows", () => {
  const template = readFileSync(
    "plugins/superpowers-overrides/build/templates/self-check.mdc",
    "utf8",
  );
  const mdc = cursorSelfCheckMdc(
    loadTargets(MANIFEST_PATH),
    "6.2.0-overrides.0.15.3",
    template,
  );
  assert.match(mdc, /superpowers-overrides-version: 6\.2\.0-overrides\.0\.15\.3/);
  assert.match(mdc, /\| `\/brainstorming`, `\/superpowers:brainstorming`, upstream `brainstorming` body \| Read `os-engineering:os-brainstorming` via agent_skills fullPath \|/);
});
