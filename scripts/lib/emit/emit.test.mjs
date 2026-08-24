import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  claudePluginManifest,
  cursorPluginManifest,
  codexPluginManifest,
  kimiPluginManifest,
  geminiExtension,
  geminiMarkdown,
  piPackageKey,
  generatedBanner,
  deriveFirstPartyNames,
  osuperpowersClaudeHooks,
  osuperpowersCursorHooks,
  osuperpowersHooksFor,
  codexHooksJson,
  qoderPluginManifest,
  qoderHooksJson,
  assertAdapterPathsExist,
  collectHookCommands,
  adapterRelFromCommand,
} from "./manifests.mjs";
import { deriveSource, SOURCE_TOP } from "./source.mjs";
import {
  findStaleCommittedFiles,
  pruneStaleAgentsNamespaces,
} from "./orchestrate.mjs";
import {
  loadTargets,
  targetSkillSuffix,
  ccMatcherBareSlash,
  promptExpansionScript,
  piRouterScript,
  claudeHooksJson,
  cursorDetectScript,
  cursorEnforceScript,
  claudeSelfCheckMd,
  cursorSelfCheckMdc,
  overridesHooksFor,
} from "./overrides.mjs";

// First-party versions are read from the live package.json SOTs so these
// assertions hold at any released version. A stale hardcoded version broke the
// Release workflow's pre-commit gate whenever version-packages.mjs bumped the
// tree before committing (emit reads the bumped package.json, so asserts must
// expect the bumped version).
const readPkgVersion = (rel) =>
  JSON.parse(
    readFileSync(new URL(`../../../${rel}/package.json`, import.meta.url), "utf8"),
  ).version;
const OS_VERSION = readPkgVersion("packages/osuperpowers");
const ROUTER_VERSION = readPkgVersion("packages/osuperpowers-router");
const ROUTER_VERSION_RE = ROUTER_VERSION.replace(/\./g, "\\.");

const OS_ENG = {
  name: "osuperpowers",
  version: OS_VERSION,
  description:
    "Standalone osuperpowers skills: orchestration + cli-* family, CDD engine, cross-harness gate.",
  author: { name: "Oscaner Miao", email: "oscaner1997@gmail.com" },
  license: "MIT",
  claude: {
    category: "osuperpowers",
    keywords: ["osuperpowers", "cli", "cdd", "harness", "droid", "pi"],
  },
};

const MANIFEST_PATH = "packages/osuperpowers-router/overrides.manifest.json";

const ROUTER = {
  name: "osuperpowers-router",
  version: ROUTER_VERSION,
  description:
    "Personal overrides for the superpowers plugin that force delegation to other skills.",
  author: { name: "Oscaner Miao", email: "oscaner1997@gmail.com" },
  license: "MIT",
  claude: {
    category: "workflow",
    tags: ["superpowers", "mattpocock", "overrides", "subagents"],
  },
};

// ---------------------------------------------------------------------------
// manifests.mjs — generic first-party per-harness manifest builders
// ---------------------------------------------------------------------------

test("claudePluginManifest emits osuperpowers claude manifest (thin, skills, no hooks field)", () => {
  const m = claudePluginManifest(OS_ENG, OS_VERSION);
  assert.deepEqual(m, {
    _generated: generatedBanner,
    name: "osuperpowers",
    description:
      "Standalone osuperpowers skills: orchestration + cli-* family, CDD engine, cross-harness gate.",
    version: OS_VERSION,
    author: { name: "Oscaner Miao", email: "oscaner1997@gmail.com" },
    license: "MIT",
    skills: "./skills/",
    category: "osuperpowers",
    keywords: ["osuperpowers", "cli", "cdd", "harness", "droid", "pi"],
  });
  assert.ok(
    !("hooks" in m),
    "standard hooks/hooks.json is auto-loaded by Claude Code — manifest must not reference it (duplicate load fails plugin startup)",
  );
});

test("claudePluginManifest with noSkills omits skills but keeps full metadata", () => {
  assert.deepEqual(
    claudePluginManifest(ROUTER, ROUTER_VERSION, { noSkills: true }),
    {
      _generated: generatedBanner,
      name: "osuperpowers-router",
      description:
        "Personal overrides for the superpowers plugin that force delegation to other skills.",
      version: ROUTER_VERSION,
      author: { name: "Oscaner Miao", email: "oscaner1997@gmail.com" },
      license: "MIT",
      category: "workflow",
      keywords: ["superpowers", "mattpocock", "overrides", "subagents"],
    },
  );
});

