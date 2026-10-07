// scripts/emit.ts — the single emit orchestrator. ONE stateless domain
// service derives the first-party marketplace + harness manifests from
// `packages/<name>/package.json#oscaner` (package-as-source) and renders the
// .github issue forms from the engine's canonical issue-body template. The
// orchestrator folds the old emit tree's thin wrapper modules into one module:
// the product writer, the derivation and the drift comparer live here. The
// committed products are byte-stable — the products scripts emits are
// byte-identical to the current converged emit (the banner watermark is the
// canonical `scripts/run.ts emit — do not edit` face).
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions besides the declared data derivation helpers.

import type { Dirent } from "node:fs";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import type { OscanerFields, PluginSource } from "./lib/first-party.ts";
import { firstPartyNames } from "./lib/first-party.ts";

/** The repo root — the emit's derivation base. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The generated watermark — the committed `_generated` banner (byte-stable). */
export const GENERATED_BANNER = "scripts/run.ts emit — do not edit";

/** The source.json top-level fields — emit constants (never hand-edited). */
const SOURCE_TOP = {
  $schema: "./source.schema.json",
  name: "oscaner-skills",
  owner: { name: "Oscaner Miao" },
  metadata: {
    description:
      "Personal skill collection: superpowers/mattpocock-skills overrides and standalone skills.",
  },
} as const;

/** The fully-owned product roots — every file inside is generator output (the stale
 *  walk's base set; the cursor wrapper roots fold in per run). */
export const BASE_PRODUCT_ROOTS = [
  ".claude-plugin",
  ".cursor-plugin",
  "packages/kairos/.claude-plugin",
  "packages/kairos/.cursor-plugin",
] as const;

/** The standalone product files — not inside a product root (stale-walk inventory). */
export const PRODUCT_FILES = [
  "marketplace/source.json",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/enhancement.yml",
] as const;

/**
 * EmitService — the single emit orchestrator. `emitAll(outRoot, { generatedPaths })`
 * writes the full product set into an output root (the repo root in write mode, a
 * temp tree in check mode), recording every repo-relative path produced.
 */
export class EmitService {
  /** Write a text product into `outRoot` (mkdir -p the parent) + record it. */
  writeText(outRoot: string, rel: string, content: string, generatedPaths: string[]): void {
    const p = join(outRoot, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content, "utf8");
    generatedPaths.push(rel);
  }

  /** `writeText` for JSON documents (pretty-printed + trailing newline). */
  writeJsonDoc(outRoot: string, rel: string, data: unknown, generatedPaths: string[]): void {
    this.writeText(outRoot, rel, `${JSON.stringify(data, null, 2)}\n`, generatedPaths);
  }

  /** Derive the full marketplace source document (first-party packages only). */
  deriveSourceDoc(): {
    $schema: string;
    name: string;
    owner: { name: string };
    metadata: { description: string };
    plugins: PluginSource[];
  } {
    const { $schema, name, owner, metadata } = SOURCE_TOP;
    const plugins = firstPartyNames(join(REPO_ROOT, "packages")).map((dirName) =>
      deriveFirstPartyPlugin(REPO_ROOT, dirName),
    );
    return { $schema, name, owner: { ...owner }, metadata: { ...metadata }, plugins };
  }

