#!/usr/bin/env bash
# Collect every fact a release draft needs. Read-only — safe to run any time.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1
git fetch -q origin 2>/dev/null
git fetch -q --tags origin 2>/dev/null

# Highest semver tag. Tags carry a `v` prefix from v3.1.0 onward; older ones
# (3.0.0, 2.8.0) do not, and `v.2.7.2` is a typo'd stray. Match both real forms,
# exclude the stray.
LAST_TAG=$(git tag --list --sort=-v:refname | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
LAST_VERSION=${LAST_TAG#v}
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
PKG_VERSION=$(grep -m1 '"version"' package.json | sed -E 's/.*"version": *"([^"]+)".*/\1/')

echo "last_tag:        $LAST_TAG"
echo "package.json:    $PKG_VERSION"
echo "repo:            $REPO"
echo "compare_link:    https://github.com/$REPO/compare/$LAST_TAG...vNEW_VERSION"
echo "tag convention:  v-prefixed tag (vX.Y.Z), bare title (X.Y.Z)"
echo

if [ "$LAST_VERSION" != "$PKG_VERSION" ]; then
  echo "!! package.json ($PKG_VERSION) != last tag ($LAST_TAG)."
  echo "!! A version bump may already be committed but untagged. Check before bumping again."
  echo
fi

echo "=== commits since $LAST_TAG ==="
COMMITS=$(git log --format='%h %s' "$LAST_TAG"..origin/main)
if [ -z "$COMMITS" ]; then
  echo "(none — origin/main is already at $LAST_TAG)"
  echo
  echo "Nothing has landed since the last release. There is nothing to release;"
  echo "say so rather than inventing a bump."
  exit 0
fi
echo "$COMMITS"
echo
echo "(Ignore 'Built new version' — that is push.yml committing the bundle.)"
echo "(A commit whose whole message is a bare version number is a release bump.)"
echo

# PR numbers, oldest first, so the notes read chronologically.
# awk, not `tac` — that is GNU-only and absent on macOS.
PRS=$(git log --format='%s' "$LAST_TAG"..origin/main \
      | grep -oE '\(#[0-9]+\)$' | tr -d '(#)' \
      | awk '{a[NR]=$0} END{for(i=NR;i>0;i--) print a[i]}')

if [ -z "$PRS" ]; then
  echo "=== no PR-numbered commits in range ==="
  echo "Commits were pushed straight to main. Write the notes from the subjects above."
  exit 0
fi

echo "=== PRs in this release ==="
AUTHORS=""
for pr in $PRS; do
  # shellcheck disable=SC2016
  gh pr view "$pr" --json number,title,author,url,labels --jq \
    '"#\(.number)\t\(.author.login)\t\(.title)\n        \(.url)\n        labels: \([.labels[].name] | join(", "))"'
  AUTHORS="$AUTHORS $(gh pr view "$pr" --json author --jq .author.login)"
done
echo

# New contributor = their lowest-numbered merged PR is one of this release's.
echo "=== new contributors ==="
FOUND=0
for author in $(echo "$AUTHORS" | tr ' ' '\n' | sort -u | grep -v '^$'); do
  first=$(gh pr list --state merged --author "$author" --limit 200 \
          --json number --jq 'min_by(.number).number' 2>/dev/null)
  if echo "$PRS" | grep -qx "$first"; then
    echo "@$author (first contribution: #$first)"
    FOUND=1
  fi
done
[ "$FOUND" -eq 0 ] && echo "(none)"
echo
echo "(GitHub's --generate-notes writes its own New Contributors section; this is"
echo " here so you can mention a notable first contribution in the prose.)"
echo

echo "=== tested-against versions ==="
echo "spicetify:       $(spicetify -v 2>/dev/null || echo 'CLI not found')"
SPOTIFY=$(curl -s -m 2 http://127.0.0.1:8088/json/version 2>/dev/null | grep -o 'Spotify/[0-9.]*' | cut -d/ -f2)
if [ -n "$SPOTIFY" ]; then
  echo "spotify:         $SPOTIFY (from the running client)"
else
  echo "spotify:         not running / debug port closed — ask the user"
fi
echo
echo "Notes cite the Spotify version only when a change is tied to one"
echo "(\"Spotify 1.2.94 renamed…\"). There is no standing tested-against line."
