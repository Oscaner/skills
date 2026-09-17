// packages/cdd-engine/src/dispatch/docs.ts — DocsLifecycle (Task 8; ex dispatch/docs.mjs / legacy
// lib/runner/run-docs.mjs): the docs-function lifecycle for `cdd review/fix --type spec|plan`.
// DocsLifecycle extends DispatchLifecycle (dispatch/base.ts) and inherits BOTH commit gates —
// the pre-flight entry gate (pre-commit clean tree) and the post-flight exit gate
// (validateCommitContract) are the base's default hooks, shared with the task face per AC10 +
// spec-review-2 [2] (docs review/fix dispatch consume the same double gate as the task face;
// the base implements one, no fork).
//   Pre-flight:  resolveContext derives root (injected / engine single root) + guards the
//                canonical handoffPath; dry-run finishes immediately (no gates, no spawn).
//   Dispatch:    prompt render (schema verbatim + fixed HARD_GATE) → spawn the docs agent CLI.
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
import { invokeCli, resolveTimeoutMs } from "../infra/invoke.mjs";
import { withLifecycle } from "../infra/proc.mjs";
import { getRoot } from "../infra/root.mjs";
import { exitWithCode, ExitRequested } from "../infra/exit.mjs";
import { writeHandoff, writeOwnHandoff, readJson } from "../artifacts/handoff/write.ts";
import { finalizeHandoff, persistFinalized } from "../artifacts/handoff/finalize.ts";
import { loadRegistry, checkHarness, REG_PATH } from "../infra/registry.mjs";
import { loadHandoffSchema, validateHandoffSchema, recoverHandoff } from "../rules/schema.ts";
import { validateCommitContract } from "../rules/commit.ts";
import { renderHandoffStub, renderTemplate, reviewHardGate, docsFixHardGate } from "../render/templates.mjs";
import { hashFile } from "./review-loop.mjs";

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
}

interface DocsResult {
  exitCode: number;
  handoff: Record<string, unknown> | null;
}

// BLOCKED 失败写盘单点（nit 收敛）：handoff 未写 / 不可解析 / schema 无效三分支同形 ——
// 构造 BLOCKED payload（含 doc_hash 内容状态 token，uniform 载体）→ 写盘 → 读回返回。
// review-3 finding 1（warn）：payload 一律 engine 自写字面量 + 仅 findings，不再 `...(baseHandoff ?? {})`
// spread —— 已声明键的 agent 原值（`notes: 5` / `findings: "none"` 一类类型违规，normalize 无权改其值）
// 不得进载体（否则 spec/plan 评审的 BLOCKED handoff 违反自家 docs schema）。`baseHandoff` 只用于判定
// 写盘方式：schema 无效分支传归一化结果 → writeOwnHandoff 全量覆盖，使违规键不留盘（浅合并会经
// existing 回灌；命名与 branch-review 的 writeBranchBlocked 对齐 —— 同一含义在两处不得有两个名字）。
// 缺 baseHandoff 的两分支（未写 / 不可解析）无已解析内容可留，findings 仍是 `[]`。
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

  /** Steps 7+8: render the prompt (two-pass: first renderTemplate for {{DOC}}/{{FINDINGS}}/
   * {{HANDOFF}}/{{HARD_GATE}}, then replace {{HANDOFF_STUB}} with the raw schema), then spawn the
   * docs agent CLI (cwd = repo root — Bug L fix; env = host env so invokeCli's cleanEnv strips
   * credentials). */
  protected override async dispatch(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return; // early-finished rounds (dry-run / blocked pre-flight) skip the spawn
    const { mode, type, doc, template, params = {}, handoffPath, harness } = this.#opts;
    // Two-pass render (T3 URC after: fix templates take the canonical fixTemplate value "docs"
    // directly — the `-review`→`-fix` legacy derivation branch is gone; docs fix must not
    // double-suffix).
    const schema = loadHandoffSchema("docs");
    const stub = renderHandoffStub(schema);
    let prompt = renderTemplate(
      template,
      {
        DOC: doc,
        FINDINGS: this.#opts.findingsPath ?? "",
        HANDOFF: handoffPath ?? "",
        // Task 18 review-1 finding 2: the shared Handoff shell's {{HARD_GATE}} slot dispatches by
        // return semantics — the review family defaults to the json-return write gate (review.mjs
        // passes its self-computed value via params, ...params spread after → explicit injection
        // wins); the fix family = the docs write gate (fix's return is the file itself; stdout has
        // no JSON return — reviewHardGate's "before outputting the JSON return" self-contradicts
        // for a fix agent — reviewHardGate must not be reused).
        HARD_GATE: mode === "fix" ? docsFixHardGate(handoffPath ?? "") : reviewHardGate("json", handoffPath ?? ""),
        ...params,
      },
      "docs-runner",
    );
    prompt = prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);

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

    // T8 hardening（P4 dogfood 实证：agent 手写 handoff 含未转义 \d）——unparseable handoff 不得
    // 作为裸 throw 传播（review 派发 exit 2 无 handoff 静默丢失）；降级为「handoff 未写 / schema
    // 无效」同构的 BLOCKED 写盘分支（含 doc_hash 内容状态 token，uniform 载体）。
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
      // T5 CONTRACT_VIOLATION 恢复（spec §2.5.2，AC7 类目级：spec/plan 评审与 task 派发同策略）：
      // 恢复单点 = src/rules/schema.ts#recoverHandoff（归一化 → 重校验，最多一轮；违规键名后缀与
      // findings 数组守卫在那里写一次，本路径只保留自己的失败载荷差异）。命中 → 写侧同源落盘
      // （违规键不留盘）+ 按归一化对象继续；仍失败 → BLOCKED 且保留已解析出的 findings。
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
    // T5/T7: status 单一权威 — review 型 handoff 由 engine 定稿（finalizeHandoff rollup 派生覆写，
    // SP-4 豁免失败轮次）；fix 型（work）status 由 agent 声明，走 finalizeHandoff fix passthrough
    // 分支（同引用 skip 写盘；work 型声明保留，契约在 commit-contract 层否决）。定稿写盘用
    // persistFinalized（全量覆盖替换；派生无变化 → 同引用 skip 写盘，返回 false 不产生 no-op 覆盖）。
    if (mode === "review" || mode === "fix") {
      const finalized = await finalizeHandoff({ mode, agentHandoff: handoff });
      if (mode === "review") {
        // P2 F5（§2.3.3）：review-mode 恒注入内容状态 token —— engine 定稿（载体唯一作者 T7），
        // 恒有 doc_hash 变更 → writeOwnHandoff 全量覆盖（不再复用 persistFinalized 的 skip-write）。
        // 内存返回值与磁盘定稿一致：派生 status 覆写回写 local + doc_hash 同步。
        const merged: Record<string, unknown> = { ...(finalized.handoff ?? handoff), doc_hash: hashFile(this.#opts.doc) };
        writeOwnHandoff(handoffPath!, merged);
        handoff.status = merged.status;
        handoff.doc_hash = merged.doc_hash;
        this.#handoff = merged;
      } else {
        persistFinalized(handoffPath!, handoff, finalized); // fix-mode 原样（无注入，负向对称）
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