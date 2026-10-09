// scripts/validate.ts — the single validate orchestrator: ONE data-table
// runner over the composed step set — emit freshness (the scripts emit byte
// check), the guard triune (anatomy · word-face · channels — the new-tree export
// consumption), the engine vitest suite, the scripts vitest suite, the kairos
// behavior tree, the type-check gate and the package version sync. The thin
// single-purpose wrapper modules of the old validate tree fold into this module;
// the step set IS the data table. `precommitSteps` is the tree-independent subset
// (the full set minus the engine suite — the lint-staged catch-all's surface).
//
// The runner: one loop over `{ name, run() }` steps, `== <name> ==` + OK per step,
// `== FAIL: <name> ==` + message + exit 1 on error, ALL PASS + 0 when green.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { NodeFs } from "../packages/cdd-engine/src-next/contract/invariants.ts";
import { Contract } from "../packages/cdd-engine/src-next/contract/judge.ts";
import { emitComparer, emitService, REPO_ROOT } from "./emit.ts";
import { guardLibrary } from "./lib/guard.ts";

/** The minimal step face — structural, so a plain `{ name, run }` feeds the runner. */
export interface StepRun {
  name: string;
  run(): void;
}

/** An in-process check block — run() executes the block's check closure. */
export class CheckBlock implements StepRun {
  readonly name: string;
  #check: () => void;

  constructor(meta: { name: string; run: () => void }) {
    this.name = meta.name;
    this.#check = meta.run;
  }

  run(): void {
    this.#check();
  }
}

/** A subprocess block — run() spawns cmd/args at the repo root (stdout/stderr inherited).
 *  `args` is public so wiring guards can assert the spawned surface (e.g. the kairos
 *  behavior-tree glob) without re-running the command. */
export class SubprocessBlock implements StepRun {
  readonly name: string;
  readonly args: string[];
  #cmd: string;

  constructor(meta: { name: string; cmd: string; args: string[] }) {
    this.name = meta.name;
    this.#cmd = meta.cmd;
    this.args = meta.args;
  }

  run(): void {
    execFileSync(this.#cmd, this.args, { cwd: REPO_ROOT, stdio: "inherit" });
  }
}

/** The single step-runner loop — validation orchestration runs every step through it. */
export class ValidateRunner {
  async run(steps: ReadonlyArray<StepRun>): Promise<number> {
    for (const s of steps) {
      try {
        console.log(`== ${s.name} ==`);
        s.run();
        console.log("OK");
      } catch (e) {
        console.error(`== FAIL: ${s.name} ==`);
        console.error((e as { message?: unknown })?.message ?? String(e));
        return 1;
      }
    }
    console.log("ALL PASS");
    return 0;
  }

