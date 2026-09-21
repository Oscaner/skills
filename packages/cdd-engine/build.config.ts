// build.config.ts — unbuild 构建配置（P5 §2.13：src/ 全量 TS + dist/ 产物）
// dev 与发布同走 dist 入口：`pnpm build` 真打包，`pnpm dev:stub`（unbuild --stub）生成 jiti 即时加载桩。
import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  // src/bin.ts → dist/cli.mjs（name 决定产物文件名，对齐开发调用链 `node packages/cdd-engine/dist/cli.mjs`）
  entries: [
    { builder: "rollup", input: "src/bin", name: "cli" },
    // Publish the canonical doc-structure schemas (P2 T1 ④): src/documents/schema/*.json is the
    // single source of truth; the copy entry ships the addressable copy at dist/documents/schema
    // (package.json files includes dist/, so the published package carries it). Under dev:stub the
    // copy builder symlinks the source dir, keeping the dev face identical to the canonical files.
    { builder: "copy", input: "src/documents/schema", outDir: "dist/documents/schema", pattern: ["*.json"] },
  ],
});
