/**
 * publish-vendor — build-time assembly of the vendored submodule plugins as
 * scoped npm packages (`@oscaner-skills/<name>`).
 *
 * Each vendor is an upstream git submodule (`vendors/<name>`, never edited
 * in-tree). This module reads the submodule content, stages a copy with a
 * scoped package.json (name/version/contentRoot/pi key, preserving the
 * upstream LICENSE), and runs `npm publish [--dry-run]`.
 *
 * The version is resolved by `resolveVendorVersion` with one priority shared
 * with the marketplace emit chain (source.mjs deriveVendor and marketplace-utils
 * resolveVersion delegate here): the vendored `.claude-plugin/plugin.json`
 * version at the assembly contentRoot first, then the `vX.Y.Z` release tag at
 * the submodule HEAD.
 *
 * `ASSEMBLY_TEMPLATE` is the single owner of the per-vendor assembly
 * `contentRoot` — source.mjs derives repo-relative paths from it rather than
 * duplicating the template.
 */

import { execSync } from "node:child_process";
import { spawnSync } from "node:child_process";
import {
  readFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  symlinkSync,
  readlinkSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import {
  SUBMODULE_PATHS,
  TAG_PATTERNS,
  semverFromNearestTag,
} from "./submodule-tags.mjs";
import { thinGeminiExtension, geminiMarkdown } from "./emit/manifests.mjs";

// ---------------------------------------------------------------------------
// Pure helpers for vendor publish I/O (Task 1)
// ---------------------------------------------------------------------------

/** @enum {string} probe result constants */
export const PROBE = Object.freeze({ PUBLISHED: "published", UNPUBLISHED: "unpublished", ERROR: "error" });

/** classifyProbe return values */
export const PROBE_CLASS = Object.freeze({ PUBLISHED: "skip", SHOULD_PUBLISH: "publish" });

/** @param {typeof PROBE[keyof typeof PROBE]} probeResult */
export function decideProbe(probeResult) {
  if (probeResult === PROBE.PUBLISHED) return PROBE_CLASS.PUBLISHED;
  if (probeResult === PROBE.UNPUBLISHED) return PROBE_CLASS.SHOULD_PUBLISH;
  throw new Error(`probe error (${probeResult}) — aborting release`);
}

/**
 * @param {string[]} allVersions   合并后版本列表（registryVersions ∪ publishedThisRun 去重）
 * @param {Set<string>} tagIndex   已有 tag 的 `version` 集合
 * @param {Set<string>} releaseIndex  已有 Release 的 `version` 集合
 * @returns {{ version: string }[]}
 */
export function collectGaps(allVersions, tagIndex, releaseIndex) {
  return allVersions
    .filter((v) => !tagIndex.has(v) || !releaseIndex.has(v))
    .map((version) => ({ version }));
}

/**
 * @param {string}   version 当前版本
 * @param {{ headVersion: string|null, headTag: string|null }} ctx
 * @param {(tagRef: string) => boolean} tagExists  注入的 tag 探测（纯函数可注入 stub）
 * @returns {string|null} upstreamTag（null = 双失败 → 省略）
 */
export function resolveUpstreamTag(version, ctx, tagExists) {
  if (ctx.headVersion === version && ctx.headTag) return ctx.headTag;
  const candidates = [`v${version}`, `skill-v${version}`];
  for (const tag of candidates) {
    if (tagExists(`refs/tags/${tag}`)) return tag;
  }
  return null;
}

// ---------------------------------------------------------------------------
// I/O helpers for vendor publish (Task 2)
// ---------------------------------------------------------------------------

/** npm view stderr 判定：含 E404/Not found → "E404"；否则 → "error" */
export function classifyProbeError(stderr) {
  if (/E404|Not found/i.test(stderr)) return PROBE.UNPUBLISHED;
  return PROBE.ERROR;
}

/** 三态探测：npm view <name>@<version> → PROBE.PUBLISHED | PROBE.UNPUBLISHED | PROBE.ERROR */
export function probeRegistryVersion(name, version) {
  const { status, stderr } = spawnSync("npm", ["view", `${name}@${version}`, "version"], { encoding: "utf8" });
  if (status === 0) return PROBE.PUBLISHED;
  return classifyProbeError(stderr ?? "");
}

/** 枚举已发布版本；E404 → []（未首次发布）；其他错误 → throw（与 probe fail-closed 一致） */
export function listRegistryVersions(name) {
  const { status, stdout, stderr } = spawnSync("npm", ["view", name, "versions", "--json"], { encoding: "utf8" });
  if (status === 0) return JSON.parse(stdout ?? "[]");
  if (/E404|Not found/i.test(stderr ?? "")) return [];
  throw new Error(`npm view versions failed for ${name}: ${(stdout ?? "") + (stderr ?? "")}`);
}

/** git ls-remote 检查 tag 是否存在于 origin */
export function probeTagExists(name, version) {
  const { status } = spawnSync(
    "git",
    ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${name}@${version}`],
    { stdio: "ignore" },
  );
  return status === 0;
}

/** gh release view 检查 Release 是否存在（runner 注入 GITHUB_TOKEN env） */
export function probeReleaseExists(name, version) {
  const { status } = spawnSync("gh", ["release", "view", `${name}@${version}`], { stdio: "ignore" });
  return status === 0;
}

/** 解析 .gitmodules，返回 vendor 上游 owner/repo（GitHub 返回 "owner/repo"，非 GitHub 返回 null） */
export function readGitmodules(root, vendorName) {
  const content = readFileSync(join(root, ".gitmodules"), "utf8");
  const sectionRegex = /\[submodule "([^"]+)"\][^[]*?url\s*=\s*([^\n]+)/gs;
  for (const [, subName, url] of content.matchAll(sectionRegex)) {
    if (subName === vendorName) {
      const m = url.trim().match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      return m ? `${m[1]}/${m[2]}` : null;
    }
  }
  return null;
}

/** git ls-remote 探测上游 repo 是否有指定 tag（host 非 GitHub → false） */
export function probeUpstreamTagExists(root, vendorName, tagRef) {
  const upstreamRepo = readGitmodules(root, vendorName);
  if (!upstreamRepo) return false;
  const url = `https://github.com/${upstreamRepo}.git`;
  const { status } = spawnSync("git", ["ls-remote", "--exit-code", "--tags", url, tagRef], { stdio: "ignore" });
  return status === 0;
}

/** 取 submodule HEAD 上匹配 TAG_PATTERNS 的 tag（null = 无匹配） */
function headTagAtHead(root, vendorName) {
  const submodulePath = join(root, SUBMODULE_PATHS[vendorName]);
  try {
    const { stdout } = spawnSync("git", ["-C", submodulePath, "tag", "--points-at", "HEAD"], { encoding: "utf8" });
    return stdout.split("\n").find((t) => t && TAG_PATTERNS[vendorName].test(t)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Discover the vendored plugin set from the `vendors/` directory, sorted.
 * cwd-independent — the caller passes the repo root. A vendor is any
 * subdirectory (submodule checkout); non-directory entries (e.g. `.DS_Store`)
 * are ignored. A dir present here but missing an `ASSEMBLY_TEMPLATE` entry
 * fails later via `assemblyTemplate` with a clear error, never a bare
 * TypeError.
 * @param {string} root repo root
 */
export function listVendors(root) {
  return readdirSync(join(root, "vendors"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/**
 * Assembly template per vendor — single source of truth for the assembly
 * `contentRoot` (relative to the assembled package root). source.mjs imports
 * this and prefixes the repo submodule path (`vendors/<name>`).
 */
export const ASSEMBLY_TEMPLATE = {
  "mattpocock-skills": { contentRoot: "." },
  superpowers: { contentRoot: "." },
  impeccable: { contentRoot: "plugin" },
};

/**
 * Assembly template for a vendor, with a descriptive guard: a `vendors/` dir
 * exists (listVendors derived it) but the assembly owner has no template entry
 * for it — throw a clear error instead of a bare TypeError at the first
 * `ASSEMBLY_TEMPLATE[name]` dereference.
 * @param {string} name vendor name
 */
export function assemblyTemplate(name) {
  const tpl = ASSEMBLY_TEMPLATE[name];
  if (!tpl) {
    throw new Error(
      `${name}: no ASSEMBLY_TEMPLATE entry in scripts/lib/publish-vendor.mjs — ` +
        "add the vendor's contentRoot to assemble it (and SUBMODULE_PATHS/TAG_PATTERNS " +
        "in scripts/lib/submodule-tags.mjs)",
    );
  }
  return tpl;
}

/**
 * Dynamically derive the `pi` key for a vendored submodule. Probes the
 * actual submodule structure instead of hardcoding — upstream structural
 * changes are picked up automatically.
 *
 * Detection priority (pi convention first, plugin.json last):
 *   1. `package.json` top-level `pi` (superpowers — preserve upstream extensions+skills)
 *   2. `.pi/skills/` directory (impeccable — pi convention, not plugin.json)
 *   3. `.claude-plugin/plugin.json` skills array (mattpocock — no .pi/ dir)
 *   4. Fallback: glob `skills/` directory at contentRoot
 *
 * @param {string} submodulePath absolute path to the vendored submodule root
 * @param {string} contentRoot relative contentRoot (e.g. "." or "plugin")
 * @returns {{ skills?: string[], extensions?: string[] }} pi key value
 */
export function derivePiKey(submodulePath, contentRoot) {
  // 1. package.json top-level pi (superpowers — upstream carries extensions+skills)
  const pkgPath = join(submodulePath, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (pkg.pi && typeof pkg.pi === "object") {
      return { ...pkg.pi };
    }
  }

  // 2. .pi/skills/ directory (pi convention — impeccable hits here)
  const piSkillsDir = join(submodulePath, ".pi", "skills");
  if (existsSync(piSkillsDir)) {
    const entries = readdirSync(piSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `./.pi/skills/${e.name}`);
    if (entries.length > 0) {
      return { skills: entries };
    }
  }

  // 3. .claude-plugin/plugin.json skills array (mattpocock — no .pi/ dir)
  const manifestPath = join(
    submodulePath,
    contentRoot,
    ".claude-plugin",
    "plugin.json",
  );
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (Array.isArray(manifest.skills) && manifest.skills.length > 0) {
      return { skills: [...manifest.skills] };
    }
  }

  // 4. Fallback: glob skills/ directory at contentRoot
  const skillsDir = join(submodulePath, contentRoot, "skills");
  if (existsSync(skillsDir)) {
    const entries = readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `./skills/${e.name}`);
    if (entries.length > 0) {
      return { skills: entries };
    }
  }

  // Nothing found — return empty skills (graceful degradation)
  return { skills: [] };
}

/**
 * Resolve the assembled package version for a vendor with a single priority,
 * shared with the marketplace emit chain so a published npm version never
 * disagrees with the marketplace declaration:
 *   1. the vendored `.claude-plugin/plugin.json` `version` at the assembly
 *      contentRoot (impeccable's SOT — its HEAD carries ext-v / cli-v /
 *      skill-v prefixed tags, so a plain v-tag lookup would return null);
 *   2. otherwise the semver from the `vX.Y.Z` release tag at the submodule
 *      HEAD (mattpocock-skills / superpowers carry no plugin.json version).
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function resolveVendorVersion(name, root) {
  const { contentRoot } = assemblyTemplate(name);
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  const manifestPath = join(
    submodulePath,
    contentRoot,
    ".claude-plugin",
    "plugin.json",
  );
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.version) return manifest.version;
  }
  // Release-tag fallback only makes sense for a checked-out submodule (a `.git`
  // marker — dir for a normal checkout, file for a gitlinked submodule). A bare
  // dir (no checkout) can't carry tags, so throw directly instead of running
  // git and letting the execSync stderr leak.
  if (existsSync(join(submodulePath, ".git"))) {
    const version = semverFromNearestTag(submodulePath, TAG_PATTERNS[name]);
    if (version) return version;
  }
  throw new Error(
    `${name}: no version in ${manifestPath} and no ${TAG_PATTERNS[name]} ` +
      `release tag on submodule HEAD (${SUBMODULE_PATHS[name]})`,
  );
}

/**
 * Build the scoped package.json for a vendor assembly. Carries descriptive
 * metadata from the vendored files (`.claude-plugin/plugin.json` at contentRoot
 * takes precedence over the submodule-root package.json), drops upstream
 * publish controls (`private`, scripts), and adds the `oscaner-plugin` key
 * (contentRoot + pi key). The LICENSE file is preserved separately by the
 * staging copy — `license` here mirrors the upstream SPDX id.
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function assemblePackageJson(name, root) {
  const { contentRoot } = assemblyTemplate(name);
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  const read = (rel) => {
    const p = join(submodulePath, rel);
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  };
  const pkg = read("package.json");
  const manifest = read(join(contentRoot, ".claude-plugin", "plugin.json"));
  const merged = { ...pkg, ...manifest };

  const out = {
    name: `@oscaner-skills/${name}`,
    version: resolveVendorVersion(name, root),
  };
  for (const field of [
    "description",
    "license",
    "author",
    "homepage",
    "keywords",
  ]) {
    if (merged[field] !== undefined) out[field] = merged[field];
  }
  if (merged.repository !== undefined) out.repository = merged.repository;
  out["oscaner-plugin"] = { contentRoot };
  // Dynamic pi derivation from vendored structure (priority: package.json pi →
  // .pi/skills/ → plugin.json skills → fallback skills/ glob)
  const pi = derivePiKey(submodulePath, contentRoot);
  if (pi && Object.keys(pi).length > 0) out.pi = pi;
  return out;
}

/** Dir entries never copied into the staged assembly. */
const COPY_EXCLUDE = new Set([".git", "node_modules"]);

/**
 * Recursively copy `src` into `dest` (created if missing), skipping `.git` and
 * `node_modules` and preserving symlinks. Submodule checkouts carry `.git`
 * (the gitlink file) and often a populated `node_modules` — neither belongs in
 * a published npm package.
 * @param {string} src
 * @param {string} dest
 */
export function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (COPY_EXCLUDE.has(entry.name)) continue;
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(d, { recursive: true });
      copyTree(s, d);
    } else if (entry.isSymbolicLink()) {
      symlinkSync(readlinkSync(s), d);
    } else if (entry.isFile()) {
      copyFileSync(s, d);
    }
  }
}

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------

/**
 * Fail fast if a vendor submodule isn't checked out (vendors/<name> has no
 * `.git` marker — either missing entirely or never initialized).
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function assertSubmoduleCheckedOut(name, root) {
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  if (!existsSync(join(submodulePath, ".git"))) {
    throw new Error(
      `${name}: submodule not checked out at ${SUBMODULE_PATHS[name]} — ` +
        "run `git submodule update --init`",
    );
  }
}

/**
 * Fail fast if a vendor has no LICENSE file to preserve in the assembly.
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function assertLicensePresent(name, root) {
  const licensePath = join(root, SUBMODULE_PATHS[name], "LICENSE");
  if (!existsSync(licensePath)) {
    throw new Error(
      `${name}: LICENSE missing at ${SUBMODULE_PATHS[name]}/LICENSE — aborting`,
    );
  }
}

/**
 * Fail fast if a vendor already ships its own `gemini-extension.json` — the
 * assembly must not silently overwrite an upstream extension definition.
 * Only checked for vendors that receive a thin gemini-extension during
 * assembly (currently mattpocock-skills).
 * @param {string} name vendor name
 * @param {string} root repo root
 */
export function assertNoUpstreamGeminiExtension(name, root) {
  const extPath = join(root, SUBMODULE_PATHS[name], "gemini-extension.json");
  if (existsSync(extPath)) {
    throw new Error(
      `${name}: upstream already has gemini-extension.json at ` +
        `${SUBMODULE_PATHS[name]}/gemini-extension.json — use the upstream version instead`,
    );
  }
}

/**
 * Stage a vendor into `<stageRoot>/<name>`: copy the submodule content (minus
 * `.git`/`node_modules`) and write the scoped package.json. The staged dir is
 * the npm package root — the upstream LICENSE is preserved by the copy.
 * For mattpocock-skills: also generates a thin `gemini-extension.json`
 * (no BeforeTool hooks) and `GEMINI.md` (skill imports).
 * @param {string} name vendor name
 * @param {string} root repo root
 * @param {string} stageRoot parent dir for the staged package
 */
export function stageVendor(name, root, stageRoot) {
  assemblyTemplate(name);
  // Guard: mattpocock-skills must not already ship gemini-extension.json
  if (name === "mattpocock-skills") {
    assertNoUpstreamGeminiExtension(name, root);
  }
  const submodulePath = join(root, SUBMODULE_PATHS[name]);
  const dest = join(stageRoot, name);
  rmSync(dest, { recursive: true, force: true });
  copyTree(submodulePath, dest);
  const pkg = assemblePackageJson(name, root);
  writeFileSync(join(dest, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  // mattpocock-skills: thin gemini-extension.json + GEMINI.md
  if (name === "mattpocock-skills") {
    const skillDirs = pkg.pi?.skills ?? [];
    const ext = thinGeminiExtension(pkg.name, pkg.version, skillDirs);
    writeFileSync(join(dest, "gemini-extension.json"), JSON.stringify(ext, null, 2) + "\n");
    // Extract skill directory names from pi.skills paths (e.g. "./skills/tdd" → "tdd")
    const skillNames = [...new Set(skillDirs.map((d) => d.split("/").filter(Boolean).pop()))];
    const geminiMd = geminiMarkdown(pkg.name, skillNames);
    writeFileSync(join(dest, "GEMINI.md"), geminiMd);
  }
  return dest;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Stage one vendor and run `npm publish` in the staged dir.
 * @param {string} name vendor name
 * @param {string} root repo root
 * @param {{ dryRun?: boolean, stageRoot: string }} opts
 */
export function publishVendor(name, root, { dryRun = false, stageRoot }) {
  assemblyTemplate(name);
  assertSubmoduleCheckedOut(name, root);
  assertLicensePresent(name, root);
  const dest = stageVendor(name, root, stageRoot);
  const flags = ["publish", "--access", "public", ...(dryRun ? ["--dry-run"] : [])];
  execSync(`npm ${flags.join(" ")}`, { cwd: dest, stdio: "inherit" });
  return dest;
}

/** Default staging parent for all assembled vendor packages. */
export function defaultStageRoot(root) {
  return join(root, "tmp", "publish-vendor");
}

/**
 * Assemble + publish every vendor; 输出 registry 全量差集到 stdout。
 * @param {string} root repo root
 * @param {{ dryRun?: boolean }} opts
 */
export function publishAll(root, { dryRun = false } = {}) {
  const stageRoot = defaultStageRoot(root);
  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(stageRoot, { recursive: true });

  // 缓存 vendor 列表 + 版本：避免 publish 循环与 gap 循环重复 listVendors + resolveVendorVersion I/O
  const vendorList = listVendors(root);
  const vendorData = vendorList.map((name) => ({ name, version: resolveVendorVersion(name, root) }));

  const publishedThisRun = []; // 成功发布 / EPUBLISHCONFLICT 归一化的 vendor name 列表

  // ── Phase 1: stage + publish ────────────────────────────────────────────
  for (const { name, version } of vendorData) {
    const dest = stageVendor(name, root, stageRoot);

    if (dryRun) {
      // dry-run：不探测、不发布，stdout 在函数末尾统一输出 []
      continue;
    }

    // probe（三态）
    const probe = probeRegistryVersion(`@oscaner-skills/${name}`, version);
    const decision = decideProbe(probe); // E404→publish / exit0→skip / error→throw（release 中止）

    if (decision === PROBE_CLASS.PUBLISHED) {
      process.stderr.write(`[skip] @oscaner-skills/${name}@${version} already published\n`);
      // 继续：该版本可能缺 tag/Release，由差集补建
    }

    if (decision === PROBE_CLASS.SHOULD_PUBLISH) {
      const { status, stdout, stderr } = spawnSync(
        "npm",
        ["publish", "--access", "public"],
        { cwd: dest, encoding: "utf8" },
      );
      // 始终将 npm 日志写入 stderr（保持 stdout 清洁）
      if (stderr) process.stderr.write(stderr);
      if (status === 0) {
        process.stderr.write(`[publish] @oscaner-skills/${name}@${version} → npm\n`);
        publishedThisRun.push(name);
      } else if (/EPUBLISHCONFLICT/i.test((stdout ?? "") + (stderr ?? ""))) {
        // TOCTOU 归一化：已发布 skip + 记录进 publishedThisRun（进差集）
        process.stderr.write(`[skip] @oscaner-skills/${name}@${version} already published (EPUBLISHCONFLICT)\n`);
        publishedThisRun.push(name);
      } else {
        throw new Error(`npm publish failed for ${name}@${version}: ${(stdout ?? "") + (stderr ?? "")}`);
      }
    }
  }

  if (dryRun) {
    process.stdout.write("[]\n");
    return stageRoot;
  }

  // ── Phase 2: registry 全量差集 ──────────────────────────────────────────
  const items = [];
  for (const { name, version: currentVersion } of vendorData) {
    const registryVersions = listRegistryVersions(`@oscaner-skills/${name}`);
    // union：registry + 本轮发布（防 TOCTOU registry 索引滞后）
    const publishedVersion = publishedThisRun.includes(name) ? currentVersion : null;
    const allVersions = [...new Set([...registryVersions, ...(publishedVersion ? [publishedVersion] : [])])];
    if (allVersions.length === 0) continue;

    // 构建本仓库 tag/release 索引
    const tagIndex = new Set();
    const releaseIndex = new Set();
    for (const v of allVersions) {
      if (probeTagExists(name, v)) tagIndex.add(v);
      if (probeReleaseExists(name, v)) releaseIndex.add(v);
    }

    const gaps = collectGaps(allVersions, tagIndex, releaseIndex);
    const upstreamRepo = readGitmodules(root, name);
    const headTag = headTagAtHead(root, name);

    for (const gap of gaps) {
      const upstreamTag = resolveUpstreamTag(gap.version, { headVersion: currentVersion, headTag }, (ref) =>
        probeUpstreamTagExists(root, name, ref),
      );
      items.push({ name, version: gap.version, upstreamRepo, upstreamTag });
    }
  }

  // ── stdout 契约：单行合法 JSON 数组（bin 不再写 stdout）──────────────────
  process.stdout.write(JSON.stringify(items) + "\n");
  return stageRoot;
}
