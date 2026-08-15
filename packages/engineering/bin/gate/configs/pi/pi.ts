// os-init gates — Pi TS extension（manual extension copy）。
// Pi auto-discovers `*.ts` / `*/index.ts` under ~/.pi/agent/extensions/ and
// .pi/extensions/（无 package.json `pi` key 机制）。本 shim re-export 包内 gate
// adapter 的 default export factory（pi.on("tool_call", …) 注册阻塞处理器）——
// gate 核心留在包内（由 adapter 导入），pi 扩展路径只需在安装时替换
// {{GATE_ADAPTER}} 为包内 adapter 的绝对路径。
export { default } from "{{GATE_ADAPTER}}";
