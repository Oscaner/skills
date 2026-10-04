---
"@oscaner-skills/cdd-engine": patch
---

refactor: doc-structure tokens derive from the DocType.shape domain (S8) — `deriveDocTokens` reads the three shape-domain faces (`doctypes/shapes/*`, the same `DocType.shape` content the registry's doc types carry) instead of re-reading the derived `config/schema` products via `loadDocSchema`; production `DOC_TOKENS` values byte-unchanged, and the dead `documents/schema/` + retired `ex lib/` comment residues are cleaned.

- **Token derivation single source** — `deriveDocTokens` now accepts the three `SchemaShape` faces (plan / overall / phase-spec); `DOC_TOKENS` derives on load from the exact shape objects the registry serves and the SchemaFactory byte-faithfully projects onto the `config/schema` products — edit a shape leaf once and the engine tokens follow in the same build, while the derived products are never re-read.
- **Dead-reference cleanup** — the CLAUDE.md skill-anatomy pointer moves to `config/schema/skill-anatomy.json`, stale `documents/schema/*.json` comments point at the shape domain, and the retired `ex lib/` (.mjs-plane) lineage notes are gone.
