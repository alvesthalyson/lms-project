import { BookOpen, LogOut } from "lucide-react";
import { NavLink, Outlet, Link } from "react-router-dom";

import { Toaster } from "@/components/Toaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks";
import { cn } from "@/lib/cn";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
  );

export function AppLayout() {
  const { status, user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-5 w-5" aria-hidden />
              Library
            </Link>
            <nav aria-label="Main" className="flex gap-1">
              <NavLink to="/hall" className={navLinkClass}>
                Shelves
              </NavLink>
              <NavLink to="/books" className={navLinkClass}>
                Books
              </NavLink>
              {user && (
                <NavLink to="/loans" className={navLinkClass}>
                  Loans
                </NavLink>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden text-sm sm:inline">{user.first_name || user.email}</span>
                <Badge variant="secondary">{user.role}</Badge>
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out
                </Button>
              </>
            ) : (
              status !== "loading" && (
                <Button asChild size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <Toaster />
    </div>
  );
}
