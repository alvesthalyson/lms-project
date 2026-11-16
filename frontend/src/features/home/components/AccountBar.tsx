import { Link } from "react-router-dom";

import { isStaff } from "@/features/auth/access";
import { useAuth } from "@/features/auth/hooks";
import { LANGUAGES, LANGUAGE_NAMES, type Lang } from "@/lib/i18n/dictionaries";
import { usePrefs } from "@/lib/i18n/store";
import { useT } from "@/lib/i18n/useT";

/** After signing in or registering on the account pages, come back to the library. */
const BACK_TO_HOME = { from: { pathname: "/" } };

/**
 * Small glass bar in the top-right corner of the Home: sign in / join for visitors, and for members
 * the shortcuts to their loans, reservations and fines (staff also get the dashboard).
 */
/** Language picker and light/dark switch. They also work for visitors, so they sit in every state of the bar. */
function Preferences() {
  const { t, lang } = useT();
  const theme = usePrefs((s) => s.theme);
  const setLang = usePrefs((s) => s.setLang);
  const setTheme = usePrefs((s) => s.setTheme);
  return (
    <>
      <select
        className="hm-pill hm-pill--ghost hm-lang"
        aria-label={t("prefs.language")}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
      <button type="button" className="hm-pill hm-pill--ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        {theme === "dark" ? t("prefs.toLight") : t("prefs.toDark")}
      </button>
    </>
  );
}

export function AccountBar() {
  const { status, user, logout } = useAuth();
  const { t } = useT();

  if (status === "loading") return null;

  if (!user) {
    return (
      <nav className="hm-account" aria-label={t("account.label")}>
        <Link to="/login" state={BACK_TO_HOME} className="hm-pill">
          {t("account.signIn")}
        </Link>
        <Link to="/register" state={BACK_TO_HOME} className="hm-pill hm-pill--portal">
          {t("account.signUp")}
        </Link>
        <Preferences />
      </nav>
    );
  }

  return (
    <nav className="hm-account" aria-label={t("account.label")}>
      <span className="hm-hello">{t("account.hello", { name: user.first_name || user.email })}</span>
      <Link to="/loans" className="hm-pill">
        {t("account.loans")}
      </Link>
      <Link to="/reservations" className="hm-pill">
        {t("account.reservations")}
      </Link>
      <Link to="/fines" className="hm-pill">
        {t("account.fines")}
      </Link>
      {isStaff(user) && (
        <Link to="/dashboard" className="hm-pill hm-pill--portal">
          {t("account.dashboard")}
        </Link>
      )}
      <button type="button" className="hm-pill hm-pill--ghost" onClick={() => void logout()}>
        {t("account.signOut")}
      </button>
      <Preferences />
    </nav>
  );
}
