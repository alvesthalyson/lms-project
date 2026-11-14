interface StarsProps {
  value: number | null;
  count?: number;
  size?: "sm" | "md";
}

/** Read-only rating: five stars, filled up to the (rounded) average, with an accessible text. */
export function Stars({ value, count, size = "sm" }: StarsProps) {
  const rounded = value === null ? 0 : Math.round(Number(value));
  const label =
    value === null
      ? "Ainda sem avaliações"
      : `Nota ${Number(value).toFixed(1).replace(".", ",")} de 5${count !== undefined ? ` (${count})` : ""}`;
  return (
    <span className={`sh-stars sh-stars--${size}`} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden data-on={n <= rounded}>
          ★
        </span>
      ))}
      {count !== undefined && count > 0 && <small aria-hidden>({count})</small>}
    </span>
  );
}
