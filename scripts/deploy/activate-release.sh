#!/usr/bin/env bash
# Invoked by GitHub Actions through a narrowly scoped sudo rule.
set -euo pipefail

if [ "$#" -ne 1 ] || ! [[ "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Expected one 40-character git SHA" >&2
  exit 64
fi

APP_ROOT=/home/ubuntu/safelink-v3
RELEASE_ID="$1"
ARCHIVE="$APP_ROOT/incoming/safe-link-v3-${RELEASE_ID}.tgz"
RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"
STAGING_DIR="$APP_ROOT/releases/.${RELEASE_ID}.staging"

test -f "$ARCHIVE"
rm -rf "$STAGING_DIR"
install -d -o ubuntu -g ubuntu -m 0755 "$STAGING_DIR"
tar -xzf "$ARCHIVE" -C "$STAGING_DIR"
test -f "$STAGING_DIR/frontend/server.js"
test -f "$STAGING_DIR/backend/safe-link-v3-backend.jar"
chown -R ubuntu:ubuntu "$STAGING_DIR"
mv "$STAGING_DIR" "$RELEASE_DIR"
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current.next"
mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"
rm -f "$ARCHIVE"

systemctl restart safelink-v3-backend.service
systemctl restart safelink-v3-frontend.service
systemctl is-active --quiet safelink-v3-backend.service
systemctl is-active --quiet safelink-v3-frontend.service

# Retain the current release plus the four most recent rollback candidates.
find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -name '[0-9a-f]*' -printf '%T@ %p\n' \
  | sort -nr | tail -n +6 | cut -d' ' -f2- | xargs -r rm -rf
