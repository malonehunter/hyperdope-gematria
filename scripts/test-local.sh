#!/usr/bin/env bash
# Run from any directory. No installs, live SDKs, credentials or deploy steps.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
case "${1:-full}" in
  full)
    shopt -s nullglob
    tests=(tests/*.test.js)
    if (( ${#tests[@]} == 0 )); then
      printf 'No tests/*.test.js files found\n' >&2
      exit 1
    fi
    ;;
  safety)
    tests=(tests/refresh-safety.test.js tests/cloud-restore-safety.test.js tests/history-sync-reconciliation.test.js)
    ;;
  *) printf 'Usage: bash scripts/test-local.sh [full|safety]\n' >&2; exit 2 ;;
esac
# Node may ignore an individually missing filename if another test matches.
# Fail before discovery so a partial required suite cannot appear green.
for test_file in "${tests[@]}"; do
  if [[ ! -f "$test_file" || ! -r "$test_file" ]]; then
    printf 'Required test file missing or unreadable: %s\n' "$test_file" >&2
    exit 1
  fi
done
# exec preserves Node's nonzero result, including assertion and load failures.
exec node --test "${tests[@]}"
