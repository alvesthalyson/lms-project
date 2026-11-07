# Testing strategy

**Test the rules, not the plumbing.** In this codebase the bugs that cost money are in the business rules (who may borrow, which copy is lent, when a fine is due, who is next in the reservation queue) and in concurrency. Those live in the **services**, so that is where most backend tests go. Views are thin and get a few contract tests. On the frontend, the risks are cache invalidation, auth/refresh behaviour and role gating, so the effort goes into hooks and page-level flows, not into components.

> **Status:** every test file described here was written without being able to run it (no Django, npm packages or Docker daemon were reachable where it was authored). Static checks passed, but run the suites once and expect to fix small things. Commands are in section 4.

---

## 1. Backend

### 1.1 The pyramid

| Layer | Share of effort | Needs DB | What it proves |
|---|---|---|---|
| **Services** (`loan_service`, `reservation_service`, `borrowing_service`, `inventory_service`) | ~60% | yes | Every business rule, edge case, rollback and queue transition |
| **Database constraints** | ~10% | yes | The last line of defence still holds if a service has a bug |
| **Pure logic** (fine arithmetic, ISBN checksum, error flattening, permissions) | ~10% | no | Fast, exhaustive, run on every save |
| **API contract** (views + serializers + permissions through `APIClient`) | ~20% | yes | Wiring: status codes, `{detail, code, field_errors}`, the role matrix, nothing more |

### 1.2 What to test in services

One behaviour per test, named as a sentence. For each service function cover: the happy path and *everything it changes* (row state, counters, activity log), **each exception it can raise**, and what is left behind when it fails (nothing).

| Function | Cases that must exist |
|---|---|
| `create_loan` | by title / by copy; default and explicit due date; lowest-id copy; no copy, withdrawn title, copy lost/damaged/on loan, copy held for someone else; fines, overdue, manual block, deactivated, loan limit; READY reservation gets its copy; taking another copy releases the held one; rollback; **two desks racing for the last copy** → *written, see 1.4* |
| `return_loan` | on time → no fine; N days late → fine of N × rate with the right note; returned as DAMAGED → copy withdrawn, counters drop; already returned → `LoanAlreadyReturnedError`; **first eligible reservation is promoted** (copy `ON_HOLD`, reservation `READY`, email queued after commit, blocked members skipped but keep their place); no waiting reservation → copy `AVAILABLE`; rollback if a late step fails |
| `renew_loan` | due date moves from the *current* due date; limit reached (2); overdue; returned; someone else waiting (`PENDING` only, own reservation does not block); borrower with fines or another overdue loan |
| `calculate_fine` | boundaries (early, due day, +1), rounding, returned loan measured to the return date, time-zone day boundary → *written* |
| `reserve` | queue position is 1-based and FIFO; book has copies on the shelf; no copies in circulation; already reserved; already borrowed; blocked member; race → `AlreadyReservedError` |
| `cancel` | PENDING and READY; READY hands its copy to the next in line (or the shelf); closed reservation → `ReservationNotActiveError` |
| `allocate_available_copies` | several copies and several waiting members; skips a blocked member who keeps their position; nothing waiting; idempotent |
| `expire_stale_holds` | expires only READY past `expires_at`; offers the copy onward; a reservation picked up between the query and the lock is left alone (it takes `now`, so no clock-freezing library is needed) |
| `get_borrowing_status` | each reason alone and combined; paying a fine or returning a late book unblocks immediately |
| `sync_book_counts` | LOST/DAMAGED leave `total_copies`; counters heal after manual drift |

### 1.3 Constraints, pure logic, API contract

* **Constraints** (`IntegrityError` straight from the ORM, no service): `uniq_active_loan_per_copy`, `book_available_lte_total`, `fine_paid_has_paid_at`, `uniq_fine_per_loan_reason`, `reservation_ready_has_copy_and_expiry`, `uniq_active_reservation_per_member_book`. If one of these fails in production, the service layer had a bug *and* the net caught it; the test keeps the net honest.
* **Pure logic** needs no `django_db` mark and runs in milliseconds: `test_fines.py`, `test_permissions.py` (22 cases), ISBN checksum, `_flatten` for error bodies.
* **API contract**: use `APIClient.force_authenticate`. Per endpoint, assert only what the view owns: the permission matrix in `docs/AUTH.md` (parametrize `(endpoint, role) → status`), that a member gets **404** for someone else's loan, that errors have exactly `detail`/`code`/`field_errors`, pagination envelope, and that one `BusinessRuleError` becomes a 409 with its code. **Do not re-test business rules through the API.**

### 1.4 How the example tests are built

`apps/loans/tests/test_create_loan.py` is the model to copy.

* **Factories, not fixtures files.** `BookFactory(copies=3)` gives three shelf copies with counters in sync; `LoanFactory(overdue=True)`, `LoanFactory(returned=True)`, `FineFactory(loan__member=m)`, `ReadyReservationFactory()` set up exactly the world a test needs in one line. A test reads as arrange / act / assert with the arrangement visible.
* **No clock freezing.** Past dates come from factory traits; `expire_stale_holds(now=...)` and `calculate_fine(returned_on=..., settings=...)` take the time as a parameter. Prefer a parameter over mocking `timezone.now`.
* **Assert on state, not on calls.** Check rows, statuses, counters and the activity log. The one `monkeypatch` is the rollback test, where the point is to force a failure half-way.
* **Assert the contract of errors**: exception class, `status_code == 409`, `get_codes()` (what the frontend branches on).
* **Concurrency test**: `@pytest.mark.django_db(transaction=True)` + two threads released by a `Barrier`, each closing its own DB connection. It only means something on PostgreSQL (row locks), so never run it on SQLite.
* **Ordinary tests are wrapped in a transaction** and rolled back, so they are fast and isolated; only the concurrency tests pay for real commits and table flushes.

