# Library Management System: REST API v1

Base URL: `/api/v1/` · Auth: JWT bearer · Format: JSON (multipart for cover uploads) · OpenAPI: `/api/schema/`, Swagger UI at `/api/docs/`

---

## 1. Conventions

### 1.1 Authentication

Send `Authorization: Bearer <access>` on every request except the ones marked **Public**.
Access tokens live 15 minutes, refresh tokens 7 days and are rotated on every refresh (the old one is blacklisted). The access token carries a `role` claim so the frontend can route by role.

### 1.2 Roles and permission tags

| Tag | Meaning | DRF permission class |
|---|---|---|
| **Public** | No token needed | `AllowAny` |
| **Auth** | Any logged-in user | `IsAuthenticated` |
| **Owner/Staff** | The record belongs to the caller, or the caller is LIBRARIAN or ADMIN | `IsOwnerOrStaff` |
| **Librarian+** | LIBRARIAN or ADMIN (admins are a superset of librarians) | `IsLibrarian` |
| **Admin** | ADMIN only | `IsAdmin` |

List endpoints marked "members: own" return only the caller's records when the caller is a MEMBER. Members never get a 403 on those lists; they simply never see anyone else's rows.

### 1.3 Status codes

| Code | When |
|---|---|
| 200 | Success (including action endpoints such as `renew`, `return`, `cancel`, `pay`) |
| 201 | Created. The `Location` header points at the new resource (not sent by `/auth/register/`) |
| 204 | Success with no body (logout, password change) |
| 400 | Malformed or invalid input (`validation_error`) |
| 401 | Missing, expired or invalid token |
| 403 | Authenticated but not allowed (`permission_denied`) |
| 404 | Not found, or not visible to the caller |
| 409 | Request is valid but breaks a business rule in the current state (see error codes) |
| 429 | Throttled |
| 500 | Unexpected server error |

### 1.4 Data formats

* Timestamps: ISO 8601 UTC, `2026-11-04T05:10:00Z`.
* Dates (`due_date`, `acquired_at`): `YYYY-MM-DD`. "Days overdue" is counted in the server's `TIME_ZONE`.
* Money: decimal **strings** with two places, `"1.50"`.
* IDs: integers. ISBNs are stored without hyphens; input with hyphens is accepted and normalised.
* Single objects are returned bare (no `{"data": ...}` envelope). Write endpoints return the full read representation of the resource.
* Field names are `snake_case`. Foreign keys are written as `<name>_id` and read as nested summary objects.

### 1.5 Error format

Every non-2xx response has exactly these three keys:

```json
{
  "detail": "One or more fields are invalid.",
  "code": "validation_error",
  "field_errors": {
    "isbn": ["Enter a valid ISBN-10 or ISBN-13."],
    "author_ids": ["This list may not be empty."]
  }
}
```

* `detail`: human-readable summary, safe to show in a toast.
* `code`: stable machine-readable string. Branch on this, never on `detail`. Catalogue in section 5.
* `field_errors`: `{}` unless `code` is `validation_error`. Keys are request field names; nested and list items use dotted paths (`authors.0.name`). Errors that belong to no single field use the key `non_field_errors`.

A business-rule failure:

```json
{
  "detail": "Member has unpaid fines of 4.50 and cannot borrow.",
  "code": "member_blocked",
  "field_errors": {}
}
```

### 1.6 Pagination

All list endpoints use page-number pagination: `?page=2&page_size=50` (default 20, max 100). An out-of-range page returns 404 with `code: "not_found"`.

```json
{
  "count": 1240,
  "page": 1,
  "page_size": 20,
  "total_pages": 62,
  "next": "https://lms.example.com/api/v1/books/?page=2",
  "previous": null,
  "results": [
    {
      "id": 12,
      "title": "Clean Architecture",
      "authors": [{"id": 3, "name": "Robert C. Martin"}],
      "isbn": "9780134494166",
      "publisher": "Pearson",
      "publication_year": 2017,
      "category": {"id": 2, "name": "Software Engineering", "slug": "software-engineering"},
      "cover_image": "https://lms.example.com/media/covers/2026/11/clean-architecture.jpg",
      "total_copies": 4,
      "available_copies": 1,
      "is_available": true,
      "is_active": true
    }
  ]
}
```

