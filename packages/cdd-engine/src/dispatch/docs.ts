// packages/cdd-engine/src/dispatch/docs.ts — DocsLifecycle (Task 8; ex dispatch/docs.mjs / legacy
// lib/runner/run-docs.mjs): the docs-function lifecycle for `cdd review/fix --type spec|plan`.
// DocsLifecycle extends DispatchLifecycle (dispatch/base.ts) and inherits BOTH commit gates —
// the pre-flight entry gate (pre-commit clean tree) and the post-flight exit gate
// (validateCommitContract) are the base's default hooks, shared with the task face per AC10 +
// spec-review-2 [2] (docs review/fix dispatch consume the same double gate as the task face;
// the base implements one, no fork).
//   Pre-flight:  resolveContext derives root (injected / engine single root) + guards the
//                canonical handoffPath; dry-run finishes immediately (no gates, no spawn).
//   Dispatch:    prompt render (schema verbatim + fixed HANDOFF_WRITE_GATE) → spawn the docs agent CLI.
//   Post-flight: handoff read + unparseable/schema-invalid BLOCKED handling (writeBlocked) +
//                review/fix finalization; the exit gate (override commitPostCheck) runs
//                validateCommitContract — docs fix dispatch's exit-gate gap (P5 落点 2) is
//                closed here, same judgment as rules/commit.ts.
// runDocsTask keeps the legacy surface ({ exitCode, handoff }; noExit-free — the CLI discards the
// return, so an entry-gate block throws ExitRequested(1) for the process exit) and delegates to
// the lifecycle — existing consumers/tests unchanged.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  DispatchLifecycle,
  type DispatchContext,
  type DispatchHookContext,
  DispatchBlocked,
} from "./base.ts";
import { invokeCli, resolveTimeoutMs } from "../infra/invoke.ts";
import { withLifecycle } from "../infra/proc.ts";
import { getRoot } from "../infra/root.ts";
import { exitWithCode, ExitRequested } from "../infra/exit.ts";
import { writeHandoff, writeOwnHandoff, readJson } from "../artifacts/handoff/write.ts";
import { finalizeHandoff, persistFinalized } from "../artifacts/handoff/finalize.ts";
import { loadRegistry, checkHarness, REG_PATH } from "../infra/registry.ts";
import { loadHandoffSchema, validateHandoffSchema, recoverHandoff } from "../rules/schema.ts";
import { validateCommitContract } from "../rules/commit.ts";
import { renderHandoffSchemaJson, renderTemplate, reviewHardGate, docsFixHardGate, HANDOFF_SCHEMA_JSON_SLOT } from "../render/templates.ts";
import { hashFile } from "./review-loop.ts";

export interface DocsLifecycleOptions {
  /** docs agent harness key (registry lookup) */
  harness: string;
  /** dispatch mode — "review" | "fix" (docs carries no implement; the mode is the exit gate's) */
  mode: string;
  /** prompt template name ("review" shared shell / canonical fix.{type} fixTemplate) */
  template: string;
  /** review/fix subtype (spec|plan) → invokeCli (op, type) injection params */
  type: string;
  /** path to the document being reviewed/fixed */
  doc: string;
  /** explicit findings path for fix mode (round derives from the findings file name) */
  findingsPath?: string;
  /** canonical-naming handoff path (handoff-naming derivation; no template fallback) */
  handoffPath?: string;
  /** dry-run: finish immediately with an APPROVED stub handoff (no gates, no spawn) */
  dryRun?: boolean;
  /** additional template params from --param KEY=VALUE flags */
  params?: Record<string, string>;
  /** injected repo root (single root authority); default = engine singleton getRoot() */
  repoRoot?: string | null;
  /** derived workspace (review.ts passes it for the unit seam; this layer never reads it) */
  workspace?: string;
}

interface DocsResult {
  exitCode: number;
  handoff: Record<string, unknown> | null;
}

