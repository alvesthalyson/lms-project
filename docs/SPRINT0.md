# Sprint 0 – make it run

Goal: the whole stack starts, migrates, passes its tests and builds, **on a real machine**.
Until this has run once, nothing in the repository has been executed end to end: the code was written and
reviewed statically (Python compiles, TypeScript is type-checked piece by piece), but never installed or run.

## Run it

```bash
bash scripts/sprint0.sh            # backend + frontend
bash scripts/sprint0.sh backend    # only the backend
bash scripts/sprint0.sh frontend   # only the frontend
```

## Without Docker (Windows)

Install Python 3.12 or 3.13 (tick *Add python.exe to PATH*), Node.js 22 and PostgreSQL 16 (remember the password of the `postgres` user), then, in PowerShell at the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\sprint0.ps1              # setup, tests, builds
powershell -ExecutionPolicy Bypass -File scripts\sprint0.ps1 -Step run   # opens the two servers
```

It creates the `lms` role and database, installs `pg_trgm`, writes `backend\.env`, creates `backend\.venv`, and then does the same steps 4-12 as the table below.

## With Docker

Requirements: Docker with the Compose plugin. The first run creates `.env` and asks you to set `POSTGRES_PASSWORD`.

| # | Step | What it proves |
|---|------|----------------|
| 1 | `docker compose config` | the compose file is valid |
| 2 | build backend | `requirements.txt` installs, the Dockerfile works |
| 3 | start PostgreSQL | the healthcheck passes |
| 4 | `makemigrations core users books loans reservations` | the models are consistent. Generates `0002_initial` for `books` (on top of the hand-written `0001_enable_trigram`) and `0001_initial` for the other apps. The apps are named because makemigrations skips apps without a `migrations` folder |
| 5 | `migrate` | the schema, including the GIN trigram indexes, is created |
| 6 | `manage.py check` | settings and URLs are sound |
| 7 | `seed_categories` | the 8 default shelves exist (safe to repeat) |
| 7b | `seed_demo` | 16 demo books with copies, so the shelves show something |
| 8 | `pytest` | the backend test-suite |
| 9 | build frontend | `npm ci`/`npm install` works |
| 10 | `npm run typecheck` | strict TypeScript, including the new `features/library` and `features/home` |
| 11 | `npm test` | vitest (geometry, hotspot config, existing tests) |
| 12 | `npm run build` | the production bundle |

Afterwards: `docker compose up`, then open <http://localhost:5173> (site) and <http://localhost:8000/api/docs/> (API).

## After it passes

1. Commit the generated `backend/apps/*/migrations/` and `frontend/package-lock.json`.
2. Create the demo content: categories exist after step 7, books do not yet.

## If a step fails

Send the last ~40 lines of that step's output. Likely suspects, in order:

- **4 / 5** – a model/migration problem, most often the app order of dependencies or the trigram extension.
- **8** – a test that assumed something the real database does differently (the concurrency tests use real transactions).
- **10** – a type error hidden so far because the packages were not installed (the partial checks ignored them).
- **permissions on `migrations/`** – on Linux the container may write files as root: `sudo chown -R "$USER" backend/apps`.
