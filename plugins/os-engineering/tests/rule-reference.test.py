#!/usr/bin/env python3
"""Rule-reference integrity guard for skill SKILL.md files (issue #52 Guard 2),
semantic mode.

Scanning mode, selected per skills directory via `--skills <dir>:<mode>`:

  semantic (os-engineering): rules are named headings `### Rule: <Name>` (no
           number; `#### <Name>` subheadings never count). Inline
           `Rule: <Name>` refs must resolve to a same-file heading; cross-refs
           use markdown links `[Rule: <Name>](../<skill>/SKILL.md#rule-<kebab>)`
           whose target skill must have that heading. Cross-doc links carrying a
           `#rule-<kebab>` anchor (e.g.
           `[Return Block](../../docs/controller-handoff.md#rule-return-block)`)
           are validated too: the anchor must match a heading slug in the target
           file (SKILL.md or any `.md` under the repo).

Invocation (from the repo root):
  python3 plugins/os-engineering/tests/rule-reference.test.py \
    --skills os-engineering/skills:semantic

Exits 0 on clean scan + self-test; 1 otherwise.
"""
import os
import re
import shutil
import sys
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, "..", ".."))

DEFAULT_SKILLS = [
    ("os-engineering/skills", "semantic"),
]

# --- semantic mode (os-engineering) ---
# Rule headings are `### Rule: <Name>` — exactly level-3, so `#### <Name>` (or
# `#### Rule: <Name>`) subheadings never register as top-level rule IDs.
HEAD_SEM = re.compile(r'^### Rule: ([A-Z][A-Za-z0-9 -]*?)\s*$')
# Inline `Rule: <Name>` ref. Names are capitalized runs (letters/digits/hyphens/
# spaces); the match stops at the first char outside that class or at EOL, which
# keeps `Rule: Empty list（…）` and `Rule: One-shot Free-Form）` whole.
REF_SEM = re.compile(r'Rule: ([A-Z][A-Za-z0-9 -]*?)(?=[^A-Za-z0-9 -]|$)')
# Cross-file semantic ref: [Rule: <Name>](<path>/SKILL.md[#rule-<kebab>])
LINK_HAS_REF_SEM = re.compile(r'\[Rule: ([A-Z][A-Za-z0-9 -]*?)\]\(([^)]*SKILL\.md[^)]*)\)')

# --- cross-doc #rule-<kebab> anchor validation (semantic mode) ---
LINK_URL = re.compile(r'\[[^\]]*\]\(([^)]+)\)')   # any markdown link URL
RULE_FRAG = re.compile(r'^rule-[a-z0-9-]+$')       # #rule-<kebab> fragment
HEAD_ANY = re.compile(r'^#{1,6}\s+(.+?)\s*#*\s*$')  # any heading level (doc anchor)
COMMENT = re.compile(r'^\s*<!--')


def slugify(text):
    """GitHub-style anchor slug for headings. Rule headings are ASCII; CJK/other
    punctuation is dropped so e.g. `### Rule: Return Block` -> `rule-return-block`."""
    s = text.strip().lower()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'\s+', '-', s)
    return s.strip('-')


def heading_anchors(path):
    """Set of heading-slug anchors present in a markdown file (all levels)."""
    anchors = set()
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                m = HEAD_ANY.match(line.rstrip("\n"))
                if m:
                    anchors.add(slugify(m.group(1)))
    except OSError:
        pass
    return anchors


def build_index_semantic(skills_dir):
    idx = {}
    for name in os.listdir(skills_dir):
        path = os.path.join(skills_dir, name, "SKILL.md")
        if not os.path.isfile(path):
            continue
        ids = set()
        for line in open(path, encoding="utf-8"):
            m = HEAD_SEM.match(line)
            if m:
                ids.add(m.group(1).strip())
        idx[name] = ids
    return idx


def resolve_link(url, cur_dir, skills_dir):
    url = url.split("#", 1)[0]  # strip #rule-<kebab> fragment before path resolution
    target = os.path.normpath(os.path.join(cur_dir, url))
    try:
        under_skills = os.path.commonpath([target, skills_dir]) == os.path.normpath(skills_dir)
    except ValueError:  # different drives/roots (e.g. an absolute-path link)
        return None, False
    if under_skills and os.path.isfile(target):
        return os.path.basename(os.path.dirname(target)), True
    return None, False


