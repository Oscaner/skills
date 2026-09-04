// gate/cdd-gate-core.mjs — P4b Node CDD gate core (T2)。
// 从 bin/lib/cdd-orchestrator-gate.sh 逐函数移植（行为为准）；cli 严格模式落到
// cdd_write_allowed / cdd_gate_phase 的等价判定。副作用仅：只读 git exec
// （rev-parse / cat-file / show-toplevel，execFileSync + catch → fail-open）；
// 不写 workspace、不 commit。
//
// Bug O Step 5b: gate 状态经 **runner spawn env** 传播（hook 在 CLI 子进程内运行，
// 继承 env）：CDD_GATE_WORKSPACE（workspace 路径，repo root 由 git toplevel 推导）、
// CDD_GATE_MODE（cli | in-session | subagent）、CDD_GATE_PLAN（deny 文案 plan basename）。
// TMPDIR pending 文件机制（pending 路径 / TTL env）已随转 env 一并删除。
//
// 导出：gateDecide(input) + isWriteTool / isShellTool / readonlyGitVerbs / gitVerbAllowed /
// denyMessage（adapter 用 r.context 渲染 deny 文案）。CLI 与 11 个 adapter（T3/T4）都调用 gateDecide。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 写工具集 / shell 工具集 —— 与 cdd_is_write_tool / cdd_is_shell_tool 一致。
const WRITE_TOOLS = new Set(["Write", "StrReplace", "Edit", "WriteNotebook", "MultiEdit"]);
const SHELL_TOOLS = new Set(["Bash", "Shell"]);

// git 只读动词白名单 —— 单源（判定 + deny 消息矩阵共用），与 cdd_readonly_git_verbs 一致。
export const readonlyGitVerbs = [
  "status", "diff", "log", "show", "rev-parse", "branch", "remote", "ls-files", "diff-tree",
];

// branch/remote 只放行只读子参数（对齐 cdd_git_verb_allowed）。
const BRANCH_REMOTE_READONLY_ARGS = new Set(["-a", "-r", "-v", "--show-current"]);

export function isWriteTool(name) {
  return WRITE_TOOLS.has(name);
}

export function isShellTool(name) {
  return SHELL_TOOLS.has(name);
}

