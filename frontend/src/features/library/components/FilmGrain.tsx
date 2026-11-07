import { useMemo } from "react";

import { createGrainTile } from "../art/canvas";

/** Very light animated film grain over the whole screen: takes the "digital" look off the interface. */
export function FilmGrain() {
  const tile = useMemo(() => createGrainTile(256), []);
  return <div className="lib-grain" aria-hidden style={{ backgroundImage: `url(${tile})` }} />;
}
