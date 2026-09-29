---
"@oscaner-skills/osuperpowers": major
---

feat: rename the first-party plugin's manifest key `oscaner-plugin` → `oscaner` in `package.json` — the single source of truth for emit and validation. `oscaner.harnesses` now declares the full delivery surface (claude / cursor / pi), `oscaner.contentRoot` / `oscaner.keywords` / `oscaner.claude` carry the metadata previously spread across the old key, and the pi-package package-surface guard ships in the shared harness registry. Consumers must rename their `oscaner-plugin` key to `oscaner` (breaking).
