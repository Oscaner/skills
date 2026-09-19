// packages/cdd-engine/vitest.config.mjs
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    pool: 'forks',            // node:test 兼容模式（避免 worker_threads 干扰 execa mock）
    // Memory-bounded concurrency (2026-09-17): the previous default spawned one
    // fork per CPU (10) with no per-file cap; each fork loads the full engine
    // (jiti stub → simple-git / handlebars / …) and spawns node CLI + git
    // subprocesses, so a full `pnpm test` could OOM the host (observed on
    // 2026-09-17 while running validate during a P5 task dispatch). Bound to a
    // single worker running one file at a time; subprocess-heavy tests are
    // further capped in-file. Folded into the P6 plan as the engine-side
    // test-run memory guard (overall v1.28).
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 2,
    // Explicit include for the migrated colocated suite (P6 Task 3): every test node now
    // lives at src/**/__tests__/**/*.test.ts (tests/ retired; .mjs plane is zero).
    // All tests are TypeScript (vitest transforms TS via esbuild); any .mjs regressing
    // back into the engine is caught by the residue mjs-terminal-state guard (block 5c).
    include: ['src/**/__tests__/**/*.test.ts'],
    // 5b CLI 黑盒用例依赖「入口门意义下的干净树」（E2②/G4①，P6 T10 文档化前置）：cdd.test.ts /
    // docs-task.test.ts / cli-shape.test.ts 的部分 dry-run 用例以 REPO_ROOT 为 cwd 黑盒运行 ——
    // 入口门放行依赖两态之一：真实干净树，或 dirty + dry-run 的 CDD_WARN 降级。跑测试时请勿带着
    // 脏开发树（未提交改动）执行本套件黑盒用例，除非预期它们断言 CDD_WARN 降级路径；entry gate
    // 与 dry-run 协议的语义变更需同步 review 这三个文件的用例预期。
    // The suite spawns many node CLI + git subprocesses under a 20-file forks pool; per-test
    // wall time inflates under load (observed >5s on a busy machine). 20s guards the
    // default 5s budget without masking genuinely stuck tests.
    testTimeout: 20000,
    coverage: { provider: 'v8' },
  },
});
