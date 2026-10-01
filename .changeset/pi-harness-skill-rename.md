---
"@oscaner-skills/kairos": major
---

feat: full `cdd-*` skill rename (8 skills) + plugin naming retirement `osuperpowers` → `kairos`.

- **Skill rename to the `cdd-*` family (breaking, on all three harnesses).** Every skill's directory, front-matter `name:`, and invocation token now share the `cdd-*` identity: `cdd-design` / `cdd-spec` / `cdd-charter` / `cdd-phase` / `cdd-plan` / `cdd-dev` / `cdd-close` / `cdd-report`. In-plugin references and harness invocations use the new names throughout — claude/cursor invoke `kairos:cdd-<name>` / `@kairos/cdd-<name>`, pi invokes `/skill:cdd-<name>`.
- **Naming retirement `osuperpowers` → `kairos`.** The plugin's npm package name, invocation namespace (`/kairos:`), marketplace manifests, and install commands all read `kairos`; the retired `osuperpowers` token no longer resolves for install or invocation. The `cdd` CLI and the standalone `@oscaner-skills/cdd-engine` package are unchanged.
- **Coexistence (pi flat namespace).** Each `cdd-*` name is a unique bare token, so a pi harness mounting kairos alongside any other plugin gets zero skill-name collisions — pi resolves duplicate bare names deterministically first-wins, and uniqueness is what keeps every kairos skill unambiguous in the shared flat namespace.
- **Consumers.** Reinstall kairos with its current install command and replace any `/osuperpowers:*` references with `/kairos:cdd-*` (bare `/skill:cdd-*` on pi). This major also moves the plugin onto its first stable line (`0.x` → `1.0.0`).