// The single BLOCKED-failure write point (nit closure): the three branches — handoff not written /
// unparseable / schema-invalid — share one shape: build a BLOCKED payload (incl. the doc_hash
// content-state token; uniform carrier) → write it → read back + return.
// review-3 finding 1 (warn): the payload is always engine-written literals + findings only — never
// a `...(baseHandoff ?? {})` spread: an agent-declared value on a declared key (type violations
// like `notes: 5` / `findings: "none"` — normalize is not allowed to change their value) must not
// enter the carrier (otherwise a spec/plan review's BLOCKED handoff violates its own docs schema).
// `baseHandoff` decides only the write path: the schema-invalid branch passes the normalized object
// → writeOwnHandoff full-replace, so offending keys never stay on disk (a shallow merge would
// re-feed them through `existing`; named like branch-review's writeBranchBlocked — one meaning
// must not have two names). The two branches without baseHandoff (not written / unparseable) have
// no parsed content to keep, so findings stays `[]`.
function writeBlocked({
  handoffPath,
  mode,
  doc,
  blocker,
  findings = [],
  baseHandoff = null,
}: {
  handoffPath: string;
  mode: string;
  doc: string;
  blocker: string;
  findings?: unknown[];
  baseHandoff?: Record<string, unknown> | null;
}): { exitCode: number; handoff: Record<string, unknown> } {
  const payload: Record<string, unknown> = {
    phase: mode,
    status: "BLOCKED",
    findings,
    artifacts: {},
    doc_path: doc,
    doc_hash: hashFile(doc),
    blocker,
  };
  if (baseHandoff) writeOwnHandoff(handoffPath, payload);
  else writeHandoff(handoffPath, payload);
  return { exitCode: 1, handoff: JSON.parse(readFileSync(handoffPath, "utf8")) as Record<string, unknown> };
}

export class DocsLifecycle extends DispatchLifecycle {
  readonly #opts: DocsLifecycleOptions;
  #agentRc = 0;
  #handoff: Record<string, unknown> | null = null;
  #exitCode = 0;
  #finished = false;

  constructor(options: DocsLifecycleOptions & { ctx: DispatchContext }) {
    const { ctx, ...opts } = options;
    super({ ctx });
    this.#opts = { ...opts };
  }

  /** runDocsTask compat result surface — { exitCode, handoff } read after run(). */
  get result(): DocsResult {
    return { exitCode: this.#exitCode, handoff: this.#handoff };
  }

  #done(result: DocsResult): void {
    this.#exitCode = result.exitCode;
    this.#handoff = result.handoff;
    this.#finished = true;
  }

  // ---- pre-flight ----

