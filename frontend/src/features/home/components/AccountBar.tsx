import { Link } from "react-router-dom";

import { isStaff } from "@/features/auth/access";
import { useAuth } from "@/features/auth/hooks";

/** After signing in or registering on the account pages, come back to the library. */
const BACK_TO_HOME = { from: { pathname: "/" } };

/**
 * Small glass bar in the top-right corner of the Home: sign in / join for visitors, and for members
 * the shortcuts to their loans, reservations and fines (staff also get the dashboard).
 */
export function AccountBar() {
  const { status, user, logout } = useAuth();

  if (status === "loading") return null;

  if (!user) {
    return (
      <nav className="hm-account" aria-label="Conta">
        <Link to="/login" state={BACK_TO_HOME} className="hm-pill">
          Entrar
        </Link>
        <Link to="/register" state={BACK_TO_HOME} className="hm-pill hm-pill--portal">
          Criar conta
        </Link>
      </nav>
    );
  }

  return (
    <nav className="hm-account" aria-label="Conta">
      <span className="hm-hello">Olá, {user.first_name || user.email}</span>
      <Link to="/loans" className="hm-pill">
        Meus empréstimos
      </Link>
      <Link to="/reservations" className="hm-pill">
        Reservas
      </Link>
      <Link to="/fines" className="hm-pill">
        Multas
      </Link>
      {isStaff(user) && (
        <Link to="/dashboard" className="hm-pill hm-pill--portal">
          Painel
        </Link>
      )}
      <button type="button" className="hm-pill hm-pill--ghost" onClick={() => void logout()}>
        Sair
      </button>
    </nav>
  );
}
