// lint-staged.config.ts — the commit gate (C6): the pre-commit hook is a single
// pnpm exec lint-staged line. Tasks, no-fix semantics (a surviving violation exits
// non-zero and blocks the commit — biome never writes back) plus the validate
// tree-independent-subset catch-all as the full-tree backstop (runs once per commit).
export default {
  "*.ts": ["biome check"],
  "*": ["pnpm run precommit"],
};
