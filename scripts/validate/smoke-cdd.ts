#!/usr/bin/env node
// scripts/validate/smoke-cdd.ts — CDD engine consumer-sim (`node scripts/run.ts smoke-cdd`).
// P3 T7 / design §2.6: replaces the old repo-internal dry-run smoke with a consumer-layout gate —
// build the real package, pack it, and run the five-command dry-run chain against a CONSUMER
// install (fresh mkdtemp git repo + `npm install <tarball>`), proving the publishable artifact
// works outside this repo with zero in-repo path dependencies.
//
// Steps (design §2.6):
//   1. `pnpm --filter @oscaner-skills/cdd-engine build` — real unbuild product into dist
//   2. package-dir `pnpm pack --pack-destination <out>` — the `prepare` hook (dev:stub) was removed
//      from package.json (P3 T7 ①), so pack no longer re-stubs dist with a jiti stub; the
//      `--config.ignore-scripts=true` flag is the verified belt-and-braces fallback. Pack MUST run
//      from the package dir — a workspace-root relative path is resolved as a registry spec
//      (ERR_PNPM_PACKAGE_VERSION_NOT_FOUND), and `--ignore-scripts` is not a supported pack flag.
//   3. tarball content assertions (anti-false-green): dist/cli.mjs must carry zero stub markers
//      (createJiti / node_modules/.pnpm) and exceed 10 kB (dev stub ≈ 614 B vs real ≈ 72 kB — the
//      >10 kB bound rejects a stub while staying well below the real product; a harsher >100 kB
//      threshold could misjudge a legitimately smaller real bundle). templates/ and
//      dist/documents/schema/ (canonical overall/plan/phase-spec/add-phase-protocol) must be
//      present, plus the harness registry the dispatch ships gate resolves at runtime.
//   4. mkdtemp consumer repo: git init + npm init + `npm install <tarball>` — consumer layout; the
//      installed engine resolves all runtime resources under node_modules, never the repo tree.
//   5. consumer chain: installed entry (`node <installed>/dist/cli.mjs`, plus the shipped
//      node_modules/.bin/cdd), `cdd help` (absolute CLI dir + addressable schema/templates dirs),
//      then the five-command dry-run chain (implement / review task / fix task / review branch /
//      fix branch). The fixture plan + design spec + the parent overall it links are GENERATED
//      INSIDE the temp repo (D1), derived from the tarball's shipped doc-structure schemas and
//      engine-config — the plan declares `**Spec:**` and the spec doc is derived alongside (the
//      engine's doc-existence audit path is thereby a deterministic pass, never dependent on a
//      dry-run degraded-BLOCK).
//   6. per-command return-block contract assertions (status / commits / artifacts / blocker /
//      counters) — the consumer-equivalent result surface for every output.
//
// Entry subcommand `smoke-cdd` keeps its name with the consumer-sim semantics (Non-goal#1 — no new
// subcommand). The old smoke's P5 deletion-surface sweep (collectGateLexiconHits / checkDeletionSurface)
// is NOT carried over: that residue face overlaps validate block 5c (residue.ts) — the sweep's
// responsibility belongs to 5c, no double write. Depends on Node built-ins + execa + the tar ships
// present on macOS (bsdtar) and CI (GNU tar) — both support `-tzf` (list) and `-xOzf` (stdout read).

import { execaCommandSync, execaSync } from "execa";
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd(); // repo toplevel (run.ts invokes with the repo root as cwd)
const NODE = process.execPath;
const PKG = "packages/cdd-engine";
const PKG_SCOPE = "@oscaner-skills/cdd-engine";
const PKG_DIR = path.join(root, PKG);
const CLI_ENTRY = "dist/cli.mjs";

// Real bundle anti-false-green bounds: dev stub ≈ 614 B, real ≈ 72 kB. The >10 kB floor rejects a
// stub (or a half-shipped artifact) while staying well below the real product's byte size.
const REAL_BUNDLE_MIN_BYTES = 10_000;
const STUB_MARKERS = /createJiti|node_modules[\\/]\.pnpm/;

const DOC_SCHEMA_FILES = ["overall.json", "plan.json", "phase-spec.json", "add-phase-protocol.json"];

function assertTrue(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`consumer-sim: ${msg}`);
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
    if (node === undefined) throw new Error(`consumer-sim: shipped schema token missing at ${parts.join(".")}`);
  }
  return String(node);
}

