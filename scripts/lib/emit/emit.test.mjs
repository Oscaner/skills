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

const MANIFEST_PATH = ""; // router deleted — kept as placeholder to avoid breaking test line refs

const ROUTER = null; // router deleted

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

// router deleted — test removed
// test("claudePluginManifest with noSkills omits skills but keeps full metadata", ...)

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
    "sample-skill",
  ]);
  assert.equal(
    md,
    `<!-- ${generatedBanner} -->\n` +
      "@./skills/cli-select/SKILL.md\n" +
      "@./skills/init/SKILL.md\n" +
      "@./skills/sample-skill/SKILL.md\n",
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
  // router deleted — test kept with osuperpowers-only variant
  assert.deepEqual(
    piPackageKey({ extensions: ["./bin/gate/adapters/pi.ts"] }),
    { extensions: ["./bin/gate/adapters/pi.ts"], skills: ["./skills"] },
  );
});

// router deleted — test removed
// test("first-party pi keys: osuperpowers pi = skills + gate extension (.ts), overrides pi = router extension (.ts)", ...)

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
    ["mattpocock-skills", "impeccable", "superpowers", "osuperpowers"],
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

  // router deleted — router assertions removed
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
// overrides.mjs — router deleted, all tests below removed (#209)
// ---------------------------------------------------------------------------