  /** One plugin's per-harness manifest (claude / cursor) — the harnesses declared by
   *  the package's `oscaner.harnesses`, resolved against the harness set. */
  pluginManifests(plugin: PluginSource): Array<{ rel: string; doc: unknown }> {
    const pkgPath = join(REPO_ROOT, plugin.contentRoot, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { oscaner?: OscanerFields };
    const declared = pkg.oscaner?.harnesses ?? [];
    const out: Array<{ rel: string; doc: unknown }> = [];
    if (declared.includes("claude")) {
      out.push({
        rel: `${plugin.contentRoot}/.claude-plugin/plugin.json`,
        doc: claudeManifest(plugin),
      });
    }
    if (declared.includes("cursor")) {
      out.push({
        rel: `${plugin.contentRoot}/.cursor-plugin/plugin.json`,
        doc: cursorManifest(plugin),
      });
    }
    return out;
  }

  /**
   * The full emit product set into `outRoot`: per-plugin manifests, the repo-root
   * marketplace documents, the issue-template forms and the derived source.json.
   */
  emitAll(outRoot: string, { generatedPaths }: { generatedPaths: string[] }): void {
    const source = this.deriveSourceDoc();
    for (const plugin of source.plugins) {
      for (const { rel, doc } of this.pluginManifests(plugin)) {
        this.writeJsonDoc(outRoot, rel, doc, generatedPaths);
      }
    }
    this.writeJsonDoc(outRoot, "marketplace/source.json", source, generatedPaths);
    this.writeJsonDoc(
      outRoot,
      ".claude-plugin/marketplace.json",
      claudeMarketplaceDoc(source),
      generatedPaths,
    );
    this.writeJsonDoc(
      outRoot,
      ".cursor-plugin/marketplace.json",
      cursorMarketplaceDoc(source),
      generatedPaths,
    );
    this.writeIssueTemplates(outRoot, generatedPaths);
  }

  /** The .github/ISSUE_TEMPLATE forms — rendered from the canonical issue-body.json
   *  (the engine's shipped template — the repo governance reads the engine's
   *  canonical data one-way; the form field definitions live solely in that file). */
  writeIssueTemplates(outRoot: string, generatedPaths: string[]): void {
    const meta = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "packages", "cdd-engine", "templates", "report", "issue-body.json"),
        "utf8",
      ),
    ) as { components?: unknown; formFieldDefs: Record<string, unknown> };
    for (const name of Object.keys(meta.formFieldDefs)) {
      const rel = `.github/ISSUE_TEMPLATE/${name}.yml`;
      this.writeText(
        outRoot,
        rel,
        renderIssueYml(meta.formFieldDefs[name], { components: meta.components }),
        generatedPaths,
      );
    }
  }

  /** Detect committed product files the generator no longer produces (stale). */
  findStaleCommittedFiles(generatedSet: Set<string>, root: string): string[] {
    const stale: string[] = [];
    for (const rootRel of BASE_PRODUCT_ROOTS) {
      for (const rel of walkProductRoot(root, rootRel)) {
        if (!generatedSet.has(rel)) stale.push(rel);
      }
    }
    for (const rel of PRODUCT_FILES) {
      if (existsSync(join(root, rel)) && !generatedSet.has(rel)) stale.push(rel);
    }
    return stale;
  }
}

/** Derive one first-party plugin entry (the source.json plugin row key order is
 *  byte-pinned: name · contentRoot · cursor · version · description · author ·
 *  homepage · repository · license · claude · hooks). */
function deriveFirstPartyPlugin(root: string, dirName: string): PluginSource {
  const pkgPath = join(root, "packages", dirName, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    oscaner?: OscanerFields;
    version?: string;
    description?: string;
    author?: unknown;
    homepage?: string;
    repository?: unknown;
    license?: string;
  };
  const osc = pkg.oscaner ?? {};
  const contentRoot = posix.normalize(posix.join("packages", dirName, osc.contentRoot ?? "."));
  const row: Record<string, unknown> = { name: dirName, contentRoot };
  if (osc.harnesses?.includes("cursor") === true) {
    row.cursor = { emitMode: "plugin-root" };
  }
  if (pkg.version !== undefined) row.version = pkg.version;
  if (pkg.description !== undefined) row.description = pkg.description;
  const author = normalizeAuthor(pkg.author);
  if (author !== undefined) row.author = author;
  const repository = repoUrl(pkg.repository);
  if (pkg.homepage !== undefined) row.homepage = pkg.homepage;
  if (repository !== undefined) row.repository = repository;
  if (pkg.license !== undefined) row.license = pkg.license;
  if (osc.claude !== undefined)
    row.claude = { ...osc.claude, keywords: osc.keywords ?? osc.claude.keywords };
  if (osc.hooks !== undefined) row.hooks = osc.hooks;
  return row as unknown as PluginSource;
}