test("cursorPluginManifest points skills at canonical ./skills/ (no copy)", () => {
  const m = cursorPluginManifest(OS_ENG, OS_VERSION);
  assert.equal(m.name, "osuperpowers");
  assert.equal(m.displayName, "osuperpowers");
  assert.equal(m.skills, "./skills/");
  assert.equal(m.hooks, "./hooks/hooks-cursor.json");
  assert.equal(m.version, OS_VERSION);
  assert.equal(m.license, "MIT");
  assert.ok(m._generated);
  assert.match(m._generated, /scripts\/emit\.mjs/);
});

test("codexPluginManifest includes skills, codex gate hooks path, and interface", () => {
  const m = codexPluginManifest(OS_ENG, OS_VERSION);
  assert.equal(m.skills, "../skills/");
  assert.equal(m.hooks, "./hooks/hooks.json");
  assert.equal(m.name, "osuperpowers");
  assert.equal(m.version, OS_VERSION);
  assert.ok(m.interface, "codex manifest must carry an interface");
  assert.equal(m.interface.displayName, "osuperpowers");
  assert.ok(Array.isArray(m.interface.capabilities));
  assert.ok(m.interface.capabilities.length > 0);
});

test("claudePluginManifest emits hooks only for non-canonical hook files", () => {
  // A non-default `oscaner-plugin.hooks.claude` (an additional hook file beyond
  // the auto-loaded standard) is still emitted in manifest.hooks.
  const custom = claudePluginManifest(
    {
      ...OS_ENG,
      hooks: { claude: "./hooks/claude.json", cursor: "./hooks/cursor.json" },
    },
    OS_VERSION,
  );
  assert.equal(custom.hooks, "./hooks/claude.json");
  // The canonical ./hooks/hooks.json is auto-loaded by Claude Code — naming it
  // in manifest.hooks duplicates the load and fails plugin startup, so it is
  // omitted even when `oscaner-plugin.hooks.claude` maps to it explicitly.
  const canonical = claudePluginManifest(
    { ...OS_ENG, hooks: { claude: "./hooks/hooks.json" } },
    OS_VERSION,
  );
  assert.ok(
    !("hooks" in canonical),
    "canonical ./hooks/hooks.json is auto-loaded — must be omitted from manifest.hooks",
  );
});

test("cursorPluginManifest resolves hooks from plugin.hooks.cursor mapping", () => {
  const m = cursorPluginManifest(
    {
      ...OS_ENG,
      hooks: { claude: "./hooks/claude.json", cursor: "./hooks/cursor.json" },
    },
    OS_VERSION,
  );
  assert.equal(m.hooks, "./hooks/cursor.json");
});

test("codexPluginManifest points hooks at the codex plugin-root hooks channel", () => {
  // codex 插件 hooks 走 plugin-root `hooks/hooks.json`（manifest 位于 .codex-plugin/，
  // manifest-relative 为 ./hooks/hooks.json）；emit 按 package-relative 映射写文件。
  // skills 同为 manifest-relative（../skills/ → 包根 skills/）—— 统一 base。
  assert.equal(codexPluginManifest(OS_ENG, OS_VERSION).hooks, "./hooks/hooks.json");
  const mapped = codexPluginManifest(
    { ...OS_ENG, hooks: { codex: "./.codex-plugin/hooks/hooks.json" } },
    OS_VERSION,
  );
  assert.equal(mapped.hooks, "./hooks/hooks.json");
});

test("codexHooksJson wires PreToolUse gate to the codex adapter (manifest-relative ../bin)", () => {
  const hooks = codexHooksJson();
  assert.ok(hooks._generated, "hooks.json must carry the generated banner");
  assert.match(hooks._generated, /scripts\/emit\.mjs/);
  const pre = hooks.hooks.PreToolUse;
  assert.equal(pre.length, 2);
  assert.equal(pre[0].matcher, "Write|Edit");
  assert.equal(pre[1].matcher, "Bash");
  for (const e of pre) {
    assert.equal(e.hooks.length, 1);
    assert.equal(e.hooks[0].type, "command");
    assert.equal(
      e.hooks[0].command,
      "../bin/gate/adapters/codex.mjs",
    );
  }
});

