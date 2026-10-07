# Deploy all portals and the API on a VPS IP

Run from the project root on a Linux VPS:

```bash
bash deploy.sh YOUR_VPS_IP
```

The requested filename also works: `bash deplot.sh YOUR_VPS_IP`.

| Application | Address |
| --- | --- |
| HeadOffice | http://YOUR_VPS_IP/ |
| Client | http://YOUR_VPS_IP:8081/ |
| Merchandiser | http://YOUR_VPS_IP:8082/ |
| API | /api/v1/ on any of the three addresses |
| Readiness | /health on any of the three addresses |

The portals use separate ports so their existing root routes, assets, links, and auth flows work. Nginx proxies each portal's API requests to the same private backend. No backend, database, Adminer, or Maildev port is published by this stack.

## Before the first run

1. Install Docker Engine and Docker Compose **2.30 or later**. The deploy user must have Docker access. The script also requires Bash, curl, and flock. Host Node/npm is unnecessary. Image builds need internet access to Docker Hub and the npm registry.
2. Upload the project, including `deployment/`, `Backend/`, `Client/`, `HeadOffice/`, `Merchandiser/`, `docker-compose.production.yml`, `.dockerignore`, and both deployment scripts. Do not upload `node_modules`, `dist`, or `.verification`.
3. Keep the **existing database connection and real SMTP settings** in `Backend/.env`. Preserve the current live upload directory in `Backend/uploads/`. These files contain private data and must be transferred privately. If the local upload snapshot is stale, copy the live uploads before deploying.
4. The database must already contain the application's schema and data. This deployment reuses that database; it neither creates a replacement PostgreSQL instance nor imports the bundled SQL export. The database must be reachable from Docker. For PostgreSQL on the VPS host, use `DATABASE_HOST=host.docker.internal` and configure PostgreSQL's listen address and access rules for the Docker network. A database at localhost inside a container is not the host database.
5. Allow inbound TCP ports **80, 8081, and 8082** in the VPS/provider firewall and ensure they are free. Permit the API container to reach the existing PostgreSQL and SMTP services. The script does not stop unrelated services or change your firewall.
6. Run `bash deploy.sh YOUR_VPS_IP`.

On first run, the script writes a private `.env.production` file, copies only the required database/mail settings, sets production mode and `DATABASE_SYNCHRONIZE=false`, and creates strong JWT secrets. Existing users and passwords remain in the database; users need to log in again when changing to the new deployment. Later runs retain those production settings and secrets. Environment values are raw, literal values without surrounding quotes, and values containing dollars or hashes are preserved.

The IP setup uses **HTTP**. Login cookies are HttpOnly, but HTTP does not encrypt credentials or traffic. Service workers remain disabled on insecure origins. For internet-facing production handling sensitive information, add trusted HTTPS before normal use; that also requires changing public URLs and enabling secure cookies. Do not simply enable secure cookies while still using HTTP.

## What the command does

- Builds the API and all three portals from their lockfiles into production images.
- Creates a PostgreSQL custom-format backup and verifies its archive table of contents.
- Checks the existing database schema in a read-only connection. Structural differences stop deployment; index/comment differences are reported without changes. Development accounts using the known default password also stop deployment.
- Checks that uploads referenced by local upload URLs exist in the source directory or persistent volume.
- Imports local uploads into the named `akzente_uploads` volume without replacing files already present, then archives the volume.
- Replaces the API and Nginx services only after preflight passes. Waits for health checks, checks each portal's index and login route, and checks the proxied API readiness from the host.
- Attempts to restore the previous images if startup or host probes fail during an update. Initial deployments have no previous images to restore.

No development seeds, automatic schema synchronization, database resets, or incomplete legacy migration sequence run. The existing migration history is untouched. When schema changes are needed, use a separately reviewed and tested migration against a restored copy first; the deploy command deliberately refuses to guess how to modify live data.

## Map configuration

Set `MAPBOX_PUBLIC_TOKEN=pk.YOUR_PUBLIC_TOKEN` in the private `Backend/.env` before the first deployment, or in `.env.production` for later deployments. The deployment supplies it to the frontend builds. Only public Mapbox tokens are accepted; never use a secret `sk.` token in a browser bundle. Without a public token, map features are unavailable.

## Later deployments and configuration

```bash
bash deploy.sh
```

Edit `.env.production` to change database or SMTP settings after the first deployment; changing `Backend/.env` alone does not replace production settings. Keep this file private and backed up. To change ports, update `HEAD_OFFICE_PORT`, `CLIENT_PORT`, and `MERCHANDISER_PORT` together with their corresponding public URLs. The script validates that they agree.

The default backup client is PostgreSQL 17. If your database runs a newer major version, choose a compatible client, for example:

```bash
DATABASE_CLIENT_IMAGE=postgres:18-alpine bash deploy.sh
```

Keep the existing application running only until the new deployment is verified. If the old application still serves the same database afterward, both applications can change the same business data; coordinate the final cutover.

## Operations and recovery

```bash
docker compose -p akzente -f docker-compose.production.yml ps
docker compose -p akzente -f docker-compose.production.yml logs --tail=100 api web
docker compose -p akzente -f docker-compose.production.yml restart api web
```

Backups remain in `deployment/backups/` with private permissions. Copy them to secure off-VPS storage and set a retention policy; the script never deletes older backups. Upload archives are filesystem archives, not an atomic snapshot coordinated with the database. Quiesce writes for a fully consistent database/upload recovery point. Database restore and upload restore should be tested in an isolated environment before any live recovery.

After a failed update, the last successful image tag remains in `deployment/.last-successful-tag`. With the default ports, it can be used to recover the previous build manually:

```bash
export DEPLOY_TAG="$(cat deployment/.last-successful-tag)"
docker compose -p akzente -f docker-compose.production.yml up -d --no-build --wait api web
```

If using custom ports, also export their three values before that manual recovery command. Keep prior images until a release is stable. Do not run `docker compose down -v` or remove `akzente_uploads` during updates.

## Verification performed in this workspace

Shell and Node script syntax, Compose configuration, lockfile consistency, configuration preservation, deployment ordering, build/schema failure handling, and rollback orchestration were checked. The database and deployment tests use isolated fixtures/mocks and do not contact the live database.

Full production builds and a running Docker smoke test could not be completed here: Docker Engine was unavailable, npm was broken, and outbound package downloads were blocked. The deploy command enforces the real build, backup, database and upload compatibility checks, container health checks, and host probes on the VPS before reporting success. After deployment, verify actual login/refresh in each portal, one business write, one upload, and email delivery with your existing accounts.
