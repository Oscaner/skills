/**
 * vendor-registry — registry/repository probing for the vendored plugin
 * publish flow (split out of the pre-P2 monolithic publish script in the
 * release domain extraction).
 *
 * Probe family (all fail-closed: an unexpected registry/network error throws
 * or returns PROBE.ERROR, aborting the release rather than skipping a publish),
 * the registry-gap diff (collectGaps + resolveUpstreamTag), and the vendored
 * plugin set discovery (listVendors / readGitmodules).
 */

import { $ } from "execa";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SUBMODULE_PATHS, TAG_PATTERNS } from "./submodule-tags.mjs";

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

/** npm view stderr 判定：含 E404/Not found → "E404"；否则 → "error" */
export function classifyProbeError(stderr) {
  if (/E404|Not found/i.test(stderr)) return PROBE.UNPUBLISHED;
  return PROBE.ERROR;
}

/** 三态探测：npm view <name>@<version> → PROBE.PUBLISHED | PROBE.UNPUBLISHED | PROBE.ERROR */
export function probeRegistryVersion(name, version) {
  try {
    $.sync`npm view ${name + "@" + version} version`;
    return PROBE.PUBLISHED;
  } catch (e) {
    return classifyProbeError(e.stderr ?? "");
  }
}

/** 枚举已发布版本；E404 → []（未首次发布）；其他错误 → throw（与 probe fail-closed 一致） */
export function listRegistryVersions(name) {
  try {
    const { stdout } = $.sync`npm view ${name} versions --json`;
    return JSON.parse(stdout ?? "[]");
  } catch (e) {
    if (/E404|Not found/i.test(e.stderr ?? "")) return [];
    throw new Error(
      `npm view versions failed for ${name}: ${(e.stdout ?? "") + (e.stderr ?? "")}`,
    );
  }
}

/** git ls-remote 检查 tag 是否存在于 origin */
export function probeTagExists(name, version) {
  try {
    $.sync({ stdio: "ignore" })`git ls-remote --exit-code --tags origin ${`refs/tags/${name}@${version}`}`;
    return true;
  } catch {
    return false;
  }
}

/** gh release view 检查 Release 是否存在（runner 注入 GITHUB_TOKEN env） */
export function probeReleaseExists(name, version) {
  try {
    $.sync({ stdio: "ignore" })`gh release view ${name + "@" + version}`;
    return true;
  } catch {
    return false;
  }
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
  try {
    $.sync({ stdio: "ignore" })`git ls-remote --exit-code --tags ${url} ${tagRef}`;
    return true;
  } catch {
    return false;
  }
}

/** 取 submodule HEAD 上匹配 TAG_PATTERNS 的 tag（null = 无匹配） */
export function headTagAtHead(root, vendorName) {
  const submodulePath = join(root, SUBMODULE_PATHS[vendorName]);
  try {
    const { stdout } = $.sync`git -C ${submodulePath} tag --points-at HEAD`;
    return (
      stdout.split("\n").find((t) => t && TAG_PATTERNS[vendorName].test(t)) ??
      null
    );
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