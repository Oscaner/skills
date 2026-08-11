---
name: spor-test-driven-development
description: MUST invoke BEFORE superpowers:test-driven-development as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-test-driven-development`, `/superpowers-overrides:spor-test-driven-development`, `/test-driven-development` or `/superpowers:test-driven-development` or `/tdd`; (2) a `<command-name>` tag in the current turn names any of those; (3) the superpowers:test-driven-development skill body appears in the current turn's system context; (4) user asks in natural language to do TDD, write tests first, follow red-green-refactor, or implement a feature test-first. Delegates to mattpocock-skills:tdd; seam confirmation gate lives in templates/cdd/implement.md
---

# Test-Driven Development（映射薄指针）

invoke Skill(mattpocock-skills:tdd)
