import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { parseOverridesVersion } from "./lib/version-utils.mjs";

const root = process.cwd();
const source = JSON.parse(
  readFileSync(join(root, "marketplace/source.json"), "utf8"),
);
const superpowersVersion = source.plugins.find(
  (p) => p.name === "superpowers",
)?.version;
if (!superpowersVersion) {
  console.error("superpowers plugin not found in marketplace/source.json");
  process.exit(1);
}

const pkg = JSON.parse(
  readFileSync(join(root, "plugins/superpowers-overrides/package.json"), "utf8"),
);
const parsed = parseOverridesVersion(pkg.version);
const base = parsed?.base ?? "";

if (base === superpowersVersion) {
  console.log("OK — already aligned, skip align changeset");
  process.exit(0);
}

const changesetDir = join(root, ".changeset");
const alignPrefix = "auto-align-";
const alignBody = `Align with superpowers ${superpowersVersion}`;

for (const file of readdirSync(changesetDir)) {
  if (!file.startsWith(alignPrefix) || !file.endsWith(".md")) continue;
  const body = readFileSync(join(changesetDir, file), "utf8");
  if (body.includes(alignBody)) {
    console.log("OK — align changeset already pending");
    process.exit(0);
  }
}

const shortSha = execSync("git rev-parse --short HEAD", {
  encoding: "utf8",
}).trim();
const filename = `${alignPrefix}${shortSha}.md`;
const content = `---
"superpowers-overrides": patch
---

${alignBody}
`;

writeFileSync(join(changesetDir, filename), content);
console.log(`OK — created ${filename}`);
