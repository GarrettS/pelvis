#!/usr/bin/env bash
# Warn once daily if .doctrine is behind canonical code-guidelines.

STAMP_FILE=".git/.doctrine-last-check"
NOW="$(date +%s)"

if [ -f "$STAMP_FILE" ]; then
  LAST="$(cat "$STAMP_FILE")"
  AGE=$((NOW - LAST))
  if [ "$AGE" -lt 86400 ]; then
    exit 0
  fi
fi

if [ ! -d ".doctrine/.git" ] && [ ! -f ".gitmodules" ]; then
  exit 0
fi

git -C .doctrine fetch origin main --quiet 2>/dev/null || exit 0

LOCAL="$(git -C .doctrine rev-parse HEAD 2>/dev/null)" || exit 0
REMOTE="$(git -C .doctrine rev-parse origin/main 2>/dev/null)" || exit 0

echo "$NOW" > "$STAMP_FILE"

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "Warning: .doctrine is behind canonical code-guidelines. Consider updating the submodule."
fi

exit 0
