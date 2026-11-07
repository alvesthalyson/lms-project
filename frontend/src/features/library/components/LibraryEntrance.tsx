import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

import { createWoodTexture } from "../art/canvas";
import { paintFrame, archPathData } from "../art/frame";
import { computeNookGeometry, parallaxOffsets, type NookGeometry } from "../art/geometry";
import { paintInterior, type InteriorLayers } from "../art/interior";
import { createRng } from "../art/random";
import { paintRoom } from "../art/room";
import { copy } from "../copy";
import "../library.css";
import { FilmGrain } from "./FilmGrain";
import type { FromEntranceState } from "./LibraryLayout";

/** Timeline of the dive, in ms. Matches the CSS transition (2.3s) on .lib-estage. */
const FLASH_AT = 1500;
const ARRIVE_AT = 2150;
const MOTE_COUNT = 26;

function readViewport(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Mote {
  left: number;
  top: number;
  style: Record<string, string>;
}

/** Warm dust floating in the light around the nook. Deterministic for a given geometry. */
function makeMotes(g: NookGeometry): Mote[] {
  const rand = createRng(5);
  return Array.from({ length: MOTE_COUNT }, () => ({
    left: g.nook.x - g.nook.width * 0.4 + rand() * g.nook.width * 1.8,
    top: g.nook.y + rand() * g.nook.height * 0.95,
    style: {
      "--s": `${2 + rand() * 3}px`,
      "--d": `${8 + rand() * 9}s`,
      "--b": `${3 + rand() * 4}s`,
      "--delay": `${-rand() * 12}s`,
      "--x2": `${(rand() - 0.5) * 120}px`,
      "--y2": `${(rand() - 0.9) * 140}px`,
    },
  }));
}

/**
 * The front door of the app: a lit book-nook between real books, painted on canvas.
 * Clicking the light (or the opening) dives into it and lands on the hall of shelves.
 */
export function LibraryEntrance() {
  const navigate = useNavigate();
  const [geometry, setGeometry] = useState<NookGeometry>(() => {
    const { width, height } = readViewport();
    return computeNookGeometry(width, height);
  });
  const [entering, setEntering] = useState(false);
  const [flash, setFlash] = useState(false);

  const roomRef = useRef<HTMLDivElement>(null);
  const interiorRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<InteriorLayers | null>(null);
  const enteringRef = useRef(false);
  const timers = useRef<number[]>([]);

  // The wood textures are expensive to compute (per-pixel noise): do it once, not on every resize.
  const woods = useMemo(() => ({ frame: createWoodTexture(480, 720, 7), boards: createWoodTexture(640, 360, 3) }), []);
  const motes = useMemo(() => makeMotes(geometry), [geometry]);

  // Re-layout when the window changes size (debounced: repainting the canvases is not free).
  useEffect(() => {
    let timer = 0;
    const onResize = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const { width, height } = readViewport();
        setGeometry(computeNookGeometry(width, height));
      }, 220);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Paint the bookshelf, the little library and the frame whenever the geometry changes.
  useEffect(() => {
    const room = roomRef.current;
    const interior = interiorRef.current;
    const frame = frameRef.current;
    if (!room || !interior || !frame) return;
    const { viewport, nook, opening, margin } = geometry;

    room.replaceChildren(
      paintRoom(
        { width: viewport.width, height: viewport.height, nookX: nook.x, nookY: nook.y, nookWidth: nook.width, nookHeight: nook.height },
        woods.boards,
      ),
    );

    const layers = paintInterior(opening.width, opening.height, margin);
    const blur = ["blur(1.6px)", "blur(.5px)", "none"] as const;
    layers.forEach((canvas, i) => {
      canvas.style.left = `${opening.x - margin}px`;
      canvas.style.top = `${opening.y - margin}px`;
      canvas.style.filter = blur[i] ?? "none";
    });
    interior.replaceChildren(...layers);
    layersRef.current = layers;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    frame.width = Math.round(nook.width * dpr);
    frame.height = Math.round(nook.height * dpr);
    paintFrame(frame, nook.width, nook.height, opening, woods.frame);
  }, [geometry, woods]);

  // Parallax: each interior layer slides by a different amount, which gives the nook its depth.
  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      const layers = layersRef.current;
      if (!layers || enteringRef.current) return;
      const px = (event.clientX / window.innerWidth - 0.5) * 2;
      const py = (event.clientY / window.innerHeight - 0.5) * 2;
      parallaxOffsets(px, py).forEach((o, i) => {
        const layer = layers[i];
        if (layer) layer.style.transform = `translate(${o.x}px, ${o.y}px)`;
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const enter = useCallback((): void => {
    if (enteringRef.current) return;
    enteringRef.current = true;
    const state: FromEntranceState = { fromEntrance: true };
    if (prefersReducedMotion()) {
      navigate("/hall", { state });
      return;
    }
    setEntering(true);
    timers.current.push(window.setTimeout(() => setFlash(true), FLASH_AT));
    timers.current.push(window.setTimeout(() => navigate("/hall", { state }), ARRIVE_AT));
  }, [navigate]);

  const { nook, opening, viewport } = geometry;
  const archClip = useMemo(() => `path('${archPathData(opening)}')`, [opening]);
  const clipStyle = { width: nook.width, height: nook.height, clipPath: archClip, WebkitClipPath: archClip } as const;
  const transformOriginY = ((nook.y + nook.height * 0.46) / viewport.height) * 100;
  const bottom = opening.y + opening.height;

  return (
    <div className="lib-entrance" data-entering={entering}>
      <div className="lib-estage" style={{ transformOrigin: `50% ${transformOriginY}%` }}>
        <div ref={roomRef} className="lib-room" aria-hidden />
        <div className="lib-motes" aria-hidden>
          {motes.map((m, i) => (
            <span key={i} className="lib-ff" style={{ left: m.left, top: m.top, ...m.style } as CSSProperties} />
          ))}
        </div>

        <div className="lib-nook" style={{ top: nook.y, width: nook.width, height: nook.height }}>
          <div ref={interiorRef} className="lib-interior" style={clipStyle} aria-hidden />
          <div className="lib-bloom" style={clipStyle} aria-hidden />
          <canvas ref={frameRef} className="lib-frame" style={{ width: nook.width, height: nook.height }} aria-hidden />
          <button type="button" className="lib-portal" style={clipStyle} onClick={enter} aria-label={copy.entrance.enterLabel} />
          <div className="lib-hoverglow" style={clipStyle} aria-hidden />
          <button
            type="button"
            className="lib-switch"
            style={{ left: nook.width / 2, top: bottom + (nook.height - bottom) * 0.55, width: Math.max(18, nook.width * 0.055) }}
            onClick={enter}
            aria-label={copy.entrance.switchLabel}
          />
        </div>
        <div className="lib-evig" aria-hidden />
      </div>

      <div className="lib-etitle">
        <h1>{copy.name}</h1>
        <p>{copy.entrance.tagline}</p>
      </div>
      <div className="lib-ehint">{copy.entrance.hint}</div>
      <div className="lib-flash" data-on={flash} aria-hidden />
      <FilmGrain />
    </div>
  );
}
