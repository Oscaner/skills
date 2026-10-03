---
"@oscaner-skills/cdd-engine": patch
---

refactor: zero-build architecture — tsc-emit publish face, node-strip dev face, dead build machinery deleted.

- **Publish face is compiled JS only** — `bin`/`main`/`exports["."]` now point at `dist/bin.js`, produced by a single `tsc -p tsconfig.build.json` pass (`module: nodenext` + `rewriteRelativeImportExtensions`, shebang preserved). The `config/` tree is copied to `dist/config/` after emit so published-first resource resolution is unchanged, and the package now ships `dist/` + `config/` + `templates/` — the `src/` sources are never published (Node permanently forbids type-stripping under `node_modules`: `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` + tracker nodejs/node#57215 closed-as-not-planned).
- **Dev/CI face is zero-build** — `node packages/cdd-engine/src/bin.ts <subcommand>` runs the source directly (Node >= 22.18 native type stripping); the vitest black-box surface, the smoke-cdd pin, and the documented dev chain all invoke that entry.
- **Dead build machinery deleted** — unbuild, jiti, the stub dev script, the root build config, the global-setup self-stub, and the separate TS6-compat type-stripping line are removed (zero d.ts demand = zero JS-API consumers; dead-shell-gets-deleted).
- **`engines` raised to `>=22.18.0`** — the native type-stripping baseline.
- Non-breaking for consumers: the `cdd` bin command name is unchanged and the package has zero API consumers (main/exports exist for manifest resolvability only).