Exception: `GET /dashboard/most-borrowed/` is a top-N list and returns a plain array.

### 1.7 Filtering, search and ordering

| Param | Convention |
|---|---|
| `search` | Case-insensitive substring match across the fields listed per endpoint. Multiple words are ANDed |
| `<field>=<value>` | Exact-match filters (`status=overdue`, `category=2`). Booleans are `true` / `false` |
| `<field>_from`, `<field>_to` | Inclusive range on dates or numbers (`due_from=2026-11-01`) |
| `ordering` | Field name, `-` prefix for descending, comma-separated for several (`ordering=-loaned_at,id`). Each endpoint lists its allowed fields and default; others return 400 |

Unknown query parameters are ignored. Invalid values for a known parameter return 400 `validation_error` with the parameter name in `field_errors`.

### 1.8 Throttling

Anonymous 60/min, authenticated 300/min, and a stricter 10/min per IP on `login`, `register` and `refresh`. A throttled request gets 429 with `code: "throttled"` and a `Retry-After` header.

### 1.9 Versioning

The version is in the path (`/api/v1/`). Adding fields or endpoints is not a breaking change; removing or renaming is, and goes into `/api/v2/`.

---

## 2. Settings the API relies on

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "60/min", "user": "300/min", "auth": "10/min"},
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Library Management System API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,  # separate request/response components (needed for multipart + read-only fields)
}
```

Additional packages beyond the original stack: **django-filter** (filter backend above). `rest_framework_simplejwt.token_blacklist` must be in `INSTALLED_APPS` for logout and rotation.

---

## 3. URL structure

```
/api/schema/  /api/docs/  /api/redoc/

/api/v1/
├── auth/            register/  login/  refresh/  logout/
├── users/           (list, create)  me/  me/password/  {id}/  {id}/block/  {id}/unblock/
│                    {id}/borrowing-status/  {id}/loans/
├── books/           (list, create)  {id}/  {id}/copies/  {id}/loans/  {id}/reservations/
├── copies/          {id}/
├── categories/      (list, create)  {id}/
├── authors/         (list, create)  {id}/
├── loans/           (list, create)  {id}/  {id}/renew/  {id}/return/
├── fines/           (list, create)  {id}/  {id}/pay/  {id}/waive/
├── reservations/    (list, create)  {id}/  {id}/cancel/
├── dashboard/       summary/  most-borrowed/  activity/
└── settings/
```

Design rules behind it:

* Collections are plural nouns; state changes that are not plain field edits are `POST .../{id}/<verb>/` actions that return the updated resource.
* Nesting is one level and read-only (`/books/{id}/loans/`, `/users/{id}/loans/`). These are shortcuts for `/loans/?book={id}` and `/loans/?member={id}` and share the same filters, ordering and serializer.
* `/users/me/` is routed before `/users/{id}/`.
* Copies are created under their book (`POST /books/{id}/copies/`) but edited at the top level (`PATCH /copies/{id}/`), since a copy's id is globally unique.

---

## 4. Endpoints

### 4.1 Auth

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/auth/register/` | Public | Creates a MEMBER account. 201 with tokens and user |
| POST | `/auth/login/` | Public | Email and password. Blocked members can still log in |
| POST | `/auth/refresh/` | Public | Exchanges a refresh token for a new access and refresh pair |
| POST | `/auth/logout/` | Auth | Blacklists the refresh token. 204 |