  /** Standalone-execution guard — wires a directly-executed module's steps to run(). */
  runIfMain(metaUrl: string, steps: ReadonlyArray<StepRun>): void {
    if (!isMain(metaUrl)) return;
    void this.run(steps).then((code) => process.exit(code != null ? code : 1));
  }
}

export function isMain(metaUrl: string): boolean {
  return Boolean(process.argv[1] && metaUrl === pathToFileURL(realpathSync(process.argv[1])).href);
}

export const validateRunner = new ValidateRunner();

// ---------------------------------------------------------------------------
// The step bodies — the data table's check closures
// ---------------------------------------------------------------------------

/** The emit freshness check — regen into a temp tree + byte-diff against the committed
 *  products + the stale-product walk (the dry-run drift gate). */
function checkEmitFresh(): void {
  const generatedPaths: string[] = [];
  const temp = mkdtempSync(path.join(tmpdir(), "scripts-emit-"));
  try {
    emitService.emitAll(temp, { generatedPaths });
    emitComparer.compareTrees(REPO_ROOT, temp, { generatedPaths });
    console.log(`OK — ${generatedPaths.length} products fresh`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

/** A guard finding printer — one line per finding (the validate step's fail face). */
function assertNoGuardFindings(findings: readonly { label: string; file: string }[]): void {
  if (findings.length === 0) return;
  throw new Error(`guard findings:\n${findings.map((f) => `  ${f.file}: ${f.label}`).join("\n")}`);
}

/** The package version sync — every kairos version-carrying surface equal (package.json
 *  SOT · source.json row · marketplace entry · the .version-bump files). */
function checkVersionSync(): void {
  const readJson = (rel: string): Record<string, unknown> =>
    JSON.parse(readFileSync(path.join(REPO_ROOT, rel), "utf8")) as Record<string, unknown>;
  const kairosPkg = readJson("packages/kairos/package.json");
  const kairosVersion = kairosPkg.version;
  if (typeof kairosVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(kairosVersion)) {
    throw new Error(`Invalid kairos version format: ${String(kairosVersion)}`);
  }
  const source = readJson("marketplace/source.json") as {
    plugins?: Array<{ name: string; version?: unknown }>;
  };
  const market = readJson(".claude-plugin/marketplace.json") as {
    plugins?: Array<{ name: string; version?: unknown }>;
  };
  const srcRow = source.plugins?.find((p) => p.name === "kairos");
  const mktRow = market.plugins?.find((p) => p.name === "kairos");
  if (srcRow?.version !== kairosVersion || mktRow?.version !== kairosVersion) {
    throw new Error(
      `kairos version mismatch: package.json ${kairosVersion} · source.json ${String(srcRow?.version)} · marketplace ${String(mktRow?.version)}`,
    );
  }
  const bump = readJson("packages/kairos/.version-bump.json") as {
    files?: Array<{ path: string; field: string }>;
  };
  for (const f of bump.files ?? []) {
    const doc = JSON.parse(
      readFileSync(path.join(REPO_ROOT, "packages", "kairos", f.path), "utf8"),
    ) as unknown;
    const val = f.field
      .split(".")
      .reduce((o: unknown, k: string) => (o as Record<string, unknown> | undefined)?.[k], doc);
    if (val !== kairosVersion) {
      throw new Error(
        `kairos ${f.path} ${String(val)} != ${kairosVersion} — run the emit orchestrator`,
      );
    }
  }
  const enginePkg = readJson("packages/cdd-engine/package.json");
  if (typeof enginePkg.version !== "string" || !/^\d+\.\d+\.\d+$/.test(enginePkg.version)) {
    throw new Error(`Invalid cdd-engine version format: ${String(enginePkg.version)}`);
  }
  console.log(`OK — kairos ${kairosVersion} · cdd-engine ${enginePkg.version}`);
}

/** The engine suite step — the tree-dependent block, excluded from the pre-commit
 *  subset (the old pre-commit face's ruling: a necessarily-dirty working tree is
 *  structurally incompatible with the engine's entry-gate black-box dispatch cases). */
export const engineSuiteStep = new SubprocessBlock({
  name: "cdd-engine engine test suite (vitest, src-next)",
  cmd: "pnpm",
  args: ["-C", "packages/cdd-engine", "test"],
});

/** The pre-contract docs — the specs/plans whose structural surface predates the
 *  P4.1 T1 doc-contract (their outlines were authored and reviewed before the
 *  engine judge existed; they fail the new-form gate's structural rules by design —
 *  the T3 migration retrofitted only their CONTAINER: the strict **Version** header
 *  + a Change-history table). Every other spec/plan doc MUST pass the FULL gate.
 *  A pre-contract doc graduates from the list when it is migrated to the new form
 *  (its gate findings go to zero — remove the basename then). */
const PRECONTRACT_DOCS = new Set<string>([
  "docs/kairos/plans/2026-09-13-osuperpowers-overhaul-p5.md",
  "docs/kairos/plans/2026-09-13-osuperpowers-overhaul-p6.md",
  "docs/kairos/plans/2026-09-21-consumer-parity-p1.md",
  "docs/kairos/plans/2026-09-21-consumer-parity-p4.1.md",
  "docs/kairos/plans/2026-09-21-consumer-parity-p4.2.md",
  "docs/kairos/plans/2026-09-21-consumer-parity-p4.3.md",
  "docs/kairos/plans/2026-09-21-consumer-parity-p4.4.md",
  "docs/kairos/plans/2026-09-27-pi-harness-p1.md",
  "docs/kairos/plans/2026-09-27-pi-harness-p2.md",
  "docs/kairos/plans/2026-09-27-pi-harness-p3.md",
  "docs/kairos/plans/2026-09-27-pi-harness-p4.md",
  "docs/kairos/plans/2026-09-27-pi-harness-p5.md",
  "docs/kairos/plans/2026-09-28-cdd-review-contract-fix.md",
  "docs/kairos/plans/2026-10-02-doc-architecture-v2-p1.md",
  "docs/kairos/plans/2026-10-02-doc-architecture-v2-p2.md",
  "docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.md",
  "docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.1.md",
  "docs/kairos/specs/2026-09-13-osuperpowers-overhaul-overall.md",
  "docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p1-design.md",
  "docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p2-design.md",
  "docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p3-design.md",
  "docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p4-design.md",
  "docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p5-design.md",
  "docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p6-design.md",
  "docs/kairos/specs/2026-09-21-consumer-parity-p1-design.md",
  "docs/kairos/specs/2026-09-21-consumer-parity-p2-design.md",
  "docs/kairos/specs/2026-09-21-consumer-parity-p3-design.md",
  "docs/kairos/specs/2026-09-21-consumer-parity-p4.1-design.md",
  "docs/kairos/specs/2026-09-21-consumer-parity-p4.2-design.md",
  "docs/kairos/specs/2026-09-21-consumer-parity-p4.3-design.md",
  "docs/kairos/specs/2026-09-21-consumer-parity-p4.4-design.md",
  "docs/kairos/specs/2026-09-27-pi-harness-p1-design.md",
  "docs/kairos/specs/2026-09-27-pi-harness-p2-design.md",
  "docs/kairos/specs/2026-09-27-pi-harness-p3-design.md",
  "docs/kairos/specs/2026-09-27-pi-harness-p4-design.md",
  "docs/kairos/specs/2026-09-27-pi-harness-p5-design.md",
  "docs/kairos/specs/2026-09-28-cdd-review-contract-fix.md",
  "docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md",
  "docs/kairos/specs/2026-10-02-doc-architecture-v2-p1-design.md",
  "docs/kairos/specs/2026-10-02-doc-architecture-v2-p2-design.md",
  "docs/kairos/specs/2026-10-02-doc-architecture-v2-p3-design.md",
  "docs/kairos/specs/2026-10-02-doc-architecture-v2-p3.1-design.md",
]);

/** The doc-contract gate over the specs/plans tree — the engine judge (the same
 *  Contract.validate the pre-flight seam runs at dispatch) on every docs/kairos
 *  spec/plan doc. A finding on any NON-pre-contract doc fails the step — the
 *  T3 acceptancce "doc-contract 对新形全绿" is real, not a fixture-only suite:
 *  the wave's own plan/spec docs were CDD_BLOCKED at dispatch while `pnpm run
 *  validate` stayed green (the find-#8 gap — the gate's target docs never featured
 *  in CI). The docKey derives the way the doc faces dispatch (plan → plan,
 *  *-overall.md → overall, other spec → phaseSpec). */
function checkDocContract(): void {
  const contract = new Contract();
  const fs = new NodeFs();
  const violations: string[] = [];
  const unreadable: string[] = [];
  let enforced = 0;
  let preContract = 0;
  for (const dir of ["specs", "plans"]) {
    const docsDir = path.join(REPO_ROOT, "docs", "kairos", dir);
    for (const name of [...fs.list(docsDir)].sort()) {
      if (!name.endsWith(".md")) continue;
      const rel = `docs/kairos/${dir}/${name}`;
      const full = path.join(REPO_ROOT, rel);
      const content = fs.read(full);
      if (content === null) {
        unreadable.push(rel);
        continue;
      }
      const docKey =
        dir === "plans" ? "plan" : name.endsWith("-overall.md") ? "overall" : "phaseSpec";
      const findings = contract.validate({ docKey, path: full, content, root: REPO_ROOT, fs });
      if (findings.length === 0) {
        enforced += 1;
        continue;
      }
      if (PRECONTRACT_DOCS.has(rel)) {
        preContract += 1;
        continue;
      }
      violations.push(
        `${rel}: ${findings.map((f) => `${f.kind}@${f.field}: ${f.message}`).join(" · ")}`,
      );
    }
  }
  if (unreadable.length > 0) {
    throw new Error(`unreadable doc-contract targets: ${unreadable.join(", ")}`);
  }
  if (violations.length > 0) {
    throw new Error(`doc-contract findings on new-form specs/plans:\n${violations.join("\n")}`);
  }
  console.log(
    `OK — doc-contract gate clean on ${enforced} specs/plans · ${preContract} pre-contract docs exempt`,
  );
}

/** The composed validate step set — the single data table. */
export const steps = [
  new CheckBlock({ name: "emit freshness (scripts emit, byte-checked)", run: checkEmitFresh }),
  new CheckBlock({
    name: "kairos skill anatomy (the typed skill-anatomy contract)",
    run: () => assertNoGuardFindings(guardLibrary.checkAnatomy()),
  }),
  new CheckBlock({
    name: "word-face audit (the guard-ban vocabulary from the word-table export)",
    run: () => assertNoGuardFindings(guardLibrary.checkWords()),
  }),
  new CheckBlock({
    name: "engine channel audit (CLI × runtime · host markers · dispatch/refs)",
    run: () => assertNoGuardFindings(guardLibrary.checkChannels()),
  }),
  new CheckBlock({
    name: "doc-contract gate over the specs/plans tree (the engine judge)",
    run: checkDocContract,
  }),
  engineSuiteStep,
  new SubprocessBlock({
    name: "scripts unit tests (root vitest run)",
    cmd: "pnpm",
    args: ["exec", "vitest", "run"],
  }),
  new SubprocessBlock({
    name: "kairos node:test behavior tree",
    cmd: "node",
    args: ["--test", "packages/kairos/tests/*.test.ts"],
  }),
  new SubprocessBlock({
    name: "type-check (tsc --noEmit × 3 projects)",
    cmd: "pnpm",
    args: ["run", "typecheck"],
  }),
  new CheckBlock({ name: "package version sync", run: checkVersionSync }),
];

/** The tree-independent pre-commit subset — the composed step set minus the engine
 *  suite; the `*` lint-staged catch-all runs `pnpm run precommit` on every commit
 *  from a dirty tree. */
export const precommitSteps = steps.filter((step) => step !== engineSuiteStep);
