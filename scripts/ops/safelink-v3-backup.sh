#!/usr/bin/env bash
set -euo pipefail

umask 077

BACKUP_DIR=/home/ubuntu/safelink-v3/backups
CONTAINER=safelink-v3-postgres
MINIO_CONTAINER=safelink-v3-minio
MINIO_BUCKET=safe-link-v3
DATABASE=safelink
DATABASE_USER=safelink
RETENTION_DAYS=14
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL="$BACKUP_DIR/safelink-$STAMP.dump"
TEMP="$FINAL.partial"
OBJECT_FINAL="$BACKUP_DIR/safelink-$STAMP-objects.tar.gz"
OBJECT_TEMP="$OBJECT_FINAL.partial"
OBJECT_STAGE="$BACKUP_DIR/.objects-$STAMP"
MANIFEST="$BACKUP_DIR/safelink-$STAMP.manifest"

install -d -o ubuntu -g ubuntu -m 0700 "$BACKUP_DIR"
trap 'rm -f "$TEMP" "$OBJECT_TEMP"; rm -rf "$OBJECT_STAGE"; docker exec "$MINIO_CONTAINER" rm -rf /tmp/safelink-v3-backup >/dev/null 2>&1 || true' EXIT

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

install -d -o root -g root -m 0700 "$OBJECT_STAGE"
docker exec "$MINIO_CONTAINER" sh -c \
  "rm -rf /tmp/safelink-v3-backup && mkdir -p /tmp/safelink-v3-backup && mc mirror --quiet --overwrite local/$MINIO_BUCKET /tmp/safelink-v3-backup"
docker cp "$MINIO_CONTAINER:/tmp/safelink-v3-backup/." "$OBJECT_STAGE/"
tar -C "$OBJECT_STAGE" -czf "$OBJECT_TEMP" .
test -s "$OBJECT_TEMP"
tar -tzf "$OBJECT_TEMP" >/dev/null
mv "$OBJECT_TEMP" "$OBJECT_FINAL"
chmod 0600 "$OBJECT_FINAL"
sha256sum "$OBJECT_FINAL" > "$OBJECT_FINAL.sha256"
chmod 0600 "$OBJECT_FINAL.sha256"

{
  printf 'created_at_utc=%s\n' "$STAMP"
  printf 'database_file=%s\n' "$(basename "$FINAL")"
  printf 'database_sha256=%s\n' "$(cut -d' ' -f1 "$FINAL.sha256")"
  printf 'object_file=%s\n' "$(basename "$OBJECT_FINAL")"
  printf 'object_sha256=%s\n' "$(cut -d' ' -f1 "$OBJECT_FINAL.sha256")"
  printf 'object_count=%s\n' "$(find "$OBJECT_STAGE" -type f | wc -l | tr -d ' ')"
} > "$MANIFEST"
chmod 0600 "$MANIFEST"

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'safelink-*.dump' -o -name 'safelink-*.dump.sha256' \
     -o -name 'safelink-*-objects.tar.gz' -o -name 'safelink-*-objects.tar.gz.sha256' \
     -o -name 'safelink-*.manifest' \) \
  -mtime "+$RETENTION_DAYS" -delete

printf 'backup_ok db_file=%s db_bytes=%s db_sha256=%s object_file=%s object_bytes=%s object_sha256=%s\n' \
  "$FINAL" \
  "$(stat -c %s "$FINAL")" \
  "$(cut -d' ' -f1 "$FINAL.sha256")" \
  "$OBJECT_FINAL" \
  "$(stat -c %s "$OBJECT_FINAL")" \
  "$(cut -d' ' -f1 "$OBJECT_FINAL.sha256")"
