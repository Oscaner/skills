// packages/cdd-engine/lib/runner/run-docs.mjs — lightweight runner for cdd review/fix
// --type spec|plan (legacy docs-task surface). No commit-contract, no ledger, no probeSkills.
// Spawns doc agent CLI; validates handoff against docs-handoff-schema.json.
// Bug L fix: subprocess cwd = repo root, not workspace/doc directory.
// P4 §2.4.1：root 由调用方注入（root 单一权威 lib/root.mjs）；本文件不自算第二权威。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { invokeCli, resolveTimeoutMs } from "../lifecycle/cli.mjs";
import { withLifecycle } from "../lifecycle/proc.mjs";
import { getRoot } from "../root.mjs";
import { writeHandoff, writeOwnHandoff } from "../handoff/write.mjs";
import { finalizeHandoff, persistFinalized } from "../handoff/finalize.mjs";
import { loadRegistry, checkHarness, REG_PATH } from "../registry.mjs";
import { loadHandoffSchema, validateHandoffSchema, recoverHandoff } from "../handoff/schema.mjs";
import { renderHandoffStub, renderTemplate, reviewHardGate, docsFixHardGate } from "../templates.mjs";
import { hashFile } from "./review-loop.mjs";

// REG_PATH 统一由 lib/registry.mjs 导出（spec §2.3 深度派生常数专项：run-docs 不再自算第二来源）。

