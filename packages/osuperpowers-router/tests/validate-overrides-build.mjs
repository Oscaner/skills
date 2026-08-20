#!/usr/bin/env node
// packages/osuperpowers-router/tests/validate-overrides-build.mjs — Node port
// of validate-overrides-build.sh.
//
// Validates the overrides trigger-router build: the manifest schema + canonical
// target names, the hooks matchers, hooks-cursor.json, init lockstep,
// self-check version stamps, dogfood stamps, and the sub-validators that the
// .sh deferred to python3 / node (rule-reference, manifest-harness, router
// hooks, engine tests, emit freshness). Fail-fast like `set -e` in the .sh:
// the first failing check prints `== FAIL: <name> ==` and exits 1.
//
// Invoked standalone (`node validate-overrides-build.mjs`) by ci-validate.mjs
// step 5; exits 0 when every check passes.
import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, ".."); // packages/osuperpowers-router
const REPO = path.resolve(ROOT, "../.."); // repo root
const ENGINE = path.join(REPO, "packages/osuperpowers");
const SKILLS = path.join(ROOT, "skills");
const MANIFEST = path.join(ROOT, "overrides.manifest.json");

const NAME_RE = /^[a-z0-9-]+:[a-z0-9-]+$/;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function isExecutable(p) {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isDir(p) {
  return existsSync(p);
}

function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST, "utf8"));
}

function nodeTest(...files) {
  execFileSync("node", ["--test", ...files], { cwd: REPO, stdio: "inherit" });
}

function check(name, fn) {
  console.log(`== ${name} ==`);
  try {
    fn();
    console.log("OK");
  } catch (e) {
    console.error(`== FAIL: ${name} ==`);
    console.error(e?.message ?? String(e));
    process.exit(1);
  }
}

