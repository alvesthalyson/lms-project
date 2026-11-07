#!/bin/sh
# Container entrypoint: optionally apply migrations, then run the command.
#   DJANGO_MIGRATE=1  apply migrations on start (the dev compose file sets it)
# In production, run migrations as an explicit release step instead:
#   docker compose run --rm backend python manage.py migrate
set -e

if [ "${DJANGO_MIGRATE:-0}" = "1" ]; then
  echo "Applying database migrations..."
  python manage.py migrate --noinput
fi

exec "$@"
