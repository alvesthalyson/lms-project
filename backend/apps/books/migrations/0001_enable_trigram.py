"""Enable the PostgreSQL pg_trgm extension.

The GIN trigram indexes on book titles and author names (`gin_trgm_ops`) need it, so this migration
must run BEFORE the one that creates the tables. It is idempotent (`CREATE EXTENSION IF NOT EXISTS`),
so it is harmless where docker/postgres/init-extensions.sh already installed it. Running it from a
migration also covers managed databases and the throw-away database that pytest creates.

`python manage.py makemigrations` generates the next migration (0002_initial) on top of this one.
"""
from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies: list[tuple[str, str]] = []

    operations = [TrigramExtension()]
