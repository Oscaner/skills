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
    {
      builder: "copy",
      input: "src/documents/schema",
      outDir: "dist/documents/schema",
      pattern: ["*.json"],
    },
    // Publish the harness registry (P3 T7 consumer parity): src/infra/harness-registry.json is the
    // single source; the copy entry ships dist/resources/harness-registry.json (infra/registry.ts
    // resolveRegistryPath published-first — the bundled module's file-relative URL would land in
    // the bundle's chunk dir, which no build materializes). The outDir must be a DEDICATED subdir:
    // unbuild's copy builder in stub mode rmdir's the whole outDir + symlinks the input dir, so a
    // copy into the top-level dist/ would clobber the rollup stub (the schema entry's dedicated
    // dist/documents/schema follows the same rule).
    {
      builder: "copy",
      input: "src/infra",
      outDir: "dist/resources",
      pattern: ["harness-registry.json"],
    },
  ],
});
