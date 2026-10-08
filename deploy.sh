#!/usr/bin/env bash
# Deploy PostgreSQL, SMTP capture, Adminer, the API, and all three portals.
set -Eeuo pipefail
umask 077
TASK_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$TASK_ROOT"
if [[ "${1:-}" == --help || "${1:-}" == -h ]]; then
  printf 'Usage: bash deploy.sh YOUR_VPS_IP\nAfter the first deployment: bash deploy.sh\nRequires Linux, Docker Engine, Compose >= 2.30, curl, flock, and access to the existing source database. Missing first-run settings are prompted.\n'
  exit 0
fi
[[ $# -le 1 ]] || { echo 'Expected at most one VPS IP argument' >&2; exit 1; }
for executable in docker curl flock; do
  command -v "$executable" >/dev/null || { printf 'Required command missing: %s\n' "$executable" >&2; exit 1; }
done
docker info >/dev/null 2>&1 || { echo 'Docker Engine is not running or your user cannot access it.' >&2; exit 1; }
compose_version="$(docker compose version --short)"
compose_version="${compose_version#v}"
IFS=. read -r compose_major compose_minor _ <<<"$compose_version"
[[ "$compose_major" =~ ^[0-9]+$ && "$compose_minor" =~ ^[0-9]+$ ]] || { echo 'Cannot determine Compose version' >&2; exit 1; }
(( compose_major > 2 || (compose_major == 2 && compose_minor >= 30) )) || { echo 'Docker Compose 2.30 or later is required (raw env_file support).' >&2; exit 1; }
mkdir -p deployment/backups
exec 9>deployment/.deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }


if [[ ! -f .env.production && -z "${1:-}" ]]; then
  read -r -p 'VPS public IP: ' vps_ip </dev/tty
  set -- "$vps_ip"
fi
if [[ ! -f .env.production && ! -f Backend/.env ]]; then
  echo 'Provide the existing database to preserve and import its data.'
  read -r -p 'Source database host (host.docker.internal if on this VPS): ' source_host </dev/tty
  read -r -p 'Source database port [5432]: ' source_port </dev/tty
  read -r -p 'Source database name: ' source_name </dev/tty
  read -r -p 'Source database username: ' source_user </dev/tty
  read -r -s -p 'Source database password: ' source_password </dev/tty
  printf '\n' >/dev/tty
  cp Backend/env-example-relational Backend/.env.setup
  append_setting() {
    local value="$2"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    printf '%s="%s"\n' "$1" "$value" >>Backend/.env.setup
  }
  printf '\n' >>Backend/.env.setup
  append_setting DATABASE_HOST "$source_host"
  append_setting DATABASE_PORT "${source_port:-5432}"
  append_setting DATABASE_NAME "$source_name"
  append_setting DATABASE_USERNAME "$source_user"
  append_setting DATABASE_PASSWORD "$source_password"
  append_setting DATABASE_SYNCHRONIZE false
  mv Backend/.env.setup Backend/.env
  unset source_password
fi

# Complete partial source configuration without replacing existing settings.
source_settings="$(docker run --rm --user "$(id -u):$(id -g)" -v "$TASK_ROOT:/project" -w /project node:22-alpine node deployment/source-config.cjs)"
mapfile -t source_fields <<<"$source_settings"
source_file="${source_fields[0]}"
[[ "$source_file" == Backend/.env || "$source_file" == .env.production ]] || { echo 'Invalid source configuration path' >&2; exit 1; }
for key in "${source_fields[@]:1}"; do
  case "$key" in
    DATABASE_HOST) prompt='Existing database host (host.docker.internal if on this VPS): ' ;;
    DATABASE_PORT) prompt='Existing database port [5432]: ' ;;
    DATABASE_NAME) prompt='Existing database name: ' ;;
    DATABASE_USERNAME) prompt='Existing database username: ' ;;
    DATABASE_PASSWORD) prompt='Existing database password: ' ;;
    *) echo 'Invalid source configuration field' >&2; exit 1 ;;
  esac
  value=''
  while [[ -z "$value" ]]; do
    if [[ "$key" == DATABASE_PASSWORD ]]; then
      read -r -s -p "$prompt" value </dev/tty
      printf '\n' >/dev/tty
    else
      read -r -p "$prompt" value </dev/tty
    fi
    [[ "$key" != DATABASE_PORT || -n "$value" ]] || value=5432
  done
  if [[ "$source_file" == Backend/.env ]]; then
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    printf '\n%s="%s"\n' "$key" "$value" >>"$source_file"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$source_file"
  fi
  chmod 600 "$source_file"
  unset value
done
unset source_settings source_fields

