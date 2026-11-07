#!/bin/sh
# Runs once, when the Postgres data volume is first created (docker-entrypoint-initdb.d).
# pg_trgm powers the trigram indexes on book titles and author names. Installing it in
# template1 as well means the throwaway databases that pytest-django creates get it too.
set -e

for db in template1 "$POSTGRES_DB"; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" \
    -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
done
