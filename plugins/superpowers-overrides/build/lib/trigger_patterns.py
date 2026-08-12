"""Shared trigger regex helpers for override hook generators."""
from __future__ import annotations

import re


def _slug_pattern(slug: str) -> str:
    return re.escape(slug)


def bare_slash_prompt_regex(slug: str) -> str:
    """Match bare /upstream-slug in user prompt (Cursor detect + shared)."""
    return rf"(?i)(^|\s)/{_slug_pattern(slug)}(\s|$)"


def cc_matcher_bare_slash(slug: str) -> str:
    """Claude Code UserPromptExpansion matcher for bare /upstream-slug."""
    return bare_slash_prompt_regex(slug)


def attach_path_regexes(slug: str) -> list[str]:
    """File-path patterns that indicate manual attach of upstream SKILL.md."""
    s = _slug_pattern(slug)
    return [
        rf"(?i)/skills/{s}/SKILL\.md$",
        rf"(?i)/plugins/superpowers/skills/{s}/SKILL\.md$",
        rf"(?i)/\.claude/plugins/cache/[^/]+/superpowers/[^/]+/skills/{s}/SKILL\.md$",
        rf"(?i)/\.cursor/skills/(superpowers/)?{s}/SKILL\.md$",
    ]


def target_skill_read_regexes(plugin: str, skill: str) -> list[str]:
    """Regexes matching the target skill's own SKILL.md path.

    Covers both the repo tree (``plugins/<plugin>/skills/<skill>/SKILL.md``)
    and the plugin cache (``.../<plugin>/<hash>/skills/<skill>/SKILL.md``).
    mattpocock-skills nests under ``skills/engineering/``.
    """
    p = re.escape(plugin)
    s = re.escape(skill)
    if plugin == "mattpocock-skills":
        return [rf"(?i)/{p}/(?:[^/]*/)?skills/engineering/{s}/SKILL\.md$"]
    return [rf"(?i)/{p}/(?:[^/]*/)?skills/{s}/SKILL\.md$"]
