from datetime import timedelta

import factory
from django.utils import timezone

from apps.books.models import CopyStatus
from apps.books.services.inventory_service import sync_book_counts
from apps.books.tests.factories import BookCopyFactory, BookFactory
from apps.reservations.models import Reservation, ReservationStatus
from apps.users.tests.factories import MemberFactory


class ReservationFactory(factory.django.DjangoModelFactory):
    """A PENDING reservation in the queue of a book (the book has no copies unless you add them)."""

    class Meta:
        model = Reservation
        skip_postgeneration_save = True

    member = factory.SubFactory(MemberFactory)
    book = factory.SubFactory(BookFactory)
    status = ReservationStatus.PENDING


class ReadyReservationFactory(ReservationFactory):
    """READY: a copy of the book is ON_HOLD for the member for the next 48 hours."""

    status = ReservationStatus.READY
    held_copy = factory.SubFactory(
        BookCopyFactory, book=factory.SelfAttribute("..book"), status=CopyStatus.ON_HOLD
    )
    notified_at = factory.LazyFunction(timezone.now)
    expires_at = factory.LazyFunction(lambda: timezone.now() + timedelta(hours=48))

    @factory.post_generation
    def sync_counts(self, create, extracted, **kwargs):
        if create:
            sync_book_counts(self.book_id)
