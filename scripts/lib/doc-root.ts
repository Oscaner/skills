// scripts/lib/doc-root.ts — docs 根落点的**唯一真相**（P2 起：`docs/osuperpowers/`）。
// read-only pure data (Criterion ⑥: typed carrier, no empty-shell class) — consumers keep
// named-constant imports; segment arrays are readonly tuples so a second source of truth
// cannot be written elsewhere.
//
// 消费方（仓工具链内）：
//   - packages/osuperpowers/tests/grep-sweep-regression.test.mjs → grep -v 排除后缀
//
export const DOC_ROOT_SEGMENTS = ["docs", "osuperpowers"] as const;

/** `<cwd>/docs/osuperpowers/specs` 的段数组（供 path.join 展开）。 */
export const DOC_SPECS_SEGMENTS = [...DOC_ROOT_SEGMENTS, "specs"] as const;

/** `<cwd>/docs/osuperpowers/plans` 的段数组（供 path.join 展开）。 */
export const DOC_PLANS_SEGMENTS = [...DOC_ROOT_SEGMENTS, "plans"] as const;

/**
 * grep-sweep 排除后缀（历史 spec/plan 记录在 `docs/` 扫描面内，须排除）。
 * 三个 `grepCount` 链共享此单源，杜绝「根变更时逐链手改」的漂移。
 */
export const DOC_ROOT_EXCLUDE_PATHS = ["specs", "plans"].map(
  (seg) => `${DOC_ROOT_SEGMENTS.join("/")}/${seg}/`,
);
