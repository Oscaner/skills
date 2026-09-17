// build.config.ts — unbuild 构建配置（P5 §2.13：src/ 全量 TS + dist/ 产物）
// dev 与发布同走 dist 入口：`pnpm build` 真打包，`pnpm dev:stub`（unbuild --stub）生成 jiti 即时加载桩。
import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  // src/bin.ts → dist/cli.mjs（name 决定产物文件名，对齐开发调用链 `node packages/cdd-engine/dist/cli.mjs`）
  entries: [{ builder: "rollup", input: "src/bin", name: "cli" }],
});
