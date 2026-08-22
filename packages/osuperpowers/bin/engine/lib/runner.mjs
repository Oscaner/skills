// engine/lib/runner.mjs — CDD per-task runner (Node port of cdd_run_task).
// H1 四行输出独占（spec v3）：本模块负责格式化 status/commits/artifacts/blocker。
// runTask 有序契约：registry ship gate → CLI preflight → workspace/env → ledger PLAN_FILE
// backfill → review fixed-point → require env → renderModePrompt → 嵌套 CLI spawn（捕获 stderr，
// 非 2>/dev/null 吞）→ commit-contract → H1 四行 → handoff 处理。
// noExit=true 时返回 { exitCode, h1 } 而非 exit helpers —— 单测的 seam。
// 落地退出委托 utils/exit.mjs（统一出口，无 inline process.exit）。
import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRegistry, checkHarness, CddBlockedError } from "./registry.mjs";
import { renderModePrompt, pluginRoot } from "./templates.mjs";
import { appendLedger } from "./ledger.mjs";
import { validateCommitContract, writeHandoff, gitToplevel } from "./contract.mjs";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "../../utils/exit.mjs";
import { config as probeConfig } from "../../utils/skills-probe.config.mjs";
import { generateBrief, validateBrief } from "./brief.mjs";

const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));
const VALID_MODES = ["implement", "task-review", "fix"];

// 本地编排错误：携带退出码；runTask/runPlan 捕获后 finish。
class RunBlocked extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

// 落地退出：noExit=false → 写 H1（若 h1 非空）到 stdout + stderr 消息 + exitWithCode；
// noExit=true → 仅返回 { exitCode, h1 }（runPlan 组合 / 单测）。
function finish(exitCode, h1, msg, noExit, { stderrPrefix = "CDD_BLOCKED" } = {}) {
  if (msg) process.stderr.write(`${stderrPrefix}: ${msg}\n`);
  if (!noExit) {
    for (const line of h1) process.stdout.write(`${line}\n`);
    exitWithCode(exitCode);
  }
  return { exitCode, h1 };
}

// ---- workspace / env ----

// 对齐 _cdd_resolve_workspace：无 plan_file + CDD_WORKSPACE → 用之；否则从 plan 派生
// <repo>/.superpowers/cdd/<slug>/（mkdir + cdd/.gitignore）。
export function resolveWorkspace({ planFile, env, cwd }) {
  if (!planFile && env.CDD_WORKSPACE) return env.CDD_WORKSPACE;
  const plan = planFile || env.PLAN_FILE;
  if (!plan) throw new RunBlocked("CDD_WORKSPACE unset and --plan not provided");
  if (!existsSync(plan)) throw new RunBlocked(`plan file not found: ${plan}`);
  const slug = path.basename(plan, ".md");
  if (!slug || slug === "." || slug === "..") throw new RunBlocked(`cannot derive workspace name from: ${plan}`);
  const root = gitToplevel(cwd);
  if (!root) throw new RunBlocked("not in a git repo");
  const base = path.join(root, ".superpowers", "cdd");
  mkdirSync(path.join(base, slug), { recursive: true });
  writeFileSync(path.join(base, ".gitignore"), "*\n");
  return path.join(base, slug);
}

// 对齐 _cdd_set_task_env：workspace 派生路径，未设置才默认（`${VAR:-default}` 语义）；
// CDD_WORKSPACE / CDD_MODE / CDD_HARNESS 强制。返回新 env 对象（不改 baseEnv）。
export function buildTaskEnv(baseEnv, workspace, task, mode, harness) {
  const env = { ...baseEnv };
  env.CDD_WORKSPACE = workspace;
  env.CDD_HARNESS = harness;
  env.CDD_LEDGER ||= path.join(workspace, "progress.md");
  env.CDD_TASK_BRIEF ||= path.join(workspace, `task-${task}-brief.md`);
  env.CDD_HANDOFF_PATH ||= path.join(workspace, `task-${task}-handoff.json`);
  env.CDD_PLAN_CONSTRAINTS ||= path.join(workspace, "plan-constraints.md");
  env.CDD_MODE = mode;
  env.CDD_FINDINGS ||= path.join(workspace, `task-${task}-open-findings.json`);
  return env;
}