function main() {
  check("validate manifest sources", () => {
    const m = loadManifest();
    for (const t of m.targets) {
      const src = t.source;
      if (src === null || src === undefined) continue; // submodule target (mattpocock tdd) — checked separately
      const p = path.join(ROOT, src, "SKILL.md");
      assert(existsSync(p), p);
    }
  });

  check("validate manifest JSON schema", () => {
    // No jsonschema npm dep — validate structurally against
    // build/overrides-manifest.schema.json (the .py's fallback + the schema's
    // name/overrides patterns).
    const m = loadManifest();
    assert(typeof m.plugin === "string" && m.plugin.length >= 1, "plugin must be a non-empty string");
    assert(Array.isArray(m.targets) && m.targets.length >= 1, "targets must be a non-empty array");
    for (const t of m.targets) {
      assert(typeof t.name === "string" && NAME_RE.test(t.name), `bad target name: ${t.name}`);
      assert(typeof t.overrides === "string" && NAME_RE.test(t.overrides), `bad target overrides: ${t.overrides}`);
      assert(
        t.source === null || (typeof t.source === "string" && t.source.length >= 1),
        `bad target source: ${JSON.stringify(t.source)}`,
      );
    }
  });

  check("validate canonical target names", () => {
    const m = loadManifest();
    assert(m.targets.length === 10, `expected 10 targets, got ${m.targets.length}`);
    for (const t of m.targets) {
      assert(t.name.includes(":"), `name must be plugin-qualified: ${t.name}`);
      const [plugin, upstream] = t.overrides.split(":");
      assert(plugin === "superpowers", `overrides must be superpowers:<slug>: ${t.overrides}`);
      assert(!isDir(path.join(SKILLS, upstream)), `upstream collision dir: ${upstream}`);
    }
    // no skill bodies: overrides = trigger router. skills/ must be absent or empty.
    if (isDir(SKILLS)) {
      const names = readdirSync(SKILLS, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
      assert(names.length === 0, `skills/ must be empty (trigger router, no skill bodies): ${names.join(", ")}`);
    }
  });

  check("validate cross-cutting skills", () => {
    // all spor-* skill bodies deleted (T2); none may come back
    if (isDir(SKILLS)) {
      for (const ent of readdirSync(SKILLS, { withFileTypes: true })) {
        if (ent.isDirectory()) {
          assert(!ent.name.startsWith("spor-"), `spor-* skill still present: ${ent.name}`);
        }
      }
    }
    for (const slug of ["spor-sdd-p0-fallback", "spor-subagent-lifecycle", "spor-token-efficient-review-dispatch"]) {
      assert(!isDir(path.join(SKILLS, slug)), `deleted cross-cutting skill still present: ${slug}`);
    }
  });

  check("validate rule-reference integrity (osuperpowers semantic)", () => {
    nodeTest(path.join(ENGINE, "tests/rule-reference.test.mjs"));
  });

  check("validate osuperpowers engine (harness registry + runners)", () => {
    assert(existsSync(path.join(ENGINE, "bin/engine/harness-registry.json")), "harness-registry.json missing");
    for (const script of ["cdd-task.mjs", "cdd-select.mjs", "cdd-review.mjs"]) {
      assert(isExecutable(path.join(ENGINE, "bin/engine", script)), `osuperpowers/bin/engine/${script} not executable`);
    }
  });

  check("validate osuperpowers engine tests", () => {
    const testsDir = path.join(ENGINE, "bin/engine/tests");
    const files = readdirSync(testsDir)
      .filter((f) => f.endsWith(".test.mjs"))
      .map((f) => path.join(testsDir, f));
    nodeTest(...files);
  });

  check("validate manifest target existence (cross-plugin)", () => {
    const m = loadManifest();
    for (const t of m.targets) {
      const src = t.source;
      if (src === null || src === undefined) continue; // submodule target (mattpocock tdd)
      // Resolve the source path relative to the manifest directory.
      // The manifest is at packages/osuperpowers-router/overrides.manifest.json,
      // so source paths like ../osuperpowers/skills/... resolve correctly.
      const p = path.resolve(path.dirname(MANIFEST), src);
      const sk = path.join(p, "SKILL.md");
      assert(existsSync(sk), `missing target skill: ${sk} (from source: ${src})`);
    }
  });

  check("validate no legacy .cursor/skills tree", () => {
    assert(!isDir(path.join(ROOT, ".cursor/skills")), ".cursor/skills/ still exists");
  });

  check("validate init self-check rows mirror manifest targets", () => {
    // The init router payload table (a hand-maintained copy of the
    // trigger->target mapping) must stay in lockstep with overrides.manifest.json
    // targets[]. Every manifest target's upstream slug must resolve to its
    // canonical target name. The table lives in init's router.md payload.
    const sporMd = readFileSync(path.join(ENGINE, "skills/init/router.md"), "utf8");
    const rows = {};
    for (const raw of sporMd.split("\n")) {
      const line = raw.trim();
      if (!(line.startsWith("| `") && line.includes("Skill("))) continue;
      const cells = line
        .replace(/^\|+/, "")
        .replace(/\|+$/, "")
        .split("|")
        .map((c) => c.trim());
      if (cells.length !== 2) continue;
      const slug = cells[0].replace(/^`+|`+$/g, "").replace(/^\/+/, "");
      const target = cells[1].slice(6, -1); // strip "Skill(" + ")"
      rows[slug] = target;
    }
    const manifest = loadManifest();
    assert(
      Object.keys(rows).length >= manifest.targets.length,
      `init payload has ${Object.keys(rows).length} rows, manifest has ${manifest.targets.length}`,
    );
    for (const t of manifest.targets) {
      const slug = t.overrides.split(":")[1];
      const want = t.name;
      const got = rows[slug];
      assert(got === want, `init row /${slug}: Skill(${got}) != Skill(${want})`);
    }
  });

  check("validate hooks.json matchers", () => {
    const hooks = JSON.parse(readFileSync(path.join(ROOT, "hooks/hooks.json"), "utf8"));
    const matchers = hooks.hooks.UserPromptExpansion.map((e) => e.matcher);
    assert(matchers.length === 2, `expected 2 matchers: ${matchers}`);
    assert(matchers.some((m) => m.startsWith("^superpowers:")), `missing ^superpowers: matcher: ${matchers}`);
    assert(matchers.some((m) => m.includes("/brainstorming")), `missing /brainstorming matcher: ${matchers}`);
    assert(!matchers.some((m) => m.includes("spor-")), "spor- matchers must be removed");
    const commands = hooks.hooks.UserPromptExpansion.map((e) => e.hooks[0].command);
    assert(commands.every((c) => c.endsWith("/bin/prompt-expansion.mjs")), `bad commands: ${commands}`);
  });

  check("validate harness manifests", () => {
    nodeTest(path.join(ROOT, "tests/manifest-harness.test.mjs"));
  });

  check("validate generator outputs fresh", () => {
    execFileSync("node", ["scripts/emit.mjs", "--check"], { cwd: REPO, stdio: "inherit" });
  });

  check("validate router hooks (Node)", () => {
    nodeTest(
      path.join(ROOT, "tests/prompt-expansion.test.mjs"),
      path.join(ROOT, "tests/cursor-detect.test.mjs"),
      path.join(ROOT, "tests/cursor-enforce.test.mjs"),
    );
  });

  check("validate hooks-cursor.json", () => {
    const hooks = JSON.parse(readFileSync(path.join(ROOT, "hooks/hooks-cursor.json"), "utf8"));
    assert(hooks.version === 1, `version != 1: ${hooks.version}`);
    assert("beforeSubmitPrompt" in hooks.hooks, "beforeSubmitPrompt missing");
    assert("preToolUse" in hooks.hooks, "preToolUse missing");
    const detect = hooks.hooks.beforeSubmitPrompt[0];
    assert(detect.command === "./bin/cursor-detect.mjs", `detect command: ${detect.command}`);
    const pre = hooks.hooks.preToolUse;
    assert(pre.length === 1, `expected 1 preToolUse entry: ${pre.length}`);
    assert(pre[0].command === "./bin/cursor-enforce.mjs", `enforce command: ${pre[0].command}`);
    assert(!("matcher" in pre[0]), "preToolUse must not carry a matcher");
    assert(!pre.some((p) => p.command.includes("cdd-gate")), "gate preToolUse moved to osuperpowers");
  });

  check("validate claude hooks.json has no PreToolUse (gate moved to osuperpowers)", () => {
    const cc = JSON.parse(readFileSync(path.join(ROOT, "hooks/hooks.json"), "utf8"));
    assert(!("PreToolUse" in cc.hooks), "gate PreToolUse moved to osuperpowers");
  });

  check("validate router hook scripts executable", () => {
    for (const f of ["bin/prompt-expansion.mjs", "bin/cursor-detect.mjs", "bin/cursor-enforce.mjs"]) {
      assert(isExecutable(path.join(ROOT, f)), `${f} not executable`);
    }
  });

  check("validate self-check version stamps", () => {
    const version = JSON.parse(readFileSync(path.join(ROOT, ".claude-plugin/plugin.json"), "utf8")).version;
    const cursor = readFileSync(path.join(ROOT, "build/generated/cursor-self-check.mdc"), "utf8");
    const claude = readFileSync(path.join(ROOT, "build/generated/claude-self-check.md"), "utf8");
    assert(cursor.includes(`osuperpowers-router-version: ${version}`), "cursor self-check missing version stamp");
    const m = claude.match(/<!-- osuperpowers-router-version: ([^ ]+) -->/);
    assert(m && m[1] === version, "claude self-check version stamp mismatch");
  });

  console.log("ALL PASS");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
