#!/usr/bin/env node

// scripts/validate/smoke-cdd.ts — CDD engine consumer-sim (`node scripts/run.ts smoke-cdd`).
// P3 T7 / design §2.6: replaces the old repo-internal dry-run smoke with a consumer-layout gate —
// build the real package, pack it, and run the five-command dry-run chain against a CONSUMER
// install (fresh mkdtemp git repo + `npm install <tarball>`), proving the publishable artifact
// works outside this repo with zero in-repo path dependencies.
//
// Steps (design §2.6):
//   1. `pnpm --filter @oscaner-skills/cdd-engine build` — the tsc-emitted product into dist
//      (tsc -p tsconfig.build.json + the config → dist/config copy)
//   2. package-dir `pnpm pack --pack-destination <out>` — the retired dev-stub chain no longer
//      exists, so pack has nothing to re-materialize; the `--config.ignore-scripts=true` flag
//      stays the verified belt-and-braces fallback. Pack MUST run
//      from the package dir — a workspace-root relative path is resolved as a registry spec
//      (ERR_PNPM_PACKAGE_VERSION_NOT_FOUND), and `--ignore-scripts` is not a supported pack flag.
//   3. tarball content assertions (anti-false-green): the emitted entry keeps its shebang, every
//      emitted dist/**/*.js rewrites relative imports to .js (zero residual `.ts` specifiers),
//      the tarball ships NO src/ tree, and the config/ home's dist
//      mirror (dist/config/ — canonical overall/plan/phase-spec/add-phase-protocol schemas +
//      template-contract + the harness contract) must be present, plus the engine-config the
//      fixture derives from.
//   4. mkdtemp consumer repo: git init + npm init + `npm install <tarball>` — consumer layout; the
//      installed engine resolves all runtime resources under node_modules, never the repo tree.
//   5. consumer chain: installed entry (`node <installed>/dist/bin.js`, plus the shipped
//      node_modules/.bin/cdd — `.bin/cdd --help` exits 0 on the real engine stack), `cdd schema get
//      plan` (installed schema-dir addressability measured byte-identically — stdout === the
//      published dist/config/schema/plan.json bytes),
//      then the five-command dry-run chain (implement / review task / fix task / review branch /
//      fix branch). The fixture plan + design spec + the parent overall it links are GENERATED
//      INSIDE the temp repo (D1), derived from the tarball's shipped doc-structure schemas and
//      engine-config — the plan declares `**Spec:**` and the spec doc is derived alongside (the
//      engine's doc-existence audit path is thereby a deterministic pass, never dependent on a
//      dry-run degraded-BLOCK).
//   6. per-command status-capsule contract assertions (status / blocker / handoff + the `next:`
//      suggestion line — the C5 T3 capsule; the stdout `blocker:` reason column is retired (M3) and
//      commits/artifacts/counters live in the handoff the capsule points at) — the
//      consumer-equivalent result surface for every output.
//   7. kairos pack whitelist audit (P4.2 Task 7 ⑤): `npm pack --dry-run --json` over the
//      kairos package — the pack top-level file set must equal the 7-item files whitelist
//      (skills/ · .claude-plugin/ · .cursor-plugin/ · README.md · README.zh-CN.md · CHANGELOG.md ·
//      package.json) with zero residue surfaces (tests/ · bin/ · scripts/ · .superpowers/ ·
//      .version-bump.json).
//
// Optional `--expect-version <semver>` (release-state version identity assertion, P4.2 / design
// §2.2 + §6): when present, step 3's tarball assertions additionally require the packed
// package.json version to EQUAL the expectation, and step 4's consumer install additionally
// requires the INSTALLED node_modules/@oscaner-skills/cdd-engine/package.json version to equal it
// (a FAIL reports both the expected and the actual value). Wired as release.yml's post-version
// release gate (`smoke-cdd --expect-version 1.0.0` after the Version PR merge, before
// `changeset publish` — the released artifact is the verified artifact); the pre-version baseline
// gate keeps calling it without the flag (version-agnostic).
//
// Entry subcommand `smoke-cdd` keeps its name with the consumer-sim semantics (Non-goal#1 — no new
// subcommand). The old smoke's P5 deletion-surface sweep (collectGateLexiconHits / checkDeletionSurface)
// is NOT carried over: that residue face overlaps validate block 5c (residue.ts) — the sweep's
// responsibility belongs to 5c, no double write. Depends on Node built-ins + execa + the tar ships
// present on macOS (bsdtar) and CI (GNU tar) — both support `-tzf` (list) and `-xOzf` (stdout read).

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execaSync } from "execa";
import { RESOURCE_SPECS } from "../../packages/cdd-engine/src/infra/resource.ts";

