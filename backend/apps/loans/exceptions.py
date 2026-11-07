from apps.core.exceptions import BusinessRuleError, ErrorCode


class LoanAlreadyReturnedError(BusinessRuleError):
    default_code = ErrorCode.LOAN_ALREADY_RETURNED
    default_detail = "This loan has already been returned."


class LoanOverdueError(BusinessRuleError):
    """Overdue loans cannot be renewed; they must be returned."""

    default_code = ErrorCode.LOAN_OVERDUE
    default_detail = "This loan is overdue and cannot be renewed."


class RenewalLimitReachedError(BusinessRuleError):
    default_code = ErrorCode.RENEWAL_LIMIT_REACHED
    default_detail = "This loan has reached the maximum number of renewals."


class RenewalBlockedByReservationError(BusinessRuleError):
    default_code = ErrorCode.RENEWAL_BLOCKED_BY_RESERVATION
    default_detail = "Another member is waiting for this book, so it cannot be renewed."