# Bootstrap with Node in Docker; the host needs neither Node nor npm.
ports="$(docker run --rm --user "$(id -u):$(id -g)" -v "$TASK_ROOT:/project" -w /project node:22-alpine node deployment/prepare-env.cjs "${1:-}")"
read -r HEAD_OFFICE_PORT CLIENT_PORT MERCHANDISER_PORT MAPBOX_PUBLIC_TOKEN <<<"$ports"
for port in "$HEAD_OFFICE_PORT" "$CLIENT_PORT" "$MERCHANDISER_PORT"; do
  [[ "$port" =~ ^[0-9]+$ ]] || { echo 'Invalid portal configuration' >&2; exit 1; }
done
export HEAD_OFFICE_PORT CLIENT_PORT MERCHANDISER_PORT MAPBOX_PUBLIC_TOKEN
chmod 600 .env.production .env.source .env.database
export DEPLOY_TAG="$(date -u +%Y%m%dT%H%M%SZ)-$$"
COMPOSE=(docker compose -p akzente -f docker-compose.production.yml)
"${COMPOSE[@]}" config --quiet
old_api_id="$("${COMPOSE[@]}" ps -q api)"
old_web_id="$("${COMPOSE[@]}" ps -q web)"
OLD_API_IMAGE=''
OLD_WEB_IMAGE=''
[[ -z "$old_api_id" ]] || OLD_API_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$old_api_id")"
[[ -z "$old_web_id" ]] || OLD_WEB_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$old_web_id")"
export OLD_API_IMAGE OLD_WEB_IMAGE
switched=0
on_failure() {
  local status=$?
  trap - ERR
  echo 'Deployment failed. The source database was not modified and Docker database data was not reset.' >&2
  if (( switched )) && [[ -n "$OLD_API_IMAGE" && -n "$OLD_WEB_IMAGE" ]]; then
    echo 'Restoring the previous API and frontend images...' >&2
    printf 'services:\n  api:\n    image: $%s\n  web:\n    image: $%s\n' '{OLD_API_IMAGE}' '{OLD_WEB_IMAGE}' >deployment/.rollback.yml
    "${COMPOSE[@]}" -f deployment/.rollback.yml up -d --no-build --wait --wait-timeout 180 api web || echo 'Automatic rollback failed; inspect docker compose logs.' >&2
  fi
  printf 'Inspect: docker compose -p akzente -f docker-compose.production.yml logs --tail=100 api web\n' >&2
  exit "$status"
}
trap on_failure ERR

printf 'Building the API and all three production portals...\n'
"${COMPOSE[@]}" build --pull api web
mkdir -p Backend/uploads
"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 180 postgres
import_state="$("${COMPOSE[@]}" run --rm --no-deps db-bootstrap status)"
if [[ "$import_state" != done && "$import_state" != pending ]]; then
  echo 'Cannot determine managed database import state.' >&2
  exit 1
fi
if [[ "$import_state" == pending ]]; then
  "${COMPOSE[@]}" run --rm --no-deps source-check
  "${COMPOSE[@]}" run --rm --no-deps source-backup
  "${COMPOSE[@]}" run --rm --no-deps db-bootstrap
fi
"${COMPOSE[@]}" run --rm --no-deps db-check
"${COMPOSE[@]}" run --rm --no-deps db-backup
"${COMPOSE[@]}" run --rm --no-deps upload-init
"${COMPOSE[@]}" run --rm --no-deps upload-backup

# Only replace running services after builds, database backup and preflight pass.
switched=1
"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 180 postgres maildev adminer api web
for port in "$HEAD_OFFICE_PORT" "$CLIENT_PORT" "$MERCHANDISER_PORT"; do
  curl --noproxy '*' --fail --silent --show-error --max-time 15 "http://127.0.0.1:$port/index.html" >/dev/null
  curl --noproxy '*' --fail --silent --show-error --max-time 15 "http://127.0.0.1:$port/health" >/dev/null
  curl --noproxy '*' --fail --silent --show-error --max-time 15 "http://127.0.0.1:$port/login" >/dev/null
done
printf '%s\n' "$DEPLOY_TAG" >deployment/.last-successful-tag
printf '\nDeployment is healthy. Open the VPS IP using:\n  HeadOffice: port %s\n  Client: port %s\n  Merchandiser: port %s\nPostgreSQL and SMTP: private Docker network\n  Mail viewer: 127.0.0.1:1080\n  Adminer: 127.0.0.1:8080\nBackups: deployment/backups/\n' "$HEAD_OFFICE_PORT" "$CLIENT_PORT" "$MERCHANDISER_PORT"