// 对齐 _cdd_plan_from_ledger：ledger 首行 `# CDD ledger — plan: <path>`。
function backfillPlanFromLedger(ledgerPath) {
  if (!ledgerPath || !existsSync(ledgerPath)) return "";
  const first = readFileSync(ledgerPath, "utf8").split("\n", 1)[0] ?? "";
  const m = first.match(/^# CDD ledger — plan: (.+)$/);
  return m ? m[1].trim() : "";
}

// 读 JSON 嵌套字段（commits.base / commits.head）；缺失/损坏 → ""。
function readJsonField(filePath, keys) {
  if (!filePath || !existsSync(filePath)) return "";
  try {
    let v = JSON.parse(readFileSync(filePath, "utf8"));
    for (const k of keys) v = v?.[k];
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

// 对齐 cdd_require_env 的 mode 有效性检查。
function validateMode(mode) {
  if (!VALID_MODES.includes(mode)) return `CDD_MODE must be implement|task-review|fix (got: ${mode})`;
  return null;
}

// 对齐 cdd_require_env：必需 CDD_* + mode 特例（task-review → CDD_TASK_REVIEW_FIXED_POINT；fix → CDD_FINDINGS）。
function requireEnv(env, mode) {
  const missing = [];
  for (const v of ["CDD_WORKSPACE", "CDD_TASK_BRIEF", "CDD_LEDGER", "CDD_MODE", "CDD_HANDOFF_PATH", "CDD_PLAN_CONSTRAINTS"]) {
    if (!env[v]) missing.push(v);
  }
  if (mode === "task-review" && !env.CDD_TASK_REVIEW_FIXED_POINT) missing.push("CDD_TASK_REVIEW_FIXED_POINT");
  if (mode === "fix" && !env.CDD_FINDINGS) missing.push("CDD_FINDINGS");
  return missing.length > 0 ? `Missing required env: ${missing.join(" ")}` : null;
}

// renderModePrompt 的 {{PLACEHOLDER}} env 映射（bash 6 键 + TASK 超集键）。
function promptEnv(env, taskNum) {
  return {
    WORKSPACE: env.CDD_WORKSPACE,
    BRIEF: env.CDD_TASK_BRIEF,
    HANDOFF: env.CDD_HANDOFF_PATH,
    FINDINGS: env.CDD_FINDINGS,
    CONSTRAINTS: env.CDD_PLAN_CONSTRAINTS,
    FIXED_POINT: env.CDD_TASK_REVIEW_FIXED_POINT,
    TASK: String(taskNum),
  };
}

// ---- 嵌套 CLI 调用 ----

// 原始 spawn + 捕获 stdout/stderr。exit code 0 → ok:true；否则 ok:false（stderr 保留给 blocker）。
function spawnCapture(command, args, { cwd, env }) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d;
    });
    proc.stderr.on("data", (d) => {
      stderr += d;
    });
    proc.on("error", (err) => {
      resolve({ ok: false, code: 1, stdout, stderr: stderr || `spawn failed: ${err.message}` });
    });
    proc.on("close", (code) => {
      resolve({ ok: code === 0, code: code ?? 1, stdout, stderr });
    });
  });
}

