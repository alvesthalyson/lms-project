"""ISBN helpers shared by the serializers and the Open Library import."""

from __future__ import annotations

import re


def normalize_isbn(raw: str | None) -> str:
    """'978-0-13-449416-6' -> '9780134494166' (spaces and hyphens out, upper-case)."""
    return re.sub(r"[\s-]", "", raw or "").upper()


def is_valid_isbn(value: str) -> bool:
    """Checksum validation for a normalised ISBN-10 / ISBN-13 (no hyphens, upper-case)."""
    if re.fullmatch(r"\d{13}", value):
        total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(value[:12]))
        return (10 - total % 10) % 10 == int(value[12])
    if re.fullmatch(r"\d{9}[\dX]", value):
        total = sum((10 - i) * (10 if d == "X" else int(d)) for i, d in enumerate(value))
        return total % 11 == 0
    return False


def to_isbn13(value: str) -> str | None:
    """The ISBN-13 form of a valid ISBN-10 or ISBN-13; None when `value` is not a valid ISBN."""
    value = normalize_isbn(value)
    if not is_valid_isbn(value):
        return None
    if len(value) == 13:
        return value
    body = "978" + value[:9]
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(body))
    return body + str((10 - total % 10) % 10)


def to_isbn10(isbn13: str) -> str | None:
    """The ISBN-10 twin of a 978-prefixed ISBN-13 (979 has none)."""
    if not re.fullmatch(r"978\d{10}", isbn13 or ""):
        return None
    body = isbn13[3:12]
    total = sum((10 - i) * int(d) for i, d in enumerate(body))
    check = (11 - total % 11) % 11
    return body + ("X" if check == 10 else str(check))
