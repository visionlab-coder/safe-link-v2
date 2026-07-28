#!/usr/bin/env bash
set -euo pipefail

umask 077

BACKUP_DIR=/home/ubuntu/safelink-v3/backups
CONTAINER=safelink-v3-postgres
DATABASE=safelink
DATABASE_USER=safelink
RETENTION_DAYS=14
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL="$BACKUP_DIR/safelink-$STAMP.dump"
TEMP="$FINAL.partial"

install -d -o ubuntu -g ubuntu -m 0700 "$BACKUP_DIR"
trap 'rm -f "$TEMP"' EXIT

docker exec "$CONTAINER" pg_dump \
  -U "$DATABASE_USER" \
  -d "$DATABASE" \
  -Fc > "$TEMP"

test -s "$TEMP"
docker exec -i "$CONTAINER" pg_restore --list < "$TEMP" >/dev/null
mv "$TEMP" "$FINAL"
chmod 0600 "$FINAL"
sha256sum "$FINAL" > "$FINAL.sha256"
chmod 0600 "$FINAL.sha256"

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'safelink-*.dump' -o -name 'safelink-*.dump.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

printf 'backup_ok file=%s bytes=%s sha256=%s\n' \
  "$FINAL" \
  "$(stat -c %s "$FINAL")" \
  "$(cut -d' ' -f1 "$FINAL.sha256")"
