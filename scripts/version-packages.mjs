import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import getChangesets from "@changesets/read";
import changelogFunctions from "@changesets/changelog-github";
import { computeNextVersion, parseOverridesVersion } from "./lib/version-utils.mjs";

const root = process.cwd();
const pkgPath = join(root, "superpowers-overrides/package.json");
const changelogPath = join(root, "superpowers-overrides/CHANGELOG.md");
const changesetDir = join(root, ".changeset");

const changesets = await getChangesets(root);
if (changesets.length === 0) {
  console.log("No changesets — skip version");
  process.exit(0);
}

const marketplace = JSON.parse(
  readFileSync(join(root, "marketplace/source.json"), "utf8"),
);
const superpowersVersion = marketplace.plugins.find(
  (p) => p.name === "superpowers",
)?.version;
if (!superpowersVersion) {
  throw new Error("superpowers plugin not found in marketplace/source.json");
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const currentVersion = pkg.version;

const nextVersion = !existsSync(changelogPath)
  ? `${superpowersVersion}-overrides.1`
  : computeNextVersion(currentVersion, superpowersVersion);

const parsed = parseOverridesVersion(currentVersion);
const baseReset =
  parsed !== null &&
  parsed.base !== superpowersVersion &&
  nextVersion.endsWith("-overrides.1");

const changelogOptions = { repo: "Oscaner/skills" };
const releaseLines = [];

if (baseReset) {
  releaseLines.push(`\n- Align with superpowers ${superpowersVersion}`);
}

for (const cs of changesets) {
  if (baseReset && cs.id.startsWith("auto-align-")) continue;
  const line = await changelogFunctions.getReleaseLine(
    cs,
    "patch",
    changelogOptions,
  );
  releaseLines.push(line);
}

const header = "# superpowers-overrides\n\n";
const newEntry = `## ${nextVersion}\n\n### Patch Changes${releaseLines.join("")}\n\n`;

if (!existsSync(changelogPath)) {
  writeFileSync(changelogPath, header + newEntry);
} else {
  const existing = readFileSync(changelogPath, "utf8");
  if (!existing.startsWith(header)) {
    throw new Error("Unexpected CHANGELOG format");
  }
  writeFileSync(changelogPath, header + newEntry + existing.slice(header.length));
}

pkg.version = nextVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

for (const cs of changesets) {
  unlinkSync(join(changesetDir, `${cs.id}.md`));
}

execSync("node scripts/sync-manifest-versions.mjs", {
  stdio: "inherit",
  cwd: root,
});

console.log(`OK — version ${nextVersion}`);
