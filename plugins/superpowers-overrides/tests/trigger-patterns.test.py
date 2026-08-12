import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "build/lib"))
from manifest_targets import load_targets, target_skill_suffix
from trigger_patterns import attach_path_regexes, bare_slash_prompt_regex, cc_matcher_bare_slash

import trigger_patterns as tp

ROOT = Path(__file__).resolve().parents[1]
targets = load_targets(ROOT)
slugs = {t.upstream_slug for t in targets}
names = {t.name for t in targets}


def test_all_manifest_slugs_have_bare_slash_patterns():
    for slug in slugs:
        assert bare_slash_prompt_regex(slug)
        assert cc_matcher_bare_slash(slug)


def test_targets_are_plugin_qualified():
    for t in targets:
        assert ":" in t.name, t.name
        plugin, skill = t.name.split(":", 1)
        assert plugin in ("os-engineering", "mattpocock-skills"), plugin
        assert skill


def test_target_skill_suffix_resolves():
    for t in targets:
        suffix = target_skill_suffix(t)
        assert suffix.endswith("/SKILL.md"), suffix
    # submodule target (mattpocock tdd) derives its nested path, not skills/tdd
    tdd = next(t for t in targets if t.name == "mattpocock-skills:tdd")
    assert target_skill_suffix(tdd) == "skills/engineering/tdd/SKILL.md"


def test_spor_slash_matcher_functions_removed():
    assert not hasattr(tp, "spor_slash_prompt_regex")
    assert not hasattr(tp, "cc_matcher_spor_slash")


def test_attach_patterns_cover_all_four_families():
    joined = "|".join(attach_path_regexes("brainstorming"))
    assert r"/skills/brainstorming/SKILL" in joined or "skills/brainstorming" in joined
    assert "plugins/superpowers/skills" in joined
    assert r"\.claude/plugins/cache" in joined
    assert r"\.cursor/skills" in joined


if __name__ == "__main__":
    test_all_manifest_slugs_have_bare_slash_patterns()
    test_targets_are_plugin_qualified()
    test_target_skill_suffix_resolves()
    test_spor_slash_matcher_functions_removed()
    test_attach_patterns_cover_all_four_families()
    print("OK")
