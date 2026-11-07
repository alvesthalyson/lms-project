from apps.core.exceptions import BusinessRuleError, ErrorCode


class BookUnavailableError(BusinessRuleError):
    """No copy of the book can be lent right now (none free, or the title is withdrawn)."""

    default_code = ErrorCode.NO_COPY_AVAILABLE
    default_detail = "No copy of this book is available."


class CopyNotAvailableError(BusinessRuleError):
    """The specific copy is on loan, lost or damaged."""

    default_code = ErrorCode.COPY_NOT_AVAILABLE
    default_detail = "This copy cannot be lent."


class CopyHeldForOtherMemberError(BusinessRuleError):
    """The copy is on hold for someone else's reservation."""

    default_code = ErrorCode.COPY_HELD_FOR_OTHER_MEMBER
    default_detail = "This copy is being held for another member's reservation."
