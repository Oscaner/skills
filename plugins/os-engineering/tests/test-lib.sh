#!/usr/bin/env bash
# test-lib.sh — shared helpers for os-engineering engine tests.
# Caller must set ROOT before sourcing. Do not run standalone.

# harness_free_path — drop every PATH dir that holds a registry CLI binary so a
# real installed CLI (claude, cursor-agent, droid, pi, codex, ...) cannot leak
# through a mock-PATH scenario. Requires jq (registry is JSON); the caller
# guards jq presence before invoking.
harness_free_path() {
  local reg="$ROOT/bin/harness-registry.json"
  local clis result="" dir b skip
  clis="$(jq -r '.[].cli' "$reg" | tr '\n' ' ')"
  while IFS= read -r dir; do
    [[ -n "$dir" ]] || continue
    skip=0
    for b in $clis; do
      if [[ -x "$dir/$b" ]]; then skip=1; break; fi
    done
    if (( skip == 0 )); then
      result="${result:+$result:}$dir"
    fi
  done < <(printf '%s' "$PATH" | tr ':' '\n')
  printf '%s' "$result"
}
