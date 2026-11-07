import pytest

from apps.core.models import LibrarySettings
from apps.users.tests.factories import AdminFactory, LibrarianFactory, MemberFactory


@pytest.fixture(autouse=True)
def _isolated_media(settings, tmp_path):
    """Uploaded cover images go to a temp folder, never into the repository."""
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def library_settings(db) -> LibrarySettings:
    """The singleton settings row (defaults: 14-day loans, 2 renewals, 5 loans, 0.50/day).
    Change a field and call .save() inside the test to exercise other rules."""
    return LibrarySettings.load()


@pytest.fixture
def member(db):
    return MemberFactory()


@pytest.fixture
def librarian(db):
    return LibrarianFactory()


@pytest.fixture
def admin(db):
    return AdminFactory()
