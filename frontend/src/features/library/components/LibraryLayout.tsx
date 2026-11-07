import { Outlet, useLocation } from "react-router-dom";

import { Toaster } from "@/components/Toaster";

import "../library.css";
import { FilmGrain } from "./FilmGrain";
import { SceneBackdrop } from "./SceneBackdrop";

/** Navigation state set by the entrance so the hall can fade out the golden light of the dive. */
export interface FromEntranceState {
  fromEntrance?: boolean;
}

/** Shared frame of the hall and the shelves: photo backdrop, film grain, toasts. */
export function LibraryLayout() {
  const location = useLocation();
  const arrived = (location.state as FromEntranceState | null)?.fromEntrance === true;

  return (
    <div className="lib-root">
      <SceneBackdrop />
      <Outlet />
      {arrived && <div className="lib-arrive" aria-hidden />}
      <FilmGrain />
      <Toaster />
    </div>
  );
}
