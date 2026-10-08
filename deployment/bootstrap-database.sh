#!/bin/sh
set -eu
export PGHOST="${BOOTSTRAP_HOST:-postgres}" PGPORT="${BOOTSTRAP_PORT:-5432}" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD" PGCONNECT_TIMEOUT=15
# This marker lives in the administrative DB, separate from business tables.
marker_exists="$(psql -d postgres -Atq -v ON_ERROR_STOP=1 -c "SELECT to_regclass('akzente_deployment.imports') IS NOT NULL")"
backup_dir="${BACKUP_DIR:-/backups}"
imported=''
if [ "$marker_exists" = t ]; then
  imported="$(psql -d postgres -Atq -v ON_ERROR_STOP=1 -v target="$DATABASE_NAME" <<'SQL'
SELECT 1 FROM akzente_deployment.imports WHERE database_name = :'target';
SQL
)"
fi
if [ "${1:-}" = status ]; then
  if [ "$imported" = 1 ]; then echo done; else echo pending; fi
  exit 0
fi
if [ "$imported" = 1 ]; then echo 'Existing Docker database retained; import skipped.'; exit 0; fi
if [ "${1:-}" = create-empty ]; then
psql -d postgres -q -v ON_ERROR_STOP=1 -v target="$DATABASE_NAME" -v app_user="$DATABASE_USERNAME" -v app_password="$DATABASE_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'target', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'target')
\gexec
SQL
count="$(psql -d "$DATABASE_NAME" -Atq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
baseline="$(psql -d "$DATABASE_NAME" -Atq -v ON_ERROR_STOP=1 -c "SELECT to_regclass('public.akzente_initial_baseline') IS NOT NULL")"
[ "$count" = 0 ] || [ "$baseline" = t ] || { echo 'Target database already contains tables. Refusing to overwrite data.' >&2; exit 1; }
  exit 0
fi
if [ "${1:-}" = mark-fresh ]; then
  archive=fresh-baseline-v1
psql -d postgres -q -v ON_ERROR_STOP=1 -v target="$DATABASE_NAME" -v archive="$archive" <<'SQL'
BEGIN;
CREATE SCHEMA IF NOT EXISTS akzente_deployment;
CREATE TABLE IF NOT EXISTS akzente_deployment.imports (database_name text PRIMARY KEY, archive_name text NOT NULL, imported_at timestamptz NOT NULL DEFAULT now());
INSERT INTO akzente_deployment.imports (database_name, archive_name) VALUES (:'target', :'archive');
COMMIT;
SQL
  exit 0
fi
[ -f "$backup_dir/source.latest" ] || { echo 'Verified source backup is missing.' >&2; exit 1; }
archive="$(cat "$backup_dir/source.latest")"
case "$archive" in *[!A-Za-z0-9.-]*|'') echo 'Invalid archive name' >&2; exit 1;; esac
[ -f "$backup_dir/$archive" ] || { echo 'Source archive is missing.' >&2; exit 1; }
pg_restore --list "$backup_dir/$archive" >/dev/null
psql -d postgres -q -v ON_ERROR_STOP=1 -v target="$DATABASE_NAME" -v app_user="$DATABASE_USERNAME" -v app_password="$DATABASE_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'target', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'target')
\gexec
SQL
count="$(psql -d "$DATABASE_NAME" -Atq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
[ "$count" = 0 ] || { echo 'Target database already contains tables without an import marker. Refusing to overwrite data; inspect the completed/partial import before retrying.' >&2; exit 1; }
# Restore into an empty target only. Atomic restore; no --clean or database deletion.
pg_restore --dbname="$DATABASE_NAME" --single-transaction --exit-on-error --no-owner --no-acl --role="$DATABASE_USERNAME" "$backup_dir/$archive"
psql -d postgres -q -v ON_ERROR_STOP=1 -v target="$DATABASE_NAME" -v archive="$archive" <<'SQL'
BEGIN;
CREATE SCHEMA IF NOT EXISTS akzente_deployment;
CREATE TABLE IF NOT EXISTS akzente_deployment.imports (database_name text PRIMARY KEY, archive_name text NOT NULL, imported_at timestamptz NOT NULL DEFAULT now());
INSERT INTO akzente_deployment.imports (database_name, archive_name) VALUES (:'target', :'archive');
COMMIT;
SQL
printf 'Source database restored into Docker; original database unchanged.\n'
