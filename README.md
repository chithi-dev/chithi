# Chithi

**Chithi** is an end-to-end file sharing application consisting of a FastAPI backend, a Svelte frontend, and a Celery worker for background tasks. The project aims to provide secure file uploads, temporary links, and user management with a simple modern UI.

## Features

- User onboarding, authentication and JWT-based sessions
- File upload and download with S3-compatible backend
- Background cleanup tasks using Celery + Redis
- Admin endpoints for managing users and files
- Svelte frontend and a small CLI/TUI for administration and local tooling

## Architecture & Tech

- Backend: FastAPI, SQLModel (Postgres), Celery (Redis), RustFS
- Storage: RustFS (S3-compatible object store)
- Frontend: SvelteKit + Vite
- Containerized with Docker Compose

## Quick start (recommended)

1. Make sure Docker and Docker Compose are installed.
2. Start the full stack (builds containers if needed):

```bash
docker compose up --build
```

- Services exposed by default:
    - Backend: http://localhost:8000
    - Frontend: http://localhost:3000
    - RustFS console: http://localhost:9001
    - Postgres: 5432
    - Redis: 6379

There is a `docker-compose-dev.yml` with a minimal local development setup (Postgres, Redis, RustFS, and optional pgAdmin).

## Environment & Configuration

Important environment variables (examples come from the compose files):

- POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
- RUSTFS_ENDPOINT_URL, RUSTFS_ACCESS_KEY, RUSTFS_SECRET_ACCESS_KEY
- CELERY_BROKER_URL, CELERY_RESULT_BACKEND
- PUBLIC_BACKEND_API (Frontend build-time config)

You can find the full example environment in `docker-compose.yml` and `docker-compose-dev.yml`.

## Development

Backend

- Python >= 3.14
- Install dependencies and run the app (example):

```bash
# from src/backend
uv sync
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 # poe run dev
```

Frontend

```bash
# from src/frontend
npm install
npm run dev
```

CLI / TUI

- CLI commands are available under the `src/cli` and `src/backend` Typer apps (user management helpers).
- TUI is experimental and uses Textual (see `src/tui`).

Testing & linting

- Frontend: `npm run test` (Vitest), `npm run lint`
- Backend: depends on dev setup (`ruff` is configured for linting in the backend project)

## Contributing

Contributions are welcome. Please open issues for bugs or feature requests, and open pull requests for proposed fixes. Follow existing code style and tests where applicable.

## License

This project is licensed under the Mozilla Public License 2.0. See `LICENSE.md` for details.

## Contact

If you need help running the project or want to contribute, open an issue.
