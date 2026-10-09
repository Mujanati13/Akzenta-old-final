#!/usr/bin/env bash
# Restore the private data package into a separate database, then deploy it.
set -Eeuo pipefail
umask 077
allow_missing_uploads=false
if [[ "${1:-}" == --allow-missing-test-uploads ]]; then allow_missing_uploads=true; shift; fi
[[ $# == 0 ]] || { echo "Usage: ./restore-existing.sh [--allow-missing-test-uploads]" >&2; exit 1; }
TASK_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$TASK_ROOT"
[[ -f deployment/import/existing-data.sql ]] || { echo 'Extract the private existing-test-data package into this project first (see DEPLOYMENT.md).' >&2; exit 1; }
[[ -f .env.production && -f .env.database ]] || { echo 'Run deploy.sh --fresh YOUR_VPS_IP once before restoring the existing data.' >&2; exit 1; }
for executable in docker flock; do command -v "$executable" >/dev/null || { echo "Required command missing: $executable" >&2; exit 1; }; done
mkdir -p deployment/backups Backend/uploads
exec 9>deployment/.deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
export DEPLOY_TAG="restore-$(date -u +%Y%m%dT%H%M%SZ)-$$"
COMPOSE=(docker compose -p akzente -f docker-compose.production.yml)
old_api_id="$("${COMPOSE[@]}" ps -q api)"
old_web_id="$("${COMPOSE[@]}" ps -q web)"
OLD_API_IMAGE=''
OLD_WEB_IMAGE=''
[[ -z "$old_api_id" ]] || OLD_API_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$old_api_id")"
[[ -z "$old_web_id" ]] || OLD_WEB_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$old_web_id")"
export OLD_API_IMAGE OLD_WEB_IMAGE
config_backup="deployment/backups/environment-before-restore-$DEPLOY_TAG.env"
cp .env.production "$config_backup"
switched=0
on_failure() {
 local code=$?
 trap - ERR
 if (( switched )); then
  cp "$config_backup" .env.production
  if [[ -n "$OLD_API_IMAGE" && -n "$OLD_WEB_IMAGE" ]]; then
   printf 'services:\n  api:\n    image: $%s\n  web:\n    image: $%s\n' '{OLD_API_IMAGE}' '{OLD_WEB_IMAGE}' >deployment/.rollback.yml
   "${COMPOSE[@]}" -f deployment/.rollback.yml up -d --no-build --wait --wait-timeout 180 api web || true
  fi
 fi
 echo 'Restore failed. The original database was retained; no original tables were overwritten.' >&2
 exit "$code"
}
trap on_failure ERR
"${COMPOSE[@]}" build api
"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 180 postgres
"${COMPOSE[@]}" run --rm --no-deps db-backup
"${COMPOSE[@]}" run --rm --no-deps db-restore-existing
restored_database="$(cat deployment/.restore-target)"
[[ "$restored_database" =~ ^akzente_restore_[a-f0-9]{16}$ ]] || { echo 'Invalid restored database name' >&2; exit 1; }
"${COMPOSE[@]}" run --rm --no-deps -e "DATABASE_NAME=$restored_database" -e DEPLOYMENT_TEST_DATA=true -e "ALLOW_MISSING_TEST_UPLOADS=$allow_missing_uploads" db-check
docker run --rm --user "$(id -u):$(id -g)" -v "$TASK_ROOT:/project" -w /project node:22-alpine node deployment/select-restored-database.cjs "$allow_missing_uploads"
mv .env.production.next .env.production
switched=1
flock -u 9
bash ./deploy.sh
printf '\nExisting database and test records are active. Test portal logins: deployment/restored-accounts.json\nOriginal database retained; previous settings: %s\n' "$config_backup"