/** A regex-pattern token reduced to its un-anchored literal prefix (e.g. `^## Constraints\\s*$` →
 * `## Constraints`) — used for the pattern-declared fixture surfaces (the canonical `## Constraints`
 * heading); an unreducible pattern shape fails loud. */
function patternLiteral(pattern: string): string {
  const body = pattern.replace(/^\^/, ""); // drop the anchor — the literal is the unanchored prefix
  const m = body.match(/^([^\\^$+*?()|\[\]]+)/);
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

function assertTarball(tgz: string): void {
  const entries = tarList(tgz);
  const has = (member: string) => entries.includes(member);
  const cliMember = `package/${CLI_ENTRY}`;
  assertTrue(has(cliMember), `tarball missing the CLI entry ${cliMember} (entries: ${entries.length} files)`);
  const cliBytes = Buffer.byteLength(tarRead(tgz, cliMember), "utf8");
  assertTrue(cliBytes > REAL_BUNDLE_MIN_BYTES, `dist/cli.mjs is ${cliBytes} B — expected a real build > ${REAL_BUNDLE_MIN_BYTES} B (dev stub ≈ 614 B) — did the pack ship a stub?`);
  assertTrue(!STUB_MARKERS.test(tarRead(tgz, cliMember)), `stub markers (createJiti / node_modules/.pnpm) found in package/dist/cli.mjs — the pack shipped the dev stub, not the build product`);
  // Canonical doc-structure schemas addressable at the published dist face.
  for (const f of DOC_SCHEMA_FILES) {
    assertTrue(has(`package/dist/documents/schema/${f}`), `tarball missing the canonical doc-structure schema dist/documents/schema/${f}`);
  }
  // The render resource dir + the handoff schemas it serves.
  assertTrue(has("package/templates/template-contract.json"), "tarball missing templates/template-contract.json");
  assertTrue(has("package/templates/schema/task-handoff-schema.json"), "tarball missing templates/schema/task-handoff-schema.json");
  // The harness registry the dispatch ship gate resolves at runtime (build copy entry publishes the
  // dedicated dist/resources/ face — see build.config.ts).
  assertTrue(has("package/dist/resources/harness-registry.json"), "tarball missing dist/resources/harness-registry.json (dispatch ship gate reads it at runtime)");
  // Zero in-repo residues inside the packed artifact: the tarball must never reference the repo
  // tree (a jiti aliased stub or an absolute alias would embed it).
  assertTrue(!tarRead(tgz, cliMember).includes(root), `package/dist/cli.mjs embeds the repo root path ${root} — the tarball is not consumer-standalone`);
}

// ---- consumer install (step 4) ----

function installConsumer(tgz: string): { consumerRoot: string; installed: string } {
  const consumerRoot = mkdtempSync(path.join(tmpdir(), "cdd-consumer-repo-"));
  execaSync("git", ["init", "-q"], { cwd: consumerRoot });
  execaSync("git", ["config", "user.email", "cdd-consumer-sim@oscaner.dev"], { cwd: consumerRoot });
  execaSync("git", ["config", "user.name", "CDD Consumer Sim"], { cwd: consumerRoot });
  execaSync("npm", ["init", "-y"], { cwd: consumerRoot, stdio: "inherit" });
  execaSync("npm", ["install", tgz], { cwd: consumerRoot, stdio: "inherit" });
  const installed = path.join(consumerRoot, "node_modules", ...PKG_SCOPE.split("/"));
  assertTrue(existsSync(path.join(installed, CLI_ENTRY)), `installed CLI entry missing: ${path.join(installed, CLI_ENTRY)}`);
  // The shipped bin surface: node_modules/.bin/cdd must resolve (package.json bin → dist/cli.mjs).
  assertTrue(existsSync(path.join(consumerRoot, "node_modules", ".bin", "cdd")), "shipped bin node_modules/.bin/cdd missing");
  return { consumerRoot, installed };
}

// ---- fixture derivation (D1) — generated inside the temp repo, derived from the shipped schemas ----

interface Fixture {
  plan: string;      // repo-root-relative plan path
  spec: string;      // repo-root-relative spec path
  overall: string;   // repo-root-relative overall path (the plan's **Parent program** link target)
  slug: string;      // engine workspace slug (plan basename minus -plan)
  workspace: string; // <consumerRoot>/<workspaceRoot>/<slug> — derived from the shipped engine-config
}

function deriveFixture(consumerRoot: string, installed: string): Fixture {
  const schemaRoot = path.join(installed, "dist", "documents", "schema");
  const planSchema = readSchema(schemaRoot, "plan");
  const phaseSpecSchema = readSchema(schemaRoot, "phase-spec");
  const overallSchema = readSchema(schemaRoot, "overall");
  // Canonical markers extracted from the SHIPPED schemas (the fixture is derived, never hardcoded).
  const specMark = schemaToken(planSchema, ["properties", "header", "properties", "specRef", "properties", "marker", "const"]);                      // **Spec:**
  const parentMark = schemaToken(planSchema, ["properties", "header", "properties", "parentProgram", "properties", "marker", "const"]);            // **Parent program**
  const constraintsHeading = patternLiteral(schemaToken(planSchema, ["properties", "constraints", "properties", "formACanonical", "properties", "heading", "pattern"])); // ## Constraints
  const taskHeadingFormat = schemaToken(planSchema, ["properties", "taskHeadings", "properties", "format", "const"]);                              // ### Task N:
  const doPattern = schemaToken(planSchema, ["properties", "taskBlock", "properties", "do", "pattern"]);                                           // ^- \*\*Do\*\*:
  const acceptPattern = schemaToken(planSchema, ["properties", "taskBlock", "properties", "acceptance", "pattern"]);                                // ^- \*\*验收\*\*:
  const versionMark = schemaToken(phaseSpecSchema, ["properties", "header", "properties", "version", "properties", "marker", "const"]);             // **Version**
  const overallVersionMark = schemaToken(overallSchema, ["properties", "header", "properties", "version", "properties", "marker", "const"]);        // **Version**
  const phaseInventoryHeader = schemaToken(overallSchema, ["properties", "phaseInventory", "properties", "columnNames", "properties", "header", "const"]); // | # | Phase | … | Dependency |
  assertTrue(specMark === "**Spec:**" && parentMark === "**Parent program**" && constraintsHeading === "## Constraints"
    && taskHeadingFormat === "### Task N:" && versionMark === "**Version**" && overallVersionMark === versionMark,
    `shipped schema tokens drifted: Spec=${JSON.stringify(specMark)} Parent=${JSON.stringify(parentMark)} Constraints=${JSON.stringify(constraintsHeading)} Task=${JSON.stringify(taskHeadingFormat)} Version=${JSON.stringify(versionMark)} OverallVersion=${JSON.stringify(overallVersionMark)}`);

  // The engine's workspace slug rule (schema-independent engine name derivation): plan basename
  // minus `.md`, with a single trailing -design/-plan layer stripped.
  const planName = "fixture-plan.md";
  const slug = path.basename(planName, ".md").replace(/-(?:design|plan)$/, "");
  // Workspace root from the SHIPPED engine-config (never a repo literal).
  const config = JSON.parse(readFileSync(path.join(installed, "templates", "engine-config.json"), "utf8")) as { handoffNamespace: { workspaceRoot: string } };
  const workspaceRootSeg = config.handoffNamespace.workspaceRoot;
  assertTrue(workspaceRootSeg === ".osuperpowers/cdd", `shipped engine-config handoffNamespace.workspaceRoot drifted: ${JSON.stringify(workspaceRootSeg)}`);

  const spec = "fixture-design.md";
  // The spec doc the plan's **Spec:** line must resolve to (the audit's Class-A target). It carries
  // the spec's own face (a **Version** line — the phase-spec schema's own required surface) and NO
  // Parent program line — the four-table audit no-ops on the truncated lineage, making the consumer
  // chain's doc-existence path deterministic.
  writeFileSync(path.join(consumerRoot, spec), [
    `# ${spec}`,
    "",
    `- ${versionMark}: v1.0 · 2026-09-22`,
    "",
    "Fixture design spec derived from the shipped cdd-engine doc-structure schemas for the consumer-sim.",
    "",
  ].join("\n"), "utf8");

  // The overall the plan's **Parent program** link resolves to — a minimal canonical charter
  // (canonical header + empty Phase inventory table, the canonical 7-column header derived from the
  // shipped overall schema). The fixture spec omits its own Parent program line, so this overall is
  // never a reached audit face — materializing it only makes the plan's own parent link resolve
  // (self-consistency), never a document the four-table / overall-contract audit runs against.
  const overall = "fixture-overall.md";
  writeFileSync(path.join(consumerRoot, overall), [
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
  ].join("\n"), "utf8");

  const plan = planName;
  // Form-A plan (canonical ## Constraints) — the structural markers are the schema-derived tokens;
  // the task bullet lines use the canonical marker spellings and are CONFORMANCE-checked against
  // the shipped do/acceptance patterns below (drift → the consumer-sim fails loud, never silent).
  const taskHeading = taskHeadingFormat.replace("N", "1");
  const doLine = "- **Do**: exercise the installed cdd engine under dry-run in a consumer layout";
  const acceptLine = "- **验收**: the dry-run chain prints the return-block contract";
  assertTrue(new RegExp(doPattern).test(doLine), `fixture Do line does not match the shipped pattern ${doPattern}: ${doLine}`);
  assertTrue(new RegExp(acceptPattern).test(acceptLine), `fixture acceptance line does not match the shipped pattern ${acceptPattern}: ${acceptLine}`);
  writeFileSync(path.join(consumerRoot, plan), [
    `# Fixture Plan`,
    "",
    `${specMark} [${spec}](${spec})`,
    "",
    `${parentMark}: [fixture-overall.md v1.0](fixture-overall.md)`,
    "",
    `${constraintsHeading}`,
    "",
    `### 口径`,
    "",
    `Consumer-sim fixture constraints materialized into the temp repo.`,
    "",
    `${taskHeading} fixture task`,
    "",
    doLine,
    acceptLine,
    "",
  ].join("\n"), "utf8");

  return { plan, spec, overall, slug, workspace: path.join(consumerRoot, workspaceRootSeg, slug) };
}

// ---- consumer chain (steps 5 & 6) ----

const COUNTERS_RE = /^counters: timeout=\d+ contract-violation=\d+ engine-self-written=\d+ recovery=\d+$/;

/** Assert the command's last stdout block is the 5-line return-block contract (per-command line
 *  expectations included — the consumer-equivalent result surface). */
function assertReturnBlock(cmd: string, stdout: string): void {
  const lastBlock = stdout.trim().split(/\n{2,}/).at(-1) ?? "";
  const lines = lastBlock.split("\n");
  const lineByKey = new Map<string, string>();
  for (const line of lines) {
    const m = line.match(/^([a-z_]+): (.*)$/);
    if (m) lineByKey.set(m[1], m[2]);
  }
  const checks: Array<[string, RegExp]> = [
    ["status", /^APPROVED$/],
    ["commits", /^base=/],
    ["artifacts", /^/],
    ["blocker", /^/],
  ];
  for (const [key, re] of checks) {
    const v = lineByKey.get(key);
    assertTrue(v !== undefined, `${key}: line missing from the return block (last block: ${JSON.stringify(lastBlock)})`);
    assertTrue(re.test(v!), `${key}: value ${JSON.stringify(v)} does not match ${re}`);
  }
  if (cmd.includes("review --type branch")) {
    assertTrue(/^base=[0-9a-f]{40} head=[0-9a-f]{40}$/.test(lineByKey.get("commits")!),
      `branch review commits ${JSON.stringify(lineByKey.get("commits"))} — expected base=<sha> head=<sha>`);
  } else if (cmd.includes("fix --type branch")) {
    assertTrue(/^base=dry-run head=dry-run$/.test(lineByKey.get("commits")!),
      `branch fix commits ${JSON.stringify(lineByKey.get("commits"))} — expected base=dry-run head=dry-run`);
  } else {
    assertTrue(/^base=dry-run$/.test(lineByKey.get("commits")!),
      `task-family commits ${JSON.stringify(lineByKey.get("commits"))} — expected base=dry-run`);
  }
  const counters = lines.find((l) => l.startsWith("counters: "));
  assertTrue(!!counters && COUNTERS_RE.test(counters!), `counters line missing or malformed (got ${JSON.stringify(counters)})`);
}

function runConsumerChain({ consumerRoot, installed }: { consumerRoot: string; installed: string }): void {
  const cli = path.join(installed, CLI_ENTRY);
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: "1" };

  // `cdd help` outside the git repo — the discovery surface (cli dir + addressable schema/templates
  // dirs), the install-face resource proof (AC6: installed-face schema-dir addressability measured).
  const helpOut = execaSync(NODE, [cli, "help"], { cwd: consumerRoot }).stdout;
  const helpLines = new Map(helpOut.split("\n").filter((l) => l.includes(": ")).map((l) => {
    const idx = l.indexOf(": ");
    return [l.slice(0, idx), l.slice(idx + 2)];
  }));
  // The engine prints realpath'd resource dirs (node realpaths loaded modules; macOS /var → /private/var) —
  // compare against the realpath'd expectation for a platform-neutral byte match.
  const expected = new Map([
    ["cli", realpathSync(path.join(installed, "dist"))],
    ["schemas", realpathSync(path.join(installed, "dist", "documents", "schema"))],
    ["templates", realpathSync(path.join(installed, "templates"))],
  ]);
  for (const [key, exp] of expected) {
    const got = helpLines.get(key);
    assertTrue(got === exp, `cdd help ${key}: ${JSON.stringify(got)} — expected the installed path ${exp}`);
  }
  for (const f of DOC_SCHEMA_FILES) {
    assertTrue(existsSync(path.join(installed, "dist", "documents", "schema", f)), `installed schema dir missing ${f}`);
  }

  // Fixture generation (D1) inside the temp repo — fixture-plan.md, its design spec and the parent
  // overall it links to — then one initial commit so the branch family has a real reviewed range
  // (base == head, the self-review shape).
  const fixture = deriveFixture(consumerRoot, installed);
  execaSync("git", ["add", "-A"], { cwd: consumerRoot });
  execaSync("git", ["commit", "-m", "chore: consumer-sim fixture plan + spec + overall"], { cwd: consumerRoot });
  const head = execaCommandSync("git rev-parse HEAD", { cwd: consumerRoot }).stdout.trim();
  const head7 = head.slice(0, 7);

  // The five-command dry-run chain — argv shape mirrors the dispatch contract the engine's own
  // black-box suite exercises; each command asserts its return block before the next runs.
  const chain = [
    ["--dry-run", "implement", "--task", "1", "--plan", fixture.plan],
    ["--dry-run", "review", "--type", "task", "--task", "1", "--plan", fixture.plan],
    ["--dry-run", "fix", "--type", "task", "--task", "1", "--plan", fixture.plan,
      "--findings", path.join(fixture.workspace, "task-1-review-1.json")],
    ["--dry-run", "review", "--type", "branch", "--plan", fixture.plan, "--base", head, "--head", head],
    ["--dry-run", "fix", "--type", "branch", "--plan", fixture.plan,
      "--findings", path.join(fixture.workspace, `branch-review-${head7}..${head7}-r1.json`)],
  ];
  for (const [i, args] of chain.entries()) {
    const res = execaSync(NODE, [cli, ...args], { cwd: consumerRoot, env });
    assertReturnBlock(args.join(" "), res.stdout);
    console.log(`  consumer-sim step ${i + 1}: ${args.slice(0, 3).join(" ")} … ${args.at(-1)}`);
  }
}

