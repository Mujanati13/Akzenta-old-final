#!/usr/bin/env bash
# Import the available original media without replacing newer uploads.
set -Eeuo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
for executable in openssl sha256sum tar docker flock; do command -v "$executable" >/dev/null || { echo "Required command missing: $executable" >&2; exit 1; }; done
[[ -f .env.production && -f .env.database ]] || { echo 'Deploy the application before importing media.' >&2; exit 1; }
TASK_ROOT="$PWD"
media_work="$(mktemp -d)"
trap 'rm -rf -- "$media_work"' EXIT
(cd deployment/media && sha256sum --check SHA256SUMS)
cat deployment/media/uploads.enc.part-* > "$media_work/uploads.enc"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -in "$media_work/uploads.enc" -out "$media_work/uploads.tar.gz"
# Only ordinary files under Backend/uploads are allowed in this package.
tar -tzf "$media_work/uploads.tar.gz" > "$media_work/members"
while IFS= read -r member; do
  [[ "$member" == Backend/uploads/ || "$member" =~ ^Backend/uploads/[A-Za-z0-9._-]+$ ]] && [[ "$member" != *..* ]] || { echo 'Unsafe media archive path' >&2; exit 1; }
done < "$media_work/members"
tar -tvzf "$media_work/uploads.tar.gz" | awk 'substr($0,1,1)!="-" && substr($0,1,1)!="d" {bad=1} END {exit bad}' || { echo 'Unsupported media archive entry' >&2; exit 1; }
tar -xzf "$media_work/uploads.tar.gz" -C "$media_work"
mkdir -p Backend/uploads deployment/backups
exec 9>deployment/.deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
docker compose -p akzente -f docker-compose.production.yml run --rm --no-deps upload-backup
cp -an "$media_work/Backend/uploads/." Backend/uploads/
flock -u 9
exec 9>&-
echo 'Available media extracted. Deploying the routing fix and copying media into the persistent Docker volume.'
bash "$TASK_ROOT/deploy.sh"
echo 'Available original media imported. Files absent from the original source still need recovery.'