// 对齐 _cdd_invoke_cli：$cli $invoke "$prompt_arg"（task-review 前缀合成）+ output 模式规范化
// （text passthrough / stream-json → 最后一个 completion 的 finalText 完整保留）。
// 导出供 cdd-review.mjs（一次性 prompt-runner）复用 —— 归一化逻辑单一来源。
export async function invokeCli(entry, prompt, mode, env, cwd) {
  const { cli, invoke, output, task_review_prefix } = entry;
  const promptArg = mode === "task-review" && task_review_prefix ? `${task_review_prefix} ${prompt}` : prompt;
  const args = [...invoke.split(/\s+/).filter(Boolean), promptArg];
  const res = await spawnCapture(cli, args, { cwd, env });
  if (res.ok && output === "stream-json") {
    const finalText = extractStreamJsonFinal(res.stdout);
    if (!finalText) {
      return { ok: false, code: 1, stdout: res.stdout, stderr: "stream-json produced no completion finalText" };
    }
    return { ok: true, code: 0, stdout: finalText, stderr: res.stderr };
  }
  return res;
}

// 对齐 stream-json 规范化 jq -rs：slurp 整个 stdout 为 JSON 值序列（容忍 pretty-printed/多行事件），
// `[.[] | select(.type=="completion" and (.finalText != null)) | .finalText] | last // empty`。
// 逐行 NDJSON 解析会丢多行 JSON 事件的 finalText —— 全流扫描取最后 completion 的 finalText。
function extractStreamJsonFinal(raw) {
  const text = String(raw);
  let last = null;
  let pos = 0;
  const n = text.length;
  while (pos < n) {
    while (pos < n && /\s/.test(text[pos])) pos++; // 跳过 JSON 值间空白
    if (pos >= n) break;
    const end = jsonValueEnd(text, pos);
    try {
      const ev = JSON.parse(text.slice(pos, end));
      if (ev.type === "completion" && ev.finalText != null) last = ev.finalText;
    } catch {
      // 非完整 JSON 文本跳过（对齐 jq 错误容错：无 completion → 调用方 BLOCKED）
    }
    pos = Math.max(end, pos + 1);
  }
  return last;
}

// 扫描 JSON 字符串从 start（首个 "）到结束的 "（含）。返回结束 " 后索引。
// 提取为共享函数，供 jsonValueEnd 和 scanBalanced 的字符串遍历复用。
function scanString(text, start) {
  let i = start + 1;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === "\\") i += 2;
    else if (ch === '"') return i + 1;
    else i++;
  }
  return n;
}

// 返回 text 中从 start 起的一个完整 JSON 值结束后的索引（对齐 jq 的 JSON 流：值之间仅空白分隔，
// 值本身可跨行）。对象/数组按 {} / [] 深度扫描（跳过字符串字面量与转义）；标量扫到空白或结构符。
function jsonValueEnd(text, start) {
  const first = text[start];
  if (first === "{") return scanBalanced(text, start, "{", "}");
  if (first === "[") return scanBalanced(text, start, "[", "]");
  if (first === '"') return scanString(text, start);
  let i = start;
  const n = text.length;
  while (i < n && !/\s/.test(text[i]) && !",}]".includes(text[i])) i++;
  return i;
}

