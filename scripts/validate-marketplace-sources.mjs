import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
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
}

console.log("OK — marketplace plugin sources exist");
