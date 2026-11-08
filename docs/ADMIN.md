# Django admin (`/admin/`)

The back-office for data work: users, catalogue and the loan rules. Day-to-day desk work
(lending, returns, fines, reservations) stays on the site, where the services enforce the rules.

## Signing in

Only users with the **ADMIN** role can open it (`is_staff` / `is_superuser` follow the role, they are not edited by hand).

* Development: `scripts\sprint0.ps1 -Step demo` creates `admin@example.com` (password `Demo-pass-123`),
  a librarian, three members, a few loans (one overdue) and a reservation. It refuses to run unless `DJANGO_DEBUG=true`.
* Any environment: `python manage.py createsuperuser` (the account gets the ADMIN role).

## What each section does

| Section | You can |
|---|---|
| Users | Create, edit, change role, block / unblock (bulk action), search by name, e-mail or card number. New members get their card number automatically. |
| Categories, Authors | Create, edit, search. |
| Books | Create, edit, withdraw / restore (bulk actions). Copies are edited **inside the book**; the book's counters are recomputed on save. Books cannot be deleted, only withdrawn. |
| Book copies | Barcode lookup (read-only). |
| Library settings | Edit the single row: loan period, renewals, loan limit, fine per day, hold hours. |
| Loans, Reservations, Fines, Activity log | Browse and filter only (read-only). Use the site to lend, return, pay fines or cancel reservations. |

Why read-only: a loan, reservation or fine edited by hand can disagree with the copy statuses and the counters.
For the same reason a copy cannot be set to *on loan* / *on hold* (or taken out of those states) from the admin.