const root = process.cwd(); // repo toplevel (run.ts invokes with the repo root as cwd)
const NODE = process.execPath;
const PKG = "packages/cdd-engine";
const PKG_SCOPE = "@oscaner-skills/cdd-engine";
const PKG_DIR = path.join(root, PKG);
const CLI_ENTRY = "dist/bin.js";

// C7: the engine's shipped-resource member paths derive from the locator table (RESOURCE_SPECS —
// the published dist mirror segments), never a second literal path list.
// RESOURCE_SPECS mixes dist-mirrored resources (published + source) and as-is-shipped ones
// (source only — issue-body); the published-face helper is only ever used for mirrored
// resources, so the name set is narrowed to those carrying a published home.
type PublishedResource = {
  [K in keyof typeof RESOURCE_SPECS]: "published" extends keyof (typeof RESOURCE_SPECS)[K]
    ? K
    : never;
}[keyof typeof RESOURCE_SPECS];
const published = (name: PublishedResource, ...tail: string[]): string =>
  path.join(...RESOURCE_SPECS[name].published, ...tail);
const DIST_SCHEMA_DIR = published("schema"); // dist/config/schema

// ---- kairos pack whitelist audit (P4.2 Task 7 ⑤) ----
// The package's `files` whitelist is its ONLY shipped surface (7 entries): the probe asserts the
// pack top-level file set equals the whitelist and that the prior inside-package surfaces
// (tests/ bin/ scripts/ .superpowers/ .version-bump.json) stay at zero inside the tarball.
const KAIROS_DIR = path.join(root, "packages", "kairos");
const KAIROS_WHITELIST = [
  "skills/",
  ".claude-plugin/",
  ".cursor-plugin/",
  "README.md",
  "README.zh-CN.md",
  "CHANGELOG.md",
  "package.json",
];
const KAIROS_RESIDUE = ["tests/", "bin/", "scripts/", ".superpowers/", ".version-bump.json"];

// Published-entry anti-false-green (T8): the pack must ship the tsc-emitted product, never a
// phantom. The CLI entry carries the preserved shebang (tsc passes the source #! through), the
// emitted module JS rewrites every relative import to .js (rewriteRelativeImportExtensions — a
// residual `.ts` relative specifier means the publish emit is broken), and the tarball ships NO
// source tree (`src/` zero — a source-shipped artifact would bypass the compile face).
const SHEBANG = "#!/usr/bin/env node";
// A relative module specifier ending in .ts — the residual shape rewriteRelativeImportExtensions
// must eliminate from the emitted JS (from/import forms; the scoped ./ and ../ prefixes keep
// bare words free). The emitted-dist scan is specifier-specific, so a source comment carrying the
// ".ts" substring stays legal.
const TS_IMPORT_RE = /["'](?:\.{1,2}\/)[^"']*\.ts["']/;

const DOC_SCHEMA_FILES = [
  "overall.json",
  "plan.json",
  "phase-spec.json",
  "add-phase-protocol.json",
];

function assertTrue(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`consumer-sim: ${msg}`);
}

/** Version identity comparison for the `--expect-version` gate — null when equal, else a mismatch
 *  message carrying BOTH the expected and the actual value (a release FAIL must show both faces). */
export function versionMismatch(actualVersion: string, expectVersion: string): string | null {
  return actualVersion === expectVersion
    ? null
    : `version identity mismatch — expected ${expectVersion}, got ${actualVersion}`;
}

function assertVersionIdentity(actualVersion: string, expectVersion: string, where: string): void {
  const mismatch = versionMismatch(actualVersion, expectVersion);
  if (mismatch !== null) throw new Error(`consumer-sim: ${mismatch} (${where})`);
}

