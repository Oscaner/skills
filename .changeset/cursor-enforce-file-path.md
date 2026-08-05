---
"superpowers-overrides": patch
---

**Fix Cursor `preToolUse` enforce rejecting valid spor Read first tools**

- Cursor sends Read paths in `tool_input.file_path`; enforce only read `.path`, denying legitimate `Read(.../spor-*/SKILL.md)` calls after detect.
- Coalesce `path // file_path` in enforce generator; regenerate `override-cursor-enforce.sh`.
- Deny message now leads with Read (Cursor) and mentions Skill (Claude Code).
- Shell test covers Cursor-shaped `file_path` payload; CURSOR-SMOKE / cross-harness docs updated.
