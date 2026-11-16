interface StarsProps {
  value: number | null;
  count?: number;
  size?: "sm" | "md";
}

import { useT } from "@/lib/i18n/useT";

/** Read-only rating: five stars, filled up to the (rounded) average, with an accessible text. */
export function Stars({ value, count, size = "sm" }: StarsProps) {
  const { t, lang } = useT();
  const rounded = value === null ? 0 : Math.round(Number(value));
  const shown = value === null ? "" : Number(value).toFixed(1).replace(".", lang === "pt" ? "," : ".");
  const label =
    value === null
      ? t("stars.none")
      : count !== undefined
        ? t("stars.valueCount", { v: shown, n: count })
        : t("stars.value", { v: shown });
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
