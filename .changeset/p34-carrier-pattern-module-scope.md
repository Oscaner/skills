---
"@oscaner-skills/cdd-engine": patch
---

The published `cdd` binary no longer throws at import. The carrier-name predicate
was a private static field initialized from a private static method of its own
class; TypeScript down-levels that shape into a temp assigned after the class
body, so the built `dist` died with `Receiver must be class RoundNaming` before
any command ran. The pattern is now a module-scope const.
