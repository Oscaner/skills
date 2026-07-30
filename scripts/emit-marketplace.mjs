import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdtempSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import {
  readSource,
  resolveVersion,
  claudeMarketplaceEntry,
  cursorWrapperManifest,
  assertCursorPathsExist,
  assertPrereleasePrefix,
  claudeMarketplaceDocument,
  cursorMarketplaceDocument,
  repoRootFromImportMeta,
} from "./lib/marketplace-utils.mjs";

const root = repoRootFromImportMeta(import.meta.url);
const checkMode = process.argv.includes("--check");

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function emitAll(outRoot) {
  const source = readSource(root);
  assertPrereleasePrefix(root, source);

  const claudePlugins = [];
  const cursorMarketplacePlugins = [];

  for (const plugin of source.plugins) {
    const resolved = resolveVersion(root, plugin);
    assertCursorPathsExist(root, plugin);

    claudePlugins.push(claudeMarketplaceEntry(plugin, resolved));

    cursorMarketplacePlugins.push({
      _generated: "scripts/emit-marketplace.mjs — do not edit",
      name: plugin.name,
      source: `cursor-plugins/${plugin.name}`,
      description: plugin.description,
    });

    const wrapperDir = join(
      outRoot,
      "cursor-plugins",
      plugin.name,
      ".cursor-plugin",
    );
    mkdirSync(wrapperDir, { recursive: true });
    writeJson(
      join(wrapperDir, "plugin.json"),
      cursorWrapperManifest(plugin, resolved),
    );
  }

  mkdirSync(join(outRoot, ".claude-plugin"), { recursive: true });
  mkdirSync(join(outRoot, ".cursor-plugin"), { recursive: true });

  writeJson(
    join(outRoot, ".claude-plugin/marketplace.json"),
    claudeMarketplaceDocument(source, claudePlugins),
  );
  writeJson(
    join(outRoot, ".cursor-plugin/marketplace.json"),
    cursorMarketplaceDocument(source, cursorMarketplacePlugins),
  );
}

function compareTrees(generatedRoot) {
  const paths = [
    ".claude-plugin/marketplace.json",
    ".cursor-plugin/marketplace.json",
    ...readSource(root).plugins.flatMap((p) => [
      `cursor-plugins/${p.name}/.cursor-plugin/plugin.json`,
    ]),
  ];

  for (const rel of paths) {
    const committed = join(root, rel);
    const generated = join(generatedRoot, rel);
    if (!existsSync(committed)) {
      console.error(`MISSING committed file: ${rel}`);
      process.exit(1);
    }
    if (!existsSync(generated)) {
      console.error(`MISSING generated file: ${rel}`);
      process.exit(1);
    }
    try {
      execSync(`diff -u "${committed}" "${generated}"`, { stdio: "pipe" });
    } catch (e) {
      console.error(`DRIFT: ${rel}\n${e.stdout?.toString() ?? ""}`);
      process.exit(1);
    }
  }
  console.log("OK — marketplace emit fresh");
}

if (checkMode) {
  const tempRoot = mkdtempSync(join(tmpdir(), "marketplace-emit-"));
  try {
    emitAll(tempRoot);
    compareTrees(tempRoot);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
} else {
  emitAll(root);
  console.log("OK — emitted marketplace manifests");
}
