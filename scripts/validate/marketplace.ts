#!/usr/bin/env node

// scripts/validate/marketplace.ts — block 6: marketplace validate (moved up from the
// scripts/ root). The four source.json / manifest checks run in-process as a single step
// descriptor with the new harness-registry consistency guard (C5); standalone
// (`node scripts/validate/marketplace.ts`) executes the same checks.
//
// This is validate's first consumption of scripts/lib: the consistency guard must
// compare the package declarations against the real registry (a blind read of the
// emitted products would be a meaningless surface check). The layering here is
// "product reader + registry-contract consumer", not the pure product reader the
// block used to be.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

import { deriveFirstPartyNames } from "../lib/first-party.ts";
import { harnessRegistry } from "../lib/harness-registry.ts";
import { CheckBlock, validateRunner } from "./runner.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ajv = new Ajv();

function validateSourceSchemaJson() {
  const source = JSON.parse(readFileSync(join(root, "marketplace/source.json"), "utf8"));
  const schema = JSON.parse(readFileSync(join(root, "marketplace/source.schema.json"), "utf8"));
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
  const source = JSON.parse(readFileSync(join(root, "marketplace/source.json"), "utf8"));

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
  const source = JSON.parse(readFileSync(join(root, "marketplace/source.json"), "utf8"));

  for (const p of source.plugins) {
    if (isPluginRoot(p)) {
      const wrapperDir = join(root, "cursor-plugins", p.name);
      if (existsSync(wrapperDir)) {
        throw new Error(`plugin-root ${p.name} wrapper must be deleted: ${wrapperDir}`);
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
  const source = JSON.parse(readFileSync(join(root, "marketplace/source.json"), "utf8"));
  const claude = JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"));
  const cursor = JSON.parse(readFileSync(join(root, ".cursor-plugin/marketplace.json"), "utf8"));

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
        throw new Error(`${entry.name} cursor source want ${expected}, got ${entry.source}`);
      }
    }
  }

  console.log("OK — marketplace plugin sources exist");
}

export function validateHarnessRegistryConsistency(packagesRoot) {
  const names = deriveFirstPartyNames(packagesRoot);
  const declarations = {};

  // ① Every declared harness id must resolve in the registry — an unknown id is a
  //    structured fail (package name + id + the expected id set).
  for (const pkgName of names) {
    const pkg = JSON.parse(readFileSync(join(packagesRoot, pkgName, "package.json"), "utf8"));
    const declared = pkg.oscaner?.harnesses ?? [];
    if (!Array.isArray(declared)) {
      throw new Error(`Package "${pkgName}" must declare oscaner.harnesses as an array`);
    }
    declarations[pkgName] = declared;
    for (const id of declared) {
      try {
        harnessRegistry.resolve(id, pkgName);
      } catch {
        const expected = harnessRegistry
          .all()
          .map((h) => h.id)
          .join(", ");
        throw new Error(
          `Package "${pkgName}" declares unknown harness id "${id}" (expected one of: ${expected})`,
        );
      }
    }
  }

  // ② Bidirectional wiring guard — a registry row no package declares is a defect
  //    (registering a harness without wiring it would stay silent otherwise).
  harnessRegistry.assertBidirectional(declarations);

  // ③ Every declared emit-harness product must exist on disk under the package
  //    content root (pi — an inline distribution with no product — is skipped).
  for (const pkgName of names) {
    const pkg = JSON.parse(readFileSync(join(packagesRoot, pkgName, "package.json"), "utf8"));
    const contentRoot = pkg.oscaner?.contentRoot ?? ".";
    for (const id of pkg.oscaner?.harnesses ?? []) {
      const h = harnessRegistry.resolve(id);
      if (h.product) {
        const abs = join(packagesRoot, pkgName, contentRoot, h.product.rel);
        if (!existsSync(abs)) {
          throw new Error(
            `Package "${pkgName}" declares emit-harness "${h.id}" but its product is missing: ${abs}`,
          );
        }
      }
    }
  }

  console.log(
    `OK — harness registry consistency (${names.length} first-party packages, ${Object.keys(declarations).length} declarations)`,
  );
}

// Single in-process step, not a `node scripts/validate/marketplace.ts` subprocess
// (plan Step 2's literal form): a run() that spawned this very module would recurse
// infinitely on standalone execution — main() here IS this module's main. In-process
// keeps suite and standalone paths byte-identical.
export const steps = [
  new CheckBlock({
    name: "marketplace manifests validate",
    run: () => {
      validateSourceSchemaJson();
      validateSourceSchema();
      validateWrapperPaths();
      validateMarketplaceSources();
    },
  }),
  new CheckBlock({
    name: "emit harness registry consistency",
    run: () => validateHarnessRegistryConsistency(join(root, "packages")),
  }),
];

validateRunner.runIfMain(import.meta.url, steps);
