// gate/adapters/opencode.mjs — OpenCode TS plugin adapter（P4b T5）。
// opencode 无 hooks.json；插件为 TS/JS 模块，loader 扫描模块的函数导出并以 PluginInput
// （{ directory, project, worktree, client, $, … }）调用 → 返回 Hooks 对象。本适配器导出
// `cddGate` plugin 函数（直接函数导出，opencode getLegacyPlugins 路径可加载）。
// 阻塞形状：tool.execute.before 抛 Error 阻断（opencode 官方语义：throw 即 block；
// 改写 output.args 可重写参数）。hook 签名 (input, output)，校准自 opencode plugins 文档：
// input.tool / input.sessionID / input.callID，output.args。
import { gateDecide } from "../cdd-gate-core.mjs";
import { canonicalToolName } from "./lib.mjs";

export async function cddGate({ directory }) {
  return {
    "tool.execute.before": async (input, output) => {
      try {
        const args = { ...(output?.args ?? {}) };
        // opencode 写工具（write/edit）用 camelCase filePath；gate 核心查 path || file_path。
        if (args.filePath != null && args.file_path == null) args.file_path = args.filePath;
        const r = gateDecide({
          harness: "opencode",
          toolName: canonicalToolName(input?.tool),
          toolInput: args,
          sessionKey: input?.sessionID, // Bug O Step 5b: repoRoot 由 CDD_GATE_WORKSPACE env 推导，不再经 input
        });
        if (r.decision === "deny") throw new Error(r.reason);
      } catch (e) {
        // deny 抛错（gate 决策，opencode throw 即 block）→ 继续传播；
        // 其它异常（畸形 input、gateDecide 意外抛错）→ fail-open allow（stderr 记录）。
        if (e instanceof Error && e.message.startsWith("CDD orchestrator gate")) throw e;
        console.error(`[cdd-gate opencode] ${e?.message ?? e}`);
      }
    },
  };
}
