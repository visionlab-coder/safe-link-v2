#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$MOBILE_DIR/../.." && pwd)"
BASE_SHA="${IOS_ANDROID_BASE_SHA:-c228ac05cddbe70fc4d6cab0f82b8fd702bd76e4}"

fail() {
  echo "[ios-isolation] ERROR: $*" >&2
  exit 1
}

git -C "$REPO_ROOT" rev-parse --verify "$BASE_SHA^{commit}" >/dev/null ||
  fail "baseline commit not available: $BASE_SHA"

ANDROID_CHANGES="$(git -C "$REPO_ROOT" status --porcelain -- apps/mobile/android)"
[[ -z "$ANDROID_CHANGES" ]] || {
  echo "$ANDROID_CHANGES" >&2
  fail "Android protected paths changed"
}

DIFF_ANDROID="$(git -C "$REPO_ROOT" diff --name-only "$BASE_SHA"...HEAD -- apps/mobile/android)"
[[ -z "$DIFF_ANDROID" ]] || {
  echo "$DIFF_ANDROID" >&2
  fail "branch contains Android path changes"
}

git -C "$REPO_ROOT" diff --check

echo "[ios-isolation] PASS"
echo "[ios-isolation] branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
echo "[ios-isolation] head=$(git -C "$REPO_ROOT" rev-parse HEAD)"
echo "[ios-isolation] android_changes=0"
