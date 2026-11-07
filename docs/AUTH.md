# Authentication & permissions

How a request becomes an authenticated user, and how roles decide what that user may do. Companion to `docs/API.md`.

Code map

| Concern | File |
|---|---|
| JWT, DRF and OpenAPI settings | `backend/config/settings/api.py` |
| Permission classes | `backend/apps/core/permissions.py` |
| "Members only see their own rows" | `backend/apps/core/mixins.py` |
| Register / login / refresh / logout views | `backend/apps/users/auth_views.py`, `auth_urls.py` |
| Registration business logic (role, card number) | `backend/apps/users/services/user_service.py` |
| Permission tests (22, no database needed) | `backend/apps/core/tests/test_permissions.py` |

---

## 1. JWT

### Settings (`config/settings/api.py`)

| Setting | Value | Why |
|---|---|---|
| `ACCESS_TOKEN_LIFETIME` | 15 min (`JWT_ACCESS_MINUTES`) | A leaked access token is useful for minutes, not days |
| `REFRESH_TOKEN_LIFETIME` | 7 days (`JWT_REFRESH_DAYS`) | One sign-in a week for regular users |
| `ROTATE_REFRESH_TOKENS` | `True` | Every refresh returns a new refresh token |
| `BLACKLIST_AFTER_ROTATION` | `True` | The old refresh token dies on use; replaying a stolen one fails |
| `SIGNING_KEY` | `JWT_SIGNING_KEY`, default `SECRET_KEY` | Lets you rotate JWT keys independently |
| `DEFAULT_PERMISSION_CLASSES` | `IsAuthenticated` | Secure by default: a view must opt out explicitly |

Requirements: `djangorestframework-simplejwt >= 5.3.1` (earlier versions let a deactivated user refresh), `rest_framework_simplejwt.token_blacklist` in `INSTALLED_APPS`, then `python manage.py migrate`. Schedule `python manage.py flushexpiredtokens` daily, otherwise the blacklist tables grow forever.

### Token contents

Access and refresh tokens carry `user_id` and a custom `role` claim (added in `LoginSerializer.get_token`, also used by register). The claim exists so the frontend can pick a landing page without a `/users/me/` round-trip.

> **The `role` claim is advisory.** Rotation copies claims from the old refresh token, so after an admin changes someone's role the claim is stale until that person logs in again. The backend never trusts it: permissions read `request.user.role` from the database on every request. Never gate anything on the claim.

### Lifecycle

```
client                                   API
  | POST /auth/login/ {email,password}    |
  |-------------------------------------->|  10/min per IP, no auth header needed
  |<-- {access, refresh, user}            |
  |                                       |
  | GET /loans/  Authorization: Bearer A  |
  |-------------------------------------->|  signature, expiry, blacklist, user.is_active
  |<-- 200                                |
  |                                       |
  | ... 15 minutes later ...              |
  | GET /loans/  Bearer A (expired)       |
  |<-- 401 {code: "token_not_valid"}      |
  | POST /auth/refresh/ {refresh: R1}     |  ONE call even if 5 requests got 401
  |<-- {access: A2, refresh: R2}          |  R1 is now blacklisted
  | GET /loans/  Bearer A2   (retry)      |
  |<-- 200                                |
  |                                       |
  | POST /auth/logout/ {refresh: R2}      |
  |<-- 204                                |  R2 blacklisted; A2 expires on its own
```

* **Deactivated users** are cut off immediately: `JWTAuthentication` checks `user.is_active` on every request, so a still-valid access token stops working at once (401). Their refresh tokens stop working too (simplejwt 5.3+).
* **Blocked members** (`is_blocked`, fines, overdue loans) can still log in and browse. Blocking is a *business rule* about borrowing, enforced in the services and answered with 409 `member_blocked`, never an authentication failure.
* The three public auth endpoints set `authentication_classes = []`. Otherwise a client that still sends its expired access token would get a 401 from the very endpoint meant to fix that.
* Logout refuses a refresh token that belongs to a different user (403), so one user cannot revoke another's sessions.

### Error codes you can branch on

| HTTP | `code` | When |
|---|---|---|
| 401 | `not_authenticated` | No `Authorization` header on a protected endpoint |
| 401 | `token_not_valid` | Expired, malformed or blacklisted token (access or refresh) |
| 401 | `no_active_account` | Wrong email/password, or deactivated account |
| 403 | `permission_denied` | Logged in but the role is not allowed |
| 429 | `throttled` | More than 10 auth attempts per minute from one IP |

The frontend interceptor refreshes only on a 401 from a non-auth endpoint, and never on `login`, `register` or `refresh` themselves (a wrong password is also a 401).

---

## 2. Roles and permission classes

Three roles on `User.role`: `ADMIN`, `LIBRARIAN`, `MEMBER`. The checks use this field, not Django's `is_staff`/`is_superuser` (those only matter for `/admin/`). **ADMIN is a superset of LIBRARIAN.**

| Class | Passes when | Level |
|---|---|---|
| `IsAdmin` | role is ADMIN | view |
| `IsLibrarian` | role is LIBRARIAN or ADMIN | view |
| `IsLibrarianOrReadOnly` | safe method (even anonymous), or LIBRARIAN / ADMIN | view |
| `IsOwnerOrStaff` | logged in; the object belongs to the caller, or caller is LIBRARIAN / ADMIN | view + object |

Anonymous users never pass `IsAdmin`, `IsLibrarian` or `IsOwnerOrStaff`.

`IsOwnerOrStaff` finds the owner through a view attribute:

