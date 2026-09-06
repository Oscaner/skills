#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync, existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import getChangesets from "@changesets/read";
import changelogFunctions from "@changesets/changelog-github";
import {
  computeNextIndependentVersion,
  highestBumpLevel,
  changesetsForPlugin,
} from "../lib/version-utils.mjs";

const root = process.cwd();
const changesetDir = join(root, ".changeset");

/**
 * Apply changesets to bump versions (`node scripts/run.mjs version [--dry-run]`).
 * Preserves the existing `--dry-run` semantics: unknown arguments abort before
 * any versioning (previous footgun — silently ignored args ran a real version).
 * @returns {number} exit code (0 = ok, 1 = usage error)
 */
export async function main({ dryRun } = {}) {
  // ---- CLI args: argv carries the "version" subcommand prefix under run.mjs
  // dispatch but not in direct runs. The forwarded commander option (when
  // present) is authoritative; the argv read only covers the isMain direct
  // run, which passes no options. ----
  const args = process.argv.slice(2);
  const argv = args[0] === "version" ? args.slice(1) : args;
  const DRY = dryRun ?? argv.includes("--dry-run");
  const unknownArgs = argv.filter((a) => a !== "--dry-run");
  if (unknownArgs.length > 0) {
    process.stderr.write(`usage: run.mjs version [--dry-run]\n`);
    process.stderr.write(`unknown argument(s): ${unknownArgs.join(", ")}\n`);
    return 1;
  }

  const changesets = await getChangesets(root);
  if (changesets.length === 0) {
    console.log("No changesets — skip version");
    return 0;
  }

  const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));
  const writeJson = (rel, data) => {
    if (DRY) {
      console.log(`  [dry-run] write ${rel}: version → ${data.version}`);
      return;
    }
    writeFileSync(join(root, rel), JSON.stringify(data, null, 2) + "\n");
  };

  /** Prepend a new release entry under a fixed header, preserving the rest. */
  function prependChangelog(header, entry, changelogPath) {
    if (DRY) {
      console.log(`  [dry-run] prepend changelog ${changelogPath.replace(`${root}/`, "")}:`);
      console.log((header + entry).trimEnd());
      console.log("");
      return;
    }
    if (!existsSync(changelogPath)) {
      writeFileSync(changelogPath, header + entry);
      return;
    }
    const existing = readFileSync(changelogPath, "utf8");
    if (!existing.startsWith(header)) {
      throw new Error("Unexpected CHANGELOG format");
    }
    writeFileSync(changelogPath, header + entry + existing.slice(header.length));
  }

  const marketplace = readJson("marketplace/source.json");
  const superpowersVersion = marketplace.plugins.find(
    (p) => p.name === "superpowers",
  )?.version;
  if (!superpowersVersion) {
    throw new Error("superpowers plugin not found in marketplace/source.json");
  }

  const changelogOptions = { repo: "Oscaner/skills" };

  // ---- osuperpowers (independent semver) ----
  const osuperpowersPkgPath = "packages/osuperpowers/package.json";
  const osuperpowersChangelogPath = join(root, "packages/osuperpowers/CHANGELOG.md");
  const osuperpowersCS = changesetsForPlugin(
    changesets,
    "@oscaner-skills/osuperpowers",
  );
  if (osuperpowersCS.length > 0) {
    const osuperpowersPkg = readJson(osuperpowersPkgPath);
    const osuperpowersTypes = osuperpowersCS.map(
      (cs) => cs.releases.find((r) => r.name === "@oscaner-skills/osuperpowers").type,
    );
    const bumpLevel = highestBumpLevel(osuperpowersTypes);
    const osuperpowersNext = computeNextIndependentVersion(osuperpowersPkg.version, bumpLevel);

    const sections = [];
    for (const type of ["major", "minor", "patch"]) {
      const typed = osuperpowersCS.filter(
        (cs) =>
          cs.releases.find((r) => r.name === "@oscaner-skills/osuperpowers").type ===
          type,
      );
      if (typed.length === 0) continue;
      const lines = [];
      for (const cs of typed) {
        lines.push(
          await changelogFunctions.getReleaseLine(cs, type, changelogOptions),
        );
      }
      const title = `${type[0].toUpperCase()}${type.slice(1)} Changes`;
      sections.push(`### ${title}${lines.join("")}\n\n`);
    }
    const osuperpowersHeader = "# osuperpowers\n\n";
    const osuperpowersEntry = `## ${osuperpowersNext}\n\n${sections.join("")}`;
    prependChangelog(osuperpowersHeader, osuperpowersEntry, osuperpowersChangelogPath);

    osuperpowersPkg.version = osuperpowersNext;
    writeJson(osuperpowersPkgPath, osuperpowersPkg);

    // Sync osuperpowers version to the init self-check stamp (the only SOT outside
    // package.json besides the manifest and derived emit products). SKILL.md holds
    // the version marker, so only SKILL.md is synced here.
    // marketplace/source.json and the per-harness manifests are derived emit products
    // — the emit re-derives them from package.json, so no direct source.json write.
    for (const initPath of [
      "packages/osuperpowers/skills/init/SKILL.md",
    ]) {
      const init = readFileSync(join(root, initPath), "utf8");
      const stamped = init.replace(
        /<!-- osuperpowers-version: [^ ]+ -->/,
        `<!-- osuperpowers-version: ${osuperpowersNext} -->`,
      );
      if (stamped === init) {
        throw new Error(`${initPath} missing osuperpowers-version stamp`);
      }
      if (DRY) {
        console.log(`  [dry-run] stamp ${initPath} → osuperpowers-version ${osuperpowersNext}`);
        continue;
      }
      writeFileSync(join(root, initPath), stamped);
    }
  }

  // ---- record which plugins were actually versioned (release workflow) ----
  // release.yml's per-plugin matrix job reads this to skip plugins that had no
  // changesets — otherwise it would mint a phantom baseline tag/release for
  // osuperpowers@0.1.0 on the first publish. Written under .changeset/ so the
  // Version PR commits it alongside the version bumps; it persists into the
  // publish-mode push that follows the Version PR merge.
  const versioned = [];
  if (osuperpowersCS.length > 0) {
    versioned.push("osuperpowers");
  }
  if (DRY) {
    console.log(`  [dry-run] write .changeset/versioned-plugins.json: ${versioned.join(", ")}`);
  } else {
    writeFileSync(
      join(root, ".changeset/versioned-plugins.json"),
      JSON.stringify(versioned, null, 2) + "\n",
    );
  }

  // ---- cleanup consumed changesets ----
  if (DRY) {
    const consumed = changesets.map((cs) => `${cs.id}.md`).join(", ");
    console.log(`  [dry-run] would consume changesets: ${consumed}`);
  } else {
    for (const cs of changesets) {
      unlinkSync(join(changesetDir, `${cs.id}.md`));
    }
  }

  console.log(DRY ? "OK — would version (dry-run, nothing written)" : "OK — versioned");
  return 0;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  Promise.resolve(main())
    .then((code) => process.exit(code != null ? code : 0))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}