function scanBalanced(text, start, openCh, closeCh) {
  const n = text.length;
  let depth = 0;
  for (let i = start; i < n; i++) {
    const ch = text[i];
    if (ch === '"') {
      // scanString 期望 start 指向开引号；返回结束 " 后索引，i++ 后指向其后
      i = scanString(text, i) - 1;
    } else if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return n;
}

// ---- review-package（非 dry-run review 模式）----

// 对齐 cdd_superpowers_scripts_dir：repo submodule → Claude/Cursor plugin cache（版本目录升序）。
// 导出供单测（T7 补回：findSuperpowersScriptsDir / byVersion）。
export function findSuperpowersScriptsDir(cwd) {
  const repoRoot = gitToplevel(cwd);
  if (repoRoot) {
    const probe = path.join(repoRoot, "vendors", "superpowers", "skills", "subagent-driven-development", "scripts");
    if (existsSync(path.join(probe, "sdd-workspace"))) return probe;
  }
  const cacheRoots = [
    path.join(os.homedir(), ".claude", "plugins", "cache", "oscaner", "superpowers"),
    path.join(os.homedir(), ".cursor", "plugins", "cache", "oscaner", "superpowers"),
  ];
  for (const cache of cacheRoots) {
    if (!existsSync(cache)) continue;
    const versions = readdirSync(cache).sort(byVersion);
    for (const ver of versions) {
      const scripts = path.join(cache, ver, "skills", "subagent-driven-development", "scripts");
      if (existsSync(path.join(scripts, "sdd-workspace"))) return scripts;
    }
  }
  return null;
}

// 简易版本排序（对齐 bash `sort -V` 升序）：数字段逐段比较，缓存探测取 oldest-first。
export function byVersion(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

// 对齐 _cdd_relpath_from_repo：repo 内路径 → 相对 repo；否则绝对路径。
function relpathFromRepo(abs, cwd) {
  const root = gitToplevel(cwd);
  const resolved = path.resolve(abs);
  if (root && resolved.startsWith(`${root}/`)) return resolved.slice(root.length + 1);
  return resolved;
}

// 对齐 cdd_run_review_package：diff 文件名用 base/head 前 7 位。
function shortSha(sha) {
  return String(sha).slice(0, 7);
}

// 对齐 _cdd_run_review_package：spawn 上游 review-package 脚本，解析末行 `wrote <diff>:`，
// 把 diff 相对路径写进 handoff artifacts（Node 无 jq —— 直接 JSON 读写）。
// bash 对齐：`[[ -x review-package ]]` 可执行检查（spawn 前 accessSync X_OK）+ `wrote <diff>:`
// progress 行落到 stdout（operator 可见）。
// scriptsDir DI：单测可 override findSuperpowersScriptsDir（避免触达 repo/cache 真实路径）。
export async function runReviewPackage(plan, base, head, handoffPath, { cwd, env, scriptsDir: scriptsDirOverride }) {
  const scriptsDir = scriptsDirOverride ?? findSuperpowersScriptsDir(cwd);
  if (!scriptsDir) throw new RunBlocked("upstream review-package script not found");
  const reviewPkg = path.join(scriptsDir, "review-package");
  try {
    accessSync(reviewPkg, constants.X_OK);
  } catch {
    throw new RunBlocked(`review-package not executable: ${reviewPkg}`);
  }
  const wsDir = path.dirname(handoffPath);
  const outFile = path.join(wsDir, `review-${shortSha(base)}..${shortSha(head)}.diff`);
  const res = await spawnCapture("bash", [reviewPkg, plan, base, head, outFile], { cwd, env });
  const outLine = res.stdout.trim().split("\n").filter(Boolean).pop() ?? "";
  const diffPath = outLine.match(/^wrote ([^:]+):/)?.[1] ?? "";
  if (!diffPath || !existsSync(diffPath)) {
    throw new RunBlocked(`review-package did not produce diff file (output: ${outLine})`);
  }
  process.stdout.write(`${outLine}\n`); // 对齐 bash：`wrote <diff>:` progress 行（stdout）
  const h = readJson(handoffPath) ?? {};
  writeHandoff(handoffPath, { artifacts: { ...(h.artifacts ?? {}), diff: relpathFromRepo(diffPath, cwd) } });
}

// ---- H1 输出 ----

// 对齐 _cdd_emit_h1_four_lines：从 agent stdout 文本取最后一个 ^key: 行；缺 → "<missing>"。
export function h1FourLines(raw) {
  const lines = String(raw).split("\n");
  const keys = ["status", "commits", "artifacts", "blocker"];
  const out = [];
  for (const key of keys) {
    let found = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith(`${key}:`)) {
        found = lines[i];
        break;
      }
    }
    out.push(found ?? `${key}: <missing>`);
  }
  return out;
}

