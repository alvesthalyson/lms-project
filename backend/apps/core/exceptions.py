import logging

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


class ErrorCode:
    """Machine-readable codes the frontend can switch on."""

    VALIDATION_ERROR = "validation_error"
    SERVER_ERROR = "server_error"

    # Borrowing eligibility
    MEMBER_BLOCKED = "member_blocked"
    LOAN_LIMIT_REACHED = "loan_limit_reached"

    # Loans and copies
    NO_COPY_AVAILABLE = "no_copy_available"
    COPY_NOT_AVAILABLE = "copy_not_available"
    COPY_HELD_FOR_OTHER_MEMBER = "copy_held_for_other_member"
    COPY_STATUS_NOT_EDITABLE = "copy_status_not_editable"
    LOAN_ALREADY_RETURNED = "loan_already_returned"
    LOAN_OVERDUE = "loan_overdue"
    RENEWAL_LIMIT_REACHED = "renewal_limit_reached"
    RENEWAL_BLOCKED_BY_RESERVATION = "renewal_blocked_by_reservation"

    # Reservations
    BOOK_AVAILABLE = "book_available"
    ALREADY_RESERVED = "already_reserved"
    ALREADY_BORROWED = "already_borrowed"
    RESERVATION_NOT_ACTIVE = "reservation_not_active"

    # Catalogue
    BOOK_HAS_ACTIVE_LOANS = "book_has_active_loans"
    CATEGORY_IN_USE = "category_in_use"
    AUTHOR_IN_USE = "author_in_use"

    # Fines
    FINE_ALREADY_SETTLED = "fine_already_settled"


class BusinessRuleError(APIException):
    """
    Raised by services when a request is well-formed but not allowed in the
    current state. Always HTTP 409; the code says which rule was hit:

        raise BusinessRuleError(
            "Member has unpaid fines.", code=ErrorCode.MEMBER_BLOCKED
        )
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = "The request conflicts with the current state."
    default_code = "conflict"


def _flatten(detail, path=""):
    """Flatten DRF's nested error structure into {"a.b.0": ["message", ...]}."""
    if not detail:
        return {}
    if isinstance(detail, dict):
        flat = {}
        for key, value in detail.items():
            child = f"{path}.{key}" if path else str(key)
            flat.update(_flatten(value, child))
        return flat
    if isinstance(detail, (list, tuple)):
        if all(isinstance(item, str) for item in detail):
            return {path or "non_field_errors": [str(item) for item in detail]}
        flat = {}
        for index, item in enumerate(detail):
            child = f"{path}.{index}" if path else str(index)
            flat.update(_flatten(item, child))
        return flat
    return {path or "non_field_errors": [str(detail)]}


def api_exception_handler(exc, context):
    """Every error leaves the API as {"detail": str, "code": str, "field_errors": {...}}."""
    if isinstance(exc, DjangoValidationError):
        # Raised by model.full_clean() or by services; treat like a DRF 400.
        exc = ValidationError(
            detail=exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        )

    response = drf_exception_handler(exc, context)

    if response is None:
        if settings.DEBUG:
            return None  # let Django show the traceback in development
        logger.error("Unhandled error in %s", context.get("view"), exc_info=exc)
        return Response(
            {
                "detail": "Internal server error.",
                "code": ErrorCode.SERVER_ERROR,
                "field_errors": {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, ValidationError):
        body = {
            "detail": "One or more fields are invalid.",
            "code": ErrorCode.VALIDATION_ERROR,
            "field_errors": _flatten(response.data),
        }
    else:
        data = response.data
        detail = data.get("detail", "") if isinstance(data, dict) else data
        body = {
            "detail": str(detail),
            "code": getattr(detail, "code", "error"),
            "field_errors": {},
        }

    response.data = body
    return response
