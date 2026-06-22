#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  echo "Usage: ./scripts/bootstrap-ios-macos.sh --check|--apply"
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$MOBILE_DIR/../.." && pwd)"
PROVISIONAL_BASE="${IOS_ANDROID_BASE_SHA:-c228ac05cddbe70fc4d6cab0f82b8fd702bd76e4}"
RESULT_DIR="${IOS_RESULT_DIR:-$REPO_ROOT/docs/generated/ios-bootstrap-results}"
DERIVED_DATA="$REPO_ROOT/.tmp/ios-derived-data"

fail() {
  echo "[ios-bootstrap] ERROR: $*" >&2
  exit 1
}

step() {
  echo
  echo "[ios-bootstrap] $*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

assert_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || fail "iOS bootstrap requires macOS"
}

assert_node_version() {
  local major
  major="$(node -p "Number(process.versions.node.split('.')[0])")"
  [[ "$major" -ge 22 ]] || fail "Node.js 22+ required; found $(node --version)"
}

assert_xcode_version() {
  local version major
  version="$(xcodebuild -version | awk 'NR==1 {print $2}')"
  major="${version%%.*}"
  [[ "$major" =~ ^[0-9]+$ ]] || fail "unable to parse Xcode version: $version"
  [[ "$major" -ge 26 ]] || fail "Xcode 26+ required; found $version"
}

assert_clean_android_paths() {
  local changes
  changes="$(git -C "$REPO_ROOT" status --porcelain -- apps/mobile/android)"
  [[ -z "$changes" ]] || {
    echo "$changes" >&2
    fail "Android protected paths are not clean"
  }
}

reset_derived_data() {
  local expected="$REPO_ROOT/.tmp/ios-derived-data"
  [[ "$DERIVED_DATA" == "$expected" ]] ||
    fail "refusing to remove unexpected DerivedData path: $DERIVED_DATA"
  [[ "$DERIVED_DATA" != "/" && "$DERIVED_DATA" != "$HOME" ]] ||
    fail "unsafe DerivedData path: $DERIVED_DATA"
  rm -rf "$DERIVED_DATA"
  mkdir -p "$DERIVED_DATA"
}

assert_capacitor_alignment() {
  node - "$MOBILE_DIR/package.json" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
const versions = {
  core: pkg.dependencies?.["@capacitor/core"],
  cli: pkg.devDependencies?.["@capacitor/cli"],
  android: pkg.devDependencies?.["@capacitor/android"],
  ios: pkg.devDependencies?.["@capacitor/ios"],
};
for (const key of ["core", "cli", "android"]) {
  if (!versions[key]) throw new Error(`missing @capacitor/${key} dependency`);
}
const major = (value) => Number(String(value).match(/\d+/)?.[0]);
const expected = major(versions.core);
for (const key of ["cli", "android"]) {
  if (major(versions[key]) !== expected) {
    throw new Error(`Capacitor major mismatch: core=${versions.core}, ${key}=${versions[key]}`);
  }
}
if (versions.ios && major(versions.ios) !== expected) {
  throw new Error(`Capacitor major mismatch: core=${versions.core}, ios=${versions.ios}`);
}
console.log(JSON.stringify({ expectedMajor: expected, versions }, null, 2));
NODE
}

step "preflight"
assert_macos
require_command git
require_command node
require_command npm
require_command npx
require_command xcodebuild
require_command xcode-select
require_command xcrun
assert_node_version
xcode-select -p >/dev/null
assert_xcode_version
git -C "$REPO_ROOT" rev-parse --verify "$PROVISIONAL_BASE^{commit}" >/dev/null ||
  fail "baseline commit not available: $PROVISIONAL_BASE"
assert_clean_android_paths
assert_capacitor_alignment

echo "[ios-bootstrap] repo=$REPO_ROOT"
echo "[ios-bootstrap] branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
echo "[ios-bootstrap] head=$(git -C "$REPO_ROOT" rev-parse HEAD)"
echo "[ios-bootstrap] node=$(node --version)"
echo "[ios-bootstrap] npm=$(npm --version)"
xcodebuild -version

if [[ "$MODE" == "--check" ]]; then
  step "check complete; no files changed"
  exit 0
fi

step "install Capacitor iOS using the Android version range"
IOS_SPEC="$(node -p "require('$MOBILE_DIR/package.json').devDependencies['@capacitor/android']")"
(
  cd "$MOBILE_DIR"
  npm install --save-dev "@capacitor/ios@$IOS_SPEC"
)

step "build web assets"
(
  cd "$MOBILE_DIR"
  npm run build
)

step "create or synchronize the Swift Package Manager iOS project"
(
  cd "$MOBILE_DIR"
  if [[ ! -d ios ]]; then
    npx cap add ios
  fi
  npx cap sync ios
)

step "unsigned iOS Simulator build"
reset_derived_data
mkdir -p "$RESULT_DIR"
BUILD_LOG="$RESULT_DIR/xcodebuild-simulator.log"
set -o pipefail
xcodebuild \
  -project "$MOBILE_DIR/ios/App/App.xcodeproj" \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  build | tee "$BUILD_LOG"

perl -pi -e 's/[ \t]+$//' "$BUILD_LOG"

step "postflight protected-path verification"
assert_clean_android_paths
git -C "$REPO_ROOT" status --short

cat >"$RESULT_DIR/environment.txt" <<EOF
completed_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)
head=$(git -C "$REPO_ROOT" rev-parse HEAD)
provisional_android_base=$PROVISIONAL_BASE
node=$(node --version)
npm=$(npm --version)
xcode=$(xcodebuild -version | tr '\n' ' ')
sdk=$(xcrun --sdk iphonesimulator --show-sdk-version)
EOF

echo "[ios-bootstrap] PASS"
echo "[ios-bootstrap] build log: $BUILD_LOG"
