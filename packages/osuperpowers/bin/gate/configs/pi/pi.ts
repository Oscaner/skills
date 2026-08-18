// os-init gates — Pi TS extension（manual extension copy）。
// Pi auto-discovers `*.ts` / `*/index.ts` under ~/.pi/agent/extensions/ and
// .pi/extensions/（Pi 包确有 package.json `pi` key 机制，但 gate adapter 是
// .mjs、不能作 .ts extension 走包通道 —— 见 configs/pi/README.md）。本 shim
// re-export 包内 gate adapter 的 default export factory（pi.on("tool_call", …)
// 注册阻塞处理器）—— gate 核心留在包内（由 adapter 导入），pi 扩展路径只需在
// 安装时替换 {{GATE_ADAPTER}} 为包内 adapter 的绝对路径。
export { default } from "{{GATE_ADAPTER}}";
