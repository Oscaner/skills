#!/usr/bin/env python3
"""Rule-reference integrity guard for skill SKILL.md files (issue #52 Guard 2),
dual-mode (numeric + semantic).

Two scanning modes, selected per skills directory via `--skills <dir>:<mode>`:

  numeric  (superpowers-overrides): every numeric `Rule N` reference (e.g.
           `Rule 0a`, `Rule 5b`) must resolve to a linked sibling heading, a
           scoped prefix (`spor-SDD Rule N`), a same-file heading, or an
           allowlist entry. This is the legacy transition-period mode.
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
    --skills os-engineering/skills:semantic superpowers-overrides/skills:numeric

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
    ("superpowers-overrides/skills", "numeric"),
]

# --- numeric mode (overrides) ---
HEAD_NUM = re.compile(r'^(?:#{3,4} |\*\*)Rule ([0-9]+[a-z]?)\b')
REF_NUM = re.compile(r'\bRule ([0-9]+[a-z]?)\b')
LINK = re.compile(r'\[[^\]]*\]\(([^)]*SKILL\.md)\)')
LINK_HAS_REF_NUM = re.compile(r'\[[^\]]*Rule [0-9]+[a-z]?[^\]]*\]\(([^)]*SKILL\.md)\)')
SCOPED_NUM = re.compile(r'\b(spor-[a-zA-Z-]+|SDD) Rule ([0-9]+[a-z]?)\b')
COMMENT = re.compile(r'^\s*<!--')

SPOR_SDD = "spor-subagent-driven-development"
SCOPED_TARGET = {"SDD": SPOR_SDD, "spor-SDD": SPOR_SDD}

# per-file allowlist: bare rule id -> ("cross-file", target_skill) | ("upstream", None)
ALLOWLIST_NUM = {
    # finishing-branch:27 references `executing-plans Rule 4` (pre-existing; neither override defines Rule 4) — external, unvalidated
    "spor-finishing-a-development-branch": {"4": ("upstream", None)},
    "spor-executing-plans": {"5b": ("cross-file", "spor-sdd-p0-fallback")},
    "spor-sdd-p0-fallback": {"0": ("cross-file", SPOR_SDD)},
}

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


def build_index_numeric(skills_dir):
    idx = {}
    for name in os.listdir(skills_dir):
        path = os.path.join(skills_dir, name, "SKILL.md")
        if not os.path.isfile(path):
            continue
        ids = set()
        for line in open(path, encoding="utf-8"):
            m = HEAD_NUM.match(line)
            if m:
                ids.add(m.group(1))
        idx[name] = ids
    return idx


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


def linked_target_numeric(line, m, cur_dir, skills_dir):
    """If Rule N is tied to a SKILL.md link on this line, return (target_name, is_sibling)."""
    for lm in LINK_HAS_REF_NUM.finditer(line):          # ref inside link text: [.. Rule N](..SKILL.md)
        if lm.start() <= m.start() <= lm.end():
            return resolve_link(lm.group(1), cur_dir, skills_dir)
    for lm in LINK.finditer(line):                      # link ends right before the token
        if lm.end() < m.start() and m.start() - lm.end() < 80:
            return resolve_link(lm.group(1), cur_dir, skills_dir)
    return None


def scan_numeric(skills_dir, idx):
    problems = []
    for name in sorted(os.listdir(skills_dir)):
        path = os.path.join(skills_dir, name, "SKILL.md")
        if not os.path.isfile(path):
            continue
        cur_dir = os.path.dirname(path)
        for lineno, line in enumerate(open(path, encoding="utf-8").read().splitlines(), 1):
            if HEAD_NUM.match(line) or COMMENT.match(line):
                continue
            for m in REF_NUM.finditer(line):
                rid = m.group(1)
                # 1. linked
                lt = linked_target_numeric(line, m, cur_dir, skills_dir)
                if lt is not None:
                    tname, is_sibling = lt
                    if is_sibling and rid not in idx[tname]:
                        problems.append(f"{name}:{lineno}: Rule {rid} -> {tname} lacks heading")
                    continue
                # 2. scoped prefix
                sc = next((s for s in SCOPED_NUM.finditer(line) if s.start() <= m.start() < s.end()), None)
                if sc is not None:
                    tname = SCOPED_TARGET.get(sc.group(1), sc.group(1))
                    if tname not in idx:
                        problems.append(f"{name}:{lineno}: Rule {rid} -> scoped {tname} is not a known skill")
                    elif rid not in idx[tname]:
                        problems.append(f"{name}:{lineno}: Rule {rid} -> scoped {tname} lacks heading")
                    continue
                # 3. same-file heading
                if rid in idx[name]:
                    continue
                # 4. allowlist
                entry = ALLOWLIST_NUM.get(name, {}).get(rid)
                if entry is not None:
                    kind, tname = entry
                    if kind == "cross-file" and rid not in idx[tname]:
                        problems.append(f"{name}:{lineno}: Rule {rid} -> allowlist {tname} lacks heading")
                    continue
                # 5. dangling
                problems.append(f"{name}:{lineno}: Rule {rid} dangling (no heading, no allowlist)")
    return problems


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
                tname, is_sibling = resolve_link(lm.group(2), cur_dir, skills_dir)
                if is_sibling and ref_name not in idx[tname]:
                    problems.append(f"{name}:{lineno}: Rule: {ref_name} -> {tname} lacks heading")
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
        # numeric: dangling Rule 2 caught; valid Rule 1 not flagged
        d = os.path.join(tmp, "skills")
        os.makedirs(os.path.join(d, "spor-aaa"))
        with open(os.path.join(d, "spor-aaa", "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: spor-aaa\n---\n\n### Rule 1 — exists\n\nBody references Rule 2 which has no heading.\n")
        idx = build_index_numeric(d)
        probs = scan_numeric(d, idx)
        assert any("Rule 2" in p for p in probs), f"numeric dangling Rule 2 not caught: {probs}"
        assert not any("Rule 1" in p for p in probs), f"numeric valid Rule 1 flagged: {probs}"

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
                if mode not in ("numeric", "semantic"):
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
        if mode == "numeric":
            idx = build_index_numeric(skills_dir)
            problems += scan_numeric(skills_dir, idx)
        else:
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
