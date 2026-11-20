import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks";
import { useLoans } from "@/features/loans/hooks";
import type { Loan } from "@/features/loans/types";
import { useT } from "@/lib/i18n/useT";

interface HourglassDialogProps {
  onClose: () => void;
}

/** Whole days from today (local) to a YYYY-MM-DD due date: negative when it has passed. */
export function daysUntil(due: string, now: Date = new Date()): number {
  const [y, m, d] = due.split("-").map(Number);
  const dueDay = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueDay - today) / 86_400_000);
}

/**
 * The hourglass on the second floor: the reader's open loans, the late ones first, each with how many
 * days are left. Visitors are asked to sign in. Modal dialog: Esc, the X button and a click outside close it.
 */
export function HourglassDialog({ onClose }: HourglassDialogProps) {
  const { t, lang } = useT();
  const { user } = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);
  const mine = user ? { member: user.id, ordering: "due_date" as const, page_size: 50 } : null;
  const overdue = useLoans({ ...mine, status: "overdue" }, { enabled: mine !== null });
  const active = useLoans({ ...mine, status: "active" }, { enabled: mine !== null });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);

  const late = overdue.data?.results ?? [];
  const onTime = active.data?.results ?? [];
  const failed = overdue.isError || active.isError;
  const loading = !!user && !failed && (overdue.isLoading || active.isLoading);
  const empty = !!user && !failed && !loading && late.length === 0 && onTime.length === 0;
  const date = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long" });

  const when = (loan: Loan): string => {
    const days = daysUntil(loan.due_date);
    if (loan.status === "overdue" || days < 0) {
      const n = loan.days_overdue || Math.abs(days);
      return n === 1 ? t("hourglass.lateOne") : t("hourglass.late", { n });
    }
    if (days === 0) return t("hourglass.today");
    if (days === 1) return t("hourglass.tomorrow");
    return t("hourglass.inDays", { n: days });
  };

  const row = (loan: Loan, late: boolean) => {
    const [y, m, d] = loan.due_date.split("-").map(Number);
    return (
      <li key={loan.id} className={late ? "hg-row hg-row--late" : "hg-row"}>
        <span className="hg-book">{loan.book.title}</span>
        <span className="hg-when">{when(loan)}</span>
        <span className="hg-date">{date.format(new Date(y, m - 1, d))}</span>
      </li>
    );
  };

  return (
    <div className="hm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="hm-panel hg-panel" role="dialog" aria-modal="true" aria-labelledby="hg-title">
        <button ref={closeRef} type="button" className="hm-close" onClick={onClose} aria-label={t("hourglass.close")}>
          ×
        </button>
        <div className="hg-body">
          <header>
            <p className="hm-kicker">{t("hourglass.kicker")}</p>
            <h2 id="hg-title">{t("hourglass.title")}</h2>
            <p className="gl-hint">{t("hourglass.hint")}</p>
          </header>

          {!user && (
            <p className="gl-status">
              {t("hourglass.signIn")}{" "}
              <Link to="/login" state={{ from: { pathname: "/" } }} className="hm-pill">
                {t("hourglass.signInLink")}
              </Link>
            </p>
          )}
          {loading && (
            <p className="gl-status" role="status">
              {t("hourglass.loading")}
            </p>
          )}
          {failed && (
            <p className="gl-status" role="alert">
              {t("hourglass.error")}{" "}
              <button type="button" className="hm-pill" onClick={() => { void overdue.refetch(); void active.refetch(); }}>
                {t("shelf.retry")}
              </button>
            </p>
          )}
          {empty && (
            <p className="gl-status" role="status">
              {t("hourglass.empty")}
            </p>
          )}

          {late.length > 0 && (
            <section aria-label={t("hourglass.overdue")}>
              <h3 className="hg-heading hg-heading--late">{t("hourglass.overdue")}</h3>
              <ul className="hg-list">{late.map((loan) => row(loan, true))}</ul>
            </section>
          )}
          {onTime.length > 0 && (
            <section aria-label={t("hourglass.onTime")}>
              <h3 className="hg-heading">{t("hourglass.onTime")}</h3>
              <ul className="hg-list">{onTime.map((loan) => row(loan, false))}</ul>
            </section>
          )}

          {user && (
            <Link to="/loans" className="hm-pill hg-all">
              {t("hourglass.all")}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