// BLOCKED 失败写盘单点（nit 收敛）：handoff 未写 / 不可解析 / schema 无效三分支同形——
// 构造 BLOCKED payload（含 doc_hash 内容状态 token，uniform 载体）→ 写盘 → 读回返回。
// review-3 finding 1（warn）：payload 一律 **engine 自写字面量 + 仅 findings**，不再 `...(baseHandoff ?? {})`
// spread——已声明键的 agent 原值（`notes: 5` / `findings: "none"` 一类类型违规，normalize 无权改其值）
// 不得进载体（否则 spec/plan 评审的 BLOCKED handoff 违反自家 docs schema）。`baseHandoff` 只用于判定写盘
// 方式：schema 无效分支传**归一化结果** → writeOwnHandoff 全量覆盖，使违规键不留盘（浅合并会经
// existing 回灌；命名与 branch-review 的 writeBranchBlocked 对齐——同一含义在两处不得有两个名字）。
// 缺 baseHandoff 的两分支（未写 / 不可解析）无已解析内容可留，findings 仍是 `[]`
//（与「保留 findings」不冲突——无 findings 可留）。
function writeBlocked({ handoffPath, mode, doc, blocker, findings = [], baseHandoff = null }) {
  const payload = {
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
  return { exitCode: 1, handoff: JSON.parse(readFileSync(handoffPath, "utf8")) };
}

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
  // repoRoot 注入缝：调用方（CLI 层）经单一 root 权威 lib/root.mjs 派生后传入；
  // 缺省回落 engine 单根（同一权威），本文件不自算 root。
  repoRoot,
}) {
  if (dryRun) {
    return { exitCode: 0, handoff: { phase: mode, status: "APPROVED", findings: [], artifacts: {}, doc_path: doc } };
  }

  return withLifecycle(async () => {
  // Bug L fix: use the repo root as subprocess cwd, not workspace (doc directory).
  // 注入值优先；未注入 → 取 engine 单根（lib/root.mjs）。求值在 dry-run 早退之后：
  // dry-run 路径不构造 root，也不触碰未初始化的单根。两条来源均恒为真值（非 git 仓已在
  // initRoot() 处 BLOCKED exit 1），故无空值守卫。
  const root = repoRoot ?? getRoot();

  // T3: handoffPath must be passed by the caller (cdd.mjs passes canonical handoff-naming filenames).
  // The legacy `${template}-${round}.json` derivation is removed — no second naming site.
  if (!handoffPath) throw new Error("docs-runner: handoffPath required (canonical naming; no template fallback)");

  // Render prompt from template (two-pass: first renderTemplate for {{DOC}}/{{FINDINGS}}/{{HANDOFF}}/{{HARD_GATE}},
  // then replace {{HANDOFF_STUB}} with the raw schema).
  // T3: URC 后 fix 模板直接收 canonical fixTemplate 值（"docs"）—— `-review`→`-fix` legacy
  // 派生分支已删，模板名直传（docs/review 不得 double-suffix）。Task 18: doc-fix.md → fix/docs.md。
  const schema = loadHandoffSchema("docs");
  const stub = renderHandoffStub(schema);
  let prompt = renderTemplate(template, {
    DOC: doc, FINDINGS: findingsPath ?? "", HANDOFF: handoffPath,
    // Task 18 review-1 finding 2: 共享 Handoff 壳的 {{HARD_GATE}} 槽按 return 语义分派 ——
    // review 族缺省 = json return 写盘门（review.mjs 经 params 传入自算值，...params 展开在后 →
    // 显式注入优先）；fix 族 = docs 写盘门（fix 的 return = 文件本体，stdout 无 JSON return，
    // 「BEFORE outputting the JSON return」对 fix 代理自相矛盾 —— reviewHardGate 不可挪用）。
    HARD_GATE: mode === "fix" ? docsFixHardGate(handoffPath) : reviewHardGate("json", handoffPath),
    ...params,
  }, "docs-runner");
  prompt = prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);

  // Spawn agent using harness registry (provides -p, --output-format, etc.).
  // cwd = root (Bug L fix: was path.dirname(handoffPath) / workspace before).
  // env = process.env so invokeCli's cleanEnv can strip credentials (Warn #137 posture).
  const reg = loadRegistry(REG_PATH);
  const entry = checkHarness(reg, harness);
  const timeoutMs = resolveTimeoutMs(process.env, "review");
  // invokeCli 注入参数 = (op, type)——review/fix 分别对 prefix.review[type?] /
  // prefix.fix（flat string）解析；type 由 cdd review/fix --type 经 runDocsTask 透传。
  const res = await invokeCli(entry, prompt, { op: mode, type }, process.env, root, timeoutMs);

  // Read handoff from disk (agent writes it).
  if (!existsSync(handoffPath)) {
    return writeBlocked({
      handoffPath, mode, doc,
      blocker: `${path.basename(handoffPath)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${handoffPath} before exit`,
    });
  }

  // T8 hardening（P4 dogfood 实证：agent 手写 handoff 含未转义 \d）——unparseable handoff 不得
  // 作为裸 throw 传播（review 派发 exit 2 无 handoff 静默丢失）；降级为「handoff 未写 / schema
  // 无效」同构的 BLOCKED 写盘分支（含 doc_hash 内容状态 token，uniform 载体）。
  let handoff;
  try {
    handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
  } catch (e) {
    return writeBlocked({
      handoffPath, mode, doc,
      blocker: `handoff JSON unparseable: ${e.message} → fix the handoff at ${handoffPath} or re-run ${mode}`,
    });
  }
  const sv = validateHandoffSchema(handoff, "docs"); // docs schema (doc_path, no task)
  if (!sv.valid) {
    // T5 CONTRACT_VIOLATION 恢复（spec §2.5.2，AC7 类目级：spec/plan 评审与 task 派发同策略）：
    // 恢复单点 = lib/handoff/schema.mjs#recoverHandoff（归一化 → 重校验，最多一轮；违规键名后缀与
    // findings 数组守卫在那里写一次，本路径只保留自己的失败载荷差异）。命中 → 写侧同源落盘
    // （违规键不留盘）+ 按归一化对象继续；仍失败 → BLOCKED 且**保留已解析出的 findings**
    //（此前该分支硬编码 findings: []，即 A4 缺陷）。
    const rec = recoverHandoff(handoff, "docs");
    if (!rec.valid) {
      return writeBlocked({
        handoffPath, mode, doc,
        baseHandoff: rec.handoff,
        findings: rec.preservedFindings,
        blocker: `docs handoff schema invalid${rec.reason} → fix the handoff JSON at ${handoffPath} and re-run ${mode}`,
      });
    }
    writeOwnHandoff(handoffPath, rec.handoff);
    handoff = rec.handoff;
  }

  // T5/T7: status 单一权威 — review 型 handoff 由 engine 定稿（finalizeHandoff rollup 派生覆写，
  // SP-4 豁免失败轮次）；fix 型（work）status 由 agent 声明，走 finalizeHandoff fix passthrough 分支
  //（同引用 skip 写盘；work 型声明保留，契约在 commit-contract 层否决）。定稿写盘用
  // persistFinalized（全量覆盖替换；派生无变化 → 同引用 skip 写盘，返回 false 不产生 no-op 覆盖）。
  if (mode === "review" || mode === "fix") {
    const finalized = finalizeHandoff({ mode, agentHandoff: handoff });
    if (mode === "review") {
      // P2 F5（§2.3.3）：review-mode 恒注入内容状态 token——引擎定稿（载体唯一作者 T7），
      // 恒有 doc_hash 变更 → writeOwnHandoff 全量覆盖（不再复用 persistFinalized 的 skip-write）。
      // 内存返回值与磁盘定稿一致：派生 status 覆写回写 local + doc_hash 同步。
      const merged = { ...(finalized.handoff ?? handoff), doc_hash: hashFile(doc) };
      writeOwnHandoff(handoffPath, merged);
      handoff.status = merged.status;
      handoff.doc_hash = merged.doc_hash;
    } else {
      persistFinalized(handoffPath, handoff, finalized);   // fix-mode 原样（无注入，负向对称）
    }
  }

  return { exitCode: res.code, handoff };
  });
}