function readSchema(schemaRoot: string, name: string): Record<string, unknown> {
  const file = path.join(schemaRoot, `${name}.json`);
  assertTrue(existsSync(file), `shipped doc-structure schema missing: ${file}`);
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

/** Read a nested token from a shipped schema (const/pattern value); a missing node = the shipped
 * schema no longer declares the fixture's required surface → fail loud, never guess. */
function schemaToken(schema: Record<string, unknown>, parts: string[]): string {
  let node: unknown = schema;
  for (const p of parts) {
    node = (node as Record<string, unknown> | null | undefined)?.[p];
    if (node === undefined)
      throw new Error(`consumer-sim: shipped schema token missing at ${parts.join(".")}`);
  }
  return String(node);
}

/** A regex-pattern token reduced to its un-anchored literal prefix (e.g. `^## Constraints\\s*$` →
 * `## Constraints`) — used for the pattern-declared fixture surfaces (the canonical `## Constraints`
 * heading); an unreducible pattern shape fails loud. */
function patternLiteral(pattern: string): string {
  const body = pattern.replace(/^\^/, ""); // drop the anchor — the literal is the unanchored prefix
  const m = body.match(/^([^\\^$+*?()|[\]]+)/);
  assertTrue(!!m, `cannot derive a literal from schema pattern ${JSON.stringify(pattern)}`);
  return m![1]!.trim();
}

// ---- tarball assertions (step 3) ----

function tarList(tgz: string): string[] {
  return execaSync("tar", ["-tzf", tgz]).stdout.split("\n").filter(Boolean);
}

function tarRead(tgz: string, member: string): string {
  return execaSync("tar", ["-xOzf", tgz, member]).stdout;
}

function assertTarball(tgz: string, expectVersion?: string): void {
  const entries = tarList(tgz);
  const has = (member: string) => entries.includes(member);
  const cliMember = `package/${CLI_ENTRY}`;
  assertTrue(
    has(cliMember),
    `tarball missing the CLI entry ${cliMember} (entries: ${entries.length} files)`,
  );
  const cliSrc = tarRead(tgz, cliMember);
  assertTrue(
    cliSrc.startsWith(SHEBANG),
    `package/${CLI_ENTRY} lost its shebang — the emitted entry must stay directly runnable (tsc passes the source #! through)`,
  );
  // The compiled module plane must be specifier-clean: every emitted dist/**/*.js rewrites its
  // relative imports to .js (rewriteRelativeImportExtensions); a residual `.ts` relative
  // specifier in any emitted module means the publish emit is broken, not a usable artifact.
  const distJs = entries.filter((e) => e.startsWith("package/dist/") && e.endsWith(".js"));
  for (const member of distJs) {
    assertTrue(
      !TS_IMPORT_RE.test(tarRead(tgz, member)),
      `${member} carries a residual .ts relative import specifier — the publish emit must rewrite relative imports to .js`,
    );
  }
  // Zero source-tree ship: the tarball must never contain src/ (a source-shipped artifact would
  // bypass the compile face; the published package carries only the tsc-emitted dist + config + templates).
  assertTrue(
    !entries.some((e) => e.startsWith("package/src/")),
    `tarball ships a source-tree member (${entries.find((e) => e.startsWith("package/src/"))}) — the publish artifact must be compiled JS only`,
  );
  // Canonical doc-structure schemas addressable at the published dist face.
  for (const f of DOC_SCHEMA_FILES) {
    assertTrue(
      has(`package/${DIST_SCHEMA_DIR}/${f}`),
      `tarball missing the canonical doc-structure schema dist/config/schema/${f}`,
    );
  }
  // The render resource + the handoff schemas it serves ride the dist mirror of the config/ home.
  assertTrue(
    has(`package/${published("template-contract")}`),
    `tarball missing the template-contract resource dist/config/template-contract.json`,
  );
  assertTrue(
    has(`package/${path.join(DIST_SCHEMA_DIR, "task-handoff-schema.json")}`),
    "tarball missing dist/config/schema/task-handoff-schema.json",
  );
  // The harness contract the dispatch ship gate resolves at runtime (the build's config copy
  // publishes the dedicated dist/config/ face).
  assertTrue(
    has(`package/${published("harness-contract")}`),
    "tarball missing dist/config/harness-contract.json (dispatch ship gate reads it at runtime)",
  );
  // Zero in-repo residues inside the packed artifact: the tarball must never reference the repo
  // tree (an absolute in-repo path would embed it).
  assertTrue(
    !tarRead(tgz, cliMember).includes(root),
    `package/${CLI_ENTRY} embeds the repo root path ${root} — the tarball is not consumer-standalone`,
  );
  // Release-state version identity (--expect-version gate): the packed artifact's declared version
  // must equal the expectation before the consumer install proceeds.
  if (expectVersion !== undefined) {
    const packedPkg = JSON.parse(tarRead(tgz, "package/package.json")) as { version: string };
    assertVersionIdentity(packedPkg.version, expectVersion, "tarball package/package.json");
  }
}

// ---- consumer install (step 4) ----

function installConsumer(
  tgz: string,
  expectVersion?: string,
): { consumerRoot: string; installed: string } {
  const consumerRoot = mkdtempSync(path.join(tmpdir(), "cdd-consumer-repo-"));
  execaSync("git", ["init", "-q"], { cwd: consumerRoot });
  execaSync("git", ["config", "user.email", "cdd-consumer-sim@oscaner.dev"], { cwd: consumerRoot });
  execaSync("git", ["config", "user.name", "CDD Consumer Sim"], { cwd: consumerRoot });
  execaSync("npm", ["init", "-y"], { cwd: consumerRoot, stdio: "inherit" });
  execaSync("npm", ["install", tgz], { cwd: consumerRoot, stdio: "inherit" });
  const installed = path.join(consumerRoot, "node_modules", ...PKG_SCOPE.split("/"));
  // Post-install version identity (--expect-version gate, its own assertion surface): the version
  // that actually LANDED in the consumer's node_modules must equal the expectation (spec §6 —
  // proves npm install resolved the asserted pack, not a cached/transformed equivalent).
  if (expectVersion !== undefined) {
    const installedPkg = JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")) as {
      version: string;
    };
    assertVersionIdentity(
      installedPkg.version,
      expectVersion,
      "installed node_modules/@oscaner-skills/cdd-engine/package.json",
    );
  }
  assertTrue(
    existsSync(path.join(installed, CLI_ENTRY)),
    `installed CLI entry missing: ${path.join(installed, CLI_ENTRY)}`,
  );
  // The shipped bin surface: node_modules/.bin/cdd must resolve (package.json bin → dist/bin.js).
  assertTrue(
    existsSync(path.join(consumerRoot, "node_modules", ".bin", "cdd")),
    "shipped bin node_modules/.bin/cdd missing",
  );
  return { consumerRoot, installed };
}