def _inside_link(span, link_matches):
    return any(lm.start() <= span[0] and span[1] <= lm.end() for lm in link_matches)


def scan_semantic(skills_dir, idx):
    problems = []
    for name in sorted(os.listdir(skills_dir)):
        path = os.path.join(skills_dir, name, "SKILL.md")
        if not os.path.isfile(path):
            continue
        cur_dir = os.path.dirname(path)
        for lineno, line in enumerate(open(path, encoding="utf-8").read().splitlines(), 1):
            if HEAD_SEM.match(line) or COMMENT.match(line):
                continue
            # 1. cross-file markdown links: [Rule: <Name>](<url>SKILL.md...)
            link_matches = list(LINK_HAS_REF_SEM.finditer(line))
            for lm in link_matches:
                ref_name = lm.group(1).strip()
                url = lm.group(2)
                tname, is_sibling = resolve_link(url, cur_dir, skills_dir)
                if is_sibling and ref_name not in idx[tname]:
                    problems.append(f"{name}:{lineno}: Rule: {ref_name} -> {tname} lacks heading")
                # anchor contract: the #rule-<kebab> fragment on a cross-skill
                # [Rule: <Name>] link must be the kebab slug of the rule name, so the
                # anchor cannot silently point at a *different* rule in the same file
                # (both headings exist, so the bare anchor check in step 3 can't catch it).
                _, _, frag = url.partition("#")
                if is_sibling and frag and RULE_FRAG.match(frag) and frag != "rule-" + slugify(ref_name):
                    problems.append(
                        f"{name}:{lineno}: Rule: {ref_name} -> {tname}#{frag} anchor mismatch "
                        f"(want rule-{slugify(ref_name)})")
            # 2. bare same-file references (skip refs that are the link text above)
            for m in REF_SEM.finditer(line):
                if _inside_link(m.span(), link_matches):
                    continue
                ref_name = m.group(1).strip()
                if ref_name and ref_name not in idx[name]:
                    problems.append(f"{name}:{lineno}: Rule: {ref_name} dangling (no heading in {name})")
            # 3. cross-doc `#rule-<kebab>` anchors must resolve to a heading slug
            # in the target file — covers both SKILL.md links (../cli-select/
            # SKILL.md#rule-ask) and doc links (../../docs/controller-handoff.md
            # #rule-return-block). Missing target files are tolerated, matching
            # the lenient handling of SKILL.md links in step 1.
            for lm in LINK_URL.finditer(line):
                url = lm.group(1).strip()
                if url.startswith(("http://", "https://", "mailto:", "#")):
                    continue
                path_part, _, frag = url.partition("#")
                if not RULE_FRAG.match(frag):
                    continue
                target = os.path.normpath(os.path.join(cur_dir, path_part))
                if not os.path.isfile(target):
                    continue
                if frag not in heading_anchors(target):
                    rel = os.path.relpath(target, REPO_ROOT)
                    problems.append(f"{name}:{lineno}: #rule anchor {frag} not found in {rel}")
    return problems