  /** Step 2/4 family: root (injected vs engine singleton) + canonical handoffPath guard; the
   * dry-run path finishes here so no gate / spawn / handoff work happens (legacy: runDocsTask
   * returned the APPROVED stub before withLifecycle). */
  protected override async resolveContext(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#opts.dryRun) {
      this.#done({
        exitCode: 0,
        handoff: {
          phase: this.#opts.mode,
          status: "APPROVED",
          findings: [],
          artifacts: {},
          doc_path: this.#opts.doc,
        },
      });
      return;
    }
    // Bug L fix: subprocess cwd = repo root, not workspace (doc directory). Injected value wins;
    // fallback = engine singleton. Both sources are always truthy (non-git already BLOCKED at
    // initRoot), so no empty guard.
    if (!this.ctx.repoRoot) {
      this.ctx = { ...this.ctx, repoRoot: getRoot() };
    }
    // T3: handoffPath must be passed by the caller (canonical handoff-naming filenames). The
    // legacy `${template}-${round}.json` derivation is removed — no second naming site.
    if (!this.#opts.handoffPath) throw new Error("docs-runner: handoffPath required (canonical naming; no template fallback)");
  }

  // ---- dispatch ----

  /** Steps 7+8: render the prompt (two-pass: first renderTemplate for {{DOCS_DOC}}/{{DOCS_FINDINGS}}/
   * {{HANDOFF_TARGET}}/{{HANDOFF_WRITE_GATE}}, then replace {{HANDOFF_SCHEMA_JSON}} with the raw schema), then spawn the
   * docs agent CLI (cwd = repo root — Bug L fix; env = host env so invokeCli's cleanEnv strips
   * credentials). */
  protected override async dispatch(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return; // early-finished rounds (dry-run / blocked pre-flight) skip the spawn
    const { mode, type, doc, template, params = {}, handoffPath, harness } = this.#opts;
    // Two-pass render (T3 URC after: fix templates take the canonical fixTemplate value "docs"
    // directly — the `-review`→`-fix` legacy derivation branch is gone; docs fix must not
    // double-suffix).
    const schema = loadHandoffSchema("docs");
    const stub = renderHandoffSchemaJson(schema);
    let prompt = renderTemplate(
      template,
      {
        DOCS_DOC: doc,
        DOCS_FINDINGS: this.#opts.findingsPath ?? "",
        HANDOFF_TARGET: handoffPath ?? "",
        // Task 18 review-1 finding 2: the shared Handoff shell's {{HANDOFF_WRITE_GATE}} slot
        // dispatches by return semantics — the review family defaults to the RETURN_JSON write gate
        // (review.mjs passes its self-computed value via params, ...params spread after → explicit
        // injection wins); the fix family = the docs write gate (fix's return is the file itself;
        // stdout has no JSON return — reviewHardGate's "before outputting the JSON return"
        // self-contradicts for a fix agent — reviewHardGate must not be reused).
        HANDOFF_WRITE_GATE: mode === "fix" ? docsFixHardGate(handoffPath ?? "") : reviewHardGate("RETURN_JSON", handoffPath ?? ""),
        ...params,
      },
      "docs-runner",
    );
    prompt = prompt.replace(HANDOFF_SCHEMA_JSON_SLOT, stub);

    // Spawn agent using the harness registry (provides -p, --output-format, etc.).
    // invokeCli injection params = (op, type) — review/fix resolve prefix.review[type?] /
    // prefix.fix (flat string) respectively; type threads from cdd review/fix --type.
    const reg = loadRegistry(REG_PATH);
    const entry = checkHarness(reg, harness);
    const timeoutMs = resolveTimeoutMs(process.env, "review");
    const res = await invokeCli(entry, prompt, { op: mode, type }, process.env, this.ctx.repoRoot as string, timeoutMs);
    this.#agentRc = res.code;
  }

  // ---- post-flight ----

  /** Step 8.8: read the agent-written handoff from disk; unparseable / schema-invalid →
   * writeBlocked (unified BLOCKED shape incl. doc_hash content token). */
  protected override async schemaValidate(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const handoffPath = this.#opts.handoffPath!;
    if (!existsSync(handoffPath)) {
      this.#done(writeBlocked({
        handoffPath,
        mode: this.#opts.mode,
        doc: this.#opts.doc,
        blocker: `${path.basename(handoffPath)} not written after exit 0 → re-run ${this.#opts.mode} and ensure handoff is written to ${handoffPath} before exit`,
      }));
      return;
    }

    // T8 hardening (P4 dogfood evidence: an agent-written handoff carried an unescaped \d) — an
    // unparseable handoff must not propagate as a bare throw (a review dispatch would exit 2 and
    // silently lose the handoff); degrade to the same BLOCKED-write branch as "not written / schema
    // invalid" (incl. the doc_hash content-state token; uniform carrier).
    let handoff: Record<string, unknown>;
    try {
      handoff = JSON.parse(readFileSync(handoffPath, "utf8")) as Record<string, unknown>;
    } catch (e) {
      this.#done(writeBlocked({
        handoffPath,
        mode: this.#opts.mode,
        doc: this.#opts.doc,
        blocker: `handoff JSON unparseable: ${(e as Error).message} → fix the handoff at ${handoffPath} or re-run ${this.#opts.mode}`,
      }));
      return;
    }
    const sv = validateHandoffSchema(handoff, "docs"); // docs schema (doc_path, no task)
    if (!sv.valid) {
      // T5 CONTRACT_VIOLATION recovery (spec §2.5.2, AC7 category-level: spec/plan reviews follow
      // the same policy as task dispatch): the recovery single point is
      // src/rules/schema.ts#recoverHandoff (normalize → re-validate, at most one round; the
      // violating key-name suffix and the findings-array guard are written there once — this path
      // only keeps its own failed-payload differences). On hit → the write side lands the
      // normalized object (offending keys never stay on disk) + continue on it; still failing →
      // BLOCKED with the parsed findings kept.
      const rec = recoverHandoff(handoff, "docs");
      if (!rec.valid) {
        this.#done(writeBlocked({
          handoffPath,
          mode: this.#opts.mode,
          doc: this.#opts.doc,
          baseHandoff: rec.handoff as Record<string, unknown>,
          findings: rec.preservedFindings as unknown[],
          blocker: `docs handoff schema invalid${rec.reason} → fix the handoff JSON at ${handoffPath} and re-run ${this.#opts.mode}`,
        }));
        return;
      }
      writeOwnHandoff(handoffPath, rec.handoff as Record<string, unknown>);
      handoff = rec.handoff;
    }
    this.#handoff = handoff;
  }

  /** Steps 12/13: result normalization — review/fix finalization (status single-authority;
   * review re-injects the doc_hash content token, fix keeps the agent-declared status) and the
   * final { exitCode, handoff } result. */
  protected override async normalizeResult(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const { mode, handoffPath } = this.#opts;
    const handoff: Record<string, unknown> = this.#handoff ?? {};
    // T5/T7: status single authority — the review-type handoff is finalized by the engine
    // (finalizeHandoff rollup derives/overwrites; SP-4 exempts failure rounds); the fix-type
    // (work) status is agent-declared, going through finalizeHandoff's fix passthrough branch
    // (same-reference skip-write; the work-type declaration is kept — the contract rejects it at
    // the commit-contract layer). Finalization writes via persistFinalized (full-replace
    // overwrite; no derived change → same-reference skip-write returning false — no no-op
    // overwrite).
    if (mode === "review" || mode === "fix") {
      const finalized = await finalizeHandoff({ mode, agentHandoff: handoff });
      if (mode === "review") {
        // P2 F5 (§2.3.3): review-mode always injects the content-state token — the engine is the
        // finalizer (the carrier's sole author, T7), so doc_hash always changes → full-replace
        // writeOwnHandoff (not the persistFinalized skip-write). The in-memory return matches the
        // disk finalization: the derived status overwrite is written back to local + doc_hash synced.
        const merged: Record<string, unknown> = { ...(finalized.handoff ?? handoff), doc_hash: hashFile(this.#opts.doc) };
        writeOwnHandoff(handoffPath!, merged);
        handoff.status = merged.status;
        handoff.doc_hash = merged.doc_hash;
        this.#handoff = merged;
      } else {
        persistFinalized(handoffPath!, handoff, finalized); // fix-mode verbatim (no injection; negative symmetry)
        this.#handoff = finalized.handoff ?? handoff;
      }
    }
    this.#exitCode = this.#agentRc;
  }

  /** Exit gate (出口门) override — docs review/fix dispatch consumes the post-commit gate like the
   * task face (P5 落点 2/3 + spec-review-2 [2]; AC10). validateCommitContract(mode, root,
   * { handoffPath }): dirty → BLOCKED handoff rewrite (by the rules layer) + exit code 1; the
   * in-memory handoff re-reads from disk so the returned payload reflects the rewrite. Skipped on
   * finished rounds (unparseable/schema-invalid dry paths) — matches the task face's skip. */
  protected override async commitPostCheck(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const cv = await validateCommitContract(this.#opts.mode, this.ctx.repoRoot, {
      handoffPath: this.#opts.handoffPath,
    });
    if (!cv.ok) {
      this.#done({ exitCode: 1, handoff: readJson(this.#opts.handoffPath ?? "") });
    }
  }
}

/** runDocsTask — legacy surface kept ({ exitCode, handoff }): builds the injected ctx, runs
 * DocsLifecycle, converts an entry-gate DispatchBlocked into a CDD_BLOCKED stderr + ExitRequested(1)
 * (the CLI needs the process exit — it discards the return value). Root resolves eagerly for a
 * real dispatch (entry gate must see it); dry-run defers root entirely (legacy: dry-run returned
 * before getRoot()). */
export async function runDocsTask(options: DocsLifecycleOptions & { dryRun?: boolean }): Promise<DocsResult> {
  const { dryRun = false, ...rest } = options;
  return withLifecycle(async () => {
    const lc = new DocsLifecycle({
      ...rest,
      dryRun,
      ctx: {
        mode: rest.mode,
        repoRoot: rest.repoRoot ?? (dryRun ? null : getRoot()),
        handoffPath: rest.handoffPath,
      },
    });
    try {
      await lc.run();
    } catch (e) {
      if (e instanceof DispatchBlocked && e.gate === "entry") {
        process.stderr.write(`CDD_BLOCKED: ${e.message}\n`);
        exitWithCode(1);
      }
      throw e;
    }
    return lc.result;
  });
}

export type { ExitRequested };
