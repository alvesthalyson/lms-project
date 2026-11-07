from datetime import timedelta
from decimal import Decimal

import factory
from django.utils import timezone

from apps.books.models import CopyStatus
from apps.books.services.inventory_service import sync_book_counts
from apps.books.tests.factories import BookCopyFactory
from apps.loans.models import Fine, FineReason, FineStatus, Loan
from apps.users.tests.factories import MemberFactory


class LoanFactory(factory.django.DjangoModelFactory):
    """
    LoanFactory()                     an active loan, due in 14 days, copy ON_LOAN
    LoanFactory(overdue=True)         active, due 3 days ago (so the member is blocked)
    LoanFactory(returned=True)        closed loan, copy back AVAILABLE
    LoanFactory(member=m, ...)        for a specific member
    Book counters are synced after creation.
    """

    class Meta:
        model = Loan
        skip_postgeneration_save = True

    member = factory.SubFactory(MemberFactory)
    copy = factory.SubFactory(BookCopyFactory, status=CopyStatus.ON_LOAN)
    loaned_at = factory.LazyFunction(timezone.now)
    due_date = factory.LazyFunction(lambda: timezone.localdate() + timedelta(days=14))

    class Params:
        overdue = factory.Trait(
            loaned_at=factory.LazyFunction(lambda: timezone.now() - timedelta(days=20)),
            due_date=factory.LazyFunction(lambda: timezone.localdate() - timedelta(days=3)),
        )
        returned = factory.Trait(
            # max(): the DB requires returned_at >= loaned_at, whatever order the two defaults are evaluated in.
            returned_at=factory.LazyAttribute(lambda o: max(timezone.now(), o.loaned_at)),
            copy=factory.SubFactory(BookCopyFactory, status=CopyStatus.AVAILABLE),
        )

    @factory.post_generation
    def sync_counts(self, create, extracted, **kwargs):
        if create:
            sync_book_counts(self.copy.book_id)


class FineFactory(factory.django.DjangoModelFactory):
    """FineFactory(loan__member=m) is an UNPAID overdue fine on a closed loan of member m."""

    class Meta:
        model = Fine

    loan = factory.SubFactory(LoanFactory, returned=True)
    reason = FineReason.OVERDUE
    amount = Decimal("2.00")
    status = FineStatus.UNPAID
