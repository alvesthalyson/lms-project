from apps.core.exceptions import BusinessRuleError, ErrorCode


class MemberBlockedError(BusinessRuleError):
    """Manual block, unpaid fines or overdue loans."""

    default_code = ErrorCode.MEMBER_BLOCKED
    default_detail = "This member is not allowed to borrow."


class LoanLimitReachedError(BusinessRuleError):
    """The member already has max_active_loans open loans."""

    default_code = ErrorCode.LOAN_LIMIT_REACHED
    default_detail = "This member has reached the maximum number of active loans."