// ---- fixture derivation (D1) — generated inside the temp repo, derived from the shipped schemas ----

interface Fixture {
  plan: string; // repo-root-relative plan path
  spec: string; // repo-root-relative spec path
  overall: string; // repo-root-relative overall path (the plan's **Parent program** link target)
  slug: string; // engine workspace slug (plan basename minus -plan)
  workspace: string; // <consumerRoot>/<workspaceRoot>/<slug> — derived from the shipped engine-config
}

function deriveFixture(consumerRoot: string, installed: string): Fixture {
  const schemaRoot = path.join(installed, DIST_SCHEMA_DIR);
  const planSchema = readSchema(schemaRoot, "plan");
  const phaseSpecSchema = readSchema(schemaRoot, "phase-spec");
  const overallSchema = readSchema(schemaRoot, "overall");
  // Canonical markers extracted from the SHIPPED schemas (the fixture is derived, never hardcoded).
  const specMark = schemaToken(planSchema, [
    "properties",
    "header",
    "properties",
    "specRef",
    "properties",
    "marker",
    "const",
  ]); // **Spec:**
  const parentMark = schemaToken(planSchema, [
    "properties",
    "header",
    "properties",
    "parentProgram",
    "properties",
    "marker",
    "const",
  ]); // **Parent program**
  const constraintsHeading = patternLiteral(
    schemaToken(planSchema, [
      "properties",
      "constraints",
      "properties",
      "formACanonical",
      "properties",
      "heading",
      "pattern",
    ]),
  ); // ## Constraints
  const taskHeadingFormat = schemaToken(planSchema, [
    "properties",
    "taskHeadings",
    "properties",
    "format",
    "const",
  ]); // ### Task N:
  const versionMark = schemaToken(phaseSpecSchema, [
    "properties",
    "header",
    "properties",
    "version",
    "properties",
    "marker",
    "const",
  ]); // **Version**
  const overallVersionMark = schemaToken(overallSchema, [
    "properties",
    "header",
    "properties",
    "version",
    "properties",
    "marker",
    "const",
  ]); // **Version**
  const phaseInventoryHeader = schemaToken(overallSchema, [
    "properties",
    "phaseInventory",
    "properties",
    "columnNames",
    "properties",
    "header",
    "const",
  ]); // | # | Phase | … | Dependency |
  assertTrue(
    specMark === "**Spec:**" &&
      parentMark === "**Parent program**" &&
      constraintsHeading === "## Constraints" &&
      taskHeadingFormat === "### Task N:" &&
      versionMark === "**Version**" &&
      overallVersionMark === versionMark,
    `shipped schema tokens drifted: Spec=${JSON.stringify(specMark)} Parent=${JSON.stringify(parentMark)} Constraints=${JSON.stringify(constraintsHeading)} Task=${JSON.stringify(taskHeadingFormat)} Version=${JSON.stringify(versionMark)} OverallVersion=${JSON.stringify(overallVersionMark)}`,
  );

  // The engine's workspace slug rule (schema-independent engine name derivation): plan basename
  // minus `.md`, with a single trailing -design/-plan layer stripped.
  const planName = "fixture-plan.md";
  const slug = path.basename(planName, ".md").replace(/-(?:design|plan)$/, "");
  // Workspace root from the SHIPPED engine-config (never a repo literal).
  const config = JSON.parse(
    readFileSync(path.join(installed, "config", "engine-config.json"), "utf8"),
  ) as { handoffNamespace: { workspaceRoot: string } };
  const workspaceRootSeg = config.handoffNamespace.workspaceRoot;
  assertTrue(
    workspaceRootSeg === ".kairos/cdd",
    `shipped engine-config handoffNamespace.workspaceRoot drifted: ${JSON.stringify(workspaceRootSeg)}`,
  );

  const spec = "fixture-design.md";
  // The spec doc the plan's **Spec:** line must resolve to (the audit's Class-A target). It carries
  // the full three-truth skeleton (the phase-spec's current contract face: a `**Version**` line, a
  // `## Design` section with the unique `### Acceptance criteria` subsection, a `## Constraints`
  // inheritance point) and a RESOLVABLE `**Parent program**` pointer (the `## Constraints`
  // inheritance point demands the parent-overall conventions — the pointer reaches fixture-overall.md,
  // whose empty Phase-inventory table keeps every four-table / overall-contract face a no-op, making
  // the consumer chain's doc-existence path deterministic).
  writeFileSync(
    path.join(consumerRoot, spec),
    [
      `# ${spec}`,
      "",
      `- ${versionMark}: v1.0 · 2026-09-22`,
      "",
      `- ${parentMark}: [fixture-overall.md v1.0](fixture-overall.md)`,
      "",
      `## Design`,
      "",
      `### Acceptance criteria`,
      "",
      "- `the consumer-sim chain audits clean`",
      "",
      `## Constraints`,
      "",
      "- fixture design spec delta — the parent-overall conventions auto-apply.",
      "",
    ].join("\n"),
    "utf8",
  );

  // The overall the plan's **Parent program** link resolves to — a minimal canonical charter
  // (canonical header + empty Phase inventory table, the header row derived from the shipped
  // overall schema). The fixture spec omits its own Parent program line, so this overall is
  // never a reached audit face — materializing it only makes the plan's own parent link resolve
  // (self-consistency), never a document the four-table / overall-contract audit runs against.
  const overall = "fixture-overall.md";
  writeFileSync(
    path.join(consumerRoot, overall),
    [
      `# Fixture Overall`,
      "",
      `- ${overallVersionMark}: v1.0 · 2026-09-22`,
      "",
      "Consumer-sim fixture program charter — the `**Parent program**` link target for the derived fixture plan.",
      "",
      `## Phase inventory`,
      "",
      phaseInventoryHeader,
      "|---|-------|-------|-------------|---------------------|----------------------|------------|",
      "",
    ].join("\n"),
    "utf8",
  );

  const plan = planName;
  // The single-form data-shaped plan (canonical `## Constraints` + the `### Task N:` data records):
  // the structural markers (`**Spec:**` / `**Parent program**` / `## Constraints`) are the
  // schema-derived tokens; the task data-field markers (`- **Objective**:` / `- **Steps**:` with
  // the ` — checkable:` outcome / `- **Acceptance**:` / the `- **DependsOn**:` edge declaration)
  // are the canonical marker spellings — their conformance is enforced downstream by the consumer
  // chain's docContractValidate gate (every dispatched command audits the plan), the schema pieces
  // no marker leaf for the data-shaped record fields.
  const taskHeading = (n: number): string => taskHeadingFormat.replace("N", String(n));
  writeFileSync(
    path.join(consumerRoot, plan),
    [
      `# Fixture Plan`,
      "",
      `${specMark} [${spec}](${spec})`,
      "",
      `${parentMark}: [fixture-overall.md v1.0](fixture-overall.md)`,
      "",
      `${constraintsHeading}`,
      "",
      `- Consumer-sim fixture constraints materialized into the temp repo.`,
      "",
      `${taskHeading(1)} fixture task`,
      "",
      "- **Objective**: exercise the installed cdd engine under dry-run in a consumer layout",
      "- **Files**: fixture-plan.md",
      "- **Steps**:",
      "  1. run the installed engine under dry-run — checkable: the five-command dry-run chain completes",
      "- **Acceptance**:",
      "  - the dry-run chain prints the status capsule contract",
      "",
      `${taskHeading(2)} fixture edge declaration`,
      "",
      "- **Objective**: exercise the data-shaped task record's edge-declaration face",
      "- **Files**: fixture-plan.md",
      "- **DependsOn**: 1",
      "- **Steps**:",
      "  1. declare the forward dependency edge — checkable: task 2's dependsOn parses as [1]",
      "- **Acceptance**:",
      "  - the TaskGraph validates the task-2 → task-1 dependency edge",
      "",
    ].join("\n"),
    "utf8",
  );

  return { plan, spec, overall, slug, workspace: path.join(consumerRoot, workspaceRootSeg, slug) };
}

