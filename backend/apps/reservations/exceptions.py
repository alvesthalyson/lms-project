from apps.core.exceptions import BusinessRuleError, ErrorCode


class BookAvailableError(BusinessRuleError):
    """Reserving a book that has copies on the shelf; it should be borrowed instead."""

    default_code = ErrorCode.BOOK_AVAILABLE
    default_detail = "Copies of this book are available. Borrow it instead of reserving it."


class AlreadyReservedError(BusinessRuleError):
    default_code = ErrorCode.ALREADY_RESERVED
    default_detail = "This member already has an open reservation for this book."


class AlreadyBorrowedError(BusinessRuleError):
    default_code = ErrorCode.ALREADY_BORROWED
    default_detail = "This member currently has this book on loan."


class ReservationNotActiveError(BusinessRuleError):
    default_code = ErrorCode.RESERVATION_NOT_ACTIVE
    default_detail = "This reservation is no longer active."
