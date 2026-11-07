# Library Management System

Django 5 + DRF + PostgreSQL backend, React 18 + TypeScript + Vite frontend, all runnable with Docker Compose.

```
backend/    Django project (apps/: core, users, books, loans, reservations, dashboard)
frontend/   Vite + React app
docker/     Postgres init script (pg_trgm extension)
docs/       API.md (REST spec), AUTH.md (JWT and roles), TESTING.md (test strategy)
```

## Quick start (development)

Requires Docker with Compose v2.

```bash
# 1. Configuration
cp .env.example .env                       # database credentials, ports
cp backend/.env.example backend/.env       # Django settings
# set POSTGRES_PASSWORD in .env and DJANGO_SECRET_KEY in backend/.env:
python3 -c "import secrets; print(secrets.token_urlsafe(50))"

# 2. Generate the migrations (once; they are not committed yet)
docker compose run --rm --no-deps -e DJANGO_MIGRATE=0 --user "$(id -u):$(id -g)" \
  backend python manage.py makemigrations core users books loans reservations
```

Then open `backend/apps/books/migrations/0001_initial.py` and add `TrigramExtension()` as the **first** operation (`from django.contrib.postgres.operations import TrigramExtension`). The dev database already has the extension, but a real production database will not, and the GIN indexes on book titles and author names need it.

```bash
# 3. Start everything (applies migrations on start)
docker compose up --build

# 4. Create the first admin
docker compose exec backend python manage.py createsuperuser
```

| What | URL |
|---|---|
| Frontend (Vite, hot reload) | http://localhost:5173 |
| API | http://localhost:8000/api/v1/ |
| Swagger UI / ReDoc | http://localhost:8000/api/docs/ , `/api/redoc/` |
| Django admin | http://localhost:8000/admin/ |
| Health check | http://localhost:8000/healthz/ |
| PostgreSQL (localhost only) | `127.0.0.1:5432` |

`createsuperuser` makes a user with role ADMIN (the custom manager sets it). Self-registered accounts are always MEMBERs; librarians are created by an admin.

## Everyday commands

```bash
docker compose up -d                               # start in the background
docker compose logs -f backend                     # follow logs (reservation emails print here)
docker compose exec backend python manage.py shell
docker compose run --rm backend pytest             # backend tests (see docs/TESTING.md)
docker compose run --rm frontend npm test          # frontend tests
docker compose run --rm backend python manage.py expire_reservations   # normally scheduled, every 10-15 min
docker compose down                                # stop (data kept)
docker compose down -v                             # stop AND delete the database and uploaded covers
```

After changing `package.json`, rebuild the frontend image: `docker compose build frontend` (its `node_modules` live in the image, not in your folder).

## Production-style run

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm backend python manage.py migrate
```

Needs Compose >= 2.24. Before running it:

* In `backend/.env`: `DJANGO_DEBUG=false`, a real `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` set to your public origins.
* In `.env`: `VITE_API_URL` is the **public** API URL (it is baked into the bundle at build time) and `FRONTEND_PORT=80`.
* The images use gunicorn (non-root) and nginx. **TLS and `/media/` (cover images) are not handled**: put a reverse proxy in front, terminate HTTPS there, and route `/media/` to the `media_data` volume. Cookies are `Secure` when `DJANGO_DEBUG=false`, so plain-HTTP testing needs `SECURE_COOKIES=false`.
* Schedule `python manage.py expire_reservations` (every 10-15 minutes) and `python manage.py flushexpiredtokens` (daily).

## Troubleshooting

* **`POSTGRES_PASSWORD is missing`**: copy `.env.example` to `.env` and set it.
* **`extension "pg_trgm" does not exist`**: the init script only runs when the data volume is first created. Either add `TrigramExtension()` to the migration (above) or run `docker compose exec db psql -U lms -d lms -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"`.
* **Browser shows a CORS error**: `CORS_ALLOWED_ORIGINS` in `backend/.env` must contain the exact frontend origin, including the port if you changed `FRONTEND_PORT`.
* **Hot reload does not pick up edits on Windows/macOS**: file events can be lost across bind mounts. Set `server.watch.usePolling: true` in `frontend/vite.config.ts` (development only).
* **`entrypoint.sh: not found` or `\r` errors on Windows**: the script needs LF line endings. `.gitattributes` enforces this for new checkouts; re-checkout the file if it was already converted.
* **Port already in use**: change `DB_PORT`, `BACKEND_PORT` or `FRONTEND_PORT` in `.env`.