// ---- consumer chain (steps 5 & 6) ----

/** Assert the command's last stdout block is the status capsule contract (per-command expectations
 *  included — the consumer-equivalent result surface). T3: the engine stdout is the single capsule
 *  `status: <axis> · blocker: <n> · handoff: <path>` + the C5 `next:` line. The `blocker:` is the
 *  judgment-source count (M3 — never a reason column); commits/artifacts/counters live in the
 *  handoff the capsule points at (the carrier facts are asserted through the capsule's pointer). */
function assertReturnBlock(cmd: string, stdout: string): void {
  const lastBlock =
    stdout
      .trim()
      .split(/\n{2,}/)
      .at(-1) ?? "";
  const lines = lastBlock.split("\n");
  const capsule = lines.find((l) => l.startsWith("status: ") && l.includes("· blocker: "));
  assertTrue(
    !!capsule,
    `status capsule missing from the last stdout block (last block: ${JSON.stringify(lastBlock)})`,
  );
  // Both axes (review judgment APPROVED/CHANGES_REQUESTED/REVIEW_FIX; work COMPLETED/BLOCKED).
  assertTrue(
    /^status: (APPROVED|CHANGES_REQUESTED|REVIEW_FIX|COMPLETED|BLOCKED) · blocker: \d+ · handoff: /.test(
      capsule!,
    ),
    `status capsule malformed: ${JSON.stringify(capsule)}`,
  );
  // Zero old-shape stdout key lines (the 4-line block is retired — T3).
  assertTrue(
    lines.every((l) => !/^(commits|artifacts|counters):/.test(l)),
    `old-shape stdout key line present (last block: ${JSON.stringify(lastBlock)})`,
  );
  // C5 (T8): the `next:` suggestion line — a command suggestion (`cdd …`), the clean terminal
  // (`none`), or the review-cycle soft-cap user-adjudication marker (`BLOCKED: …`). The assertion
  // tests the VALUE after the `next: ` prefix (the prefix is the capsule's route anchor, not part
  // of the suggestion shape — a green round's `next: cdd review …` must match the suggestion arm).
  const next = lines.find((l) => l.startsWith("next: "));
  assertTrue(
    !!next && /^(cdd |none$|BLOCKED:)/.test(next!.replace(/^next: /, "")),
    `next: line missing or unexpected (got ${JSON.stringify(next)})`,
  );
  // Branch-family carrier facts follow the capsule's handoff pointer (commits moved off stdout).
  // Only the branch family materializes its carrier in dry-run (branch-review → commits
  // base=head=<sha>; branch-fix → base=head=dry-run); the task-family dry-run writes no handoff
  // (the engine's dry-run no-handoff invariant — task.ts step 13 "dry-run does not write a
  // handoff"), so its capsule `handoff:` pointer names a non-materialized path and the carrier
  // assertions apply on the branch faces only.
  const handoffMatch = capsule!.match(/handoff: (\S+)$/);
  if (handoffMatch && cmd.includes("--type branch")) {
    const carrier = JSON.parse(readFileSync(handoffMatch[1], "utf8")) as {
      commits?: { base?: string; head?: string };
    };
    if (cmd.includes("review --type branch")) {
      assertTrue(
        /^[0-9a-f]{40}$/.test(carrier.commits?.base ?? "") &&
          /^[0-9a-f]{40}$/.test(carrier.commits?.head ?? ""),
        `branch review carrier commits ${JSON.stringify(carrier.commits)} — expected base=<sha> head=<sha>`,
      );
    } else if (cmd.includes("fix --type branch")) {
      assertTrue(
        carrier.commits?.base === "dry-run" && carrier.commits?.head === "dry-run",
        `branch fix carrier commits ${JSON.stringify(carrier.commits)} — expected base=dry-run head=dry-run`,
      );
    }
  }
}

