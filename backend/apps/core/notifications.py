import logging

from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def notify_reservation_ready(reservation) -> None:
    """
    Email stub: "your reserved book is ready". The message is built now but
    only sent after the surrounding transaction commits, so a rolled-back
    operation never emails anyone. Development uses Django's console email
    backend; swap EMAIL_BACKEND (or this function) for real delivery.

    `reservation.member`, `.book` and `.expires_at` must be set.
    """
    member = reservation.member
    book = reservation.book
    pickup_until = timezone.localtime(reservation.expires_at)

    subject = f"Your reserved book is ready: {book.title}"
    body = (
        f"Hello {member.get_full_name() or member.email},\n\n"
        f'"{book.title}" is ready for pick-up. '
        f"We will hold it for you until {pickup_until:%Y-%m-%d %H:%M}.\n"
    )
    recipient = member.email
    reservation_id = reservation.pk

    def _send():
        try:
            send_mail(subject, body, None, [recipient])
        except Exception:  # never let email trouble break a committed operation
            logger.exception(
                "Could not send reservation-ready email (reservation %s)", reservation_id
            )

    transaction.on_commit(_send)