// 对齐 _cdd_emit_h1_from_handoff（无 jq 依赖）：读 handoff JSON，缺失/损坏 → BLOCKED 兜底。
// artifacts 仅当存在时输出（与 bash 一致）。
export function h1FromHandoff(handoffPath) {
  if (!handoffPath || !existsSync(handoffPath)) {
    return h1FourLines("status: BLOCKED\nblocker: handoff missing after commit-contract interception");
  }
  const h = readJson(handoffPath);
  if (!h) {
    return h1FourLines("status: BLOCKED\nblocker: handoff JSON unparseable after commit-contract interception");
  }
  const out = [
    `status: ${h.status ?? "BLOCKED"}`,
    `commits: base=${h.commits?.base ?? ""} head=${h.commits?.head ?? ""}`,
  ];
  const arts = [];
  for (const key of ["brief", "report", "test_evidence"]) {
    if (h.artifacts?.[key]) arts.push(`${key}=${h.artifacts[key]}`);
  }
  if (arts.length > 0) out.push(`artifacts: ${arts.join(" ")}`);
  out.push(`blocker: ${h.blocker ?? "uncommitted changes at return"}`);
  return out;
}

// ---- dry-run 仿真 ----

// 对齐 bash dry-run 分支的硬编码 H1 块（CDD_DRY_RUN=1）。
function dryRunH1Block(env, taskNum) {
  const ws = env.CDD_WORKSPACE;
  return [
    "status: DONE",
    "commits: base=dry-run head=dry-run",
    `artifacts: brief=${env.CDD_TASK_BRIEF} report=${ws}/task-${taskNum}-report.md test_evidence=${ws}/task-${taskNum}-test-evidence.json`,
    "blocker: none",
  ].join("\n");
}

// ---- runTask / runPlan ----

