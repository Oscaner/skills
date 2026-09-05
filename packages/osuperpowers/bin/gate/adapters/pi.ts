// gate/adapters/pi.ts — Pi TS extension gate adapter (P6b T2).
// Registers a tool_call handler via pi.on() for CDD gate enforcement.
// Replaces pi.mjs as the pi channel (T5).
import { gateDecide } from "../cdd-gate-core.mjs";
import { canonicalToolName } from "./lib.mjs";

export default function cddGate(pi: any): void {
  pi.on("tool_call", async (event: any, ctx: any) => {
    try {
      const r = gateDecide({
        harness: "pi",
        toolName: canonicalToolName(event.toolName),
        toolInput: event.input ?? {},
        sessionKey: await piSessionKey(ctx), // Bug O Step 5b: repoRoot 由 CDD_GATE_WORKSPACE env 推导，不再经 ctx
      });
      if (r.decision === "deny") return { block: true, reason: r.reason };
      return {};
    } catch (e: any) {
      // 异常（畸形 event/ctx、gateDecide 意外抛错）→ fail-open allow（stderr 记录）。
      console.error(`[cdd-gate pi] ${e?.message ?? e}`);
      return {};
    }
  });
}

// sessionManager.getSessionId() 为会话标识（gateway 追踪/归因用）；不可用 → 静态 "pi" key。
async function piSessionKey(ctx: any): Promise<string> {
  try {
    const id = await ctx.sessionManager?.getSessionId?.();
    if (id) return id;
  } catch {
    // sessionManager 不可用 / 抛错 → 回退静态 key（fail-open 一致）。
  }
  return "pi";
}
