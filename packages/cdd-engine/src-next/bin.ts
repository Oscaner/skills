// packages/cdd-engine/src-next/bin.ts
// P3.2 new-tree CLI entry point (placeholder).
//
// The five planes (contract / session / face / render / infra) land in T2-T10; the
// cutover task (T11) wires this entry to the dispatch face and the old-tree entry
// (src/bin.ts) goes dark. Until then the old tree stays the live CLI (dual-face build
// discipline - the plan's dual-face build constraint), and forking this entry must
// stay inert yet valid so the dual tsconfig include and the dual vitest project
// remain green.
//
// The dev face runs the .ts source directly under Node >=22.18 (native type
// stripping), matching the old-tree entry convention - no dist materialization.
export {};
