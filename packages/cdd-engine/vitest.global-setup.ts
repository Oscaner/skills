// packages/cdd-engine/vitest.global-setup.ts — P3 T7 / design §2.6 D4 wiring change registration.
// The `prepare` hook (`pnpm run dev:stub`) was removed from package.json, so a bare `pnpm install`
// no longer auto-stubs dist/. The black-box CLI tests (cdd.test.ts CDD_MJS, cli-shape.test.ts,
// docs-task.test.ts) spawn packages/cdd-engine/dist/cli.mjs directly — without the hook their
// standalone `pnpm --filter @oscaner-skills/cdd-engine test` face would ENOENT on a fresh checkout.
// validate block 5b0 covers the CI face (explicit `pnpm -C packages/cdd-engine dev:stub` before the
// suite) — this globalSetup makes the standalone face self-sufficient: when dist/cli.mjs is
// missing, materialize the dev stub first (independent face self-supply, then the suite is
// unchanged). An existing dist is left untouched (a real `pnpm build` product is never clobbered by
// the test run).
import { existsSync } from "node:fs";
import { execaSync } from "execa";

export default function globalSetup(): void {
  if (existsSync(new URL("./dist/cli.mjs", import.meta.url))) return;
  execaSync("pnpm", ["-C", "packages/cdd-engine", "dev:stub"], { stdio: "inherit" });
}
