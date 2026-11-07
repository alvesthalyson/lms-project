/** Strip spaces and hyphens and upper-case, exactly as the backend's ISBNField does. */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Checksum validation of a normalised ISBN-10 or ISBN-13 (mirrors `is_valid_isbn`
 * in backend/apps/books/serializers.py, so the form rejects what the API would).
 */
export function isValidIsbn(value: string): boolean {
  if (/^\d{13}$/.test(value)) {
    let total = 0;
    for (let i = 0; i < 12; i++) total += Number(value[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (total % 10)) % 10 === Number(value[12]);
  }

  if (/^\d{9}[\dX]$/.test(value)) {
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const digit = value[i] === "X" ? 10 : Number(value[i]);
      total += (10 - i) * digit;
    }
    return total % 11 === 0;
  }

  return false;
}
