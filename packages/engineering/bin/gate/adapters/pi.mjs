// gate/adapters/pi.mjs — Pi TS extension adapter（P4b T5）。
// pi 无 CLI hooks manifest；扩展为 TS 模块，default export factory 接收 ExtensionAPI，
// pi.on("tool_call", handler) 注册阻塞处理器。校准自 pi extensions 文档：
// handler(event, ctx)，event.toolName / event.input（可变更、后置 handler 可见），
// ctx.cwd / ctx.sessionManager；deny → { block: true, reason }（terminate 不设 →
// 仅阻断本次调用）。写工具 input 用 path（read/write/edit 同构），gate 核心查
// path || file_path → 直接命中。
// 发现：pi 在 ~/.pi/agent/extensions + .pi/extensions 自动发现 `*.ts` / `*/index.ts`。
// pi 包确有 package.json `pi` key（skills/prompts/themes 分发通道，见 research
// harness-marketplace-hooks §1 Pi 行），但 gate 不以此为通道：adapter 是 `.mjs`，
// pi 扩展只认 `*.ts`，故消费方通过 os-init gates 手动扩展复制（configs/pi/pi.ts
// shim re-export 本 default export factory；见 gate/configs/pi/README.md）。`.mjs`
// 经 shim 的绝对路径 import 加载 —— 未经真实 pi 安装实测（experimental）。
import { gateDecide } from "../cdd-gate-core.mjs";
import { canonicalToolName } from "./lib.mjs";

export default function cddGate(pi) {
  pi.on("tool_call", async (event, ctx) => {
    try {
      const r = gateDecide({
        harness: "pi",
        toolName: canonicalToolName(event.toolName),
        toolInput: event.input ?? {},
        sessionKey: await piSessionKey(ctx),
        repoRoot: ctx.cwd ?? process.cwd(),
      });
      if (r.decision === "deny") return { block: true, reason: r.reason };
      return {};
    } catch (e) {
      // 异常（畸形 event/ctx、gateDecide 意外抛错）→ fail-open allow（stderr 记录）。
      console.error(`[cdd-gate pi] ${e?.message ?? e}`);
      return {};
    }
  });
}

// sessionManager.getSessionId() 为会话标识（gateway 追踪/归因用）；不可用 → 静态 "pi" key。
async function piSessionKey(ctx) {
  try {
    const id = await ctx.sessionManager?.getSessionId?.();
    if (id) return id;
  } catch {
    // sessionManager 不可用 / 抛错 → 回退静态 key（fail-open 一致）。
  }
  return "pi";
}
