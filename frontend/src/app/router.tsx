import { Navigate, createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { STAFF_ROLES } from "@/features/auth/access";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { BooksListPage } from "@/features/books/pages/BooksListPage";
import { HomePage } from "@/features/home/pages/HomePage";
import { LibraryEntrance } from "@/features/library/components/LibraryEntrance";
import { LibraryLayout } from "@/features/library/components/LibraryLayout";
import { HallPage } from "@/features/library/pages/HallPage";
import { ShelfPage } from "@/features/library/pages/ShelfPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { FinesPage } from "@/features/fines/pages/FinesPage";
import { LoansPage } from "@/features/loans/pages/LoansPage";
import { ReservationsPage } from "@/features/reservations/pages/ReservationsPage";

/**
 * Route table. `/` is the Library entrance; `/hall` and `/shelf/:slug` are the public browsing experience. The catalogue is public (the API allows anonymous reads); anything
 * that needs a session sits under <ProtectedRoute />. Role-restricted screens would use
 * <ProtectedRoute roles={STAFF_ROLES} /> the same way.
 */
export const router = createBrowserRouter([
  // Home: the point-and-click reading room, full screen, outside every layout.
  { path: "/", element: <HomePage /> },
  // The earlier "lit nook" entrance, kept as an alternative front door.
  { path: "/entrada", element: <LibraryEntrance /> },
  // The hall and the shelves share the photographed backdrop.
  {
    element: <LibraryLayout />,
    children: [
      { path: "hall", element: <HallPage /> },
      { path: "shelf/:slug", element: <ShelfPage /> },
    ],
  },
  // The classic screens ("counter mode"): catalogue management, loans, sign-in.
  {
    element: <AppLayout />,
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "books", element: <BooksListPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "loans", element: <LoansPage /> },
          { path: "reservations", element: <ReservationsPage /> },
          { path: "fines", element: <FinesPage /> },
        ],
      },
      {
        element: <ProtectedRoute roles={STAFF_ROLES} />,
        children: [{ path: "dashboard", element: <DashboardPage /> }],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
