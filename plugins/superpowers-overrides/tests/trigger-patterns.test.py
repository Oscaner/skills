import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "build/lib"))
from manifest_targets import load_targets
from trigger_patterns import attach_path_regexes, bare_slash_prompt_regex, cc_matcher_bare_slash, cc_matcher_spor_slash

ROOT = Path(__file__).resolve().parents[1]
slugs = {t.upstream_slug for t in load_targets(ROOT)}

def test_all_manifest_slugs_have_patterns():
    for slug in slugs:
        assert bare_slash_prompt_regex(slug)
        assert cc_matcher_bare_slash(slug)
        assert cc_matcher_spor_slash(slug)

def test_attach_patterns_cover_all_four_families():
    joined = "|".join(attach_path_regexes("brainstorming"))
    assert r"/skills/brainstorming/SKILL" in joined or "skills/brainstorming" in joined
    assert "plugins/superpowers/skills" in joined
    assert r"\.claude/plugins/cache" in joined
    assert r"\.cursor/skills" in joined

if __name__ == "__main__":
    test_all_manifest_slugs_have_patterns()
    test_attach_patterns_cover_all_four_families()
    print("OK")