// 提取 git 子命令并查只读白名单。提取失败 → false（deny，fail-closed）。
// 支持：git <verb>、git -C <path> <verb>、git --git-dir=<path> <verb>
// v1 不支持：git -C <path> -c k=v <verb>（-c 配置选项）→ 提取失败 → deny。
// 含 shell 操作符（&& | ; > < $( ` 换行）或多行命令 → deny（防复合命令绕过）。
// 对齐 cdd_git_verb_allowed：tokens 由空白切分（bash read 默认 IFS）。
export function gitVerbAllowed(command) {
  if (typeof command !== "string" || command === "") return false;
  if (/&&|&|\||;|>|<|\$\(|`|\n/.test(command)) return false;
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] !== "git") return false;
  let verb = "";
  let i = 1;
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "-C") {
      i += 1; // 跳过 -C 及其路径
      continue;
    }
    if (t.startsWith("--git-dir=")) continue; // 跳过 --git-dir=<path>
    if (t.startsWith("-")) return false; // 其它未知 flag → 提取失败 → deny
    verb = t;
    break;
  }
  if (!verb) return false;
  if (verb === "branch" || verb === "remote") {
    for (let j = i + 1; j < tokens.length; j++) {
      if (!BRANCH_REMOTE_READONLY_ARGS.has(tokens[j])) return false;
    }
    return true;
  }
  return readonlyGitVerbs.includes(verb);
}

// cdd_shell_allowed：cdd-task / sdd-workspace / task-brief / review-package 直接放行，
// 否则落到只读 git 白名单。引擎入口为 cdd-task.mjs。
function shellAllowed(command) {
  if (typeof command !== "string") return false;
  if (/(^|\/)cdd-task\.mjs|sdd-workspace|task-brief|review-package/.test(command)) return true;
  return gitVerbAllowed(command);
}

// CDD_GATE_WORKSPACE 的 repo root —— git toplevel，CWD 无关（对齐 git rev-parse
// --show-toplevel）。非 git 仓库 / exec 失败 → ""（调用方 fail-open allow）。
function gitToplevel(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// cdd_is_under_path：path 等于 prefix 或在其下。
function isUnderPath(p, prefix) {
  if (!prefix || !p) return false;
  return p === prefix || p.startsWith(`${prefix}/`);
}

// cdd_normalize_abs：相对路径按 repo_root 落绝对；dirname 经逻辑路径解析（path.resolve
// 词法规范化，不解析符号链接 —— 对齐 bash `cd "$dir" && pwd` 的逻辑 $PWD 行为）。
function normalizeAbs(inputPath, repoRoot) {
  let p = inputPath;
  if (!path.isAbsolute(p)) p = path.resolve(repoRoot, p);
  const dir = path.dirname(p);
  const base = path.basename(p);
  if (existsSync(p)) {
    return path.join(path.resolve(dir), base);
  }
  if (existsSync(dir)) {
    return path.join(path.resolve(dir), base);
  }
  return p;
}

// git cat-file 绑定 repo_root（CWD 无关）—— 对齐 cdd_git_object_exists。
function gitObjectExists(repoRoot, sha) {
  try {
    execFileSync("git", ["-C", repoRoot, "cat-file", "-e", sha], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// brief 首行 `TASK_BASE: <sha>` 提取；tr -d ' \r' 对齐 bash（去掉空格与 CR）。
function extractTaskBase(content) {
  for (const line of content.split("\n")) {
    if (line.startsWith("TASK_BASE: ")) {
      return line.slice("TASK_BASE: ".length).replace(/[ \r]/g, "");
    }
  }
  return "";
}

function briefHasTaskBase(brief, repoRoot) {
  if (!existsSync(brief)) return false;
  const sha = extractTaskBase(readFileSync(brief, "utf8"));
  if (!sha) return false;
  return gitObjectExists(repoRoot, sha);
}

function handoffApproved(handoffPath) {
  if (!existsSync(handoffPath)) return false;
  try {
    const d = JSON.parse(readFileSync(handoffPath, "utf8"));
    return d.status === "APPROVED";
  } catch {
    return false;
  }
}

// 前沿任务号 —— 对齐 cdd_frontier_task（空 workspace → 0，对齐 `while [[ -n "$workspace" ]]`）。
function frontierTask(workspace, repoRoot) {
  if (!workspace) return 0;
  let n = 1;
  for (;;) {
    const brief = path.join(workspace, `task-${n}-brief.md`);
    const handoff = path.join(workspace, `task-${n}-handoff.json`);
    if (!existsSync(brief)) return n - 1;
    if (briefHasTaskBase(brief, repoRoot)) {
      if (!handoffApproved(handoff)) return n;
    } else {
      return n - 1;
    }
    n += 1;
  }
}

// phase 判定 —— 对齐 cdd_gate_phase：inactive | orchestrating | task_active | task_complete。
// workspace 显式来自 CDD_GATE_WORKSPACE env（Bug O Step 5b），无 pending 文件的扫描回退。
function gatePhase(repoRoot, workspace) {
  if (!workspace) return "orchestrating";
  const n = frontierTask(workspace, repoRoot);
  if (n === 0) return "orchestrating";
  const brief = path.join(workspace, `task-${n}-brief.md`);
  const nextBrief = path.join(workspace, `task-${n + 1}-brief.md`);
  const handoff = path.join(workspace, `task-${n}-handoff.json`);
  if (briefHasTaskBase(brief, repoRoot) && !handoffApproved(handoff)) return "task_active";
  if (handoffApproved(handoff) && !briefHasTaskBase(nextBrief, repoRoot)) return "task_complete";
  if (briefHasTaskBase(brief, repoRoot)) return "task_active";
  return "orchestrating";
}

// 写放行 —— 对齐 cdd_write_allowed（含 CDD_GATE_FIXTURES_ROOT 测试根 与
// .superpowers/sdd 过渡回退）。
function writeAllowed(absPath, repoRoot, workspace, phase) {
  const cddRoot = process.env.CDD_GATE_FIXTURES_ROOT ?? path.join(repoRoot, ".superpowers", "cdd");
  switch (phase) {
    case "inactive":
    case "task_complete":
      return true;
    case "orchestrating":
      if (isUnderPath(absPath, cddRoot)) return true;
      // Transition: in-flight plans 仍在 .superpowers/sdd/ —— 允许那里的 workspace 写。
      // fixtures root 为测试专用：设置了就只扫该根（D6-B5）。
      if (!process.env.CDD_GATE_FIXTURES_ROOT) {
        if (isUnderPath(absPath, path.join(repoRoot, ".superpowers", "sdd"))) return true;
      }
      return isUnderPath(absPath, workspace);
    case "task_active":
      return isUnderPath(absPath, workspace);
    default:
      return false;
  }
}

// deny 消息 —— 等价 cdd_deny_message（含恢复指引）。os_root 为 osuperpowers 插件根。
// 导出供 adapter（T3）用 r.context（taskNum/planBase）渲染 deny 文案。
export function denyMessage(harness, taskNum, planBasename_) {
  const osRoot = pluginRoot();
  const verbs = formatVerbs(readonlyGitVerbs);
  return `CDD orchestrator gate — direct repo edits forbidden during active task.

Allowed Bash (read-only diagnostics):
${verbs}
  cdd-task --harness ${harness}   (@oscaner-skills/cdd-engine bin)
  sdd-workspace / task-brief / review-package

Allowed Write:
  .superpowers/cdd/${planBasename_}/

Repo changes flow only through:
  cdd-task --harness ${harness} --task ${taskNum} --mode implement   (@oscaner-skills/cdd-engine bin)

Full matrix: ${osRoot}/skills/cli-driven-development/docs/cdd-reference.md (CDD gate matrix)
See cli-driven-development Rule: Three-Mode Chain.`;
}

// cdd_readonly_git_verbs 的 awk 排版：前 7 个动词一行（`  git x / git y / …`），
// 余下动词缩进续行。
function formatVerbs(verbs) {
  const firstLine = `  git ${verbs.slice(0, 7).join(" / git ")}`;
  const rest = verbs.slice(7).map((v) => `git ${v}`).join(" / ");
  return `${firstLine}\n  ${rest}`;
}

// 插件根 —— 自模块路径上溯找 .claude-plugin/plugin.json（对齐 cdd_plugin_root）。
function pluginRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(path.join(dir, ".claude-plugin", "plugin.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return "";
    dir = parent;
  }
}

// 活跃任务号 —— 对齐 cdd_active_task_num（frontier_task 的别名）。
function activeTaskNum(workspace, repoRoot) {
  return frontierTask(workspace, repoRoot);
}

// plan basename —— 对齐 cdd_plan_basename：CDD_GATE_PLAN env → progress.md 首行 → workspace 名。
function planBasename(workspace) {
  const planPath = process.env.CDD_GATE_PLAN ?? "";
  if (planPath) return path.basename(planPath).replace(/\.md$/, "");
  if (workspace) {
    const progress = path.join(workspace, "progress.md");
    if (existsSync(progress)) {
      const firstLine = (readFileSync(progress, "utf8").split("\n")[0] ?? "").trim();
      const m = firstLine.match(/^# (?:SDD|CDD) ledger — plan: (.+)$/);
      if (m) return path.basename(m[1]).replace(/\.md$/, "");
    }
    return path.basename(workspace);
  }
  return "unknown-plan";
}

function allowResult() {
  return { decision: "allow", reason: "", context: {} };
}

function denyResult(harness, workspace, repoRoot) {
  let taskNum = activeTaskNum(workspace, repoRoot);
  if (!(taskNum > 0)) taskNum = 1;
  const planBase = planBasename(workspace);
  return {
    decision: "deny",
    reason: denyMessage(harness, taskNum, planBase),
    context: { taskNum, planBase },
  };
}

// 核心入口 —— 对齐 cdd_gate_decide。input: { harness, toolName, toolInput, sessionKey }。
// Bug O Step 5b: repo_root 不再来自 pending JSON，由 CDD_GATE_WORKSPACE 的 git toplevel
// 推导；input.repoRoot / sessionKey 为调用方上下文，不参与 gate 判定（无 repo_root 可推导
// → fail-open allow，行为与 pending 时代一致）。
export function gateDecide(input) {
  const { harness, toolName, toolInput } = input ?? {};
  const ti = toolInput ?? {};

  // 读环境变量（hook 在子进程内运行，继承 runner spawn env）。
  const gateWorkspace = process.env.CDD_GATE_WORKSPACE ?? "";
  if (!gateWorkspace) return allowResult();
  const repoRoot = gitToplevel(gateWorkspace);
  if (!repoRoot) return allowResult();
  const sessionMode = process.env.CDD_GATE_MODE ?? "";
  const workspace = gateWorkspace;
  const phase = gatePhase(repoRoot, workspace);

  if (isShellTool(toolName)) {
    const command = ti.command ?? "";
    if (shellAllowed(command)) return allowResult();
    // 模式感知（spec §E，与 Write 分支一致）：mode 空 / in-session / subagent → Bash 放行
    // （嵌套 task agent 需 git add/commit、pnpm run emit、vitest 等）；cli 严格。
    if (sessionMode === "in-session" || sessionMode === "subagent" || sessionMode === "") return allowResult();
    if (phase === "inactive" || phase === "task_complete") return allowResult();
    return denyResult(harness, workspace, repoRoot);
  }

  if (isWriteTool(toolName)) {
    // path 优先、空串回退 file_path —— 对 bash 版 `jq -r '.path // .file_path // empty'`
    // 的刻意加固：jq `//` 是 alternative 运算符，空串不是 null/false → `"" // "x"` 仍返回
    // "" → 空 rawPath → `[[ -n "" ]]` 失败 → 静默 allow bypass。`||` 把空串当缺失 → 回退
    // file_path → 仅两者皆空才 allow（锁定：cdd-gate-core.test.mjs 的 path/file_path 空串用例）。
    const rawPath = ti.path || ti.file_path || "";
    if (!rawPath) return allowResult();
    const absPath = normalizeAbs(rawPath, repoRoot);
    // 模式感知（spec §E）：mode 空 / in-session / subagent → Write/Edit 放行；cli 严格。
    if (sessionMode === "in-session" || sessionMode === "subagent" || sessionMode === "") return allowResult();
    if (writeAllowed(absPath, repoRoot, workspace, phase)) return allowResult();
    return denyResult(harness, workspace, repoRoot);
  }

  return allowResult();
}