/** Normalize a package.json `author` to an object with a name (string → { name }). */
function normalizeAuthor(author: unknown): { name: string; email?: string } | string | undefined {
  if (typeof author === "string") return { name: author };
  if (author !== null && typeof author === "object" && "name" in author) {
    const name = (author as { name?: unknown }).name;
    if (typeof name === "string") return author as { name: string; email?: string };
  }
  return undefined;
}

/** Normalize a `repository` field to a bare https URL string. */
function repoUrl(repository: unknown): string | undefined {
  if (typeof repository === "string") return stripVcs(repository);
  if (repository !== null && typeof repository === "object" && "url" in repository) {
    const url = (repository as { url?: unknown }).url;
    if (typeof url === "string") return stripVcs(url);
  }
  return undefined;
}

function stripVcs(url: string): string {
  return url.replace(/^git\+/, "").replace(/\.git$/, "");
}

/** The claude manifest — the thin plugin doc (`skills` points at the canonical dir). */
function claudeManifest(plugin: PluginSource): Record<string, unknown> {
  const m: Record<string, unknown> = {
    _generated: GENERATED_BANNER,
    name: plugin.name,
    description: plugin.description,
    version: plugin.version,
    author: plugin.author,
  };
  m.skills = "./skills/";
  const claudeHooks =
    (plugin.hooks as { claude?: string } | undefined)?.claude ?? "./hooks/hooks.json";
  if (claudeHooks !== "./hooks/hooks.json") m.hooks = claudeHooks;
  if (plugin.license !== undefined) m.license = plugin.license;
  if (plugin.claude?.category !== undefined) m.category = plugin.claude.category;
  const kw = plugin.claude?.keywords ?? [];
  if (kw.length > 0) m.keywords = kw;
  return m;
}

/** The cursor manifest — thin (displayName = the cursor display name or the plugin name). */
function cursorManifest(plugin: PluginSource): Record<string, unknown> {
  const cursor = plugin.cursor;
  const displayName =
    cursor !== undefined && "displayName" in cursor && typeof cursor.displayName === "string"
      ? cursor.displayName
      : plugin.name;
  const m: Record<string, unknown> = {
    _generated: GENERATED_BANNER,
    name: plugin.name,
    displayName,
    description: plugin.description,
    version: plugin.version,
    author: plugin.author,
  };
  if (plugin.license !== undefined) m.license = plugin.license;
  const kw = plugin.claude?.keywords ?? [];
  if (kw.length > 0) m.keywords = kw;
  m.skills = "./skills/";
  return m;
}

/** The repo-root claude marketplace document + its per-plugin entries. */
function claudeMarketplaceDoc(source: {
  name: string;
  owner: object;
  metadata: object;
  plugins: PluginSource[];
}): Record<string, unknown> {
  return {
    _generated: GENERATED_BANNER,
    $schema: "https://www.schemastore.org/claude-code-marketplace.json",
    name: source.name,
    metadata: source.metadata,
    owner: source.owner,
    plugins: source.plugins.map((plugin) => claudeMarketplaceEntry(plugin)),
  };
}

/** One claude marketplace entry — source points at the plugin content root (the
 *  `./`-prefixed plugin-root form). */
function claudeMarketplaceEntry(plugin: PluginSource): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    name: plugin.name,
    source: `./${plugin.contentRoot}`,
    description: plugin.description,
    author: plugin.author,
    homepage: plugin.homepage,
    repository: plugin.repository,
    license: plugin.license,
    version: plugin.version,
  };
  if (plugin.claude?.category !== undefined) entry.category = plugin.claude.category;
  const kw = plugin.claude?.keywords ?? [];
  if (kw.length > 0) entry.keywords = kw;
  return entry;
}

/** The repo-root cursor marketplace document + its per-plugin entries (plugin-root
 *  ships the contentRoot source form). */
