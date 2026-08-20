/**
 * source.json derivation — "package-as-source".
 *
 * marketplace/source.json is no longer hand-edited. This module derives the
 * marketplace aggregate from first-party package.json `oscaner-plugin` fields
 * (packages/) plus the vendored submodule descriptors (SUBMODULE_PATHS +
 * VENDOR_PLUGINS). Top-level fields ($schema/metadata/owner) are emit
 * constants here.
 *
 * Vendored plugins have no in-repo oscaner-plugin package.json: their
 * name/version/contentRoot/cursor come from the assembly-template constants in
 * publish-vendor.mjs (`ASSEMBLY_TEMPLATE`, the single owner — repo paths are
 * derived here by prefixing `vendors/<name>`), merged with whatever the
 * vendored package.json / .claude-plugin/plugin.json already carry. Versions
 * resolve through the shared `resolveVendorVersion` (plugin.json first,
 * release-tag fallback) so the marketplace declaration always matches what
 * publish-vendor will publish.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, posix } from "node:path";
import { SUBMODULE_PATHS } from "../submodule-tags.mjs";
import {
  assemblyTemplate,
  resolveVendorVersion,
} from "../publish-vendor.mjs";
import { deriveFirstPartyNames } from "./manifests.mjs";

/** Top-level source.json fields — emit constants (never hand-edited). */
export const SOURCE_TOP = {
  $schema: "./source.schema.json",
  name: "oscaner-skills",
  owner: { name: "Oscaner Miao" },
  metadata: {
    description:
      "Personal skill collection: superpowers/mattpocock-skills overrides and standalone skills.",
  },
};

/**
 * Vendored plugin descriptors — the marketplace-specific fields for plugins
 * that live as upstream submodules (no in-repo oscaner-plugin package.json).
 * contentRoot is derived from the assembly template (see deriveVendor), not
 * duplicated here; `cursor` is the marketplace cursor block (wrapper for
 * mattpocock-skills/impeccable, plugin-root for superpowers).
 */
export const VENDOR_PLUGINS = {
  "mattpocock-skills": {
    cursor: {
      displayName: "Matt Pocock Skills",
      skills: "../../vendors/mattpocock-skills/skills",
    },
  },
  impeccable: {
    cursor: {
      displayName: "Impeccable",
      skills: "../../vendors/impeccable/plugin/skills",
    },
  },
  superpowers: {
    cursor: { emitMode: "plugin-root" },
  },
};

/** Stable vendor order in the derived source (insertion order above). */
export const VENDOR_ORDER = Object.keys(VENDOR_PLUGINS);

/** Vendor metadata the vendored files don't carry (claude blocks, missing author). */
const VENDOR_FALLBACK = {
  "mattpocock-skills": {
    author: { name: "Matt Pocock", url: "https://github.com/mattpocock" },
    claude: {
      category: "engineering",
      keywords: ["engineering", "skills", "tdd", "code-review", "grilling"],
    },
  },
  impeccable: {
    claude: {
      category: "design",
      tags: ["design", "frontend", "ui", "ux", "skills", "commands"],
    },
  },
};

/** First-party plugins are plugin-root cursor plugins (generated manifests). */
const FIRST_PARTY_CURSOR = { emitMode: "plugin-root" };

/** Normalize a package.json `repository` field to a bare https URL string. */
function repoUrl(repository) {
  if (typeof repository === "string") return stripVcs(repository);
  if (repository && typeof repository.url === "string") {
    return stripVcs(repository.url);
  }
  return undefined;
}

function stripVcs(url) {
  return url.replace(/^git\+/, "").replace(/\.git$/, "");
}

/** source.schema author must be an object with a name (string → { name }). */
function normalizeAuthor(author) {
  if (typeof author === "string") return { name: author };
  if (author && typeof author === "object" && typeof author.name === "string") {
    return author;
  }
  return undefined;
}

function firstDefined(...vals) {
  return vals.find((v) => v !== undefined && v !== null);
}

/**
 * Derive a vendored plugin entry: assembly-template descriptor + vendored
 * files, with the `.claude-plugin/plugin.json` at contentRoot taking precedence
 * over the submodule-root package.json. contentRoot is the single assembly
 * template prefixed with the repo submodule path; the version goes through the
 * shared `resolveVendorVersion` so the marketplace declaration matches what
 * publish-vendor will publish.
 */
function deriveVendor(root, name) {
  const desc = VENDOR_PLUGINS[name];
  // Guard first: a vendor dir present in vendors/ but missing an assembly
  // template must fail with a clear error (never a bare TypeError on the
  // posix.join dereference below).
  const { contentRoot: templateContentRoot } = assemblyTemplate(name);
  const submodulePath = SUBMODULE_PATHS[name];
  const contentRoot = posix.join(submodulePath, templateContentRoot);
  const readVendorJson = (rel) =>
    existsSync(join(root, rel))
      ? JSON.parse(readFileSync(join(root, rel), "utf8"))
      : {};
  const pkg = readVendorJson(join(submodulePath, "package.json"));
  const manifest = readVendorJson(
    join(contentRoot, ".claude-plugin", "plugin.json"),
  );
  const fallback = VENDOR_FALLBACK[name] ?? {};

  const version = resolveVendorVersion(name, root);
  const description = firstDefined(manifest.description, pkg.description);
  const author = normalizeAuthor(
    firstDefined(manifest.author, pkg.author, fallback.author),
  );
  const repository = repoUrl(
    firstDefined(manifest.repository, pkg.repository, fallback.repository),
  );
  const homepage = firstDefined(
    manifest.homepage,
    pkg.homepage,
    fallback.homepage,
    repository,
  );
  const license = firstDefined(manifest.license, pkg.license, fallback.license);

  const plugin = { name, contentRoot, cursor: desc.cursor };
  if (version !== undefined) plugin.version = version;
  if (description !== undefined) plugin.description = description;
  if (author !== undefined) plugin.author = author;
  if (homepage !== undefined) plugin.homepage = homepage;
  if (repository !== undefined) plugin.repository = repository;
  if (license !== undefined) plugin.license = license;
  if (fallback.claude) plugin.claude = fallback.claude;
  return plugin;
}

/** Derive a first-party plugin entry from its package.json `oscaner-plugin`. */
function deriveFirstParty(root, dirName) {
  const pkgPath = join(root, "packages", dirName, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const osc = pkg["oscaner-plugin"] ?? {};
  const contentRoot = posix.normalize(
    posix.join("packages", dirName, osc.contentRoot ?? "."),
  );
  const author = normalizeAuthor(pkg.author);
  const repository = repoUrl(pkg.repository);

  const plugin = { name: dirName, contentRoot, cursor: FIRST_PARTY_CURSOR };
  if (pkg.version !== undefined) plugin.version = pkg.version;
  if (pkg.description !== undefined) plugin.description = pkg.description;
  if (author !== undefined) plugin.author = author;
  if (pkg.homepage !== undefined) plugin.homepage = pkg.homepage;
  if (repository !== undefined) plugin.repository = repository;
  if (pkg.license !== undefined) plugin.license = pkg.license;
  if (osc.claude !== undefined) plugin.claude = osc.claude;
  if (osc.hooks !== undefined) plugin.hooks = osc.hooks;
  return plugin;
}

/** Derive the full marketplace source document (vendors first, then packages). */
export function deriveSource(root) {
  const firstParty = deriveFirstPartyNames(join(root, "packages"));
  const plugins = [
    ...VENDOR_ORDER.map((name) => deriveVendor(root, name)),
    ...firstParty.map((name) => deriveFirstParty(root, name)),
  ];
  return { ...SOURCE_TOP, plugins };
}
