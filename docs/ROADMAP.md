# Roadmap — Library Management System

Six sprints of two weeks each (about 12 weeks for one full-stack developer; about 7 weeks for two).
Every sprint ends with something demonstrable and a green CI.

## Where we are today (honest status)

| Area | State | Verified how |
|---|---|---|
| Data model (Step 1) | Written, **no migrations generated yet** | Static checks only |
| API spec (Step 2) | `docs/API.md` complete; serializers written; **CRUD views and router missing** | Examples match serializer fields |
| Services (Step 3) | Complete: loans, fines, reservations, borrowing rules, inventory | Static checks; **never run under Django** |
| Auth and permissions (Step 4) | JWT views, permission classes, mixin | 22 permission tests pass (stubbed DRF) |
| Frontend (Step 5) | About 75 files; Books list page, auth, loans hooks | tsc partial; **never installed or built** |
| Docker (Step 6) | Compose dev and prod, Dockerfiles | `docker compose config` only; **images never built** |
| Tests (Step 7) | 26 + 12 loan tests, frontend unit tests written | **Never run** (no pip/npm/Docker in the authoring sandbox) |

The first thing to do on a real machine is Sprint 0 below. It turns "written" into "proven".

---

## Sprint 0 (2–3 days) — Make it run

Goal: everything already written actually works.

- `docker compose build` and fix whatever breaks.
- `makemigrations core users books loans reservations`; add `TrigramExtension()` to `books/0001_initial.py`; commit the migrations.
- `pytest` (backend) and `npm ci && npm run build && npm test` (frontend); fix failures.
- CI (GitHub Actions): ruff, mypy with django-stubs, pytest on PostgreSQL, `tsc --noEmit`, eslint, vitest, docker build.

Done when: CI is green on a clean clone and `docker compose up` serves `/healthz` and the Swagger UI.

## Sprint 1 — Foundation, auth, catalogue (backend)

Deliverables
- Views and router for categories, authors, books, copies (`/api/v1/...` as in `docs/API.md`), with filtering, search (pg_trgm) and the standard pagination envelope.
- Users: list, detail, create (staff), block/unblock, `GET /users/{id}/borrowing-status/`, `/users/me/`.
- `LibrarySettings` endpoints (ADMIN write, staff read).
- Seed command (`manage.py seed_demo`) with realistic data.
- API contract tests: every endpoint × role matrix from `docs/AUTH.md`.

Done when: a librarian can manage the catalogue through Swagger; a member sees only what the matrix allows.

## Sprint 2 — Loans, fines, returns (backend)

Deliverables
- Loan views: create (checkout), renew, return, list and detail scoped with `MemberScopedQuerysetMixin`.
- Fine views: list, detail, pay (`PAID` requires `paid_at`).
- Service tests for `return_loan`, `renew_loan`, `calculate_fine` edge cases (renewal limit, blocked by reservation, lost and damaged copies).
- Concurrency test on PostgreSQL (already written for `create_loan`; extend to return and renew).

Done when: the full loan lifecycle works over HTTP, and the constraints (one open loan per copy, available ≤ total) hold under a concurrent test.

## Sprint 3 — Reservations and scheduled work

Deliverables
- Reservation views: create, list, cancel; `queue_position` exposed.
- Service tests for `reserve`, `cancel`, `allocate_available_copies`, `expire_stale_holds`, including blocked members who keep their place.
- Scheduling for `expire_reservations` (cron container or Celery beat; decision below).
- Real email delivery behind `notify_reservation_ready` (SMTP settings, templates), still sent through `transaction.on_commit`.

Done when: returning a book promotes the next member, emails them, and the hold expires on schedule.

## Sprint 4 — Frontend: operations screens

Deliverables
- Loan desk (checkout by member number and copy barcode, return, renew).
- Reservations pages (my reservations for members; queue management for staff).
- Members pages (list, detail with borrowing status, block/unblock).
- Fines page with pay action.
- Component tests for each critical flow (login, checkout, return, reserve).

Done when: a librarian can run a full day at the desk without Swagger.

## Sprint 5 — Dashboard, hardening, release

Deliverables
- `dashboard_service` and endpoints: loans today, overdue count, top books, unpaid fines total (Decimal), reservations waiting.
- Dashboard page (React Query, skeletons, error states).
- Security hardening (snippet below), rate limits reviewed, `manage.py check --deploy` clean.
- Observability: structured logging, Sentry hook, `/healthz` wired to the load balancer.
- E2E smoke test (Playwright) for the golden path; production deploy guide; backup and restore note for PostgreSQL.

Done when: `check --deploy` is clean, the smoke test passes against the prod compose stack, and the README release checklist is ticked.

---

## Compliance with the project constraints

| Constraint | Status |
|---|---|
| Production-ready | Locking, constraints and error contract done; migrations, views and a real test run still pending (Sprints 0–2) |
| Strict type hints | All 25 service functions, permissions and mixins fully annotated. About 46 non-service backend functions still lack return annotations; closed by mypy in CI (Sprint 0) |
| Explicit over implicit | Services are called explicitly; no signals |
| Money as Decimal | No `float` anywhere in the backend; fines rounded with `ROUND_HALF_UP` to cents |
| Timezone-aware dates | `USE_TZ=True`; code uses `timezone.now()` and `timezone.localdate()` |
| PEP 8 and Django practices | ruff in CI (Sprint 0) |
| React practices | State is local or in Zustand, server state in React Query, no prop drilling (context and hooks), strict TS, no `any` |
| Docstrings on services | All public service functions have one |
| Settings defaults | Partial today; completed in Sprint 5 |

## Security settings to apply in Sprint 5 (not applied yet)

```python
# backend/config/settings/base.py — production block (inside `if not DEBUG:`)
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
SECURE_REDIRECT_EXEMPT = [r"^healthz/?$"]        # load balancer probes use plain HTTP
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30          # raise to 1 year once verified
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = False                       # enable only deliberately
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")   # explicit, never CORS_ALLOW_ALL_ORIGINS
CORS_ALLOW_CREDENTIALS = False                    # JWT in headers, not cookies
```

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Code never executed under Django | Hidden bugs in services and models | Sprint 0 first; do not start views before tests are green |
| Denormalised counters drift | Wrong availability | `sync_book_counts` recomputes from rows; add a nightly consistency check |
| Row-lock contention on popular titles | Slow checkouts | Locks are short and per book; measure in Sprint 5 |
| Refresh token in localStorage | XSS exposure | Strict CSP at nginx; alternative: httpOnly cookie (needs CSRF handling) |
| Email provider choice | Delays Sprint 3 | Console backend until chosen |

## Open decisions

1. **Scheduler**: a cron container running `expire_reservations` (simple) versus Celery beat (more moving parts, but also gives retries and async email). Recommendation: cron for the MVP.
2. **Barcode scanning** in the loan desk: keyboard-wedge scanners work with a plain input; camera scanning is a later feature.
3. **Multi-branch libraries**: out of scope; `BookCopy` would gain a `branch` FK later.
4. **Fine payment**: recorded manually by staff; online payment is a post-MVP feature.

## Post-MVP backlog

Member self-service profile and password reset, CSV import of the catalogue, book cover upload, audit-log viewer, i18n (pt-BR), reports export.