// 对齐 cdd_run_task。opts: { mode, planFile, dryRun, env, cwd, registryPath, probeSkills, channelMap, noExit, pluginRoot }。
// 返回 { exitCode, h1 }（noExit=true 时不 exitWithCode）。
export async function runTask(harness, taskNum, opts = {}) {
  const { mode, planFile, dryRun = false, noExit = false } = opts;
  const probeSkills = opts.probeSkills;
  const pluginRootFn = opts.pluginRoot ?? pluginRoot;
  const channelMap = opts.channelMap ?? probeConfig.channel;
  const cwd = opts.cwd ?? process.cwd();
  const baseEnv = opts.env ?? process.env;
  const registryPath = opts.registryPath ?? REG_PATH;

  // 1. Registry ship gate + CLI preflight
  let entry;
  try {
    entry = checkHarness(loadRegistry(registryPath), harness, { dryRun });
  } catch (e) {
    if (e instanceof CddBlockedError) {
      return finish(e.exitCode, [], e.message, noExit, {
        stderrPrefix: e.kind === "cli-missing" ? "CDD_CLI_MISSING" : "CDD_BLOCKED",
      });
    }
    throw e;
  }

  // 2. Resolve workspace
  let workspace;
  try {
    workspace = resolveWorkspace({ planFile, env: baseEnv, cwd });
  } catch (e) {
    if (e instanceof RunBlocked) return finish(1, [], e.message, noExit);
    throw e;
  }

  // 2.5 Skills gate — probe for required skill plugins via DI seam.
  //   probeSkills(harness, { cwd, env }) → { missing: [{plugin, installHint}], probeFailed }.
  //   Channel classification: install-and-use → exit 3; init → stderr hint + continue;
  //   probeFailed → fail-open (exit 0, warn).
  if (probeSkills) {
    let probeResult;
    try {
      probeResult = await probeSkills(harness, { cwd, env: baseEnv });
    } catch {
      probeResult = { missing: [], probeFailed: true };
    }
    if (probeResult.probeFailed) {
      process.stderr.write(`skills-probe: probe failed for ${harness}, failing open\n`);
    } else if (probeResult.missing.length > 0) {
      if (channelMap["install-and-use"]?.includes(harness)) {
        for (const m of probeResult.missing) {
          process.stderr.write(`${m.plugin}: ${m.installHint}\n`);
        }
        return finish(3, [], `missing skills: ${probeResult.missing.map((m) => m.plugin).join(", ")}`, noExit);
      } else {
        // init channel or unknown — warn and continue
        for (const m of probeResult.missing) {
          process.stderr.write(`skills-probe: ${m.plugin}: ${m.installHint}\n`);
        }
      }
    }
  }

  // 2.55 Templates existence check — BLOCKED exit 1 if missing (not exit 3).
  {
    try {
      const tplDir = path.join(pluginRootFn(), "templates", "cdd");
      if (!existsSync(tplDir)) {
        return finish(1, [], `templates missing: ${tplDir}`, noExit);
      }
    } catch {
      return finish(1, [], "templates missing: osuperpowers plugin root not found", noExit);
    }
  }

  // 3. Set env
  const env = buildTaskEnv(baseEnv, workspace, taskNum, mode, harness);

  // 4. Ledger PLAN_FILE backfill
  let plan = planFile || baseEnv.PLAN_FILE || "";
  if (!plan) plan = backfillPlanFromLedger(env.CDD_LEDGER);

  // 4.5 Brief 生成 / 校验（plan backfill 之后，task-review fixed-point 之前）
  // CDD_TASK_BRIEF 由 buildTaskEnv 恒设置 —— briefPath 永不为 falsy，无外层守卫。
  // plan、taskNum、cwd 均为本函数现有作用域变量
  {
    const briefPath = env.CDD_TASK_BRIEF;
    if (!existsSync(briefPath)) {
      if (!plan) return finish(1, [], "brief missing and plan unavailable: cannot auto-generate brief", noExit);
      try {
        generateBrief(plan, taskNum, briefPath, cwd);
      } catch (e) {
        return finish(1, [], `brief auto-generation failed: ${e.message}`, noExit);
      }
    } else if (!validateBrief(briefPath)) {
      return finish(1, [], `brief at ${briefPath} missing TASK_BASE: line`, noExit);
    }
  }

  // 5. Task-review fixed-point + review-package
  if (mode === "task-review") {
    if (!env.CDD_TASK_REVIEW_FIXED_POINT) {
      const handoffBase = readJsonField(env.CDD_HANDOFF_PATH, ["commits", "base"]);
      if (handoffBase) env.CDD_TASK_REVIEW_FIXED_POINT = handoffBase;
    }
    if (dryRun && !env.CDD_TASK_REVIEW_FIXED_POINT) env.CDD_TASK_REVIEW_FIXED_POINT = "HEAD~1";
    if (!dryRun) {
      if (!plan) return finish(1, [], "task-review mode requires plan path (ledger header or --plan)", noExit);
      if (!existsSync(plan)) return finish(1, [], `plan file not found: ${plan}`, noExit);
      const taskReviewBase = env.CDD_TASK_REVIEW_FIXED_POINT;
      if (!taskReviewBase) return finish(1, [], "task-review mode requires CDD_TASK_REVIEW_FIXED_POINT or handoff commits.base", noExit);
      let taskReviewHead = "HEAD";
      const handoffHead = readJsonField(env.CDD_HANDOFF_PATH, ["commits", "head"]);
      if (handoffHead) taskReviewHead = handoffHead;
      try {
        await runReviewPackage(plan, taskReviewBase, taskReviewHead, env.CDD_HANDOFF_PATH, { cwd, env });
      } catch (e) {
        if (e instanceof RunBlocked) return finish(1, [], e.message, noExit);
        throw e;
      }
    }
  }

  // 6. require env / mode validation
  const modeErr = validateMode(mode);
  if (modeErr) return finish(1, [], modeErr, noExit);
  const missing = requireEnv(env, mode);
  if (missing) return finish(1, [], missing, noExit);

  // 7. Render prompt
  let prompt;
  try {
    prompt = renderModePrompt(mode, promptEnv(env, taskNum));
  } catch (e) {
    return finish(1, [], `template render failed: ${e.message}`, noExit);
  }

  // 8. Invoke CLI（或 dry-run 仿真）
  let agentOut = "";
  let agentRc = 0;
  let cliStderr = "";
  if (dryRun) {
    agentOut = dryRunH1Block(env, taskNum);
  } else {
    const res = await invokeCli(entry, prompt, mode, env, cwd);
    agentOut = res.ok ? res.stdout : "";
    cliStderr = res.stderr;
    if (!res.ok) agentRc = res.code;
  }

  // 9. Commit-contract（先于 H1 —— validator 可能把 handoff 重写为 BLOCKED，H1 必须读该状态）。
  //    !ok → stderr CDD_BLOCKED 诊断（对齐 bash cdd_validate_commit_contract 的 printf）+ exit 1。
  const contract = validateCommitContract(mode, workspace, { handoffPath: env.CDD_HANDOFF_PATH });
  if (!contract.ok) {
    return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), contract.blocker, noExit);
  }

  // 10. 嵌套 CLI 失败且无 handoff → 写 BLOCKED handoff（stderr 进 blocker）+ H1-from-handoff +
  //     stderr CDD_BLOCKED 诊断 + exit 1（对齐 bash cdd_exit_blocked）。唯一 sanctioned divergence：
  //     Node 额外写 handoff（§spec 2.1 stderr-surfacing）—— bash 为 emit 原始 agent H1 + exit 1。
  if (agentRc !== 0 && !existsSync(env.CDD_HANDOFF_PATH)) {
    const stderrText = cliStderr.trim();
    const blocker = stderrText
      ? `cli exited ${agentRc}: ${stderrText}`
      : `cli exited ${agentRc} and handoff missing`;
    writeHandoff(env.CDD_HANDOFF_PATH, {
      task: taskNum,
      phase: mode,
      status: "BLOCKED",
      commits: { base: "unknown", head: "unknown" },
      blocker,
    });
    return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), `cli exited ${agentRc} and handoff missing`, noExit);
  }

  // 11. H1 四行（来自 agent stdout / dry-run 块）
  const h1 = h1FourLines(agentOut);

  // 12. agent 失败但 handoff 存在 → exit agent_rc
  if (agentRc !== 0) {
    return finish(agentRc, h1, "", noExit);
  }

  // 13. OK（dry-run 不写 handoff —— 对齐 bash：bash dry-run 分支不写，Node 亦不写）
  return finish(0, h1, "", noExit);
}


