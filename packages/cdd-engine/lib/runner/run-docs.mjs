// packages/cdd-engine/lib/runner/run-docs.mjs — lightweight runner for cdd review/fix
// --type spec|plan (legacy docs-task surface). No commit-contract, no ledger, no probeSkills.
// Spawns doc agent CLI; validates handoff against docs-handoff-schema.json.
// Bug L fix: subprocess cwd = gitToplevel(process.cwd()), not workspace/doc directory.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { invokeCli, resolveTimeoutMs } from "../lifecycle/cli.mjs";
import { gitToplevel } from "../contract/commit.mjs";
import { writeHandoff } from "../handoff/write.mjs";
import { finalizeHandoff, persistFinalized } from "../handoff/finalize.mjs";
import { loadRegistry, checkHarness, REG_PATH } from "../registry.mjs";
import { loadHandoffSchema, validateHandoffSchema } from "../handoff/schema.mjs";
import { renderHandoffStub, renderTemplate } from "../templates.mjs";

// REG_PATH 统一由 lib/registry.mjs 导出（spec §2.3 深度派生常数专项：run-docs 不再自算第二来源）。

export async function runDocsTask({
  harness,
  mode,
  template,
  type,          // review/fix 子类型（spec|plan）→ invokeCli (op, type) 注入参数（无模板名可依）
  doc,           // path to the document being reviewed/fixed
  findingsPath,
  handoffPath,   // canonical 命名权威（handoff-naming 派生）；无 template-fallback
  dryRun = false,
  params = {},   // additional template params from --param KEY=VALUE flags
  // repoRoot accepted in opts but ignored — gitToplevel(process.cwd()) is always used (Bug L fix)
}) {
  if (dryRun) {
    return { exitCode: 0, handoff: { phase: mode, status: "APPROVED", findings: [], artifacts: {}, doc_path: doc } };
  }

  // Bug L fix: use gitToplevel(process.cwd()) as subprocess cwd, not workspace (doc directory).
  const repoRoot = gitToplevel(process.cwd());
  if (!repoRoot) throw new Error("docs-runner: not in a git repo");

  // T3: handoffPath must be passed by the caller (cdd.mjs passes canonical handoff-naming filenames).
  // The legacy `${template}-${round}.json` derivation is removed — no second naming site.
  if (!handoffPath) throw new Error("docs-runner: handoffPath required (canonical naming; no template fallback)");

  // Render prompt from template (two-pass: first renderTemplate for {{DOC}}/{{FINDINGS}}/{{HANDOFF}},
  // then replace {{HANDOFF_STUB}} with schema-derived stub).
  // T3: URC 后 fix 模板直接收 canonical fixTemplate 值（"doc-fix"）—— `-review`→`-fix` legacy
  // 派生分支已删，模板名直传（doc-fix/review 不得 double-suffix）。
  const schema = loadHandoffSchema("docs");
  const stub = renderHandoffStub(schema, mode, undefined, { docPath: doc });
  let prompt = renderTemplate(template, {
    DOC: doc, FINDINGS: findingsPath ?? "", HANDOFF: handoffPath,
    ...params,
  }, "docs-runner");
  prompt = prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);

  // Spawn agent using harness registry (provides -p, --output-format, etc.).
  // cwd = repoRoot (Bug L fix: was path.dirname(handoffPath) / workspace before).
  // env = process.env so invokeCli's cleanEnv can strip credentials (Warn #137 posture).
  const reg = loadRegistry(REG_PATH);
  const entry = checkHarness(reg, harness);
  const timeoutMs = resolveTimeoutMs(process.env, "review");
  // invokeCli 注入参数 = (op, type)——review/fix 分别对 prefix.review[type?] /
  // prefix.fix（flat string）解析；type 由 cdd review/fix --type 经 runDocsTask 透传。
  const res = await invokeCli(entry, prompt, { op: mode, type }, process.env, repoRoot, timeoutMs);

  // Read handoff from disk (agent writes it).
  if (!existsSync(handoffPath)) {
    writeHandoff(handoffPath, {
      phase: mode,
      status: "BLOCKED",
      findings: [],
      artifacts: {},
      doc_path: doc,
      blocker: `${path.basename(handoffPath)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${handoffPath} before exit`,
    });
    return { exitCode: 1, handoff: JSON.parse(readFileSync(handoffPath, "utf8")) };
  }

  const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
  const sv = validateHandoffSchema(handoff, "docs"); // docs schema (doc_path, no task)
  if (!sv.valid) {
    writeHandoff(handoffPath, {
      phase: mode,
      status: "BLOCKED",
      findings: [],
      artifacts: {},
      doc_path: doc,
      blocker: `docs handoff schema invalid: ${sv.reason} → fix the handoff JSON at ${handoffPath} and re-run ${mode}`,
    });
    return { exitCode: 1, handoff: JSON.parse(readFileSync(handoffPath, "utf8")) };
  }

  // T5/T7: status 单一权威 — review 型 handoff 由 engine 定稿（finalizeHandoff rollup 派生覆写，
  // SP-4 豁免失败轮次）；fix 型（work）status 由 agent 声明，走 finalizeHandoff fix passthrough 分支
  //（同引用 skip 写盘；work 型声明保留，契约在 commit-contract 层否决）。定稿写盘用
  // persistFinalized（全量覆盖替换；派生无变化 → 同引用 skip 写盘，返回 false 不产生 no-op 覆盖）。
  if (mode === "review" || mode === "fix") {
    const finalized = finalizeHandoff({ mode, agentHandoff: handoff });
    persistFinalized(handoffPath, handoff, finalized);
  }

  return { exitCode: res.code, handoff };
}
