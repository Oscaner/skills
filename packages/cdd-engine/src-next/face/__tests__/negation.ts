// packages/cdd-engine/src-next/face/__tests__/negation.ts
// Shared test helper: the retired negated bool spellings are composed from the
// declared positive flags at runtime — the literal tokens never appear in the
// tree or in test files (the zero-consumption pin). The cli and projection
// suites share this synthesizer so the composition stays identical.
export const negatedOf = (flag: string) => `--no-${flag.replace(/^-+/, "")}`;