function cursorMarketplaceDoc(source: {
  name: string;
  owner: object;
  metadata: object;
  plugins: PluginSource[];
}): Record<string, unknown> {
  return {
    _generated: GENERATED_BANNER,
    name: source.name,
    owner: source.owner,
    metadata: source.metadata,
    plugins: source.plugins.map((plugin) => ({
      _generated: GENERATED_BANNER,
      name: plugin.name,
      source: isPluginRoot(plugin) ? `./${plugin.contentRoot}` : `cursor-plugins/${plugin.name}`,
      description: plugin.description,
    })),
  };
}

/** Whether a plugin ships plugin-root cursor manifests (`oscaner.harnesses` includes
 *  cursor — the first-party emit mode). */
function isPluginRoot(plugin: PluginSource): boolean {
  return (
    plugin.cursor !== undefined &&
    "emitMode" in plugin.cursor &&
    plugin.cursor.emitMode === "plugin-root"
  );
}

/** The issue-form YAML rendering — the `yaml` package (root devDependency), the
 *  emit-side renderer (the shipped engine imports zero third-party packages). */
function renderIssueYml(formDef: unknown, enums: { components?: unknown }): string {
  const { frontmatter, body } = formDef as {
    frontmatter: { name?: string; description?: string; labels?: string[] };
    body: Array<Record<string, unknown>>;
  };
  const doc: Record<string, unknown> = {
    name: frontmatter.name,
    description: frontmatter.description,
    labels: frontmatter.labels,
    body: body.map((item) => {
      const entry: Record<string, unknown> = { type: item.type };
      const typed = item as {
        id?: string;
        attributes?: Record<string, unknown>;
        validations?: { required?: unknown };
      };
      if (typed.id !== undefined) entry.id = typed.id;
      const attributes = { ...typed.attributes };
      if (item.type === "dropdown" && typed.id === "component")
        attributes.options = enums.components;
      entry.attributes = attributes;
      if (typed.validations?.required !== undefined)
        entry.validations = { required: typed.validations.required };
      return entry;
    }),
  };
  return stringify(doc, { indent: 2, lineWidth: 0 });
}

/** Recursively walk a product root collecting repo-relative file paths. */
function walkProductRoot(root: string, rootRel: string): string[] {
  const out: string[] = [];
  const base = join(root, rootRel);
  const visit = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) visit(p);
      else if (entry.isFile()) out.push(relative(root, p));
    }
  };
  if (existsSync(base)) visit(base);
  return out;
}

/** The emit service singleton — the two orchestrators' shared emit face. */
export const emitService = new EmitService();

/**
 * EmitComparer — the drift check: diff every generated path between the committed
 * tree and a freshly generated tree byte-identically, flag stale committed products.
 */
export class EmitComparer {
  compareTrees(
    committedRoot: string,
    generatedRoot: string,
    { generatedPaths }: { generatedPaths: string[] },
  ): void {
    const generatedSet = new Set(generatedPaths);
    for (const rel of generatedPaths) {
      const committed = join(committedRoot, rel);
      const generated = join(generatedRoot, rel);
      if (!existsSync(committed)) {
        throw new Error(`MISSING committed file: ${rel} — run the emit orchestrator`);
      }
      if (!existsSync(generated)) {
        throw new Error(`MISSING generated file: ${rel}`);
      }
      const committedBytes = readFileSync(committed, "utf8");
      const generatedBytes = readFileSync(generated, "utf8");
      if (committedBytes !== generatedBytes) {
        throw new Error(`DRIFT: ${rel} — committed product differs from the fresh generation`);
      }
    }
    const stale = emitService.findStaleCommittedFiles(generatedSet, committedRoot);
    if (stale.length > 0) {
      throw new Error(
        `STALE committed product file(s) — the generator no longer produces them (delete):\n  ${stale.join("\n  ")}`,
      );
    }
  }
}

/** The drift comparer singleton. */
export const emitComparer = new EmitComparer();
