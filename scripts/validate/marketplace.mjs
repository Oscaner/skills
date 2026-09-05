#!/usr/bin/env node
// scripts/validate/marketplace.mjs — block 6: marketplace validate (moved up from the
// scripts/ root). The four source.json / manifest checks run in-process as a single step
// descriptor; standalone (`node scripts/validate/marketplace.mjs`) executes the same checks.

import Ajv from "ajv";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ajv = new Ajv();

function validateSourceSchemaJson() {
  const source = JSON.parse(
    readFileSync(join(root, "marketplace/source.json"), "utf8"),
  );
  const schema = JSON.parse(
    readFileSync(join(root, "marketplace/source.schema.json"), "utf8"),
  );
  const validate = ajv.compile(schema);
  if (!validate(source)) {
    throw new Error(
      `source.json schema invalid:\n${validate.errors
        .map((e) => `  ${e.instancePath || "/"} ${e.message}`)
        .join("\n")}`,
    );
  }
  console.log("OK — source.json schema");
}

function isPluginRoot(p) {
  return p.cursor?.emitMode === "plugin-root";
}

function validateSourceSchema() {
  const source = JSON.parse(
    readFileSync(join(root, "marketplace/source.json"), "utf8"),
  );

  if (!source.name || !source.owner?.name || !source.metadata?.description) {
    throw new Error("source.json missing required top-level fields");
  }
  if (!Array.isArray(source.plugins) || source.plugins.length === 0) {
    throw new Error("source.json plugins must be non-empty array");
  }

  for (const p of source.plugins) {
    for (const field of ["name", "description", "author", "contentRoot", "cursor"]) {
      if (!p[field]) throw new Error(`${p.name ?? "?"} missing ${field}`);
    }
    if (isPluginRoot(p)) {
      const manifest = join(root, p.contentRoot, ".cursor-plugin/plugin.json");
      if (!existsSync(manifest)) {
        throw new Error(`${p.name} missing plugin-root manifest: ${manifest}`);
      }
    } else {
      if (!p.cursor.displayName || !p.cursor.skills) {
        throw new Error(`${p.name} missing cursor.displayName or cursor.skills`);
      }
      if (typeof p.cursor.skills !== "string") {
        throw new Error(`${p.name} cursor.skills must be string in v1`);
      }
    }
    const contentRoot = join(root, p.contentRoot);
    if (!existsSync(contentRoot)) {
      throw new Error(`${p.name} contentRoot missing: ${contentRoot}`);
    }
  }

  console.log(`OK — source.json (${source.plugins.length} plugins)`);
}

function validateWrapperPaths() {
  const source = JSON.parse(
    readFileSync(join(root, "marketplace/source.json"), "utf8"),
  );

  for (const p of source.plugins) {
    if (isPluginRoot(p)) {
      const wrapperDir = join(root, "cursor-plugins", p.name);
      if (existsSync(wrapperDir)) {
        throw new Error(
          `plugin-root ${p.name} wrapper must be deleted: ${wrapperDir}`,
        );
      }
      const contentRoot = join(root, p.contentRoot);
      const manifest = JSON.parse(
        readFileSync(join(contentRoot, ".cursor-plugin/plugin.json"), "utf8"),
      );
      for (const [field, rel] of [
        ["skills", manifest.skills],
        ["hooks", manifest.hooks],
      ]) {
        if (!rel) continue;
        const abs = resolve(contentRoot, rel);
        if (!existsSync(abs)) {
          throw new Error(`${p.name} plugin-root ${field} missing: ${abs}`);
        }
      }
      continue;
    }

    const wrapperRoot = join(root, "cursor-plugins", p.name);
    for (const [field, rel] of [
      ["skills", p.cursor.skills],
      ["hooks", p.cursor.hooks],
    ]) {
      if (!rel) continue;
      const abs = resolve(wrapperRoot, rel);
      if (!existsSync(abs)) {
        throw new Error(`${p.name} ${field} path missing: ${abs}`);
      }
    }
  }

  console.log("OK — wrapper paths resolve");
}

function validateMarketplaceSources() {
  const source = JSON.parse(
    readFileSync(join(root, "marketplace/source.json"), "utf8"),
  );
  const claude = JSON.parse(
    readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"),
  );
  const cursor = JSON.parse(
    readFileSync(join(root, ".cursor-plugin/marketplace.json"), "utf8"),
  );

  for (const entry of claude.plugins) {
    const dir = join(root, entry.source.replace(/^\.\//, ""));
    if (!existsSync(dir)) {
      throw new Error(`Claude plugin source missing: ${entry.source}`);
    }
  }

  for (const entry of cursor.plugins) {
    const dir = join(root, entry.source);
    if (!existsSync(dir)) {
      throw new Error(`Cursor plugin source missing: ${entry.source}`);
    }
    const plugin = source.plugins.find((p) => p.name === entry.name);
    if (plugin && isPluginRoot(plugin)) {
      const expected = `./${plugin.contentRoot}`;
      if (entry.source !== expected) {
        throw new Error(
          `${entry.name} cursor source want ${expected}, got ${entry.source}`,
        );
      }
    }
  }

  console.log("OK — marketplace plugin sources exist");
}

export const steps = [
  {
    name: "6. marketplace validate",
    run: () => {
      validateSourceSchemaJson();
      validateSourceSchema();
      validateWrapperPaths();
      validateMarketplaceSources();
    },
  },
];

function main(stepsArg = steps) {
  for (const s of stepsArg) {
    try {
      console.log(`== ${s.name} ==`);
      s.run();
      console.log("OK");
    } catch (e) {
      console.error(`== FAIL: ${s.name} ==`);
      console.error(e?.message ?? String(e));
      return 1;
    }
  }
  console.log("ALL PASS");
  return 0;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  Promise.resolve(main())
    .then((code) => process.exit(code != null ? code : 1))
    .catch(() => process.exit(1));
}