import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
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
  if (!p.cursor.displayName || !p.cursor.skills) {
    throw new Error(`${p.name} missing cursor.displayName or cursor.skills`);
  }
  if (typeof p.cursor.skills !== "string") {
    throw new Error(`${p.name} cursor.skills must be string in v1`);
  }
  const contentRoot = join(root, p.contentRoot);
  if (!existsSync(contentRoot)) {
    throw new Error(`${p.name} contentRoot missing: ${contentRoot}`);
  }
}

console.log(`OK — source.json (${source.plugins.length} plugins)`);