test("assertAdapterPathsExist: every generated osuperpowers hooks command resolves to a real adapter", () => {
  const plugin = {
    name: "osuperpowers",
    hooks: {
      claude: "./hooks/hooks.json",
      cursor: "./hooks/hooks-cursor.json",
      codex: "./.codex-plugin/hooks/hooks.json",
      qoder: "./.qoder-plugin/hooks/hooks.json",
    },
  };
  assert.doesNotThrow(() =>
    assertAdapterPathsExist(plugin, "packages/osuperpowers", OS_VERSION),
  );
});

test("assertAdapterPathsExist: throws when a generated hooks command adapter is missing", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-adapter-guard-"));
  try {
    const plugin = {
      name: "osuperpowers",
      hooks: { claude: "./hooks/hooks.json" },
    };
    // empty temp dir has no bin/gate/adapters/* — the guard must fail loud
    assert.throws(() => assertAdapterPathsExist(plugin, tmp, OS_VERSION), /adapter/i);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("adapterRelFromCommand: ../bin manifest-relative shape is recognized (ADAPTER_CMD_RE cover)", () => {
  assert.equal(
    adapterRelFromCommand("../bin/gate/adapters/codex.mjs"),
    "bin/gate/adapters/codex.mjs",
  );
  assert.equal(
    adapterRelFromCommand("../bin/gate/adapters/qoder.mjs"),
    "bin/gate/adapters/qoder.mjs",
  );
  assert.equal(
    adapterRelFromCommand("./bin/gate/adapters/cursor.mjs"),
    "bin/gate/adapters/cursor.mjs",
  );
  assert.equal(
    adapterRelFromCommand("${CLAUDE_PLUGIN_ROOT}/bin/gate/adapters/claude.mjs"),
    "bin/gate/adapters/claude.mjs",
  );
  assert.equal(adapterRelFromCommand("python3 /tmp/x.py"), null);
});

test("assertAdapterPathsExist: ../bin manifest-relative adapter missing → throws (guard covers ../)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-adapter-guard-"));
  try {
    const plugin = {
      name: "osuperpowers",
      hooks: { codex: "./.codex-plugin/hooks/hooks.json" },
    };
    // 空 temp dir 无 bin/gate/adapters/codex.mjs —— 即使命令是 ../ 前缀也必须失败
    assert.throws(() => assertAdapterPathsExist(plugin, tmp, OS_VERSION), /adapter/i);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("collectHookCommands walks nested hook docs and returns every command string", () => {
  const cmds = collectHookCommands({
    hooks: {
      PreToolUse: [
        { matcher: "Write|Edit", hooks: [{ type: "command", command: "/a.mjs" }] },
        { matcher: "Bash", hooks: [{ type: "command", command: "/b.mjs" }] },
      ],
    },
  });
  assert.deepEqual(cmds, ["/a.mjs", "/b.mjs"]);
});

test("kimiPluginManifest includes sessionStart + tool-mapping prose + interface", () => {
  const m = kimiPluginManifest(OS_ENG, OS_VERSION);
  assert.equal(m.skills, "./skills/");
  assert.deepEqual(m.sessionStart, { skill: "init" });
  assert.ok(
    typeof m.skillInstructions === "string" && m.skillInstructions.length > 0,
    "kimi manifest must carry tool-mapping prose",
  );
  assert.ok(m.interface);
  assert.equal(m.interface.displayName, "osuperpowers");
});

test("geminiExtension carries BeforeTool gate hooks + contextFileName", () => {
  assert.deepEqual(geminiExtension(OS_ENG, OS_VERSION), {
    _generated: generatedBanner,
    name: "osuperpowers",
    description:
      "Standalone osuperpowers skills: orchestration + cli-* family, CDD engine, cross-harness gate.",
    version: OS_VERSION,
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
  });
});

test("geminiMarkdown @-imports each skill's SKILL.md sorted under a banner", () => {
  const md = geminiMarkdown(OS_ENG, [
    "init",
    "cli-select",
    "cli-task",
    "debugging",
  ]);
  assert.equal(
    md,
    `<!-- ${generatedBanner} -->\n` +
      "@./skills/cli-select/SKILL.md\n" +
      "@./skills/cli-task/SKILL.md\n" +
      "@./skills/debugging/SKILL.md\n" +
      "@./skills/init/SKILL.md\n",
  );
});

test("piPackageKey carries the pi gate extension (.ts) when passed, pure skills otherwise", () => {
  assert.deepEqual(
    piPackageKey({ extensions: ["./bin/gate/adapters/pi.ts"] }),
    { extensions: ["./bin/gate/adapters/pi.ts"], skills: ["./skills"] },
  );
  assert.deepEqual(piPackageKey(), { skills: ["./skills"] });
});

test("piPackageKey first-party: osuperpowers pi key (skills + extensions)", () => {
  assert.deepEqual(
    piPackageKey({ skills: ["./skills"], extensions: ["./bin/gate/adapters/pi.ts"] }),
    { skills: ["./skills"], extensions: ["./bin/gate/adapters/pi.ts"] },
  );
});

test("piPackageKey first-party: overrides pi key (extensions only, no skills)", () => {
  assert.deepEqual(
    piPackageKey({ extensions: ["./bin/pi-router.ts"] }),
    { extensions: ["./bin/pi-router.ts"], skills: ["./skills"] },
  );
});

test("first-party pi keys: osuperpowers pi = skills + gate extension (.ts), overrides pi = router extension (.ts)", () => {
  const eng = JSON.parse(readFileSync("packages/osuperpowers/package.json", "utf8"));
  const ovr = JSON.parse(readFileSync("packages/osuperpowers-router/package.json", "utf8"));
  assert.deepEqual(eng.pi, { skills: ["./skills"], extensions: ["./bin/gate/adapters/pi.ts"] });
  assert.deepEqual(ovr.pi, { extensions: ["./bin/pi-router.ts"] });
  // oscaner-plugin field must NOT be removed by pi key addition
  assert.ok(eng["oscaner-plugin"], "osuperpowers oscaner-plugin preserved");
  assert.ok(ovr["oscaner-plugin"], "overrides oscaner-plugin preserved");
});

test("qoderPluginManifest emits the qoder plugin manifest (skills + hooks)", () => {
  const m = qoderPluginManifest(OS_ENG, OS_VERSION);
  assert.equal(m.name, "osuperpowers");
  assert.equal(m.version, OS_VERSION);
  assert.equal(m.description, OS_ENG.description);
  assert.equal(m.author.name, "Oscaner Miao");
  assert.equal(m.license, "MIT");
  assert.deepEqual(m.keywords, OS_ENG.claude.keywords);
  assert.equal(m.skills, "../skills/");
  assert.equal(m.hooks, "./hooks/hooks.json");
  assert.ok(m._generated);
  assert.match(m._generated, /scripts\/emit\.mjs/);
});

test("qoderHooksJson wires PreToolUse gate to the qoder adapter (manifest-relative ../bin)", () => {
  const hooks = qoderHooksJson();
  assert.ok(hooks._generated, "qoder hooks.json must carry the generated banner");
  assert.match(hooks._generated, /scripts\/emit\.mjs/);
  const pre = hooks.hooks.PreToolUse;
  assert.equal(pre.length, 2);
  assert.equal(pre[0].matcher, "Write|Edit");
  assert.equal(pre[1].matcher, "Bash");
  for (const e of pre) {
    assert.equal(e.hooks.length, 1);
    assert.equal(e.hooks[0].type, "command");
    assert.equal(
      e.hooks[0].command,
      "../bin/gate/adapters/qoder.mjs",
    );
  }
});

test(".version-bump.json tracks every per-harness manifest version (incl .qoder-plugin)", () => {
  const bump = JSON.parse(
    readFileSync("packages/osuperpowers/.version-bump.json", "utf8"),
  );
  const paths = bump.files.map((f) => f.path);
  for (const p of [
    ".claude-plugin/plugin.json",
    ".cursor-plugin/plugin.json",
    ".codex-plugin/plugin.json",
    ".qoder-plugin/plugin.json",
    ".kimi-plugin/plugin.json",
    "gemini-extension.json",
  ]) {
    assert.ok(paths.includes(p), `${p} 应在 version-bump files 内`);
  }
});

test("deriveFirstPartyNames discovers packages with oscaner-plugin (sorted)", () => {
  assert.deepEqual(deriveFirstPartyNames("packages"), [
    "osuperpowers",
    "osuperpowers-router",
  ]);
});

test("deriveFirstPartyNames ignores dirs without oscaner-plugin / package.json", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-fp-"));
  try {
    mkdirSync(join(tmp, "real"), { recursive: true });
    writeFileSync(
      join(tmp, "real", "package.json"),
      JSON.stringify({ name: "real", "oscaner-plugin": { contentRoot: "." } }),
    );
    // has package.json but no oscaner-plugin → excluded
    mkdirSync(join(tmp, "helper"), { recursive: true });
    writeFileSync(join(tmp, "helper", "package.json"), JSON.stringify({ name: "helper" }));
    // no package.json → excluded
    mkdirSync(join(tmp, "empty"), { recursive: true });
    assert.deepEqual(deriveFirstPartyNames(tmp), ["real"]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// source.mjs — source.json derivation (package-as-source)
// ---------------------------------------------------------------------------

test("deriveSource top-level fields come from emit constants", () => {
  const source = deriveSource(".");
  assert.equal(source.name, SOURCE_TOP.name);
  assert.deepEqual(source.owner, SOURCE_TOP.owner);
  assert.deepEqual(source.metadata, SOURCE_TOP.metadata);
  assert.equal(source.$schema, SOURCE_TOP.$schema);
});

test("deriveSource enumerates vendors + first-party packages in stable order", () => {
  const source = deriveSource(".");
  assert.deepEqual(
    source.plugins.map((p) => p.name),
    ["mattpocock-skills", "impeccable", "superpowers", "osuperpowers", "osuperpowers-router"],
  );
  // schema-required fields present on every plugin
  for (const p of source.plugins) {
    assert.ok(p.name, "plugin name");
    assert.ok(p.description, `${p.name} description`);
    assert.ok(p.author?.name, `${p.name} author.name`);
    assert.ok(p.contentRoot, `${p.name} contentRoot`);
    assert.ok(p.cursor, `${p.name} cursor`);
  }
});

test("deriveSource first-party entries carry oscaner-plugin + package metadata", () => {
  const source = deriveSource(".");
  const eng = source.plugins.find((p) => p.name === "osuperpowers");
  assert.deepEqual(eng, {
    name: "osuperpowers",
    version: OS_VERSION,
    description:
      "Standalone osuperpowers skills: orchestration + cli-* family, CDD engine, cross-harness gate.",
    author: { name: "Oscaner Miao", email: "oscaner1997@gmail.com" },
    contentRoot: "packages/osuperpowers",
    homepage: "https://github.com/Oscaner/skills",
    repository: "https://github.com/Oscaner/skills",
    license: "MIT",
    claude: {
      category: "osuperpowers",
      keywords: ["osuperpowers", "cli", "cdd", "harness", "droid", "pi"],
    },
    cursor: { emitMode: "plugin-root" },
    hooks: {
      claude: "./hooks/hooks.json",
      cursor: "./hooks/hooks-cursor.json",
      codex: "./.codex-plugin/hooks/hooks.json",
      qoder: "./.qoder-plugin/hooks/hooks.json",
    },
  });

  const ovr = source.plugins.find((p) => p.name === "osuperpowers-router");
  assert.equal(ovr.version, ROUTER_VERSION);
  assert.equal(ovr.contentRoot, "packages/osuperpowers-router");
  assert.equal(ovr.license, "MIT");
  assert.deepEqual(ovr.claude, {
    category: "workflow",
    tags: ["superpowers", "mattpocock", "overrides", "subagents"],
  });
  assert.deepEqual(ovr.cursor, { emitMode: "plugin-root" });
  assert.deepEqual(ovr.hooks, {
    claude: "./hooks/hooks.json",
    cursor: "./hooks/hooks-cursor.json",
  });
});

test("deriveSource vendor entries merge assembly-template fields + vendored files", () => {
  const source = deriveSource(".");
  const mp = source.plugins.find((p) => p.name === "mattpocock-skills");
  assert.equal(mp.version, "1.1.0");
  assert.deepEqual(mp.author, {
    name: "Matt Pocock",
    url: "https://github.com/mattpocock",
  });
  assert.equal(mp.contentRoot, "vendors/mattpocock-skills");
  assert.equal(mp.repository, "https://github.com/mattpocock/skills");
  assert.equal(mp.license, "MIT");
  assert.deepEqual(mp.cursor, {
    displayName: "Matt Pocock Skills",
    skills: "../../vendors/mattpocock-skills/skills",
  });

  const imp = source.plugins.find((p) => p.name === "impeccable");
  assert.equal(imp.version, "4.0.4");
  assert.equal(imp.contentRoot, "vendors/impeccable/plugin");
  assert.deepEqual(imp.author, {
    name: "Paul Bakaus",
    email: "paul@paulbakaus.com",
  });
  assert.equal(imp.repository, "https://github.com/pbakaus/impeccable");
  assert.equal(imp.license, "Apache-2.0");
  assert.deepEqual(imp.cursor, {
    displayName: "Impeccable",
    skills: "../../vendors/impeccable/plugin/skills",
  });

  const sp = source.plugins.find((p) => p.name === "superpowers");
  assert.equal(sp.version, "6.2.0");
  assert.equal(sp.contentRoot, "vendors/superpowers");
  assert.deepEqual(sp.author, { name: "Jesse Vincent", email: "jesse@fsck.com" });
  assert.deepEqual(sp.cursor, { emitMode: "plugin-root" });
});

test("osuperpowersClaudeHooks gates Write|Edit and Bash via the cdd gate", () => {
  const hooks = osuperpowersClaudeHooks();
  assert.ok(hooks._generated, "hooks.json must carry the generated banner");
  assert.match(hooks._generated, /scripts\/emit\.mjs/);
  const pre = hooks.hooks.PreToolUse;
  assert.equal(pre.length, 2);
  assert.equal(pre[0].matcher, "Write|Edit");
  assert.equal(pre[1].matcher, "Bash");
  for (const e of pre) {
    assert.equal(e.hooks.length, 1);
    assert.equal(e.hooks[0].type, "command");
    assert.equal(
      e.hooks[0].command,
      "${CLAUDE_PLUGIN_ROOT}/bin/gate/adapters/claude.mjs",
    );
  }
});

test("osuperpowersCursorHooks wires the cursor cdd gate preToolUse", () => {
  const hooks = osuperpowersCursorHooks();
  assert.ok(hooks._generated, "hooks-cursor.json must carry the generated banner");
  assert.match(hooks._generated, /scripts\/emit\.mjs/);
  assert.equal(hooks.version, 1);
  assert.deepEqual(hooks.hooks.preToolUse, [
    { command: "./bin/gate/adapters/cursor.mjs" },
  ]);
});

test("osuperpowersHooksFor dispatches per harness, fail-fast on unknown", () => {
  const claude = osuperpowersHooksFor("claude");
  assert.equal(claude.hooks.PreToolUse[0].matcher, "Write|Edit");
  const cursor = osuperpowersHooksFor("cursor");
  assert.equal(cursor.version, 1);
  assert.deepEqual(cursor.hooks.preToolUse, [
    { command: "./bin/gate/adapters/cursor.mjs" },
  ]);
  const codex = osuperpowersHooksFor("codex");
  assert.equal(
    codex.hooks.PreToolUse[0].hooks[0].command,
    "../bin/gate/adapters/codex.mjs",
  );
  const qoder = osuperpowersHooksFor("qoder");
  assert.equal(
    qoder.hooks.PreToolUse[0].hooks[0].command,
    "../bin/gate/adapters/qoder.mjs",
  );
  assert.throws(() => osuperpowersHooksFor("kimi"), /kimi/);
});

// ---------------------------------------------------------------------------
// orchestrate.mjs — stale-product detection + .agents/skills prune
// ---------------------------------------------------------------------------

test("findStaleCommittedFiles flags emitted products no longer generated", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-stale-"));
  try {
    // productRoot dir with one current and one stale product file
    mkdirSync(join(tmp, "products"));
    writeFileSync(join(tmp, "products/kept.json"), "{}\n");
    writeFileSync(join(tmp, "products/stale.json"), "{}\n");
    // standalone product file that IS still generated
    writeFileSync(join(tmp, "standalone.json"), "{}\n");
    // retired whole-directory product (cursor wrapper) that must be gone
    mkdirSync(join(tmp, "cursor-plugins/osuperpowers"), { recursive: true });

    const stale = findStaleCommittedFiles({
      generatedSet: new Set(["products/kept.json", "standalone.json"]),
      productRoots: ["products"],
      productFiles: ["standalone.json"],
      extraStale: ["cursor-plugins/osuperpowers/"],
      root: tmp,
    });
    assert.deepEqual(stale.sort(), [
      "cursor-plugins/osuperpowers/",
      "products/stale.json",
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("findStaleCommittedFiles returns empty when every product is generated", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-fresh-"));
  try {
    mkdirSync(join(tmp, "products"));
    writeFileSync(join(tmp, "products/kept.json"), "{}\n");
    const stale = findStaleCommittedFiles({
      generatedSet: new Set(["products/kept.json"]),
      productRoots: ["products"],
      productFiles: [],
      root: tmp,
    });
    assert.deepEqual(stale, []);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("pruneStaleAgentsNamespaces removes deleted/missing namespace dirs", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-agents-"));
  try {
    const outAgents = join(tmp, ".agents", "skills");
    mkdirSync(join(outAgents, "osuperpowers"), { recursive: true });
    mkdirSync(join(outAgents, "superpowers"), { recursive: true });
    mkdirSync(join(outAgents, "ghost"), { recursive: true });
    const srcDir = join(tmp, "src");
    mkdirSync(srcDir, { recursive: true });

    const namespaces = [
      // maps to an existing source → kept
      ["osuperpowers", srcDir],
      // maps to a missing source → pruned
      ["superpowers", join(tmp, "no-such-source")],
    ];
    const removed = pruneStaleAgentsNamespaces(outAgents, namespaces);
    assert.deepEqual(removed.sort(), ["ghost", "superpowers"]);
    assert.ok(existsSync(join(outAgents, "osuperpowers")), "kept namespace survives");
    assert.ok(!existsSync(join(outAgents, "superpowers")), "missing-source namespace pruned");
    assert.ok(!existsSync(join(outAgents, "ghost")), "unmapped namespace pruned");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("pruneStaleAgentsNamespaces is a no-op on a missing .agents/skills dir", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-agents-empty-"));
  try {
    const outAgents = join(tmp, ".agents", "skills");
    const removed = pruneStaleAgentsNamespaces(outAgents, [
      ["osuperpowers", join(tmp, "src")],
    ]);
    assert.deepEqual(removed, []);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// overrides.mjs — target parsing + artifact generators
// ---------------------------------------------------------------------------

test("loadTargets parses the real overrides.manifest.json", () => {
  const targets = loadTargets(MANIFEST_PATH);
  assert.equal(targets.length, 8); // P5 removed two legacy mappings
  const brainstorming = targets.find(
    (t) => t.name === "osuperpowers:brainstorming",
  );
  assert.ok(brainstorming);
  assert.equal(brainstorming.overrides, "superpowers:brainstorming");
  assert.equal(brainstorming.upstream_slug, "brainstorming");
  assert.equal(brainstorming.source, "../osuperpowers/skills/brainstorming");
  const tdd = targets.find((t) => t.name === "mattpocock-skills:tdd");
  assert.equal(tdd.source, null);
  assert.equal(targetSkillSuffix(tdd), "skills/osuperpowers/tdd/SKILL.md");
});

test("ccMatcherBareSlash escapes hyphens like Python re.escape", () => {
  assert.equal(
    ccMatcherBareSlash("writing-plans"),
    "(?i)(^|\\s)/writing\\-plans(\\s|$)",
  );
});

test("promptExpansionScript maps every overrides trigger to its target (.mjs)", () => {
  const script = promptExpansionScript(loadTargets(MANIFEST_PATH));
  assert.match(script, /^#!\/usr\/bin\/env node/);
  assert.match(script, /\/\/ scripts\/emit\.mjs — do not edit/);
  assert.match(script, /"superpowers:brainstorming": "osuperpowers:brainstorming"/);
  assert.match(script, /"\/brainstorming": "osuperpowers:brainstorming"/);
  assert.match(script, /"superpowers:test-driven-development": "mattpocock-skills:tdd"/);
  assert.match(script, /"\/using-git-worktrees": "osuperpowers:finishing"/);
});

test("piRouterScript maps every overrides trigger to its target (.ts)", () => {
  const script = piRouterScript(loadTargets(MANIFEST_PATH));
  assert.match(script, /\/\/ scripts\/emit\.mjs — do not edit/);
  assert.match(script, /"brainstorming": "osuperpowers:brainstorming"/);
  assert.match(script, /"writing-plans": "osuperpowers:writing-plans"/);
  assert.match(script, /"test-driven-development": "mattpocock-skills:tdd"/);
  assert.match(script, /"using-git-worktrees": "osuperpowers:finishing"/);
  assert.match(script, /export function on/);
  assert.match(script, /pi\.on\("input"/);
});

test("claudeHooksJson has exactly the two UserPromptExpansion matchers", () => {
  const hooks = claudeHooksJson(loadTargets(MANIFEST_PATH));
  assert.equal(hooks._generated, generatedBanner);
  const matchers = hooks.hooks.UserPromptExpansion.map((e) => e.matcher);
  assert.equal(matchers.length, 2);
  assert.equal(matchers[0], "^superpowers:");
  assert.match(matchers[1], /\/brainstorming/);
  assert.doesNotMatch(matchers[1], /spor-/);
  // every override target gets a bare-slash branch in the combined matcher
  assert.ok(matchers[1].includes("/writing\\-plans"), "writing-plans matcher");
  assert.ok(matchers[1].includes("/using\\-git\\-worktrees"), "using-git-worktrees matcher");
  // both matchers route to the Node prompt-expansion router
  for (const e of hooks.hooks.UserPromptExpansion) {
    assert.equal(
      e.hooks[0].command,
      "${CLAUDE_PLUGIN_ROOT}/bin/prompt-expansion.mjs",
    );
  }
});

test("overridesHooksFor dispatches claude → router, cursor → detect/enforce, fail-fast on unknown", () => {
  const targets = loadTargets(MANIFEST_PATH);
  const claude = overridesHooksFor("claude", targets);
  assert.equal(claude.hooks.UserPromptExpansion[0].matcher, "^superpowers:");
  const cursor = overridesHooksFor("cursor", targets);
  assert.deepEqual(cursor.hooks.beforeSubmitPrompt, [
    { command: "./bin/cursor-detect.mjs", matcher: "UserPromptSubmit" },
  ]);
  assert.deepEqual(cursor.hooks.preToolUse, [
    { command: "./bin/cursor-enforce.mjs" },
  ]);
  assert.throws(() => overridesHooksFor("codex", targets), /codex/);
});

test("cursorDetectScript embeds target skill_suffix and attach regexes", () => {
  const template = readFileSync(
    "scripts/templates/cursor-detect.mjs",
    "utf8",
  );
  const script = cursorDetectScript(loadTargets(MANIFEST_PATH), template);
  assert.match(script, /#!\/usr\/bin\/env node/);
  assert.match(script, /\/\/ scripts\/emit\.mjs — do not edit/);
  assert.match(script, /"skill_suffix": ?"\.\.\/osuperpowers\/skills\/brainstorming\/SKILL\.md"/);
  assert.match(script, /"name": ?"mattpocock-skills:tdd"/);
  assert.match(script, /"skill_suffix": ?"skills\/osuperpowers\/tdd\/SKILL\.md"/);
  // attach regex for the brainstorming upstream family present
  assert.match(script, /\(\?i\)\/brainstorming\/SKILL/);
  assert.match(script, /\(\?i\)\/vendors\/superpowers\/skills\/brainstorming\/SKILL/);
});

test("cursorEnforceScript embeds read-regexes per target skill", () => {
  const template = readFileSync(
    "scripts/templates/cursor-enforce.mjs",
    "utf8",
  );
  const script = cursorEnforceScript(loadTargets(MANIFEST_PATH), template);
  assert.match(script, /\/\/ scripts\/emit\.mjs — do not edit/);
  assert.match(script, /READ_RES = \{/);
  assert.match(script, /"mattpocock-skills:tdd"/);
  assert.match(script, /skills\/osuperpowers\/tdd\/SKILL/);
  assert.match(script, /"osuperpowers:brainstorming"/);
});

test("claudeSelfCheckMd fills the trigger table with target skill names", () => {
  const template = readFileSync(
    "packages/osuperpowers-router/build/templates/claude-self-check.md",
    "utf8",
  );
  const md = claudeSelfCheckMd(
    loadTargets(MANIFEST_PATH),
    ROUTER_VERSION,
    template,
  );
  assert.match(md, /<!-- scripts\/emit\.mjs — do not edit -->/);
  assert.match(md, new RegExp(`<!-- osuperpowers-router-version: ${ROUTER_VERSION_RE} -->`));
  assert.match(md, /\| `superpowers:brainstorming` \| `Skill\(osuperpowers:brainstorming\)` \|/);
  assert.match(md, /\| `superpowers:test-driven-development` \| `Skill\(mattpocock-skills:tdd\)` \|/);
});

test("cursorSelfCheckMdc carries the version stamp and trigger rows", () => {
  const template = readFileSync(
    "packages/osuperpowers-router/build/templates/self-check.mdc",
    "utf8",
  );
  const mdc = cursorSelfCheckMdc(
    loadTargets(MANIFEST_PATH),
    ROUTER_VERSION,
    template,
  );
  assert.match(mdc, /_generated: scripts\/emit\.mjs — do not edit/);
  assert.match(mdc, new RegExp(`osuperpowers-router-version: ${ROUTER_VERSION_RE}`));
  assert.match(mdc, /\| `\/brainstorming`, `\/superpowers:brainstorming`, upstream `brainstorming` body \| Read `osuperpowers:brainstorming` via agent_skills fullPath \|/);
});
