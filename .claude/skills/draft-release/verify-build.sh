#!/usr/bin/env bash
# Verify the committed hidePodcasts.js on main -- what users actually install --
# was built from main's current source.
#
# There is no dist branch here despite push.yml's name. The bundle is a tracked
# file at the repo root, and README tells users to copy that file. So "is the
# release current" means "does the committed artifact match a build of main".
#
# Builds out-of-tree so the tracked artifact is never touched: `pnpm build:local`
# writes to the repo root and would dirty it.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1
git fetch -q origin 2>/dev/null

STATUS=0

echo "=== push.yml run for current main ==="
HEAD_SHA=$(git rev-parse origin/main)
gh run list --workflow=push.yml --branch main --limit 5 \
  --json headSha,conclusion,displayTitle,url \
  --jq ".[] | select(.headSha == \"$HEAD_SHA\") | \"\(.conclusion)\t\(.displayTitle)\n\(.url)\"" \
  | head -3
RUN_OK=$(gh run list --workflow=push.yml --branch main --limit 5 \
         --json headSha,conclusion --jq \
         "[.[] | select(.headSha == \"$HEAD_SHA\")] | first | .conclusion")
if [ "$RUN_OK" != "success" ]; then
  echo "!! no successful push.yml run for $(git rev-parse --short origin/main) (got: ${RUN_OK:-none})"
  echo "!! the committed bundle may be stale. Do not tag until this is sorted."
  STATUS=1
fi
echo
echo "Note: a bump commit normally produces NO 'Built new version' commit."
echo "The version is not embedded in the bundle, so the output is unchanged and"
echo "git-auto-commit has nothing to commit. That is not a failed deploy."
echo

echo "=== rebuilding out-of-tree with CI's build (spicetify-creator --minify) ==="
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
if ! pnpm exec spicetify-creator --out="$OUT" --minify >/dev/null 2>&1; then
  echo "!! build failed — run 'pnpm build:local' directly to see why"
  exit 1
fi

echo "=== local build vs the artifact committed on origin/main ==="
REF="$OUT/committed.js"
git show origin/main:hidePodcasts.js > "$REF" 2>/dev/null || {
  echo "!! could not read hidePodcasts.js from origin/main"
  exit 1
}

# The build is byte-reproducible, so a match is exact.
if diff -q "$OUT/hidePodcasts.js" "$REF" >/dev/null 2>&1; then
  echo "identical ($(wc -c < "$REF" | tr -d ' ') bytes)"
  echo "The committed bundle matches a build of main."
else
  echo "!! the committed bundle does NOT match a local build of main"
  echo "   committed: $(wc -c < "$REF" | tr -d ' ') bytes"
  echo "   rebuilt:   $(wc -c < "$OUT/hidePodcasts.js" | tr -d ' ') bytes"
  echo
  echo "!! Check the push.yml run above before tagging."
  STATUS=1
fi

# Also flag a dirty working tree, which makes the comparison mean something else.
if ! git diff --quiet HEAD -- src hidePodcasts.js; then
  echo
  echo "!! working tree has uncommitted changes under src/ or hidePodcasts.js —"
  echo "!! the rebuild above used those, not origin/main's source."
  STATUS=1
fi

# Single verdict at the end, so a passing content check cannot read as an
# all-clear while an earlier check has already failed.
echo
if [ "$STATUS" -eq 0 ]; then
  echo "PASS — safe to tag."
else
  echo "FAIL — do not tag until the '!!' lines above are resolved."
fi

exit $STATUS
