#!/usr/bin/env bash
set -euo pipefail

KEYSTORE_PATH="${1:-apps/mobile/android/safelink-upload.jks}"
KEY_ALIAS="${2:-safelink-upload}"

mkdir -p "$(dirname "$KEYSTORE_PATH")"

keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000

echo "Created upload keystore: $KEYSTORE_PATH"
echo "Alias: $KEY_ALIAS"
echo "Keep this file and its passwords outside git."
