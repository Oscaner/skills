#!/usr/bin/env python3
"""Rule-reference integrity guard for override SKILL.md files (issue #52 Guard 2).

Every numeric `Rule N` reference (e.g. `Rule 0a`, `Rule 5b`) in an override
skill's body or frontmatter must resolve to:
  1. a linked skill file — markdown link whose text contains `Rule N`, or a link
     ending right before the token. Sibling override (`skills/*`): the target must
     have that heading. Non-sibling/upstream target: OK (author pointed elsewhere).
  2. a scoped prefix — `spor-SDD Rule N`, `SDD Rule N`, or `spor-<name> Rule N`;
     the named sibling must have that heading.
  3. a same-file heading.
  4. a per-file allowlist entry (cross-file entries validated against target).
Otherwise the reference is dangling and the guard FAILs.

Exits 0 on clean scan + self-test; 1 otherwise.
"""
import os
import re
import shutil
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SKILLS = os.path.join(ROOT, "skills")

HEAD = re.compile(r'^(?:#{3,4} |\*\*)Rule ([0-9]+[a-z]?)\b')
REF = re.compile(r'\bRule ([0-9]+[a-z]?)\b')
LINK = re.compile(r'\[[^\]]*\]\(([^)]*SKILL\.md)\)')
LINK_HAS_REF = re.compile(r'\[[^\]]*Rule [0-9]+[a-z]?[^\]]*\]\(([^)]*SKILL\.md)\)')
SCOPED = re.compile(r'\b(spor-[a-zA-Z-]+|SDD) Rule ([0-9]+[a-z]?)\b')
COMMENT = re.compile(r'^\s*<!--')

SPOR_SDD = "spor-subagent-driven-development"
SCOPED_TARGET = {"SDD": SPOR_SDD, "spor-SDD": SPOR_SDD}

# per-file allowlist: bare rule id -> ("cross-file", target_skill) | ("upstream", None)
ALLOWLIST = {
    "spor-finishing-a-development-branch": {"4": ("upstream", None)},
    "spor-executing-plans": {"5b": ("cross-file", "spor-sdd-p0-fallback")},
    "spor-sdd-p0-fallback": {"0": ("cross-file", SPOR_SDD)},
}


def build_index(skills_dir):
    idx = {}
    for name in os.listdir(skills_dir):
        path = os.path.join(skills_dir, name, "SKILL.md")
        if not os.path.isfile(path):
            continue
        ids = set()
        for line in open(path, encoding="utf-8"):
            m = HEAD.match(line)
            if m:
                ids.add(m.group(1))
        idx[name] = ids
    return idx


def resolve_link(url, cur_dir, skills_dir):
    target = os.path.normpath(os.path.join(cur_dir, url))
    if os.path.commonpath([target, skills_dir]) == os.path.normpath(skills_dir) and os.path.isfile(target):
        return os.path.basename(os.path.dirname(target)), True
    return None, False


def linked_target(line, m, cur_dir, skills_dir):
    """If Rule N is tied to a SKILL.md link on this line, return (target_name, is_sibling)."""
    for lm in LINK_HAS_REF.finditer(line):          # ref inside link text: [.. Rule N](..SKILL.md)
        if lm.start() <= m.start() <= lm.end():
            return resolve_link(lm.group(1), cur_dir, skills_dir)
    for lm in LINK.finditer(line):                   # link ends right before the token
        if lm.end() < m.start() and m.start() - lm.end() < 80:
            return resolve_link(lm.group(1), cur_dir, skills_dir)
    return None


def scan(skills_dir, idx):
    problems = []
    for name in sorted(os.listdir(skills_dir)):
        path = os.path.join(skills_dir, name, "SKILL.md")
        if not os.path.isfile(path):
            continue
        cur_dir = os.path.dirname(path)
        for lineno, line in enumerate(open(path, encoding="utf-8").read().splitlines(), 1):
            if HEAD.match(line) or COMMENT.match(line):
                continue
            for m in REF.finditer(line):
                rid = m.group(1)
                # 1. linked
                lt = linked_target(line, m, cur_dir, skills_dir)
                if lt is not None:
                    tname, is_sibling = lt
                    if is_sibling and rid not in idx[tname]:
                        problems.append(f"{name}:{lineno}: Rule {rid} -> {tname} lacks heading")
                    continue
                # 2. scoped prefix
                sc = next((s for s in SCOPED.finditer(line) if s.start() <= m.start() < s.end()), None)
                if sc is not None:
                    tname = SCOPED_TARGET.get(sc.group(1), sc.group(1))
                    if rid not in idx[tname]:
                        problems.append(f"{name}:{lineno}: Rule {rid} -> scoped {tname} lacks heading")
                    continue
                # 3. same-file heading
                if rid in idx[name]:
                    continue
                # 4. allowlist
                entry = ALLOWLIST.get(name, {}).get(rid)
                if entry is not None:
                    kind, tname = entry
                    if kind == "cross-file" and rid not in idx[tname]:
                        problems.append(f"{name}:{lineno}: Rule {rid} -> allowlist {tname} lacks heading")
                    continue
                # 5. dangling
                problems.append(f"{name}:{lineno}: Rule {rid} dangling (no heading, no allowlist)")
    return problems


def self_test():
    tmp = tempfile.mkdtemp()
    try:
        d = os.path.join(tmp, "skills")
        os.makedirs(os.path.join(d, "spor-aaa"))
        with open(os.path.join(d, "spor-aaa", "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: spor-aaa\n---\n\n### Rule 1 — exists\n\nBody references Rule 2 which has no heading.\n")
        idx = build_index(d)
        probs = scan(d, idx)
        assert any("Rule 2" in p for p in probs), f"dangling Rule 2 not caught: {probs}"
    finally:
        shutil.rmtree(tmp)


def main():
    self_test()
    idx = build_index(SKILLS)
    problems = scan(SKILLS, idx)
    if problems:
        for p in problems:
            print("FAIL:", p)
        print("rule-reference: FAIL (%d)" % len(problems))
        return 1
    print("rule-reference: OK (self-test passed, %d skills clean)" % len(idx))
    return 0


if __name__ == "__main__":
    sys.exit(main())
