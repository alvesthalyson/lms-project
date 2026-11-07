#!/usr/bin/env bash
# Sprint 0 – "make it run": the first end-to-end run of the whole stack, using Docker only
# (no local Python or Node needed). Run it from the repository root:
#
#     bash scripts/sprint0.sh            # everything
#     bash scripts/sprint0.sh backend    # only the backend steps
#     bash scripts/sprint0.sh frontend   # only the frontend steps
#
# It stops at the first failing step and says which one it was. Send that step's output back
# and it can be fixed. Details of every step: docs/SPRINT0.md
set -Eeuo pipefail

cd "$(dirname "$0")/.."
WHAT="${1:-all}"
COMPOSE="docker compose"

step() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
trap 'printf "\n\033[1;31mFAILED at step: %s\033[0m\n" "${CURRENT:-?}" >&2' ERR
run() { CURRENT="$1"; step "$1"; shift; "$@"; }

prepare() {
  [ -f .env ] || { cp .env.example .env; echo "Created .env from .env.example – set POSTGRES_PASSWORD in it, then run this script again."; exit 1; }
  [ -f backend/.env ] || cp backend/.env.example backend/.env
  grep -Eq '^POSTGRES_PASSWORD=.+' .env || { echo "Set POSTGRES_PASSWORD in .env first."; exit 1; }
}

backend() {
  run "1. validate docker-compose.yml"            $COMPOSE config --quiet
  run "2. build the backend image"                $COMPOSE build backend
  run "3. start PostgreSQL"                       $COMPOSE up -d --wait db
  # books/0001_enable_trigram.py already exists. Without app names, makemigrations skips apps that have no
  # migrations folder yet, so every app is named explicitly (this also creates their folders).
  run "4. generate the migrations"                $COMPOSE run --rm --no-deps -e DJANGO_MIGRATE=0 backend python manage.py makemigrations core users books loans reservations
  run "5. apply the migrations"                   $COMPOSE run --rm backend python manage.py migrate --noinput
  run "6. Django system check"                    $COMPOSE run --rm backend python manage.py check
  run "7. create the default categories"          $COMPOSE run --rm backend python manage.py seed_categories
  run "7b. create demo books"                     $COMPOSE run --rm backend python manage.py seed_demo
  run "8. backend tests (pytest)"                 $COMPOSE run --rm backend pytest -q
}

frontend() {
  run "9. build the frontend image (npm ci/install)" $COMPOSE build frontend
  run "10. typecheck"                             $COMPOSE run --rm --no-deps frontend npm run typecheck
  run "11. unit tests (vitest)"                   $COMPOSE run --rm --no-deps frontend npm test
  run "12. production build"                      $COMPOSE run --rm --no-deps frontend npm run build
}

prepare
case "$WHAT" in
  backend)  backend ;;
  frontend) frontend ;;
  all)      backend; frontend ;;
  *)        echo "usage: $0 [all|backend|frontend]"; exit 2 ;;
esac

step "Done. Start everything with: docker compose up   (site: http://localhost:5173, API docs: http://localhost:8000/api/docs/)"
echo "Remember to commit backend/apps/*/migrations/ and frontend/package-lock.json."