function runConsumerChain({
  consumerRoot,
  installed,
}: {
  consumerRoot: string;
  installed: string;
}): void {
  const cli = path.join(installed, CLI_ENTRY);
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: "1" };

  // The installed bin shim on the real engine stack: `.bin/cdd --help` runs the shipped
  // dist/bin.js through its shebang and must exit 0 with the USAGE face (T8 empirical anchor).
  const shimHelp = execaSync(path.join(consumerRoot, "node_modules", ".bin", "cdd"), ["--help"], {
    cwd: consumerRoot,
    env,
  }).stdout;
  assertTrue(
    shimHelp.includes("USAGE") && /implement\|review\|fix/.test(shimHelp),
    "installed .bin/cdd --help missing the engine USAGE face (the bin shim did not surface the engine help)",
  );

  // `cdd schema get plan` — the discovery surface (canonical doc-structure schema straight to
  // stdout), the install-face resource proof (AC6: installed-face schema-dir addressability measured
  // byte-identically — schema-get stdout === the published dist/config/schema/plan.json bytes).
  // `stripFinalNewline: false` keeps execa from trimming the schema's trailing newline — the
  // byte-identity assertion must measure the raw output, not a newline-normalized shape.
  // The config/ home's dist mirror is proven implicitly by the consumer chain below (the engine
  // reads the shipped engine-config / handoff schemas on every dispatched command).
  const schemaOut = execaSync(NODE, [cli, "schema", "get", "plan"], {
    cwd: consumerRoot,
    stripFinalNewline: false,
  }).stdout;
  assertTrue(
    schemaOut === readFileSync(path.join(installed, DIST_SCHEMA_DIR, "plan.json"), "utf8"),
    "cdd schema get plan output ≠ the installed dist/config/schema/plan.json bytes",
  );
  for (const f of DOC_SCHEMA_FILES) {
    assertTrue(
      existsSync(path.join(installed, DIST_SCHEMA_DIR, f)),
      `installed schema dir missing ${f}`,
    );
  }

  // Fixture generation (D1) inside the temp repo — fixture-plan.md, its design spec and the parent
  // overall it links to — then one initial commit so the branch family has a real reviewed range
  // (base == head, the self-review shape).
  const fixture = deriveFixture(consumerRoot, installed);
  execaSync("git", ["add", "-A"], { cwd: consumerRoot });
  execaSync("git", ["commit", "-m", "chore: consumer-sim fixture plan + spec + overall"], {
    cwd: consumerRoot,
  });
  const head = execaSync("git", ["rev-parse", "HEAD"], { cwd: consumerRoot }).stdout.trim();
  const head7 = head.slice(0, 7);

  // The five-command dry-run chain — argv shape mirrors the dispatch contract the engine's own
  // black-box suite exercises; each command asserts its return block before the next runs.
  const chain = [
    ["--dry-run", "implement", "--tasks", "1", "--plan", fixture.plan],
    ["--dry-run", "review", "--type", "task", "--tasks", "1", "--plan", fixture.plan],
    [
      "--dry-run",
      "fix",
      "--type",
      "task",
      "--tasks",
      "1",
      "--plan",
      fixture.plan,
      "--findings",
      path.join(fixture.workspace, "tasks-1-review-1.json"),
    ],
    [
      "--dry-run",
      "review",
      "--type",
      "branch",
      "--plan",
      fixture.plan,
      "--base",
      head,
      "--head",
      head,
    ],
    [
      "--dry-run",
      "fix",
      "--type",
      "branch",
      "--plan",
      fixture.plan,
      "--findings",
      path.join(fixture.workspace, `branch-review-${head7}..${head7}-r1.json`),
    ],
  ];
  for (const [i, args] of chain.entries()) {
    const res = execaSync(NODE, [cli, ...args], { cwd: consumerRoot, env });
    assertReturnBlock(args.join(" "), res.stdout);
    console.log(`  consumer-sim step ${i + 1}: ${args.slice(0, 3).join(" ")} … ${args.at(-1)}`);
  }
}

