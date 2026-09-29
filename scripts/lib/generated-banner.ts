// scripts/lib/generated-banner.ts — the canonical emit watermark literal, the single
// definition for every generated document (`_generated`). All consumers resolve here:
// the harness classes (scripts/lib/harness-registry.ts), the marketplace domain service
// (scripts/lib/marketplace-utils.ts), and the emit-side re-export surface
// (scripts/emit/manifests.ts → `generatedBanner`). Never re-declare the literal in a
// consumer — byte pins + emit-drift checks couple emitted products to this one string.

export const generatedBanner = "scripts/run.ts emit — do not edit";
