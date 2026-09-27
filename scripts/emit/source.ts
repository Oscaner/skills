/**
 * source.json derivation — "package-as-source". SourceService domain service (Task 9,
 * Criterion ②: stateless service, zero bare-function module).
 *
 * marketplace/source.json is no longer hand-edited. This module derives the
 * marketplace aggregate from first-party package.json `oscaner-plugin` fields
 * (packages/). Top-level fields ($schema/metadata/owner) are emit constants
 * here (SOURCE_TOP — a typed carrier, Criterion ⑥).
 *
 * The vendored submodule descriptors were retired with the self-maintenance
 * surface (P6 Task 2 / B9): no `vendors/` assembly, no `resolveVendorVersion`
 * — the marketplace is first-party only.
 */

import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { manifestService } from "./manifests.ts";

/** Top-level source.json fields — emit constants (never hand-edited). */
export const SOURCE_TOP = {
  $schema: "./source.schema.json",
  name: "oscaner-skills",
  owner: { name: "Oscaner Miao" },
  metadata: {
    description:
      "Personal skill collection: superpowers/mattpocock-skills overrides and standalone skills.",
  },
} as const;

export class SourceService {
  /** Derive the full marketplace source document (first-party packages only). */
  derive(root) {
    const firstParty = manifestService.deriveFirstPartyNames(join(root, "packages"));
    const plugins = firstParty.map((name) => this.#deriveFirstParty(root, name));
    return { ...SOURCE_TOP, plugins };
  }

  /** Derive a first-party plugin entry from its package.json `oscaner-plugin`. */
  #deriveFirstParty(root, dirName) {
    const pkgPath = join(root, "packages", dirName, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const osc = pkg["oscaner-plugin"] ?? {};
    const contentRoot = posix.normalize(posix.join("packages", dirName, osc.contentRoot ?? "."));
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
}

export const sourceService = new SourceService();

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
