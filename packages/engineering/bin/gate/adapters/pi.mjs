// gate/adapters/pi.mjs — Pi TS extension adapter（P4b T5）。
// pi 无 CLI hooks manifest；扩展为 TS 模块，default export factory 接收 ExtensionAPI，
// pi.on("tool_call", handler) 注册阻塞处理器。校准自 pi extensions 文档：
// handler(event, ctx)，event.toolName / event.input（可变更、后置 handler 可见），
// ctx.cwd / ctx.sessionManager；deny → { block: true, reason }（terminate 不设 →
// 仅阻断本次调用）。写工具 input 用 path（read/write/edit 同构），gate 核心查
// file_path ?? path → 直接命中。
// 发现：pi 在 ~/.pi/extensions 自动发现 `*.ts`；本包扩展走 package.json `pi.extensions`
// 显式路径加载（`.mjs` = ESM 模块）。`.mjs` 经实时 loader 支持未经实测 —— 若目标 pi
// 版本不加载 `.mjs`，将本文件转写为 `.ts` 并在 piPackageKey/package.json 同步扩展路径
// （见 gate/configs/pi/README.md）。
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