### 1.5 Do not test

Django/DRF/simplejwt behaviour (token expiry, the ORM itself); serializers that only declare fields; factories; one-line properties; the same rule at three layers. If a test would still pass after you delete the rule it is named for, delete the test.

---

## 2. Frontend

### 2.1 Layers

| Layer | Tooling | Examples |
|---|---|---|
| **Pure logic** | Vitest | Zod schemas and ISBN checksum, filter ⇄ URL conversion, request-body builder, role rules, API-error → form-error mapping |
| **HTTP plumbing** | Vitest with a fake axios adapter | Interceptors: 401 → **one** shared refresh → retry; failed refresh clears tokens and signs out |
| **Hooks** | Testing Library `renderHook`, API module mocked | Mutations invalidate the right query keys; failures toast the API's `detail`; queries pass the right params |
| **Critical flows** | Testing Library, API module mocked, real router/query client | Protected routes, catalogue search/pagination/role gating, the book form with server field errors |
| **End-to-end** | Playwright against the Docker stack (*not written yet*) | Login → lend → return with fine; reserve → return → "ready"; fined member blocked |

### 2.2 Rules that keep the tests useful

1. **Mock one boundary: the feature's `api.ts` module** (`vi.mock("../api")`). Everything above it (hooks, cache, URL state, debounce) runs for real. MSW is a good upgrade later if you want the axios layer in the loop too.
2. **Query like a user:** `getByRole("button", { name: "Next page" })`, `findByText`, labels. Never CSS classes, component internals, or snapshots.
3. **A fresh `QueryClient` per test**, `retry: false`, so no cached data or retry delays leak between tests. Reset Zustand stores (`useToastStore.setState`) in `beforeEach`.
4. **Wait for outcomes, not time:** `findBy…` / `waitFor`. The 300 ms search debounce runs on real timers and `waitFor` outlasts it.
5. **Assert the effect that matters to the user or the cache**, e.g. "the API was never called with the half-typed `cl`", "the books list is invalidated after a loan", not that a function was invoked N times.
6. **Do not test** shadcn/Radix primitives, Tailwind classes, or React Query itself.

### 2.3 Critical flows to cover, in priority order

1. Session: reload with a stored refresh token restores the user; an expired access token refreshes transparently; a revoked refresh token lands on `/login` with the original destination remembered.
2. Catalogue: search (debounced, in URL), filters, pagination, shared-link restore, role-dependent actions.
3. Book form: client-side validation (ISBN with hyphens), server `field_errors` shown under the right field, success closes the modal and refreshes the list, cover over 5 MB rejected.
4. Lending desk: create a loan, 409s (`member_blocked`, `no_copy_available`) shown as a message, return with a fine announced.
5. Reservations: reserve an unavailable book, queue position shown, cancel.

---

## 3. What was written

| File | Kind | Cases | Needs |
|---|---|---|---|
| `backend/apps/loans/tests/test_create_loan.py` | service | 26 incl. 1 concurrency | PostgreSQL |
| `backend/apps/loans/tests/test_fines.py` | pure | 12 | none |
| `backend/apps/core/tests/test_permissions.py` | pure | 22 (**ran: pass**, with stubbed DRF) | none |
| `backend/apps/*/tests/factories.py`, `backend/conftest.py` | support | | |
| `frontend/src/features/loans/hooks.test.tsx` | hook | 3 | npm packages |
| `frontend/src/features/auth/components/ProtectedRoute.test.tsx` | flow | 6 | npm packages |
| `frontend/src/features/books/pages/BooksListPage.test.tsx` | flow | 13 | npm packages |
| 7 unit test files (`interceptors`, `errors`, `access`, `schemas`, `filters`, `payload`, `form-errors`) | pure | | npm packages |

Not written yet: `return_loan`, `renew_loan`, `reserve`, `cancel` and queue-allocation tests (use the table in 1.2 and copy the structure of `test_create_loan.py`), constraint tests, API contract tests, book-form modal test, Playwright flows.

---

## 4. Running

```bash
# Backend (needs the db service: docker compose up -d db)
docker compose run --rm backend pytest                       # everything
docker compose run --rm backend pytest -m "not concurrency"  # skip the threaded test
docker compose run --rm backend pytest apps/loans/tests/test_create_loan.py -k reservation
docker compose run --rm backend pytest --cov=apps --cov-report=term-missing
docker compose run --rm backend pytest --reuse-db            # faster reruns; add --create-db after model changes

# Frontend
cd frontend && npm test            # vitest run
npm run test:watch                 # while developing
```

**Targets:** services ≥ 90% line coverage, backend overall ≥ 80%; frontend coverage is not a goal, the flows in 2.3 are. In CI run the whole backend suite (including `concurrency`) against a real PostgreSQL 16 service, then `npm run build && npm test`.

The database role used by tests needs `CREATEDB` (pytest-django creates `test_<name>`); the `postgres` user the compose file creates has it, and the init script installs `pg_trgm` in `template1` so the test database gets the extension too.