def self_test():
    tmp = tempfile.mkdtemp()
    try:
        # semantic: same-file dangling caught; cross-file link to existing heading
        # OK, cross-file link to missing heading caught.
        d2 = os.path.join(tmp, "sem")
        os.makedirs(os.path.join(d2, "cli-aaa"))
        os.makedirs(os.path.join(d2, "cli-bbb"))
        with open(os.path.join(d2, "cli-aaa", "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: cli-aaa\n---\n\n### Rule: Alpha\n\nBody references Rule: Beta（dangling）.\n")
        with open(os.path.join(d2, "cli-bbb", "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: cli-bbb\n---\n\n### Rule: Gamma\n\nSee [Rule: Alpha](../cli-aaa/SKILL.md#rule-alpha) and Rule: Delta（missing）.\n")
        idx2 = build_index_semantic(d2)
        probs2 = scan_semantic(d2, idx2)
        assert any("Rule: Beta" in p for p in probs2), f"semantic same-file dangling not caught: {probs2}"
        assert any("Rule: Delta" in p for p in probs2), f"semantic bare dangling not caught: {probs2}"
        assert any("Rule: Alpha" in p and "cli-aaa lacks heading" in p for p in probs2) is False, \
            f"semantic valid cross-ref flagged: {probs2}"

        # semantic cross-doc anchor: doc link to an existing heading slug passes;
        # a `#rule-<kebab>` anchor with no matching heading is caught.
        d3 = os.path.join(tmp, "anchor")
        os.makedirs(os.path.join(d3, "cli-aaa"))
        os.makedirs(os.path.join(d3, "docs"))
        with open(os.path.join(d3, "docs", "controller-handoff.md"), "w", encoding="utf-8") as f:
            f.write("### Rule: Return Block\n\nBody.\n")
        with open(os.path.join(d3, "cli-aaa", "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: cli-aaa\n---\n\n"
                    "See [Return Block](../docs/controller-handoff.md#rule-return-block) "
                    "and [Missing](../docs/controller-handoff.md#rule-missing).\n")
        idx3 = build_index_semantic(d3)
        probs3 = scan_semantic(d3, idx3)
        assert not any("rule-return-block" in p for p in probs3), f"valid doc anchor flagged: {probs3}"
        assert any("rule-missing" in p for p in probs3), f"missing doc anchor not caught: {probs3}"

        # os-* modeled pattern: a skill at skills/<skill>/ references a two-level-up
        # docs anchor and a cross-skill [Rule: <Name>](...SKILL.md#rule-<kebab>) link.
        # The cross-skill #rule fragment must equal the kebab slug of the rule name —
        # an anchor pointing at a *different* rule in the same file is a mismatch
        # (both headings exist, so the bare anchor check cannot catch it).
        d4 = os.path.join(tmp, "os")
        for sub in ("cli-aaa", "os-aaa", "os-bbb", "docs"):
            os.makedirs(os.path.join(d4, sub))
        with open(os.path.join(d4, "docs", "controller-handoff.md"), "w", encoding="utf-8") as f:
            f.write("### Rule: Return Block\n\nBody.\n")
        with open(os.path.join(d4, "cli-aaa", "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: cli-aaa\n---\n\n### Rule: Ask\n\n### Rule: Detect\n\nBody.\n")
        with open(os.path.join(d4, "os-aaa", "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: os-aaa\n---\n\n"
                    "See [Rule: Ask](../cli-aaa/SKILL.md#rule-ask) "
                    "and [Return Block](../../docs/controller-handoff.md#rule-return-block).\n")
        with open(os.path.join(d4, "os-bbb", "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: os-bbb\n---\n\nSee [Rule: Ask](../cli-aaa/SKILL.md#rule-detect).\n")
        idx4 = build_index_semantic(d4)
        probs4 = scan_semantic(d4, idx4)
        assert not any("os-aaa" in p for p in probs4), f"os-* modeled valid refs flagged: {probs4}"
        assert any("os-bbb" in p and "anchor mismatch" in p for p in probs4), \
            f"cross-skill anchor-name mismatch not caught: {probs4}"
    finally:
        shutil.rmtree(tmp)


def parse_skills_args(argv):
    skills = []
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--skills":
            i += 1
            while i < len(argv) and not argv[i].startswith("--"):
                path, _, mode = argv[i].partition(":")
                if not mode:
                    raise SystemExit(f"--skills values must be <dir>:<mode> (got: {argv[i]})")
                if mode != "semantic":
                    raise SystemExit(f"unknown rule-reference mode: {mode}")
                skills.append((path, mode))
                i += 1
        else:
            raise SystemExit(f"unknown argument: {arg}")
    return skills or list(DEFAULT_SKILLS)


def main(argv=None):
    if argv is None:
        argv = sys.argv[1:]
    self_test()
    skills = parse_skills_args(argv)
    problems = []
    total_skills = 0
    for rel_path, mode in skills:
        skills_dir = os.path.normpath(os.path.join(REPO_ROOT, rel_path))
        if not os.path.isdir(skills_dir):
            problems.append(f"{rel_path}: not a directory")
            continue
        idx = build_index_semantic(skills_dir)
        problems += scan_semantic(skills_dir, idx)
        total_skills += len(idx)
    if problems:
        for p in problems:
            print("FAIL:", p)
        print("rule-reference: FAIL (%d)" % len(problems))
        return 1
    print("rule-reference: OK (self-test passed, %d skills clean across %d dirs)" % (total_skills, len(skills)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
