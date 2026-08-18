---
name: os-debugging
description: Independent systematic debugging orchestrator -- Reads upstream superpowers:systematic-debugging as baseline, layers personal rules (no fix without diagnostic evidence / delegate diagnosing-bugs).
---

# OS Debugging

Systematic debugging: evidence before fix proposals.

## Rules

### Rule: Read Upstream

Read upstream `superpowers:systematic-debugging` SKILL.md as the process baseline **when available** (resolution priority + unavailability fallback same as [Rule: Read Upstream](../os-brainstorming/SKILL.md#rule-read-upstream)). **Read, not Skill-invoke**.

### Rule: No-Fix-Without-Evidence

Before proposing a fix, the current turn must have diagnostic tool output (Read/Bash/Grep used for information gathering) or an explicit reference to prior diagnostic results. Otherwise, **refuse to output a fix proposal** and complete root cause investigation first. Exemption: user explicitly states the root cause is known.

### Rule: Delegate Diagnosis

The diagnostic loop delegates to `mattpocock-skills:diagnosing-bugs` (Skill-invoke), do not reimplement. Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).

## Red Flags

- "Guess first, verify later" -> no fix without evidence (Rule: No-Fix-Without-Evidence)
