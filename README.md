# CampusAI

CampusAI is a campus recruitment and placement management platform. Phase 2 includes the public overview, institution-scoped accounts and invitations, academic verification, employer onboarding, and private resume versions. The AI service exposes its Phase 1 health endpoint.

- [Software requirements](docs/SRS.md) · [Architecture](docs/ARCHITECTURE.md) · [Implementation tracker](docs/IMPLEMENTATION_TRACKER.md)
- [Authentication](docs/AUTHENTICATION.md) · [Permissions](docs/PERMISSIONS.md) · [Entity relationships](docs/ER_DIAGRAM.md) · [API](docs/API.md)
- [Threat model](docs/THREAT_MODEL.md) · [Demo accounts](docs/DEMO.md) · [Phase 2 report](docs/PHASE_2_REPORT.md)

## Start the local stack

Install Docker with Compose v2. From the repository root:

```sh
cp .env.example .env
docker compose up --build --wait
```

Compose starts the web, API, AI, PostgreSQL, a local S3-compatible Versity Gateway, and Mailpit. The API applies committed migrations and initializes the private development bucket before serving requests.

| Service                             | Address                                                      |
| ----------------------------------- | ------------------------------------------------------------ |
| Landing page and sign-in            | http://localhost:5173                                        |
| API liveness and database readiness | http://localhost:3001/health and http://localhost:3001/ready |
| AI liveness                         | http://localhost:8002/health                                 |
| PostgreSQL                          | localhost:5432                                               |
| Private S3-compatible endpoint      | http://localhost:9000                                        |
| Mailpit inbox                       | http://localhost:8025                                        |

Follow the [demo account instructions](docs/DEMO.md) to bootstrap an administrator and invite the other roles. The mailbox and Compose credentials are for development. `docker compose down` preserves the database and object volumes. Adding `--volumes` deletes both. Rebuild after changing containerized source.

## Run applications on the host

Use Node.js 22.19+ or 24.x, npm 10+, Python 3.12, and a POSIX shell. Start the backing services first:

```sh
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose up -d --wait db storage mail
npm ci
npm run db:generate
npm exec -w @campusai/api -- prisma migrate deploy
npm run storage:init -w @campusai/api
python3.12 -m venv services/ai/.venv
services/ai/.venv/bin/python -m pip install -r services/ai/requirements-dev.txt
```

Match the API environment to the database credentials. Use URL-safe Compose DB variables because they are interpolated into a connection URL. Run each application in a separate terminal from the repository root:

```sh
npm run dev:web
npm run dev:api
(cd services/ai && .venv/bin/python -m uvicorn app.main:app --reload --port 8002)
```

Use the host bootstrap variant in the [demo instructions](docs/DEMO.md). To execute the compiled API after a build, use `npm run start -w @campusai/api`. Vite writes the compiled web assets to `apps/web/dist`.

## Verification

```sh
npm run db:validate
npm run format:check
npm run lint
npm run build
npm test
npm run test:integration
(cd services/ai && .venv/bin/python -m ruff check .)
(cd services/ai && .venv/bin/python -m ruff format --check .)
(cd services/ai && .venv/bin/python -m pytest)
docker compose config --quiet
```

Use disposable development databases and buckets for integration tests. The suite creates uniquely named synthetic fixtures. With the full Compose stack, run it using `docker compose exec -T api npm run test:integration`.

## Deployment and retention

Run migrations as a separate deployment step. Serve the web and API behind HTTPS on the same site. Configure `WEB_ORIGIN` with the exact browser origin and build the web with `VITE_API_ORIGIN` set to the API origin. Use an empty `VITE_API_ORIGIN` for a same-origin reverse proxy. Route web page paths to the SPA entry point. Set `NODE_ENV=production` on the API to enforce secure session cookies. Provide `S3_BUCKET`, region, and workload credentials or explicit S3 credentials. Set `S3_ENDPOINT` and `S3_PATH_STYLE` for compatible providers. Provision a private bucket, keep keys out of application logs, and configure production SMTP with `MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` and optional `SMTP_USER` / `SMTP_PASSWORD`. `MAIL_MODE=disabled` permits startup while email workflows are unavailable. See the [threat model](docs/THREAT_MODEL.md) for real-data deployment prerequisites.

Resume deletion immediately removes access and attempts physical removal. Keep an operational schedule for `npm run documents:purge -w @campusai/api` to retry deleted objects and stale upload tickets. On Compose, use `docker compose exec -T api npm run documents:purge -w @campusai/api`. The command handles batches of up to 100 of each kind and reports failures. PostgreSQL retains deletion tombstones and audit metadata. Configure database and object backup retention separately.
