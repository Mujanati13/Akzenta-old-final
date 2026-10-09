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
| Mail viewer | VPS loopback only; automatically assigned port printed after deployment |
| Adminer | VPS loopback only; automatically assigned port printed after deployment |
| Uploaded files | Persistent `akzente_uploads` volume |

Nginx serves all three production frontend builds and proxies API requests to the same backend. PostgreSQL and SMTP ports are not exposed to the internet. Maildev captures messages for viewing; it does not deliver them to recipients. To deliver real emails, set the `MAIL_*` settings in `.env.production` to a real SMTP provider and redeploy. Maildev will still start as part of the stack.

## Prerequisites and existing data

- Linux, Docker Engine, Docker Compose **2.30+**, Bash, curl, and flock. Host Node/npm is unnecessary. Builds need access to Docker Hub and npm.
- Keep the existing source PostgreSQL reachable from containers. For PostgreSQL on the host, use `host.docker.internal` with the correct source port and PostgreSQL access rules. A source database in another Docker project needs a reachable address; the new stack's `postgres` hostname refers to the new database, not your old one.
- Copy the current live uploads into `Backend/uploads/` before the first run. Database records referencing missing uploads stop deployment.
- Schedule the first import with source application writes paused. The import copies data as of its backup; it does not continuously synchronize later changes from the original database. The command never stops unrelated applications or modifies the source database.
- Allow public TCP ports **80, 8081, 8082**, and ensure they are free. Docker assigns free local host ports for the mail viewer and Adminer, avoiding conflicts with other containers. The script does not change your firewall or stop unrelated services.

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
ssh -L 1080:127.0.0.1:MAIL_VIEWER_HOST_PORT -L 8080:127.0.0.1:ADMINER_HOST_PORT root@YOUR_VPS_IP
```

Replace `MAIL_VIEWER_HOST_PORT` and `ADMINER_HOST_PORT` with the assigned ports printed by deployment (or look them up using the commands below). Then open http://localhost:1080 for mail or http://localhost:8080 for Adminer. Adminer's server is `postgres`; use the database username, password, and name from `.env.production`.

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

## Dependency installation

The frontend and backend Docker stages use `npm ci --legacy-peer-deps` with the committed lockfiles. These lockfiles contain conflicting peer ranges (including Angular localize, older toast/stylelint packages, and AWS SDK packages); strict peer resolution rejects them. This keeps the existing locked dependency versions and does not regenerate the lockfiles during deployment. A dependency upgrade must separately align Angular and its integrations and verify all three production builds. See [npm ci documentation](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

Find the current private tool addresses at any time:

```bash
docker compose -p akzente -f docker-compose.production.yml port maildev 1080
docker compose -p akzente -f docker-compose.production.yml port adminer 8080
```

## Load all existing seed data

```bash
git pull --ff-only && ./deploy.sh --seed-all
```

This runs a database backup before adding missing roles, account statuses, user types, merchandiser statuses, report statuses, 41 European countries, 402 European city entries, and 2,054 German city entries. City names shared by both datasets are inserted only once per country. Existing country IDs, cities, account passwords, and report statuses are preserved. It creates the existing demo seed users (`admin@example.com` and `john.doe@example.com`) only when absent, with generated passwords and HeadOffice membership. Read their passwords with `cat deployment/seeder-credentials.json`. This private file is excluded from Git. The initial deployment administrator remains available. No clients, projects, or reports are defined by these seeders. The destructive `seed_remote.sql` maintenance script is not a dataset and is not executed.

The seed writes run in one transaction and can be repeated without duplicate records. Combine `--fresh --seed-all` for a new installation.

## Restore the original database and existing test records

The standard seeders do not include the full original dataset. Use the private `private-existing-test-data.tar.gz` package to restore the existing snapshot (24 client companies, 28 projects, 537 reports, 25 merchandisers, and 89 original users). The package contains `deployment/import/existing-data.sql` and the matching uploads available locally. It is intentionally excluded from GitHub because it contains account and business records.

Upload the archive to the project directory on the VPS using SCP or SFTP. Then run:

```bash
git pull --ff-only && tar --skip-old-files -xzf private-existing-test-data.tar.gz && ./restore-existing.sh
```

The command backs up the current database, creates a separate restored database using the current application schema, imports the original records, checks foreign keys and schema compatibility, and deploys against it. It retains the previous database. Old sessions are excluded. The initial administrator remains available; a restored Client account and Merchandiser account receive generated test passwords stored privately in `deployment/restored-accounts.json`. Repeating the restore reuses the completed database rather than adding duplicate records. A failed validation keeps the previous configuration active.

The available package has 203 of the snapshot's 790 referenced uploads. To restore all database records for testing while retaining the 587 unavailable file references, run `./restore-existing.sh --allow-missing-test-uploads`. This explicitly enables a warning for missing attachments only in a restored test database. Those images/documents will remain unavailable until the original files are supplied. The default restore refuses missing files. To use a complete upload archive, place its files in `Backend/uploads` before restoring.
