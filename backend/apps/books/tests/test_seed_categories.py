import pytest
from django.core.management import call_command

from apps.books.management.commands.seed_categories import DEFAULT_CATEGORIES
from apps.books.models import Category


@pytest.mark.django_db
def test_seed_creates_every_default_category_with_a_slug():
    call_command("seed_categories")
    assert Category.objects.count() == len(DEFAULT_CATEGORIES)
    assert Category.objects.get(name="Programação").slug == "programacao"


@pytest.mark.django_db
def test_seed_is_idempotent_and_keeps_existing_rows():
    existing = Category.objects.create(name="Ficção", slug="ficcao")
    call_command("seed_categories")
    call_command("seed_categories")
    assert Category.objects.count() == len(DEFAULT_CATEGORIES)
    assert Category.objects.get(slug="ficcao").pk == existing.pk
