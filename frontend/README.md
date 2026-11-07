# LMS frontend

React 18 + TypeScript + Vite, Tailwind CSS 3 with hand-written shadcn/ui-style components, TanStack Query v5, Zustand, React Router v6, React Hook Form + Zod, Vitest + Testing Library.

## Run

```bash
cp .env.example .env        # VITE_API_URL=http://localhost:8000/api/v1
npm install
npm run dev                 # http://localhost:5173
npm test                    # vitest run
npm run build               # tsc --noEmit && vite build
```

The backend must allow the dev origin (`CORS_ALLOWED_ORIGINS`, default `http://localhost:5173`).

## Structure

```
src/
  api/             axios client, auth interceptors (single-flight refresh), ApiError parsing, shared types
  app/             router
  components/      layout, Pagination, FormField, Toaster, ui/ (button, input, dialog, badge, select, ...)
  features/
    auth/          tokenStore (Zustand), AuthContext, ProtectedRoute, access rules, LoginPage
    books/         api, hooks, schemas (Zod), filters (URL state), components/, pages/BooksListPage
    loans/         api, hooks (useLoans, useCreateLoan, useReturnLoan, useRenewLoan), LoansPage
    reservations/  api, hooks (useReserveBook, useCancelReservation)
  lib/             env, cn, query client, toast, form-error mapping
  test/            vitest setup
```

Each feature owns its `api.ts` (HTTP only), `hooks.ts` (React Query), `types.ts`, and its components and pages. Server state lives only in React Query; Zustand holds the tokens.

## Auth in one paragraph

The access token is kept in memory, the refresh token in `localStorage` (guarded by try/catch). The request interceptor adds `Authorization: Bearer`. On a 401 from a non-auth endpoint, the response interceptor refreshes **once** (concurrent 401s share one in-flight promise, because the API rotates and blacklists refresh tokens), stores the new pair and retries the request. If the refresh fails the tokens are cleared and `AuthProvider` sends the user to `/login`. See `docs/AUTH.md`.

## Status

The code was written and reviewed, but **not installed or executed yet**: the environment it was written in could not reach the npm registry. Before relying on it, run `npm install && npm run build && npm test` and fix whatever the compiler or the 7 unit test files report. Component-level tests (BooksListPage, ProtectedRoute rendering) are not written yet.
