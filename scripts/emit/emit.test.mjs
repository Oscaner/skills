import { test, expect } from "vitest";
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
  writeText,
  writeJsonDoc,
} from "./orchestrate.mjs";
import { emitAll } from "./all.mjs";
import { assertVersionBump } from "./compare.mjs";

// First-party versions are read from the live package.json SOTs so these
// assertions hold at any released version. A stale hardcoded version broke the
// Release workflow's pre-commit gate whenever version-packages.mjs bumped the
// tree before committing (emit reads the bumped package.json, so asserts must
// expect the bumped version).
const readPkgVersion = (rel) =>
  JSON.parse(
    readFileSync(new URL(`../../${rel}/package.json`, import.meta.url), "utf8"),
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
  expect(m).toEqual({
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
  expect(
    !("hooks" in m),
  ).toBeTruthy();
});

// router deleted — test removed
// test("claudePluginManifest with noSkills omits skills but keeps full metadata", ...)

test("cursorPluginManifest points skills at canonical ./skills/ (no copy)", () => {
  const m = cursorPluginManifest(OS_ENG, OS_VERSION);
  expect(m.name).toBe("osuperpowers");
  expect(m.displayName).toBe("osuperpowers");
  expect(m.skills).toBe("./skills/");
  expect(m.hooks).toBe("./hooks/hooks-cursor.json");
  expect(m.version).toBe(OS_VERSION);
  expect(m.license).toBe("MIT");
  expect(m._generated).toBeTruthy();
  expect(m._generated).toMatch(/scripts\/run\.mjs/);
});

test("codexPluginManifest includes skills, codex gate hooks path, and interface", () => {
  const m = codexPluginManifest(OS_ENG, OS_VERSION);
  expect(m.skills).toBe("../skills/");
  expect(m.hooks).toBe("./hooks/hooks.json");
  expect(m.name).toBe("osuperpowers");
  expect(m.version).toBe(OS_VERSION);
  expect(m.interface, "codex manifest must carry an interface").toBeTruthy();
  expect(m.interface.displayName).toBe("osuperpowers");
  expect(Array.isArray(m.interface.capabilities)).toBeTruthy();
  expect(m.interface.capabilities.length > 0).toBeTruthy();
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
  expect(custom.hooks).toBe("./hooks/claude.json");
  // The canonical ./hooks/hooks.json is auto-loaded by Claude Code — naming it
  // in manifest.hooks duplicates the load and fails plugin startup, so it is
  // omitted even when `oscaner-plugin.hooks.claude` maps to it explicitly.
  const canonical = claudePluginManifest(
    { ...OS_ENG, hooks: { claude: "./hooks/hooks.json" } },
    OS_VERSION,
  );
  expect(
    !("hooks" in canonical),
  ).toBeTruthy();
});

test("cursorPluginManifest resolves hooks from plugin.hooks.cursor mapping", () => {
  const m = cursorPluginManifest(
    {
      ...OS_ENG,
      hooks: { claude: "./hooks/claude.json", cursor: "./hooks/cursor.json" },
    },
    OS_VERSION,
  );
  expect(m.hooks).toBe("./hooks/cursor.json");
});

test("codexPluginManifest points hooks at the codex plugin-root hooks channel", () => {
  // codex plugin hooks route through the plugin-root `hooks/hooks.json` (manifest
  // lives in .codex-plugin/, so manifest-relative would be ./hooks/hooks.json);
  // emit writes files by package-relative mapping. skills are likewise
  // manifest-relative (../skills/ → package-root skills/) — one unified base.
  expect(codexPluginManifest(OS_ENG, OS_VERSION).hooks).toBe("./hooks/hooks.json");
  const mapped = codexPluginManifest(
    { ...OS_ENG, hooks: { codex: "./.codex-plugin/hooks/hooks.json" } },
    OS_VERSION,
  );
  expect(mapped.hooks).toBe("./hooks/hooks.json");
});

test("codexHooksJson wires PreToolUse gate to the codex adapter (manifest-relative ../bin)", () => {
  const hooks = codexHooksJson();
  expect(hooks._generated, "hooks.json must carry the generated banner").toBeTruthy();
  expect(hooks._generated).toMatch(/scripts\/run\.mjs/);
  const pre = hooks.hooks.PreToolUse;
  expect(pre.length).toBe(2);
  expect(pre[0].matcher).toBe("Write|Edit");
  expect(pre[1].matcher).toBe("Bash");
  for (const e of pre) {
    expect(e.hooks.length).toBe(1);
    expect(e.hooks[0].type).toBe("command");
    expect(
      e.hooks[0].command,
    ).toBe("../bin/gate/adapters/codex.mjs");
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
  expect(() =>
    assertAdapterPathsExist(plugin, "packages/osuperpowers", OS_VERSION),
  ).not.toThrow();
});

test("assertAdapterPathsExist: throws when a generated hooks command adapter is missing", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-adapter-guard-"));
  try {
    const plugin = {
      name: "osuperpowers",
      hooks: { claude: "./hooks/hooks.json" },
    };
    // empty temp dir has no bin/gate/adapters/* — the guard must fail loud
    expect(() => assertAdapterPathsExist(plugin, tmp, OS_VERSION)).toThrow(/adapter/i);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("adapterRelFromCommand: ../bin manifest-relative shape is recognized (ADAPTER_CMD_RE cover)", () => {
  expect(
    adapterRelFromCommand("../bin/gate/adapters/codex.mjs"),
  ).toBe("bin/gate/adapters/codex.mjs");
  expect(
    adapterRelFromCommand("../bin/gate/adapters/qoder.mjs"),
  ).toBe("bin/gate/adapters/qoder.mjs");
  expect(
    adapterRelFromCommand("./bin/gate/adapters/cursor.mjs"),
  ).toBe("bin/gate/adapters/cursor.mjs");
  expect(
    adapterRelFromCommand("${CLAUDE_PLUGIN_ROOT}/bin/gate/adapters/claude.mjs"),
  ).toBe("bin/gate/adapters/claude.mjs");
  expect(adapterRelFromCommand("python3 /tmp/x.py")).toBe(null);
});

test("assertAdapterPathsExist: ../bin manifest-relative adapter missing → throws (guard covers ../)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-adapter-guard-"));
  try {
    const plugin = {
      name: "osuperpowers",
      hooks: { codex: "./.codex-plugin/hooks/hooks.json" },
    };
    // empty temp dir has no bin/gate/adapters/codex.mjs — even a ../ prefix command must fail
    expect(() => assertAdapterPathsExist(plugin, tmp, OS_VERSION)).toThrow(/adapter/i);
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
  expect(cmds).toEqual(["/a.mjs", "/b.mjs"]);
});

test("kimiPluginManifest includes sessionStart + tool-mapping prose + interface", () => {
  const m = kimiPluginManifest(OS_ENG, OS_VERSION);
  expect(m.skills).toBe("./skills/");
  expect(m.sessionStart).toEqual({ skill: "init" });
  expect(
    typeof m.skillInstructions === "string" && m.skillInstructions.length > 0,
    "kimi manifest must carry tool-mapping prose",
  ).toBeTruthy();
  expect(m.interface).toBeTruthy();
  expect(m.interface.displayName).toBe("osuperpowers");
});

test("geminiExtension carries BeforeTool gate hooks + contextFileName", () => {
  expect(geminiExtension(OS_ENG, OS_VERSION)).toEqual({
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
  expect(
    md,
  ).toBe(
    `<!-- ${generatedBanner} -->\n` +
      "@./skills/cli-select/SKILL.md\n" +
      "@./skills/init/SKILL.md\n" +
      "@./skills/sample-skill/SKILL.md\n",
  );
});

test("piPackageKey carries the pi gate extension (.ts) when passed, pure skills otherwise", () => {
  expect(
    piPackageKey({ extensions: ["./bin/gate/adapters/pi.ts"] }),
  ).toEqual({ extensions: ["./bin/gate/adapters/pi.ts"], skills: ["./skills"] });
  expect(piPackageKey()).toEqual({ skills: ["./skills"] });
});

test("piPackageKey first-party: osuperpowers pi key (skills + extensions)", () => {
  expect(
    piPackageKey({ skills: ["./skills"], extensions: ["./bin/gate/adapters/pi.ts"] }),
  ).toEqual({ skills: ["./skills"], extensions: ["./bin/gate/adapters/pi.ts"] });
});

test("piPackageKey first-party: overrides pi key (extensions only, no skills)", () => {
  // router deleted — test kept with osuperpowers-only variant
  expect(
    piPackageKey({ extensions: ["./bin/gate/adapters/pi.ts"] }),
  ).toEqual({ extensions: ["./bin/gate/adapters/pi.ts"], skills: ["./skills"] });
});

// router deleted — test removed
// test("first-party pi keys: osuperpowers pi = skills + gate extension (.ts), overrides pi = router extension (.ts)", ...)

test("qoderPluginManifest emits the qoder plugin manifest (skills + hooks)", () => {
  const m = qoderPluginManifest(OS_ENG, OS_VERSION);
  expect(m.name).toBe("osuperpowers");
  expect(m.version).toBe(OS_VERSION);
  expect(m.description).toBe(OS_ENG.description);
  expect(m.author.name).toBe("Oscaner Miao");
  expect(m.license).toBe("MIT");
  expect(m.keywords).toEqual(OS_ENG.claude.keywords);
  expect(m.skills).toBe("../skills/");
  expect(m.hooks).toBe("./hooks/hooks.json");
  expect(m._generated).toBeTruthy();
  expect(m._generated).toMatch(/scripts\/run\.mjs/);
});

test("qoderHooksJson wires PreToolUse gate to the qoder adapter (manifest-relative ../bin)", () => {
  const hooks = qoderHooksJson();
  expect(hooks._generated, "qoder hooks.json must carry the generated banner").toBeTruthy();
  expect(hooks._generated).toMatch(/scripts\/run\.mjs/);
  const pre = hooks.hooks.PreToolUse;
  expect(pre.length).toBe(2);
  expect(pre[0].matcher).toBe("Write|Edit");
  expect(pre[1].matcher).toBe("Bash");
  for (const e of pre) {
    expect(e.hooks.length).toBe(1);
    expect(e.hooks[0].type).toBe("command");
    expect(
      e.hooks[0].command,
    ).toBe("../bin/gate/adapters/qoder.mjs");
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
    expect(paths.includes(p)).toBeTruthy();
  }
});

test("deriveFirstPartyNames discovers packages with oscaner-plugin (sorted)", () => {
  expect(deriveFirstPartyNames("packages")).toEqual([
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
    expect(deriveFirstPartyNames(tmp)).toEqual(["real"]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// source.mjs — source.json derivation (package-as-source)
// ---------------------------------------------------------------------------

test("deriveSource top-level fields come from emit constants", () => {
  const source = deriveSource(".");
  expect(source.name).toBe(SOURCE_TOP.name);
  expect(source.owner).toEqual(SOURCE_TOP.owner);
  expect(source.metadata).toEqual(SOURCE_TOP.metadata);
  expect(source.$schema).toBe(SOURCE_TOP.$schema);
});

test("deriveSource enumerates vendors + first-party packages in stable order", () => {
  const source = deriveSource(".");
  expect(
    source.plugins.map((p) => p.name),
  ).toEqual(["mattpocock-skills", "impeccable", "superpowers", "osuperpowers"]);
  // schema-required fields present on every plugin
  for (const p of source.plugins) {
    expect(p.name).toBeTruthy();
    expect(p.description).toBeTruthy();
    expect(p.author?.name).toBeTruthy();
    expect(p.contentRoot).toBeTruthy();
    expect(p.cursor).toBeTruthy();
  }
});

test("deriveSource first-party entries carry oscaner-plugin + package metadata", () => {
  const source = deriveSource(".");
  const eng = source.plugins.find((p) => p.name === "osuperpowers");
  expect(eng).toEqual({
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
  expect(mp.version).toBe("1.1.0");
  expect(mp.author).toEqual({
    name: "Matt Pocock",
    url: "https://github.com/mattpocock",
  });
  expect(mp.contentRoot).toBe("vendors/mattpocock-skills");
  expect(mp.repository).toBe("https://github.com/mattpocock/skills");
  expect(mp.license).toBe("MIT");
  expect(mp.cursor).toEqual({
    displayName: "Matt Pocock Skills",
    skills: "../../vendors/mattpocock-skills/skills",
  });

  const imp = source.plugins.find((p) => p.name === "impeccable");
  expect(imp.version).toBe("4.0.4");
  expect(imp.contentRoot).toBe("vendors/impeccable/plugin");
  expect(imp.author).toEqual({
    name: "Paul Bakaus",
    email: "paul@paulbakaus.com",
  });
  expect(imp.repository).toBe("https://github.com/pbakaus/impeccable");
  expect(imp.license).toBe("Apache-2.0");
  expect(imp.cursor).toEqual({
    displayName: "Impeccable",
    skills: "../../vendors/impeccable/plugin/skills",
  });

  const sp = source.plugins.find((p) => p.name === "superpowers");
  expect(sp.version).toBe("6.2.0");
  expect(sp.contentRoot).toBe("vendors/superpowers");
  expect(sp.author).toEqual({ name: "Jesse Vincent", email: "jesse@fsck.com" });
  expect(sp.cursor).toEqual({ emitMode: "plugin-root" });
});

test("osuperpowersClaudeHooks gates Write|Edit and Bash via the cdd gate", () => {
  const hooks = osuperpowersClaudeHooks();
  expect(hooks._generated, "hooks.json must carry the generated banner").toBeTruthy();
  expect(hooks._generated).toMatch(/scripts\/run\.mjs/);
  const pre = hooks.hooks.PreToolUse;
  expect(pre.length).toBe(2);
  expect(pre[0].matcher).toBe("Write|Edit");
  expect(pre[1].matcher).toBe("Bash");
  for (const e of pre) {
    expect(e.hooks.length).toBe(1);
    expect(e.hooks[0].type).toBe("command");
    expect(
      e.hooks[0].command,
    ).toBe("${CLAUDE_PLUGIN_ROOT}/bin/gate/adapters/claude.mjs");
  }
});

test("osuperpowersCursorHooks wires the cursor cdd gate preToolUse", () => {
  const hooks = osuperpowersCursorHooks();
  expect(hooks._generated, "hooks-cursor.json must carry the generated banner").toBeTruthy();
  expect(hooks._generated).toMatch(/scripts\/run\.mjs/);
  expect(hooks.version).toBe(1);
  expect(hooks.hooks.preToolUse).toEqual([
    { command: "./bin/gate/adapters/cursor.mjs" },
  ]);
});

test("osuperpowersHooksFor dispatches per harness, fail-fast on unknown", () => {
  const claude = osuperpowersHooksFor("claude");
  expect(claude.hooks.PreToolUse[0].matcher).toBe("Write|Edit");
  const cursor = osuperpowersHooksFor("cursor");
  expect(cursor.version).toBe(1);
  expect(cursor.hooks.preToolUse).toEqual([
    { command: "./bin/gate/adapters/cursor.mjs" },
  ]);
  const codex = osuperpowersHooksFor("codex");
  expect(
    codex.hooks.PreToolUse[0].hooks[0].command,
  ).toBe("../bin/gate/adapters/codex.mjs");
  const qoder = osuperpowersHooksFor("qoder");
  expect(
    qoder.hooks.PreToolUse[0].hooks[0].command,
  ).toBe("../bin/gate/adapters/qoder.mjs");
  expect(() => osuperpowersHooksFor("kimi")).toThrow(/kimi/);
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
    expect(stale.sort()).toEqual([
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
    expect(stale).toEqual([]);
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
    expect(removed.sort()).toEqual(["ghost", "superpowers"]);
    expect(existsSync(join(outAgents, "osuperpowers"))).toBeTruthy();
    expect(!existsSync(join(outAgents, "superpowers"))).toBeTruthy();
    expect(!existsSync(join(outAgents, "ghost"))).toBeTruthy();
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
    expect(removed).toEqual([]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("writeJsonDoc/writeText write into outRoot (mkdir -p) and track generatedPaths", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-writers-"));
  try {
    const generatedPaths = [];
    writeText(tmp, "a/b.txt", "hello", generatedPaths);
    writeJsonDoc(tmp, "c/d.json", { ok: true }, generatedPaths);
    expect(generatedPaths).toEqual(["a/b.txt", "c/d.json"]);
    expect(readFileSync(join(tmp, "a/b.txt"), "utf8")).toBe("hello");
    expect(JSON.parse(readFileSync(join(tmp, "c/d.json"), "utf8"))).toEqual({ ok: true });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("emitAll into a temp tree produces the full product set and tracks every path", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-emitall-"));
  try {
    const generatedPaths = [];
    emitAll(tmp, { generatedPaths });
    for (const rel of [
      "marketplace/source.json",
      ".claude-plugin/marketplace.json",
      ".cursor-plugin/marketplace.json",
      "cursor-plugins/mattpocock-skills/.cursor-plugin/plugin.json",
      "packages/osuperpowers/.claude-plugin/plugin.json",
      "packages/osuperpowers/.codex-plugin/plugin.json",
      "packages/osuperpowers/.qoder-plugin/plugin.json",
      "packages/osuperpowers/.kimi-plugin/plugin.json",
      "packages/osuperpowers/gemini-extension.json",
      "packages/osuperpowers/GEMINI.md",
      "packages/osuperpowers/hooks/hooks.json",
    ]) {
      expect(existsSync(join(tmp, rel))).toBe(true);
      expect(generatedPaths.includes(rel)).toBe(true);
    }
    // the shared .agents/skills/ namespace copy is tracked too
    expect(
      generatedPaths.some((r) =>
        r.startsWith("packages/osuperpowers/.agents/skills/osuperpowers/"),
      ),
    ).toBe(true);
    // every recorded path resolves to a real temp-tree file, no duplicates
    for (const rel of generatedPaths) {
      expect(existsSync(join(tmp, rel))).toBe(true);
    }
    expect(new Set(generatedPaths).size).toBe(generatedPaths.length);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("emitAll returns an identical wrapper-root set per run (no shared-state accumulation)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-emitall-roots-"));
  try {
    const wrapperRoots = emitAll(tmp, { generatedPaths: [] });
    // non-plugin-root vendors only — osuperpowers/superpowers run plugin-root
    expect(wrapperRoots).toEqual([
      "cursor-plugins/mattpocock-skills",
      "cursor-plugins/impeccable",
    ]);
    // a second emit returns the identical set — the base product-root constant
    // is never mutated (regression: marketplace used to push into the exported
    // shared array, so repeated emitAll calls accumulated wrappers)
    expect(emitAll(tmp, { generatedPaths: [] })).toEqual(wrapperRoots);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("assertVersionBump validates the passed committedRoot, not the module root", () => {
  const tmp = mkdtempSync(join(tmpdir(), "oscaner-version-bump-"));
  try {
    const pluginRoot = join(tmp, "packages", "osuperpowers");
    mkdirSync(pluginRoot, { recursive: true });
    writeFileSync(join(pluginRoot, "package.json"), JSON.stringify({ version: "1.0.0" }));
    mkdirSync(join(pluginRoot, ".claude-plugin"), { recursive: true });
    writeFileSync(
      join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ version: "9.9.9" }),
    );
    writeFileSync(
      join(pluginRoot, ".version-bump.json"),
      JSON.stringify({ files: [{ path: ".claude-plugin/plugin.json", field: "version" }] }),
    );
    // staged manifest (9.9.9) drifts from staged package.json (1.0.0) → must
    // throw on the passed root; closing over the module root would read the
    // in-sync repo root instead and pass silently
    expect(() => assertVersionBump(tmp)).toThrow(/version drift/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// overrides.mjs — router deleted, all tests below removed (#209)
// ---------------------------------------------------------------------------


