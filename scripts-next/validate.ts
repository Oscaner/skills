// scripts-next/validate.ts — the single validate orchestrator (T14): ONE data-table
// runner over the composed step set — emit freshness (the scripts-next emit byte
// check), the guard triune (anatomy · word-face · channels — the new-tree export
// consumption), the engine vitest suite, the scripts + scripts-next vitest suite,
// the kairos behavior tree, the type-check gate and the package version sync. The
// thin single-purpose wrapper modules of the old validate tree fold into this module;
// the step set IS the data table.
//
// The runner: one loop over `{ name, run() }` steps, `== <name> ==` + OK per step,
// `== FAIL: <name> ==` + message + exit 1 on error, ALL PASS + 0 when green.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

/** A subprocess block — run() spawns cmd/args at the repo root (stdout/stderr inherited). */
export class SubprocessBlock implements StepRun {
  readonly name: string;
  #cmd: string;
  #args: string[];

  constructor(meta: { name: string; cmd: string; args: string[] }) {
    this.name = meta.name;
    this.#cmd = meta.cmd;
    this.#args = meta.args;
  }

  run(): void {
    execFileSync(this.#cmd, this.#args, { cwd: REPO_ROOT, stdio: "inherit" });
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
  const temp = mkdtempSync(path.join(tmpdir(), "scripts-next-emit-"));
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

/** The composed validate step set — the single data table. */
export const steps = [
  new CheckBlock({ name: "emit freshness (scripts-next emit, byte-checked)", run: checkEmitFresh }),
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
  new SubprocessBlock({
    name: "cdd-engine engine test suite (vitest, src + src-next projects)",
    cmd: "pnpm",
    args: ["-C", "packages/cdd-engine", "test"],
  }),
  new SubprocessBlock({
    name: "scripts + scripts-next unit tests (root vitest run)",
    cmd: "pnpm",
    args: ["exec", "vitest", "run"],
  }),
  new SubprocessBlock({
    name: "kairos node:test behavior tree",
    cmd: "node",
    args: ["--test", "packages/kairos/tests/*.test.ts"],
  }),
  new SubprocessBlock({
    name: "type-check (tsc --noEmit × 4 projects)",
    cmd: "pnpm",
    args: ["run", "typecheck"],
  }),
  new CheckBlock({ name: "package version sync", run: checkVersionSync }),
];
