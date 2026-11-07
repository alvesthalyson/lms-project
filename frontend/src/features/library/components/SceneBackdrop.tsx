import { useEffect, useRef } from "react";

import { paintHall } from "../art/hall";

/**
 * The painted hall that sits behind the interface: a legibility gradient, a soft blur only at the
 * screen edges (depth of field), and a slowly breathing golden glow from the window.
 * The painting is generated once (it is expensive) and reused while the user moves between pages.
 */
let cached: HTMLCanvasElement | null = null;

export function SceneBackdrop() {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = holder.current;
    if (!node) return;
    cached ??= paintHall();
    cached.className = "lib-paint";
    node.replaceChildren(cached);
  }, []);

  return (
    <div className="lib-scene" aria-hidden>
      <div ref={holder} className="lib-cover" />
      <div className="lib-shade" />
      <div className="lib-glow" />
      <div className="lib-dof" />
      <div className="lib-vignette" />
    </div>
  );
}
