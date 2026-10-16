---
"@oscaner-skills/kairos": major
---

feat: kairos — the plugin's first stable line: the `cdd-*` skill family, the `osuperpowers` → `kairos` rename, and the pi-harness distribution (breaking):

- **Skill rename to the `cdd-*` family** (breaking, on all three harnesses) — every skill's directory, front-matter `name:`, and invocation token now share the `cdd-*` identity (`cdd-design` / `cdd-spec-writer` / `cdd-plan` / `cdd-dev` / `cdd-close` / `cdd-report`). In-plugin references and harness invocations use the new names throughout — claude/cursor invoke the slash form `/kairos:cdd-<name>`, pi invokes `/skill:cdd-<name>`.
- **Naming retirement `osuperpowers` → `kairos`** — the plugin's npm package name, invocation namespace (`/kairos:`), marketplace manifests, and install commands all read `kairos`; the retired `osuperpowers` token no longer resolves for install or invocation. The `cdd` CLI and the standalone `@oscaner-skills/cdd-engine` package are unchanged.
- **Manifest key rename `oscaner-plugin` → `oscaner`** — the `package.json` SOT key for emit and validation renames; `oscaner.harnesses` now declares the full delivery surface (claude / cursor / pi), and `oscaner.contentRoot` / `oscaner.keywords` / `oscaner.claude` carry the metadata previously spread across the old key.
- **pi-harness distribution** — the plugin declares the pi fields (`pi: { skills: ["./skills"] }` + the `pi-package` keyword), and the manifest contract is pinned in behavior tests. Each `cdd-*` name is a unique bare token, so a pi harness mounting kairos alongside any other plugin gets zero skill-name collisions.
- **Consumers** — reinstall kairos with its current install command, rename any `oscaner-plugin` key to `oscaner`, and replace any `/osuperpowers:*` references with `/kairos:cdd-*` (bare `/skill:cdd-*` on pi). This major also moves the plugin onto its first stable line (`0.x` → `1.0.0`).
