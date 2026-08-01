import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const pkg = JSON.parse(
  readFileSync(join(root, "plugins/superpowers-overrides/package.json"), "utf8"),
);
const version = pkg.version;

const pluginPath = join(
  root,
  "plugins/superpowers-overrides/.claude-plugin/plugin.json",
);
const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
plugin.version = version;
writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");

const sourcePath = join(root, "marketplace/source.json");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const entry = source.plugins.find((p) => p.name === "superpowers-overrides");
if (!entry) {
  throw new Error("superpowers-overrides not in marketplace/source.json");
}
entry.version = version;
writeFileSync(sourcePath, JSON.stringify(source, null, 2) + "\n");

execSync("pnpm run emit", { stdio: "inherit", cwd: root });

const pluginRoot = join(root, "plugins/superpowers-overrides");
const generatedCursor = join(
  pluginRoot,
  "build/generated/cursor-self-check.mdc",
);
const generatedClaude = join(
  pluginRoot,
  "build/generated/claude-self-check.md",
);
const deployCursor = join(root, ".cursor/rules/superpowers-overrides.mdc");
const claudePath = join(root, "CLAUDE.md");

const cursorCanonical = readFileSync(generatedCursor, "utf8");
const claudeCanonical = readFileSync(generatedClaude, "utf8");

mkdirSync(dirname(deployCursor), { recursive: true });
writeFileSync(deployCursor, cursorCanonical);

const claude = readFileSync(claudePath, "utf8");
const lines = claude.split("\n");

let start = 0;
if (lines[0]?.startsWith("<!-- superpowers-overrides-version:")) {
  start = 0;
} else {
  const idx = lines.findIndex((l) =>
    l.startsWith("## superpowers-overrides self-check"),
  );
  if (idx === -1) {
    throw new Error(
      `${claudePath}: no superpowers-overrides self-check block found`,
    );
  }
  start = idx;
}

const end = lines.findIndex((l) => l === "# CLAUDE.md");
if (end === -1) {
  throw new Error(`${claudePath}: missing '# CLAUDE.md' heading`);
}

const rest = lines.slice(end).join("\n");
const merged = `${claudeCanonical.trimEnd()}\n\n${rest}`;
writeFileSync(claudePath, merged);

console.log(`OK — synced ${version}`);
