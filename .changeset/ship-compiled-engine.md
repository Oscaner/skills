---
"@oscaner-skills/cdd-engine": patch
---

fix: publish the compiled `dist/` instead of raw `.ts` sources, so `npx @oscaner-skills/cdd-engine` no longer fails with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` on Node versions that refuse type stripping under `node_modules`.