// ---- plan 构建块（纯函数，单测 seam）----

// 对齐 _task_numbers_from_plan：`^### Task N:` → 数字排序。
export function taskNumbersFromPlan(planFile) {
  const nums = [];
  for (const line of readFileSync(planFile, "utf8").split("\n")) {
    const m = line.match(/^### Task (\d+):/);
    if (m) nums.push(Number(m[1]));
  }
  return nums.sort((a, b) => a - b);
}

// 对齐 _ledger_complete：ledger 含 `^Task N: complete` 行。
function ledgerComplete(n, ledgerPath) {
  if (!ledgerPath || !existsSync(ledgerPath)) return false;
  return new RegExp(`^Task ${n}: complete`).test(readFileSync(ledgerPath, "utf8"));
}

// 对齐 _handoff_status：缺失 → "MISSING"；损坏 → "UNKNOWN"；否则 status // "UNKNOWN"。
export function handoffStatus(handoffPath) {
  if (!handoffPath || !existsSync(handoffPath)) return "MISSING";
  try {
    return JSON.parse(readFileSync(handoffPath, "utf8")).status ?? "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

// 对齐 _task_pending：非 ledger-complete 且 handoff status ≠ APPROVED。
export function isTaskPending(n, ledgerPath, handoffPath) {
  if (ledgerComplete(n, ledgerPath)) return false;
  return handoffStatus(handoffPath) !== "APPROVED";
}
