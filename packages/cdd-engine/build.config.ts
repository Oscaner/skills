// build.config.ts — unbuild 构建配置（P5 §2.13：src/ 全量 TS + dist/ 产物）
// dev 与发布同走 dist 入口：`pnpm build` 真打包，`pnpm dev:stub`（unbuild --stub）生成 jiti 即时加载桩。
import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  // src/bin.ts → dist/cli.mjs（name 决定产物文件名，对齐开发调用链 `node packages/cdd-engine/dist/cli.mjs`）
  entries: [
    { builder: "rollup", input: "src/bin", name: "cli" },
    // Publish the read-as-data plane (P4 C7): config/ is the single static-data home — runtime
    // config (engine-config) · harness contract (harness-contract) · contract lexicon ·
    // template contract + the generic config/schema/ namespace (doc-structure + handoff +
    // cache-profile schemas). The copy entry mirrors config/ to dist/config (the consumer
    // install's addressable face; every loader resolves published-dist-first via resolveResource).
    // The outDir must be a DEDICATED subdir: unbuild's copy builder in stub mode rmdir's the whole
    // outDir + symlinks the input dir, so a copy into the top-level dist/ would clobber the rollup
    // stub.
    {
      builder: "copy",
      input: "config",
      outDir: "dist/config",
      pattern: ["**/*.json"],
    },
  ],
});
