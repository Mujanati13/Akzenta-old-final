# One-command VPS deployment

For a new installation with no existing database, run from the project root on your Linux VPS:

```bash
./deploy.sh --fresh "$(curl -4 -fsS https://api.ipify.org)"
```

Docker creates PostgreSQL and the application schema. Lookup data and a HeadOffice administrator are initialized once in a transaction, only in an empty database. Generated login details are stored privately in `deployment/admin-credentials.txt`. Runtime database synchronization remains disabled. Later deployments preserve the Docker volumes.

For an existing source database to import, or subsequent deployments:

```bash
./deploy.sh
```

Or provide the public IP explicitly: `./deploy.sh YOUR_VPS_IP`. The `deplot.sh` and `deply.sh` aliases run the same command.

The first run asks for the VPS IP when missing. If neither `Backend/.env` nor saved production settings exist, it asks for your existing database connection and writes a private environment file automatically. Existing database settings are kept. Blank or missing source connection fields are prompted even when `Backend/.env` already exists; enter the actual existing database name to preserve its data. SMTP credentials are unnecessary for the included local mail server.

## Included services

| Service | Address / storage |
| --- | --- |
| HeadOffice | http://YOUR_VPS_IP/ |
| Client | http://YOUR_VPS_IP:8081/ |
| Merchandiser | http://YOUR_VPS_IP:8082/ |
| API | /api/v1/ on each portal; private container port 3000 |
| PostgreSQL 17 | Private Docker network; persistent `akzente_database` volume |
| Maildev SMTP | Private Docker network, port 1025; captured mail in `akzente_mail` |
| Mail viewer | VPS loopback only: 127.0.0.1:1080 |
| Adminer | VPS loopback only: 127.0.0.1:8080 |
| Uploaded files | Persistent `akzente_uploads` volume |

Nginx serves all three production frontend builds and proxies API requests to the same backend. PostgreSQL and SMTP ports are not exposed to the internet. Maildev captures messages for viewing; it does not deliver them to recipients. To deliver real emails, set the `MAIL_*` settings in `.env.production` to a real SMTP provider and redeploy. Maildev will still start as part of the stack.

## Prerequisites and existing data

- Linux, Docker Engine, Docker Compose **2.30+**, Bash, curl, and flock. Host Node/npm is unnecessary. Builds need access to Docker Hub and npm.
- Keep the existing source PostgreSQL reachable from containers. For PostgreSQL on the host, use `host.docker.internal` with the correct source port and PostgreSQL access rules. A source database in another Docker project needs a reachable address; the new stack's `postgres` hostname refers to the new database, not your old one.
- Copy the current live uploads into `Backend/uploads/` before the first run. Database records referencing missing uploads stop deployment.
- Schedule the first import with source application writes paused. The import copies data as of its backup; it does not continuously synchronize later changes from the original database. The command never stops unrelated applications or modifies the source database.
- Allow public TCP ports **80, 8081, 8082**, and ensure they are free. Local mail-viewer and Adminer ports 1080/8080 must also be free. The script does not change your firewall or stop unrelated services.

This workflow preserves an existing database. It does not silently create an empty business dataset or run development seeds. If you intend a fresh installation, a separately verified initial schema and secure administrator setup are required.

## First run and later runs

The command builds the API and all three portals first. It starts the private PostgreSQL service and checks its import marker. On first use it checks the source schema and uploads, creates and verifies a source backup, then restores it into an **empty target database** in one transaction. It records successful import in the administrative database. A populated target without an import marker is refused; no automatic overwrite, reset, or `--clean` is used.

After import, it verifies the managed database, creates a managed database backup, imports uploads without replacing existing files, archives uploads, and starts PostgreSQL, Maildev, Adminer, the API, and Nginx. It waits for health checks and probes each portal through its host port. Later runs retain the database and skip source backup/import. Image rollback is attempted on failed application startup; no database restore or data deletion runs during rollback.

Private generated configuration:

- `.env.source`: original connection used for first import. Correct this file if the source connection needs fixing after an initial failure.
- `.env.database`: persistent PostgreSQL administrator credentials.
- `.env.production`: API connection to the managed database, strong generated application password, JWT secrets, public URLs, and SMTP settings.

Back up all three privately and keep them with the corresponding volumes. They are excluded from Git and Docker build contexts. Do not delete them to retry a deployment: generating new credentials against existing volumes can break access. When upgrading the earlier external-database deployment, the original production settings are preserved in `.env.source` and JWT secrets are retained. Existing users and application records are imported; no default accounts are seeded. Known development accounts still using the default password stop preflight.

Every later deployment uses the same command:

```bash
./deploy.sh
```

## IP access, email, and maps

IP access uses HTTP and HttpOnly cookies. HTTP does not encrypt credentials or traffic; add trusted HTTPS before normal use with sensitive data. Secure cookies and public URL settings must then be adjusted together. Service workers remain disabled on insecure origins.

Set `MAPBOX_PUBLIC_TOKEN=pk.YOUR_PUBLIC_TOKEN` in `Backend/.env` before the first run or `.env.production` afterward to enable maps. Secret `sk.` tokens are refused. Without a public token, map features are unavailable.

View captured mail and Adminer from your own computer through SSH:

```bash
ssh -L 1080:127.0.0.1:1080 -L 8080:127.0.0.1:8080 root@YOUR_VPS_IP
```

Then open http://localhost:1080 for mail or http://localhost:8080 for Adminer. Adminer's server is `postgres`; use the database username, password, and name from `.env.production`.

## Operations and recovery

```bash
docker compose -p akzente -f docker-compose.production.yml ps
docker compose -p akzente -f docker-compose.production.yml logs --tail=100 postgres maildev api web
docker compose -p akzente -f docker-compose.production.yml restart api web
```

Backups are kept privately in `deployment/backups/`. `source.latest` identifies the archive used for initial import. Copy backups to secure off-VPS storage and set retention; this script does not delete previous backups. Upload archives are not an atomic snapshot coordinated with the database; pause writes for a consistent recovery point. Test restores in an isolated environment before live recovery. Never run `docker compose down -v` or remove the database/upload/mail volumes during an update.

A restore that finishes but loses its import-marker write is refused on retry because the target already contains data. Inspect that target and the verified source archive before repairing its marker; do not reset it automatically.

The bundled target is PostgreSQL 17. Source databases must be compatible with PostgreSQL 17; migrating from a newer major version requires an explicitly tested migration/target upgrade. Do not assume changing only the dump client makes a newer database compatible with this target.

## Validation

Configuration, credential preservation, first-run import ordering, later-run import skipping, build/schema failure handling, rollback orchestration, and read-only schema/upload checks are covered by automated tests. Compose and shell syntax were validated. A real isolated PostgreSQL 17 test verified backup restoration, UUID extension creation under the application role, retained rows, skipped repeated import, and refusal to overwrite a populated target without a marker.

Full Docker image builds and the complete running stack remain unverified in this workspace because Docker Engine was unavailable. The command enforces builds, preflight and container/host health checks on the VPS. After it succeeds, verify actual login/refresh for each portal, a business write, an upload, and captured mail (or actual delivery if an SMTP provider is configured).