export function main(): void {
  // 1. build — the real unbuild product into dist (dev and publish share the same dist entry).
  execaSync("pnpm", ["--filter", PKG_SCOPE, "build"], { cwd: root, stdio: "inherit" });

  // 2. pack — from the package dir (prepare removed; --config.ignore-scripts=true is the verified
  //    belt-and-braces fallback).
  const outDir = mkdtempSync(path.join(tmpdir(), "cdd-consumer-pack-"));
  execaSync("pnpm", ["pack", "--pack-destination", outDir, "--config.ignore-scripts=true"], { cwd: PKG_DIR, stdio: "inherit" });
  const pkgJson = JSON.parse(readFileSync(path.join(PKG_DIR, "package.json"), "utf8")) as { name: string; version: string };
  const baseName = pkgJson.name.replace(/^@/, "").replace("/", "-"); // @scope/name → scope-name (pnpm pack's unscoped file prefix)
  const tgzName = `${baseName}-${pkgJson.version}.tgz`;
  const tgz = path.join(outDir, tgzName);
  assertTrue(existsSync(tgz), `pack produced no ${tgzName} at ${outDir}`);

  // 3. tarball content assertions (anti-false-green).
  assertTarball(tgz);

  // 4. consumer install + 5. consumer chain + 6. per-command return-block assertions.
  const consumer = installConsumer(tgz);
  runConsumerChain(consumer);

  console.log("OK — cdd-engine consumer-sim (pack → install → help + 5-command dry-run chain green, tarball = real product)");
}
