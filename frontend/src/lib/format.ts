/** Format an ISO timestamp or a plain `YYYY-MM-DD` date for display in the user's locale. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  // A bare date must be read as local time, otherwise it shifts a day in negative UTC offsets.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}
