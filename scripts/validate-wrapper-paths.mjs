import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const source = JSON.parse(
  readFileSync(join(root, "marketplace/source.json"), "utf8"),
);

for (const p of source.plugins) {
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
