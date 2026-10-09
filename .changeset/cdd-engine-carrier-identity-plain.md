---
"@oscaner-skills/cdd-engine": patch
---

The handoff carrier now carries only the schema-declared writable fields — the engine-seated identity (`phase` · `tasks`) is no longer written inline; the canonical file name (`tasks-{wave}-*.json` / the branch range / the doc family) is the sole identity. The inline identity was never declared in the writable subset yet was materialized by the engine, seeding a mimicking precedence that tripped the reserved-field gate (a fix draft copied `phase` and was rejected — correctly, but avoidably). `buildHandoff` / the materialized carrier hold the declared plane only; existing runtime carriers are untouched.
