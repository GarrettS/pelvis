#!/bin/bash
# pre-commit-check.sh
# Catches mechanical code-guideline violations that are greppable.
# This is a tripwire, not a review. Structural rules (Active Object pattern,
# event delegation, async .catch, fetch status checks) require manual
# inspection per claude.md.
#
# Usage: bash bin/pre-commit-check.sh
# Exit code 0 = clean, 1 = violations found.

set -euo pipefail

FAIL=0
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

EXCLUDES="node_modules|\.git|pre-commit-check\.sh|code-guidelines\.md"

check() {
  local label="$1"
  local pattern="$2"
  local glob="$3"
  local hits

  hits=$(grep -rn --include="$glob" -E "$pattern" . 2>/dev/null \
    | grep -Ev "$EXCLUDES" \
    || true)

  if [ -n "$hits" ]; then
    echo -e "${RED}FAIL${NC}  $label"
    echo "$hits" | head -20
    echo ""
    FAIL=1
  else
    echo -e "${GREEN}PASS${NC}  $label"
  fi
}

echo "=== Pre-Commit Checks ==="
echo ""

# ---- HTML ----

check "Inline event handlers (onclick, onchange, etc.)" \
  '\bon(click|change|submit|keydown|keyup|keypress|focus|blur|load|mouse\w+)=' \
  '*.html'

check "javascript: pseudo-protocol" \
  'href\s*=\s*["'"'"']javascript:' \
  '*.html'

check "Inline <style> blocks" \
  '<style[ >]' \
  '*.html'

check "Self-closing slash on void elements" \
  '<(img|br|hr|input|meta|link|area|base|col|embed|source|track|wbr)\b[^>]*/>' \
  '*.html'

# ---- JS (scripts and inline <script> in HTML) ----

check "fetch() in .js  [verify: caught and handled, not re-thrown]" \
  '\bfetch\(' \
  '*.js'

check "fetch() in .html  [verify: caught and handled, not re-thrown]" \
  '\bfetch\(' \
  '*.html'

check "JSON.parse() in .js  [verify: caught and handled, not re-thrown]" \
  'JSON\.parse\(' \
  '*.js'

check "JSON.parse() in .html  [verify: caught and handled, not re-thrown]" \
  'JSON\.parse\(' \
  '*.html'

check "throw in .js  [verify: not in production code path]" \
  '\bthrow\b' \
  '*.js'

check "throw in .html  [verify: not in production code path]" \
  '\bthrow\b' \
  '*.html'

check "return null/undefined in .js  [verify: not a silent failure — user must see feedback]" \
  'return\s+(null|undefined)\s*;' \
  '*.js'

check "return null/undefined in .html  [verify: not a silent failure — user must see feedback]" \
  'return\s+(null|undefined)\s*;' \
  '*.html'

check "innerHTML in .js  [verify justified — inserting HTML tags]" \
  '\.innerHTML\s*=' \
  '*.js'

check "innerHTML in .html  [verify justified — inserting HTML tags]" \
  '\.innerHTML\s*=' \
  '*.html'

check "Banner/landmark comments in JS" \
  '[═─━]{3,}|[*]{4,}' \
  '*.js'

check "var declaration  [prefer const/let]" \
  '(^|[^a-zA-Z])\bvar\b\s' \
  '*.js'

# ---- File names (JS and CSS) ----
# This list is not exhaustive. Any module name that describes a role instead of
# a domain concept violates the Module Cohesion principle in code-guidelines.md.

JUNK_DRAWER=$(find . \( -name '*.js' -o -name '*.css' \) \
  | grep -Ev "$EXCLUDES" \
  | grep -iE '(util|helper|tool|misc|common|shared|lib|component)[s]?\.' \
  || true)

if [ -n "$JUNK_DRAWER" ]; then
  echo -e "${RED}FAIL${NC}  Junk-drawer file name  [name after domain concept, not role]"
  echo "$JUNK_DRAWER"
  echo ""
  FAIL=1
else
  echo -e "${GREEN}PASS${NC}  No junk-drawer file names (spot-check only — see Module Cohesion principle)"
fi

# ---- CSS ----

check "Hardcoded hex color  [only valid inside :root definitions]" \
  '#[0-9a-fA-F]{3,8}' \
  '*.css'

check "Fixed px font-size  [use clamp() custom property]" \
  'font-size:\s*[0-9]+px' \
  '*.css'

check "Fixed rem font-size  [use clamp() custom property]" \
  'font-size:\s*[0-9]+(\.[0-9]+)?rem' \
  '*.css'

check "CDN font import" \
  'fonts\.googleapis\.com|fonts\.gstatic\.com' \
  '*.css'

check "Banner/landmark comments in CSS" \
  '[═─━]{3,}|[*]{4,}' \
  '*.css'

# ---- Asset integrity ----

# Verify every sw.js precache entry exists as a file
if [ -f sw.js ]; then
  MISSING_PRECACHE=""
  while IFS= read -r url; do
    # Strip leading ./ to get relative path
    filepath="${url#./}"
    if [ ! -f "$filepath" ]; then
      MISSING_PRECACHE="${MISSING_PRECACHE}  ${url} — file not found\n"
    fi
  done < <(grep -oE "'\.\/[^']+'" sw.js | tr -d "'")

  if [ -n "$MISSING_PRECACHE" ]; then
    echo -e "${RED}FAIL${NC}  sw.js precache entries reference missing files"
    echo -e "$MISSING_PRECACHE"
    FAIL=1
  else
    echo -e "${GREEN}PASS${NC}  All sw.js precache entries exist"
  fi
fi

# Flag files in img/ and data/ not referenced by app code.
# Only app files count as valid references — dev tools (coord-picker, tools/)
# do not justify an asset's inclusion in the deployed app.
APP_EXCLUDES="$EXCLUDES|sw\.js|coord-picker|tools/"
ORPHAN_ASSETS=""
for asset in img/* data/*; do
  [ -f "$asset" ] || continue
  basename=$(basename "$asset")
  refs=$(grep -rl --include='*.html' --include='*.js' --include='*.json' \
    "$basename" . 2>/dev/null \
    | grep -Ev "$APP_EXCLUDES" \
    || true)
  if [ -z "$refs" ]; then
    ORPHAN_ASSETS="${ORPHAN_ASSETS}  ${asset} — not referenced by app code\n"
  fi
done

if [ -n "$ORPHAN_ASSETS" ]; then
  echo -e "${YELLOW}WARN${NC}  Unreferenced assets in img/ or data/  [verify: used by declared process or delete]"
  echo -e "$ORPHAN_ASSETS"
else
  echo -e "${GREEN}PASS${NC}  All img/ and data/ assets referenced"
fi

# ---- Summary ----

echo ""
if [ $FAIL -ne 0 ]; then
  echo -e "${YELLOW}Items flagged for review.${NC}"
  echo "Not all flags are violations — review each in context."
  echo "Structural rules require manual inspection (see claude.md)."
  exit 1
else
  echo -e "${GREEN}All mechanical checks passed.${NC}"
  echo "Manual review still required for structural rules."
  exit 0
fi
