# CampusAI

CampusAI is a campus recruitment and placement management platform in development. Phase 1 includes a public overview, service health checks, PostgreSQL readiness, and a baseline institution migration.

- [Software requirements](docs/SRS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation tracker](docs/IMPLEMENTATION_TRACKER.md)
- [Engineering rules](AGENTS.md)

## Run with Docker Compose

Install Docker with Compose v2 and clone the repository. From the repository root, run:

```sh
cp .env.example .env
docker compose up --build --wait
```

The API applies committed migrations on startup. Compose publishes the services on loopback. Rebuild after editing application source. Use the host setup below for live reload.

| Service                | Address                      |
| ---------------------- | ---------------------------- |
| Landing page           | http://localhost:5173        |
| API liveness           | http://localhost:3001/health |
| API database readiness | http://localhost:3001/ready  |
| AI liveness            | http://localhost:8002/health |
| PostgreSQL             | localhost:5432               |

```sh
curl --fail http://localhost:3001/health
curl --fail http://localhost:3001/ready
curl --fail http://localhost:8002/health
docker compose down
```

`docker compose down` retains the development database volume. `docker compose down --volumes` deletes its data. The Compose credentials are local defaults. Use URL-safe values for local PostgreSQL variables because Compose interpolates them into the connection URL. For an existing database volume, changing the environment alone does not update existing PostgreSQL credentials.

## Run services on the host

Use Node.js 22.19+ or 24.x, npm 10+, Python 3.12, and a local PostgreSQL instance. The commands below use Compose for PostgreSQL only.

```sh
cp .env.example .env
cp apps/api/.env.example apps/api/.env
docker compose up -d --wait db
npm ci
npm run db:generate
npm exec -w @campusai/api -- prisma migrate deploy
python3.12 -m venv services/ai/.venv
services/ai/.venv/bin/python -m pip install -r services/ai/requirements-dev.txt
```

Match `apps/api/.env` to the database credentials used by Compose. The web app and AI service have no application environment variables in Phase 1.

Run each command from the repository root in a separate terminal:

```sh
npm run dev:web
```

```sh
npm run dev:api
```

```sh
cd services/ai
.venv/bin/python -m uvicorn app.main:app --reload --port 8002
```

## Run checks

From the repository root after installing dependencies and creating `apps/api/.env`:

```sh
npm run db:validate
npm run format:check
npm run lint
npm run build
npm test
(cd services/ai && .venv/bin/python -m ruff check .)
(cd services/ai && .venv/bin/python -m ruff format --check .)
(cd services/ai && .venv/bin/python -m pytest)
docker compose config --quiet
```

To start the compiled API, run `npm run start -w @campusai/api` after building. Vite writes production assets to `apps/web/dist`.