```python
owner_field = "member"        # Loan, Reservation
owner_field = "loan.member"   # Fine (dotted paths work; a missing hop denies instead of crashing)
# unset                       # the object IS the user (/users/{id}/ routes)
```

### Defence in depth: five layers

A request has to survive each layer, and each one answers differently:

| # | Layer | Mechanism | Failure |
|---|---|---|---|
| 1 | Authentication | `JWTAuthentication` | 401 |
| 2 | Default gate | `DEFAULT_PERMISSION_CLASSES = IsAuthenticated` | 401 |
| 3 | Role gate | per-action permission classes (above) | 403 |
| 4 | Row scoping | `MemberScopedQuerysetMixin` filters the queryset for MEMBER callers | 404 |
| 5 | Business rules | services (`assert_can_borrow`, renewal limits...) | 409 |

Row scoping answers **404, not 403**, for someone else's record: a member cannot even confirm that an id exists. `IsOwnerOrStaff.has_object_permission` is the backstop for routes that do not go through a scoped queryset (the nested `/users/{id}/...` routes).

### Applying it in a view

The CRUD views are not part of this step; this is the pattern they follow.

```python
class LoanViewSet(MemberScopedQuerysetMixin, viewsets.GenericViewSet, ...):
    queryset = Loan.objects.select_related("member", "copy__book")
    member_field = "member"          # scoping for MEMBER callers
    owner_field = "member"           # object-level check

    def get_permissions(self):
        if self.action == "create":
            return [IsLibrarian()]                       # only staff lend books
        if self.action == "return_loan":
            return [IsLibrarian()]
        return [IsOwnerOrStaff()]                        # list, retrieve, renew

class BookViewSet(viewsets.ModelViewSet):
    permission_classes = [IsLibrarianOrReadOnly]         # public catalogue, staff writes

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAdmin()]                           # soft delete is admin-only
        return super().get_permissions()
```

Views stay thin: after the permission check they hand `serializer.validated_data` to a service, and the service raises the 409s.

---

## 3. Who can call what

`own` = only the caller's records (other people's are 404). `-` = not allowed.

| Endpoint | Anonymous | MEMBER | LIBRARIAN | ADMIN |
|---|---|---|---|---|
| `POST /auth/register`, `login`, `refresh` | yes | yes | yes | yes |
| `POST /auth/logout` | - | yes | yes | yes |
| `GET /users/` | - | - | members only | all users |
| `POST /users/` | - | - | - | yes |
| `GET /users/me/`, `PATCH /users/me/`, `POST /users/me/password/` | - | yes | yes | yes |
| `GET /users/{id}/`, `/borrowing-status/`, `/loans/` | - | own | any | any |
| `PATCH /users/{id}/` (role, deactivate) | - | - | - | yes |
| `POST /users/{id}/block/`, `/unblock/` | - | - | yes | yes |
| `GET /books/`, `/books/{id}/`, `/categories/`, `/authors/` | yes | yes | yes | yes |
| `POST/PATCH` books, categories, authors | - | - | yes | yes |
| `DELETE` books, categories, authors | - | - | - | yes |
| `GET /books/{id}/copies/`, `/loans/`, `/reservations/` | - | - | yes | yes |
| `POST /books/{id}/copies/`, `PATCH /copies/{id}/` | - | - | yes | yes |
| `GET /loans/`, `/loans/{id}/` | - | own | all | all |
| `POST /loans/` (lend), `POST /loans/{id}/return/` | - | - | yes | yes |
| `POST /loans/{id}/renew/` | - | own loan | any | any |
| `GET /fines/`, `/fines/{id}/` | - | own | all | all |
| `POST /fines/`, `/fines/{id}/pay/` | - | - | yes | yes |
| `POST /fines/{id}/waive/` | - | - | - | yes |
| `GET /reservations/`, `/reservations/{id}/` | - | own | all | all |
| `POST /reservations/` | - | for self | for any member | for any member |
| `POST /reservations/{id}/cancel/` | - | own | any | any |
| `GET /dashboard/*` | - | - | yes | yes |
| `GET /settings/` | - | yes | yes | yes |
| `PATCH /settings/` | - | - | - | yes |

A member sending `member_id` on `POST /reservations/` gets 403 (they may only reserve for themselves).

---

## 4. Security notes and known gaps

* **Refresh token storage (frontend).** The access token lives in memory only; the refresh token is in `localStorage` so a reload keeps the session. That is exposed to any XSS. The stricter alternative is an `HttpOnly; SameSite=Strict` cookie set by the API, at the price of CSRF handling and a different refresh flow. Rotation plus blacklisting limits the damage of a stolen token either way.
* **Password change does not revoke other sessions yet.** Outstanding refresh tokens stay valid until they expire. To revoke them, blacklist every `OutstandingToken` of the user inside the change-password service.
* **CORS** allows only `CORS_ALLOWED_ORIGINS` (default `http://localhost:5173`) and no credentials: tokens travel in the `Authorization` header, never in cookies. Set the production origin explicitly.
* **Throttling.** `ScopedRateThrottle` (scope `auth`, 10/min per IP) replaces the default anon/user throttles on the three public auth endpoints. Behind a reverse proxy configure `NUM_PROXIES` / `X-Forwarded-For` handling, otherwise every user looks like one IP.
* **Registration is always MEMBER.** `register_member` sets the role itself; `RegisterSerializer` does not accept `role`. Staff accounts are created by an admin via `POST /users/` only.
* **Not yet written:** the CRUD views for users, books, loans, fines, reservations and the dashboard. The permission classes, scoping mixin and services they need are in place.
