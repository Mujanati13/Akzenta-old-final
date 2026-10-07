#!/bin/sh
set -eu
umask 077
backup_name="$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
backup_file="/backups/$backup_name"
export PGCONNECT_TIMEOUT=15
export PGSSLMODE=disable
if [ "${DATABASE_SSL_ENABLED:-false}" = true ]; then
  export PGSSLMODE=require
  if [ "${DATABASE_REJECT_UNAUTHORIZED:-true}" = true ]; then export PGSSLMODE=verify-full; fi
fi
if [ -n "${DATABASE_CA:-}" ]; then printf '%s' "$DATABASE_CA" >/tmp/database-ca.pem; export PGSSLROOTCERT=/tmp/database-ca.pem; fi
if [ -n "${DATABASE_CERT:-}" ]; then printf '%s' "$DATABASE_CERT" >/tmp/database-cert.pem; export PGSSLCERT=/tmp/database-cert.pem; fi
if [ -n "${DATABASE_KEY:-}" ]; then printf '%s' "$DATABASE_KEY" >/tmp/database-key.pem; export PGSSLKEY=/tmp/database-key.pem; fi
trap 'rm -f "$backup_file.partial" /tmp/database-ca.pem /tmp/database-cert.pem /tmp/database-key.pem' EXIT
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file="$backup_file.partial"
else
  export PGPASSWORD="$DATABASE_PASSWORD"
  pg_dump --host="$DATABASE_HOST" --port="${DATABASE_PORT:-5432}" --username="$DATABASE_USERNAME" --dbname="$DATABASE_NAME" --format=custom --no-owner --no-acl --file="$backup_file.partial"
fi
pg_restore --list "$backup_file.partial" >/dev/null
mv "$backup_file.partial" "$backup_file"
printf 'Database backup: deployment/backups/%s\n' "$backup_name"