**POST /auth/register/**

```json
{
  "email": "ana@example.com",
  "password": "S3cure-passphrase",
  "first_name": "Ana",
  "last_name": "Silva",
  "phone": "+81-90-1234-5678"
}
```

201:

```json
{
  "access": "eyJhbGciOiJIUzI1NiIs.access.token",
  "refresh": "eyJhbGciOiJIUzI1NiIs.refresh.token",
  "user": {
    "id": 7,
    "email": "ana@example.com",
    "first_name": "Ana",
    "last_name": "Silva",
    "role": "MEMBER",
    "member_number": "M-000007",
    "phone": "+81-90-1234-5678",
    "address": "",
    "is_active": true,
    "is_blocked": false,
    "blocked_reason": "",
    "blocked_at": null,
    "date_joined": "2026-11-04T05:00:00Z"
  }
}
```

Errors: 400 `validation_error` (duplicate email, weak password).

**POST /auth/login/** takes `{"email", "password"}` and returns the same body as register. Wrong credentials give 401 `no_active_account`.

**POST /auth/refresh/** takes `{"refresh"}` and returns `{"access", "refresh"}`. An expired or blacklisted token gives 401 `token_not_valid`.

**POST /auth/logout/** takes `{"refresh"}` and returns 204.

### 4.2 Users

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/users/` | Librarian+ | Librarians see MEMBER accounts only, admins see everyone |
| POST | `/users/` | Admin | Create a user with any role |
| GET | `/users/me/` | Auth | Own profile |
| PATCH | `/users/me/` | Auth | Own `first_name`, `last_name`, `phone`, `address` only |
| POST | `/users/me/password/` | Auth | `{old_password, new_password}`. 204 |
| GET | `/users/{id}/` | Owner/Staff | |
| PATCH | `/users/{id}/` | Admin | Change role, deactivate (`is_active=false`). Users are never deleted because loan history references them |
| POST | `/users/{id}/block/` | Librarian+ | `{reason}`. Manual block; sets `is_blocked`, `blocked_at` |
| POST | `/users/{id}/unblock/` | Librarian+ | No body |
| GET | `/users/{id}/borrowing-status/` | Owner/Staff | Computed eligibility, see below |
| GET | `/users/{id}/loans/` | Owner/Staff | Loans per user. Same filters as `/loans/` |

Filters for `GET /users/`: `search` (email, first_name, last_name, member_number), `role`, `is_blocked`, `is_active`. Ordering: `last_name` (default), `date_joined`, `email`.

**Blocking.** A member cannot borrow when any of the following is true. The rule is evaluated by the user service on every borrow, renew and reserve call, so it can never go stale.

1. `is_blocked` was set manually by staff.
2. They have unpaid fines.
3. They have at least one overdue loan.
4. They already have `max_active_loans` open loans (only affects new loans).

**GET /users/7/borrowing-status/** 200:

```json
{
  "can_borrow": false,
  "reasons": ["unpaid_fines", "overdue_loans"],
  "active_loans": 3,
  "overdue_loans": 1,
  "unpaid_fines_total": "4.50",
  "max_active_loans": 5
}
```

### 4.3 Books

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/books/` | Public | Catalogue list. Anonymous users and members see `is_active=true` books only |
| POST | `/books/` | Librarian+ | JSON or multipart (for `cover_image`). Optional `initial_copies` |
| GET | `/books/{id}/` | Public | Detail (adds `description`, timestamps) |
| PATCH | `/books/{id}/` | Librarian+ | Counters are not writable; use copies |
| DELETE | `/books/{id}/` | Admin | Soft delete (`is_active=false`), 204. Open reservations are cancelled. 409 `book_has_active_loans` if any copy is out |
| GET | `/books/{id}/copies/` | Librarian+ | Filter `status` |
| POST | `/books/{id}/copies/` | Librarian+ | Adds a copy; `total_copies` and `available_copies` go up by one |
| PATCH | `/copies/{id}/` | Librarian+ | Move a copy between `AVAILABLE`, `LOST`, `DAMAGED`. 409 `copy_status_not_editable` while the copy is `ON_LOAN` or `ON_HOLD` |
| GET | `/books/{id}/loans/` | Librarian+ | Loans per book (all copies) |
| GET | `/books/{id}/reservations/` | Librarian+ | The FIFO queue, oldest first |

Filters for `GET /books/`:

| Param | Behaviour |
|---|---|
| `search` | title, author name, ISBN, publisher |
| `title` | title contains |
| `author` | author name contains; `author_id` for an exact author |
| `isbn` | exact, hyphens ignored |
| `category` | category id; `category_slug` for the slug |
| `publication_year`, `year_from`, `year_to` | exact or inclusive range |
| `available` | `true` returns books with at least one available copy |
| `is_active` | Staff only; defaults to `true` |

Ordering: `title` (default), `-created_at`, `publication_year`, `available_copies`.

**POST /books/** (JSON form)

```json
{
  "title": "Clean Architecture",
  "isbn": "978-0-13-449416-6",
  "publisher": "Pearson",
  "publication_year": 2017,
  "category_id": 2,
  "author_ids": [3],
  "description": "A craftsman's guide to software structure and design.",
  "initial_copies": 4
}
```

201 (`BookDetailSerializer`):

```json
{
  "id": 12,
  "title": "Clean Architecture",
  "authors": [{"id": 3, "name": "Robert C. Martin"}],
  "isbn": "9780134494166",
  "publisher": "Pearson",
  "publication_year": 2017,
  "category": {"id": 2, "name": "Software Engineering", "slug": "software-engineering"},
  "cover_image": null,
  "total_copies": 4,
  "available_copies": 4,
  "is_available": true,
  "is_active": true,
  "description": "A craftsman's guide to software structure and design.",
  "created_at": "2026-11-04T05:05:00Z",
  "updated_at": "2026-11-04T05:05:00Z"
}
```

Errors: 400 `validation_error` (bad ISBN checksum, duplicate ISBN, empty `author_ids`, cover over 5 MB).

**POST /books/12/copies/**

```json
{
  "barcode": "BC-000311",
  "condition_notes": "",
  "acquired_at": "2026-11-04"
}
```

201:

```json
{
  "id": 311,
  "book_id": 12,
  "barcode": "BC-000311",
  "status": "AVAILABLE",
  "condition_notes": "",
  "acquired_at": "2026-11-04"
}
```

#### Categories and authors

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/categories/` | Public | `search` (name). Ordering `name` |
| POST | `/categories/` | Librarian+ | `{name, slug?}`; slug is generated from the name when omitted |
| GET, PATCH | `/categories/{id}/` | Public, Librarian+ | |
| DELETE | `/categories/{id}/` | Admin | 409 `category_in_use` if any book uses it |
| GET | `/authors/` | Public | `search` (name). Ordering `name` |
| POST | `/authors/` | Librarian+ | `{name}` |
| GET, PATCH | `/authors/{id}/` | Public, Librarian+ | |
| DELETE | `/authors/{id}/` | Admin | 409 `author_in_use` if any book lists the author |

#### Discovery: reviews, wish list, read-next (added with the shelf experience)

Book list and detail rows also carry `rating_avg` (null when unreviewed), `rating_count`, `is_favorite`
(always false for visitors), `cover_image` (uploaded file, else the external `cover_url`) and `pages`.
List extras: `?favorite=true` (the caller's wish list), `?min_rating=4`, `?ordering=-rating_avg`.

| Method | Path | Who | Result |
|---|---|---|---|
| GET | `/books/{id}/reviews/` | public | paginated reviews, newest first (`reviewer` is "First L.", never the e-mail) |
| POST | `/books/{id}/reviews/` | signed in | `{rating 1-5, comment?}`; one review per user and book: 201 created, 200 replaced |
| DELETE | `/reviews/{id}/` | author or staff | 204 (404 for other members' reviews) |
| PUT / DELETE | `/books/{id}/favorite/` | signed in | `{is_favorite}`; both idempotent |
| GET | `/books/{id}/related/` | public | up to 6 `{reason: readers\|author\|category, book}` |

Management commands: `seed_bookshelf` (five demo novels, idempotent) and `fetch_covers [--dry-run] [--force] [--limit N]`
(Open Library; stores only the cover URL).

### 4.4 Loans

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/loans/` | Auth (members: own) | |
| POST | `/loans/` | Librarian+ | Lends a copy to a member. 201 |
| GET | `/loans/{id}/` | Owner/Staff | |
| POST | `/loans/{id}/renew/` | Owner/Staff | Empty body. Extends `due_date` by `renewal_period_days` |
| POST | `/loans/{id}/return/` | Librarian+ | Returns the copy; computes any fine |

Filters for `GET /loans/`:

| Param | Behaviour |
|---|---|
| `status` | `active`, `overdue` (active and past due) or `returned` |
| `member`, `book`, `copy` | ids. `member` is ignored for MEMBER callers (they only ever see their own) |
| `due_from`, `due_to` | Inclusive range on `due_date` |
| `loaned_from`, `loaned_to` | Inclusive range on the loan date |
| `search` | Staff only: member email or name, book title, copy barcode |

Ordering: `-loaned_at` (default), `loaned_at`, `due_date`, `returned_at`.

**POST /loans/**

```json
{
  "member_id": 7,
  "book_id": 12
}
```

Provide exactly one of `copy_id` (a specific copy) or `book_id` (the service picks a copy). `due_date` is optional and defaults to today plus `loan_period_days`. 201:

```json
{
  "id": 42,
  "member": {"id": 7, "email": "ana@example.com", "full_name": "Ana Silva", "member_number": "M-000007"},
  "copy": {"id": 311, "barcode": "BC-000311"},
  "book": {
    "id": 12,
    "title": "Clean Architecture",
    "isbn": "9780134494166",
    "cover_image": "https://lms.example.com/media/covers/2026/11/clean-architecture.jpg"
  },
  "loaned_at": "2026-11-04T05:10:00Z",
  "due_date": "2026-11-18",
  "returned_at": null,
  "status": "active",
  "days_overdue": 0,
  "renewal_count": 0
}
```

Rules, in the order the loan service checks them:

1. The member must be allowed to borrow (see 4.2). 409 `member_blocked` or `loan_limit_reached`.
2. With `copy_id`: the copy must be `AVAILABLE`, or `ON_HOLD` for this member's own `READY` reservation. Otherwise 409 `copy_not_available` or `copy_held_for_other_member`.
3. With `book_id`: the member's own held copy is used first, then any `AVAILABLE` copy. 409 `no_copy_available` if none.
4. If the member has a `READY` reservation for the book, it becomes `FULFILLED` and is linked to the loan.
5. The copy becomes `ON_LOAN` and the book's counters update, all in one transaction with the copy row locked.

**POST /loans/42/renew/** returns the updated loan with `renewal_count: 1` and `due_date` moved to `"2026-12-02"`. Errors, all 409:

| code | Condition |
|---|---|
| `loan_already_returned` | The loan is closed |
| `loan_overdue` | Overdue loans cannot be renewed; return them instead |
| `renewal_limit_reached` | `renewal_count` already equals `max_renewals` (2 by default) |
| `renewal_blocked_by_reservation` | Another member is waiting in the queue for this book |
| `member_blocked` | The borrower has unpaid fines, another overdue loan, or a manual block |

**POST /loans/42/return/**

```json
{
  "copy_status": "AVAILABLE",
  "condition_notes": ""
}
```

Both fields are optional; an empty body means `AVAILABLE`. 200:

```json
{
  "loan": {
    "id": 42,
    "member": {"id": 7, "email": "ana@example.com", "full_name": "Ana Silva", "member_number": "M-000007"},
    "copy": {"id": 311, "barcode": "BC-000311"},
    "book": {
      "id": 12,
      "title": "Clean Architecture",
      "isbn": "9780134494166",
      "cover_image": "https://lms.example.com/media/covers/2026/11/clean-architecture.jpg"
    },
    "loaned_at": "2026-11-04T05:10:00Z",
    "due_date": "2026-11-18",
    "returned_at": "2026-11-21T02:30:00Z",
    "status": "returned",
    "days_overdue": 3,
    "renewal_count": 0
  },
  "fine": {
    "id": 9,
    "loan_id": 42,
    "member": {"id": 7, "email": "ana@example.com", "full_name": "Ana Silva", "member_number": "M-000007"},
    "book": {
      "id": 12,
      "title": "Clean Architecture",
      "isbn": "9780134494166",
      "cover_image": "https://lms.example.com/media/covers/2026/11/clean-architecture.jpg"
    },
    "reason": "OVERDUE",
    "amount": "1.50",
    "status": "UNPAID",
    "paid_at": null,
    "note": "3 days overdue at 0.50/day",
    "created_at": "2026-11-21T02:30:00Z"
  }
}
```

`fine` is `null` for an on-time return. The fine is `days_overdue × fine_per_day`. After the return, the loan service frees the copy: if someone is waiting in the reservation queue the first `PENDING` reservation becomes `READY`, the copy goes `ON_HOLD`, and the notification stub fires; otherwise the copy goes `AVAILABLE`. Error: 409 `loan_already_returned`.

### 4.5 Fines

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/fines/` | Auth (members: own) | |
| POST | `/fines/` | Librarian+ | Manual fine for a `LOST` or `DAMAGED` copy. Overdue fines are automatic |
| GET | `/fines/{id}/` | Owner/Staff | |
| POST | `/fines/{id}/pay/` | Librarian+ | Marks `PAID`, sets `paid_at`. Optional `{note}`. Payment-gateway integration is out of scope for the MVP |
| POST | `/fines/{id}/waive/` | Admin | Marks `WAIVED`. Optional `{note}` |

Filters: `status` (`UNPAID`, `PAID`, `WAIVED`), `member`, `loan`, `reason`. Ordering: `-created_at` (default), `amount`.

**POST /fines/**

```json
{
  "loan_id": 42,
  "reason": "DAMAGED",
  "amount": "12.00",
  "note": "Water damage on back cover"
}
```

201 returns a `Fine` (same shape as in the return response). Errors: 400 `validation_error` (this loan already has a fine for that reason); 409 `fine_already_settled` on `pay` or `waive` for a fine that is not `UNPAID`.

### 4.6 Reservations

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/reservations/` | Auth (members: own) | |
| POST | `/reservations/` | Auth | Members reserve for themselves; staff may pass `member_id` |
| GET | `/reservations/{id}/` | Owner/Staff | |
| POST | `/reservations/{id}/cancel/` | Owner/Staff | Empty body |

Filters: `status` (`PENDING`, `READY`, `FULFILLED`, `CANCELLED`, `EXPIRED`), `active` (`true` means `PENDING` or `READY`), `member`, `book`. Ordering: `created_at` (default), `-created_at`.

**POST /reservations/**

```json
{
  "book_id": 12
}
```

201:

```json
{
  "id": 15,
  "member": {"id": 7, "email": "ana@example.com", "full_name": "Ana Silva", "member_number": "M-000007"},
  "book": {
    "id": 12,
    "title": "Clean Architecture",
    "isbn": "9780134494166",
    "cover_image": "https://lms.example.com/media/covers/2026/11/clean-architecture.jpg"
  },
  "status": "PENDING",
  "queue_position": 2,
  "notified_at": null,
  "expires_at": null,
  "loan_id": null,
  "created_at": "2026-11-04T05:20:00Z"
}
```

Errors, all 409:

| code | Condition |
|---|---|
| `book_available` | Copies are available right now; borrow the book instead of reserving it |
| `already_reserved` | The member already has a `PENDING` or `READY` reservation for this book |
| `already_borrowed` | The member currently has this book on loan |
| `member_blocked` | The member cannot borrow |

The FIFO queue is ordered by `(created_at, id)`. `queue_position` is the 1-based place among `PENDING` reservations and `null` for every other status.

**Notification flow.** When a copy is returned and a reservation reaches the front, it becomes `READY` with `notified_at` set and `expires_at` set to now plus `reservation_hold_hours`. The email is sent through Django's email backend (console backend in development, which is the "email stub"). If the member does not pick the book up before `expires_at`, a scheduled `expire_reservations` command marks it `EXPIRED` and offers the copy to the next in line. Creating a loan for the held copy marks the reservation `FULFILLED`.

**POST /reservations/15/cancel/** returns the reservation with `status: "CANCELLED"`. If it was `READY`, the held copy is passed to the next person in the queue (or becomes `AVAILABLE`). 409 `reservation_not_active` if it is already closed.

### 4.7 Dashboard

All Librarian+.

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard/summary/` | Headline counters |
| GET | `/dashboard/most-borrowed/` | `days` (default 30, 1 to 365), `limit` (default 10, max 50). Plain array |
| GET | `/dashboard/activity/` | Paginated feed, newest first. Filters: `action`, `member`, `book`, `since` (date) |

**GET /dashboard/summary/** 200:

```json
{
  "books": {"titles": 1240, "copies_total": 3410, "copies_available": 2987},
  "members": {"total": 860, "blocked": 12},
  "loans": {"active": 423, "overdue": 37},
  "reservations": {"pending": 58, "ready": 6},
  "fines": {"unpaid_count": 21, "unpaid_total": "63.50"}
}
```

**GET /dashboard/most-borrowed/?days=30&limit=2** 200:

```json
[
  {
    "book": {
      "id": 12,
      "title": "Clean Architecture",
      "isbn": "9780134494166",
      "cover_image": "https://lms.example.com/media/covers/2026/11/clean-architecture.jpg"
    },
    "loan_count": 18
  },
  {
    "book": {"id": 31, "title": "The Pragmatic Programmer", "isbn": "9780135957059", "cover_image": null},
    "loan_count": 15
  }
]
```

**GET /dashboard/activity/?page_size=1** 200:

```json
{
  "count": 240,
  "page": 1,
  "page_size": 1,
  "total_pages": 240,
  "next": "https://lms.example.com/api/v1/dashboard/activity/?page=2&page_size=1",
  "previous": null,
  "results": [
    {
      "id": 981,
      "action": "LOAN_RETURNED",
      "action_label": "Loan returned",
      "actor": {"id": 2, "email": "kenji@example.com", "full_name": "Kenji Tanaka", "member_number": null},
      "member": {"id": 7, "email": "ana@example.com", "full_name": "Ana Silva", "member_number": "M-000007"},
      "book": {
        "id": 12,
        "title": "Clean Architecture",
        "isbn": "9780134494166",
        "cover_image": "https://lms.example.com/media/covers/2026/11/clean-architecture.jpg"
      },
      "metadata": {"loan_id": 42, "days_overdue": 3},
      "created_at": "2026-11-21T02:30:00Z"
    }
  ]
}
```

### 4.8 Library settings

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/settings/` | Auth | Members need the limits to render renew buttons and due dates |
| PATCH | `/settings/` | Admin | Partial update of the singleton row |

```json
{
  "loan_period_days": 14,
  "renewal_period_days": 14,
  "max_renewals": 2,
  "max_active_loans": 5,
  "fine_per_day": "0.50",
  "reservation_hold_hours": 48,
  "updated_at": "2026-11-04T05:00:00Z"
}
```

---

## 5. Error code catalogue

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `validation_error` | Invalid input; see `field_errors` |
| 400 | `parse_error` | Body is not valid JSON |
| 401 | `not_authenticated` | No credentials supplied |
| 401 | `authentication_failed` | Bad credentials or token |
| 401 | `token_not_valid` | Access or refresh token expired, blacklisted or malformed |
| 401 | `no_active_account` | Login failed (wrong password, unknown email or deactivated account) |
| 403 | `permission_denied` | Authenticated but not allowed (for example a member creating a loan) |
| 404 | `not_found` | No such resource, no such page, or not visible to the caller |
| 405 | `method_not_allowed` | |
| 415 | `unsupported_media_type` | |
| 429 | `throttled` | Too many requests |
| 409 | `member_blocked` | Member has unpaid fines, overdue loans or a manual block |
| 409 | `loan_limit_reached` | Member already has `max_active_loans` open loans |
| 409 | `no_copy_available` | `book_id` given but no copy is `AVAILABLE` |
| 409 | `copy_not_available` | The chosen copy is on loan, lost or damaged |
| 409 | `copy_held_for_other_member` | The copy is held for someone else's reservation |
| 409 | `copy_status_not_editable` | Copy is `ON_LOAN` or `ON_HOLD` |
| 409 | `loan_already_returned` | Renew or return on a closed loan |
| 409 | `loan_overdue` | Renewing an overdue loan |
| 409 | `renewal_limit_reached` | Already renewed `max_renewals` times |
| 409 | `renewal_blocked_by_reservation` | Someone is waiting for the book |
| 409 | `book_available` | Reserving a book that has available copies |
| 409 | `already_reserved` | Duplicate open reservation |
| 409 | `already_borrowed` | Reserving a book the member currently has |
| 409 | `reservation_not_active` | Cancelling a closed reservation |
| 409 | `book_has_active_loans` | Deleting a book that has copies on loan |
| 409 | `category_in_use` | Deleting a category that has books |
| 409 | `author_in_use` | Deleting an author that has books |
| 409 | `fine_already_settled` | Paying or waiving a fine that is not `UNPAID` |
| 500 | `server_error` | Unexpected failure; details are in the server log, not the response |

Services raise 409s with `BusinessRuleError(detail, code=ErrorCode.X)` from `apps/core/exceptions.py`. The exception handler there produces the body shape in 1.5 for every error, including Django `ValidationError` from model validation and unhandled exceptions (when `DEBUG` is off).

---

## 6. Serializer map

| Endpoint | Request serializer | Response serializer |
|---|---|---|
| `POST /auth/register/` | `RegisterSerializer` | `AuthResponseSerializer` |
| `POST /auth/login/` | `LoginSerializer` | `AuthResponseSerializer` |
| `POST /auth/refresh/` | simplejwt `TokenRefreshSerializer` | same |
| `POST /auth/logout/` | `LogoutSerializer` | none |
| `GET /users/`, `GET /users/{id}/`, `GET /users/me/` | none | `UserSerializer` |
| `POST /users/`, `PATCH /users/{id}/` | `UserAdminWriteSerializer` | `UserSerializer` |
| `PATCH /users/me/` | `ProfileUpdateSerializer` | `UserSerializer` |
| `POST /users/me/password/` | `ChangePasswordSerializer` | none |
| `POST /users/{id}/block/` | `BlockUserSerializer` | `UserSerializer` |
| `GET /users/{id}/borrowing-status/` | none | `BorrowingStatusSerializer` |
| `GET /books/` | none | `BookListSerializer` |
| `GET /books/{id}/` | none | `BookDetailSerializer` |
| `POST /books/`, `PATCH /books/{id}/` | `BookWriteSerializer` | `BookDetailSerializer` |
| `GET /books/{id}/copies/` | none | `BookCopySerializer` |
| `POST /books/{id}/copies/` | `BookCopyCreateSerializer` | `BookCopySerializer` |
| `PATCH /copies/{id}/` | `BookCopyUpdateSerializer` | `BookCopySerializer` |
| `/categories/`, `/authors/` | `CategorySerializer`, `AuthorSerializer` | same |
| `GET /loans/...` | none | `LoanSerializer` |
| `POST /loans/` | `LoanCreateSerializer` | `LoanSerializer` |
| `POST /loans/{id}/return/` | `LoanReturnSerializer` | `LoanReturnResponseSerializer` |
| `POST /loans/{id}/renew/` | none | `LoanSerializer` |
| `GET /fines/...` | none | `FineSerializer` |
| `POST /fines/` | `FineCreateSerializer` | `FineSerializer` |
| `POST /fines/{id}/pay/`, `/waive/` | `FineActionSerializer` | `FineSerializer` |
| `GET /reservations/...` | none | `ReservationSerializer` |
| `POST /reservations/` | `ReservationCreateSerializer` | `ReservationSerializer` |
| `GET /dashboard/summary/` | none | `DashboardSummarySerializer` |
| `GET /dashboard/most-borrowed/` | none | `MostBorrowedSerializer` (many) |
| `GET /dashboard/activity/` | none | `ActivityLogSerializer` |
| `/settings/` | `LibrarySettingsSerializer` | same |

Nesting policy: lists and detail views nest at most one level of small summary objects (`UserSummarySerializer`, `BookSummarySerializer`, plus authors and category on books). Anything deeper is a separate endpoint. Serializers only validate and shape data. They never call `save()`; views pass `serializer.validated_data` to a service, which owns the transaction, row locking, counters and activity log.

## 7. Notes for the view and service layer (Step 3)

* **Queryset scoping**: for MEMBER callers, `/loans/`, `/fines/` and `/reservations/` filter by `member=request.user`. Retrieving someone else's record is a 404, not a 403. `IsOwnerOrStaff` still guards object-level access on the nested `/users/{id}/...` routes.
* **N+1**: loan lists need `select_related("member", "copy__book")`; fines need `select_related("loan__member", "loan__copy__book")`; books need `select_related("category").prefetch_related("authors")`.
* **`queue_position`**: annotate on the reservation queryset with a count of earlier `PENDING` reservations for the same book plus one, and only for `PENDING` rows.
* **Concurrency**: loan creation, return and reservation promotion lock the `BookCopy` row (`select_for_update`) inside `transaction.atomic`. The partial unique constraints from the models are the safety net; catch `IntegrityError` and map it to the matching 409.
* **Idempotency**: `return`, `cancel`, `pay` and `waive` on an already-closed record give 409 rather than silently succeeding, so double clicks are visible to the client.
