#!/usr/bin/env bash
# sdd-gate-test-lib.sh — shared fixture isolation + session namespacing for the
# SDD gate tests. Sourced by the three gate test scripts (override-claude,
# override-cursor, allow-deny smoke); do not run standalone.
#
# Isolation model (spec §设计 测试 fixture 隔离): every scenario is copied from
# tests/fixtures/sdd-gate/<scene>/ into a per-run temp dir, the copy is git-init'ed,
# and briefs carrying the `<SHA>` placeholder get the copy's own short-SHA injected.
# Tracked fixture files are never modified (P4 anti-pattern).
#
# Session keys are namespaced per-run (smk-<base>-$$) so overlapping test
# invocations — and a live SDD session on the same machine — never share or
# clobber each other's pending-sdd JSON in the gate's global pending root.

# Caller must set ROOT before sourcing. Derive the plugin tree from $ROOT.
TESTS_DIR="$(cd "$ROOT/tests" && pwd)"
FIXTURES="$TESTS_DIR/fixtures/sdd-gate"
GATE_ROOT="${SDD_PENDING_ROOT:-${TMPDIR:-/tmp}/oscaner-superpowers-overrides/pending-sdd}"

SESSION_TAG="${SDD_GATE_TEST_TAG:-$$}"
TMPROOT="$(mktemp -d)"

# cleanup — remove this run's own pending-sdd JSON files. Scoped to the session
# keys this run created; never a global find -delete (that would clobber a
# concurrent or live session's gate, fail-open semantics violation).
sdd_gate_test_cleanup() {
  local key
  rm -rf "$TMPROOT"
  for key in "${SESSION_KEYS[@]:-}"; do
    rm -f "$GATE_ROOT/$key.json"
  done
}
trap 'sdd_gate_test_cleanup' EXIT

# session_key <base> — per-run namespaced key: smk-<base>-$$. Unique to this
# process, so overlapping runs never write the same pending file.
session_key() {
  printf '%s-%s-%s\n' "smk" "$1" "$SESSION_TAG"
}

# setup_scenario <scenario> <dest-name> [<session-key>] — copy a fixture scene
# root into $TMPROOT/<dest-name>, git-init the copy, inject the copy's own short
# SHA into any `<SHA>` brief placeholder, and export SDD_GATE_FIXTURES_ROOT so
# the gate scans the copy instead of the real tree. With <session-key>, creates
# the namespaced pending file via sdd-session-activate minimal mode.
#
# Result path is left in $SCEN_DEST. Do NOT call this inside $() — the export
# and SESSION_KEYS bookkeeping would be lost to the subshell.
setup_scenario() {
  local scen="$1" name="$2" key="${3:-}" sha b
  local dest="$TMPROOT/$name"
  cp -R "$FIXTURES/$scen/." "$dest/"
  git -C "$dest" init -q
  git -C "$dest" add -A
  git -C "$dest" -c user.name="sdd-gate-test" -c user.email="sdd-gate-test@example.com" \
    commit --allow-empty -qm "fixture"
  sha="$(git -C "$dest" rev-parse --short HEAD)"
  while IFS= read -r b; do
    if grep -q 'TASK_BASE: <SHA>' "$b"; then
      printf 'TASK_BASE: %s\n' "$sha" > "$b"
    fi
  done < <(find "$dest" -name 'task-*-brief.md')
  export SDD_GATE_FIXTURES_ROOT="$dest/sdd"
  SCEN_DEST="$dest"
  if [[ -n "$key" ]]; then
    "$ACT" minimal "$key" "$dest"
    SESSION_KEYS+=("$key")
  fi
}