/** kairos pack whitelist audit — `npm pack --dry-run --json` over the kairos package;
 *  the pack's top-level file set must equal the 7-item files whitelist (normalized: a trailing
 *  slash stripped) and no residue surface (tests/ bin/ scripts/ .superpowers/ .version-bump.json)
 *  may appear anywhere in the tarball listing. */
function assertKairosPackWhitelist(): void {
  const res = execaSync("npm", ["pack", "--dry-run", "--json"], { cwd: KAIROS_DIR });
  const listing = JSON.parse(res.stdout) as Array<{ files: Array<{ path: string }> }>;
  const files = listing[0]?.files ?? [];
  const rel = files.map((f) => f.path.replace(/^package\//, ""));
  const normalize = (entry: string) => entry.replace(/\/$/, "");
  const topEntries = [...new Set(rel.map((p) => normalize(p.split("/")[0])))].sort();
  assertTrue(
    JSON.stringify(topEntries) === JSON.stringify([...KAIROS_WHITELIST].map(normalize).sort()),
    `kairos pack top-level file set ${JSON.stringify(topEntries)} ≠ the 7-item whitelist ${JSON.stringify(KAIROS_WHITELIST)}`,
  );
  for (const residue of KAIROS_RESIDUE) {
    const hits = rel.filter((p) => p === residue || p.startsWith(residue));
    assertTrue(
      hits.length === 0,
      `kairos pack carries a residue surface ${residue}: ${hits.join(", ")}`,
    );
  }
  console.log(
    "OK — kairos pack whitelist audit (top-level file set == the 7-item whitelist, zero residue surfaces)",
  );
}

export function main(expectVersion?: string): void {
  // 1. build — the tsc-emitted product into dist (dev runs the src entry directly; the published
  //    dist/bin.js is the compile face).
  execaSync("pnpm", ["--filter", PKG_SCOPE, "build"], { cwd: root, stdio: "inherit" });

  // 2. pack — from the package dir (prepare removed; --config.ignore-scripts=true is the verified
  //    belt-and-braces fallback).
  const outDir = mkdtempSync(path.join(tmpdir(), "cdd-consumer-pack-"));
  execaSync("pnpm", ["pack", "--pack-destination", outDir, "--config.ignore-scripts=true"], {
    cwd: PKG_DIR,
    stdio: "inherit",
  });
  const pkgJson = JSON.parse(readFileSync(path.join(PKG_DIR, "package.json"), "utf8")) as {
    name: string;
    version: string;
  };
  const baseName = pkgJson.name.replace(/^@/, "").replace("/", "-"); // @scope/name → scope-name (pnpm pack's unscoped file prefix)
  const tgzName = `${baseName}-${pkgJson.version}.tgz`;
  const tgz = path.join(outDir, tgzName);
  assertTrue(existsSync(tgz), `pack produced no ${tgzName} at ${outDir}`);

  // 3. tarball content assertions (anti-false-green) + release-state version identity.
  assertTarball(tgz, expectVersion);

  // 4. consumer install + 5. consumer chain + 6. per-command status-capsule assertions.
  const consumer = installConsumer(tgz, expectVersion);
  runConsumerChain(consumer);

  // 7. kairos pack whitelist audit (P4.2 Task 7 ⑤) — the packed plugin surface is exactly
  //    the 7-item files whitelist, zero residue.
  assertKairosPackWhitelist();

  console.log(
    `OK — cdd-engine consumer-sim (pack → install → cdd schema get + 5-command dry-run chain green, tarball = real product${
      expectVersion !== undefined
        ? `, release-state version identity ${expectVersion} verified at pack + install`
        : ""
    })`,
  );
}
